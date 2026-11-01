import { ApiError, mediaUrl, type Api } from '#lib/api.ts';
import { MEDIA_KEYS, type Card } from '#lib/types.ts';
import { type LocalDb, type OutboxEntry } from './db.ts';

export type FlushResult = 'synced' | 'offline' | 'auth';

/**
 * Sends queued changes in the order they were made. Stops at the first one that cannot
 * be sent right now and keeps it (and everything after it) for the next attempt.
 * Every request is idempotent on its id, so resending after a lost response is safe.
 */
export async function flush(ldb: LocalDb, api: Api, onRejected: (message: string) => void): Promise<FlushResult> {
	for (;;) {
		const entry = await ldb.outbox.orderBy('seq').first();
		if (!entry) return 'synced';
		try {
			await send(ldb, api, entry);
		} catch (e) {
			if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500) return 'offline';
			if (e.status === 401) return 'auth';
			// the server will never accept this one (e.g. its deck is gone): drop it so the rest can go through
			onRejected(e.message);
		}
		await ldb.outbox.delete(entry.seq!);
	}
}

async function send(ldb: LocalDb, api: Api, entry: OutboxEntry): Promise<void> {
	switch (entry.kind) {
		case 'deck':
			await api.createDeck(entry.deck);
			return;
		case 'card':
			await sendCard(ldb, api, entry);
			return;
		case 'import':
			await api.importCards(entry.deckId, entry.rows);
			return;
		case 'delete':
			await api.deleteCard(entry.cardId);
			return;
		case 'review': {
			const card = await api.review(entry.review);
			// a later answer may already be applied locally and still queued: keep the newer state
			const queued = await ldb.outbox
				.filter((e) => e.kind === 'review' && e.review.cardId === card.id && e.seq! > entry.seq!)
				.count();
			if (!queued) await ldb.cards.put(card);
			return;
		}
	}
}

async function sendCard(ldb: LocalDb, api: Api, entry: Extract<OutboxEntry, { kind: 'card' }>) {
	const form = new FormData();
	for (const [k, v] of Object.entries(entry.card)) form.set(k, v);
	const blobKeys = Object.values(entry.media);
	for (const key of MEDIA_KEYS) {
		const blobKey = entry.media[key];
		const row = blobKey ? await ldb.blobs.get(blobKey) : undefined;
		if (row) form.set(key, row.blob, key);
	}

	const saved = await api.createCard(form);

	// keep the local copy of the media under its new server name, so it plays offline right away
	if (typeof caches !== 'undefined') {
		const cache = await caches.open('media');
		for (const key of MEDIA_KEYS) {
			const blobKey = entry.media[key];
			const row = blobKey ? await ldb.blobs.get(blobKey) : undefined;
			const name = saved[key];
			if (row && name) {
				await cache.put(mediaUrl(name), new Response(row.blob, { headers: { 'content-type': row.blob.type } }));
			}
		}
	}

	await ldb.transaction('rw', ldb.cards, ldb.blobs, async () => {
		// keep the local card (answers given before the upload are applied to it already);
		// if it is gone, it was deleted on this device meanwhile and the deletion is queued
		const local = await ldb.cards.get(saved.id);
		if (local) await ldb.cards.put({ ...local, ...mediaOf(saved) });
		await ldb.blobs.bulkDelete(blobKeys);
	});
}

const mediaOf = (c: Card) => ({
	frontImage: c.frontImage,
	frontAudio: c.frontAudio,
	backImage: c.backImage,
	backAudio: c.backAudio
});

/**
 * Replaces the local copy with the server's. Skipped if new local changes were queued
 * meanwhile, so nothing made on this device is overwritten before it was sent.
 */
export async function pull(ldb: LocalDb, api: Api): Promise<boolean> {
	const data = await api.load();
	return ldb.transaction('rw', [ldb.decks, ldb.cards, ldb.meta, ldb.outbox], async () => {
		if ((await ldb.outbox.count()) > 0) return false;
		await ldb.decks.clear();
		await ldb.decks.bulkPut(data.decks);
		await ldb.cards.clear();
		await ldb.cards.bulkPut(data.cards);
		await ldb.setMeta('stats', { ...data.stats, day: Date.now() });
		await ldb.setMeta('syncedAt', Date.now());
		return true;
	});
}

/** Downloads media that is not cached yet, so every card works offline. */
export async function prefetchMedia(cards: Card[]): Promise<void> {
	if (typeof caches === 'undefined') return;
	const cache = await caches.open('media');
	const names = new Set(cards.flatMap((c) => MEDIA_KEYS.map((k) => c[k]).filter((n): n is string => !!n)));
	for (const name of names) {
		if (name.startsWith('local:') || (await cache.match(mediaUrl(name)))) continue;
		try {
			const res = await fetch(mediaUrl(name));
			// redirected = sent to the login page: nothing to keep
			if (res.ok && !res.redirected) await cache.put(mediaUrl(name), res);
		} catch {
			return; // offline again: try next time
		}
	}
}
