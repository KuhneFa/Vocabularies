import { api, ApiError, type Api } from './api.ts';
import { newId } from './id.ts';
import { step } from './leitner.ts';
import { LOCAL_MEDIA, LocalDb, type OutboxOp } from './local/db.ts';
import { rollStats, type StoredStats } from './local/stats.ts';
import { flush, prefetchMedia, pull } from './local/sync.ts';
import { toast } from './toast.svelte.ts';
import { MEDIA_KEYS, type Card, type Deck, type MediaKey, type Stats } from './types.ts';

export type SyncState = 'syncing' | 'synced' | 'offline' | 'auth';

const MAX_DURATION_MS = 10 * 60 * 1000;

/**
 * Everything the app shows. Reads and writes go to the device's own database first,
 * so the app works offline; queued changes are sent to the server whenever it is reachable.
 */
export class AppState {
	decks = $state<Deck[]>([]);
	cards = $state<Card[]>([]);
	stats = $state<Stats>({ today: { right: 0, wrong: 0 }, streak: 0 });
	ready = $state(false);
	sync = $state<SyncState>('syncing');
	/** Changes made on this device that the server has not received yet. */
	pending = $state(0);
	/** False until this device has received data from the server once. */
	hasSynced = $state(false);

	readonly ldb: LocalDb;
	#api: Api;
	#running: Promise<void> | null = null;
	#again = false;

	constructor(ldb: LocalDb, serverApi: Api) {
		this.ldb = ldb;
		this.#api = serverApi;
	}

	/** Shows the device's copy, then syncs now and whenever it makes sense. */
	async start() {
		await this.init();
		void this.syncNow();
		window.addEventListener('online', () => void this.syncNow());
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') void this.syncNow();
		});
		setInterval(() => {
			if (document.visibilityState === 'visible') void this.syncNow();
		}, 60_000);
	}

	async init() {
		await this.#readLocal();
		this.ready = true;
	}

	async #readLocal() {
		const [decks, cards, stats, pending, syncedAt] = await Promise.all([
			this.ldb.decks.toArray(),
			this.ldb.cards.toArray(),
			this.ldb.getMeta<StoredStats>('stats'),
			this.ldb.outbox.count(),
			this.ldb.getMeta<number>('syncedAt')
		]);
		this.decks = decks.sort((a, b) => a.createdAt - b.createdAt);
		this.cards = cards.sort((a, b) => a.createdAt - b.createdAt);
		this.stats = rollStats(stats, Date.now());
		this.pending = pending;
		this.hasSynced = !!syncedAt;
	}

	/** Sends queued changes, then takes over the server's state. Calls during a run add one more run. */
	syncNow(): Promise<void> {
		if (this.#running) {
			this.#again = true;
			return this.#running;
		}
		this.#running = (async () => {
			do {
				this.#again = false;
				await this.#syncOnce();
			} while (this.#again);
			this.#running = null;
		})();
		return this.#running;
	}

	async #syncOnce() {
		this.sync = 'syncing';
		const result = await flush(this.ldb, this.#api, (message) =>
			toast.show(`Eine Änderung wurde vom Server abgelehnt: ${message}`, 5000)
		);
		this.pending = await this.ldb.outbox.count();
		if (result !== 'synced') {
			this.sync = result;
			return;
		}
		try {
			if (await pull(this.ldb, this.#api)) await this.#readLocal();
			else this.#again = true; // something new was queued meanwhile
			this.sync = 'synced';
			void prefetchMedia($state.snapshot(this.cards));
		} catch (e) {
			this.sync = e instanceof ApiError && e.status === 401 ? 'auth' : 'offline';
		}
	}

	#queued() {
		this.pending++;
		void this.syncNow();
	}

	deck(id: string) {
		return this.decks.find((d) => d.id === id);
	}

	cardsOf(deckId: string) {
		return this.cards.filter((c) => c.deckId === deckId);
	}

	async createDeck(name: string, languagePair: string): Promise<Deck> {
		const now = Date.now();
		const deck: Deck = { id: newId(), name, languagePair, createdAt: now, updatedAt: now };
		const op: OutboxOp = { kind: 'deck', deck: { id: deck.id, name, languagePair } };
		await this.ldb.transaction('rw', [this.ldb.decks, this.ldb.outbox], async () => {
			await this.ldb.decks.put(deck);
			await this.ldb.outbox.add(op);
		});
		this.decks.push(deck);
		this.#queued();
		return deck;
	}

	async addCard(
		deckId: string,
		front: string,
		back: string,
		media: Partial<Record<MediaKey, Blob | null>>
	): Promise<Card> {
		const now = Date.now();
		const keys: Partial<Record<MediaKey, string>> = {};
		const blobs: { key: string; blob: Blob }[] = [];
		for (const k of MEDIA_KEYS) {
			const blob = media[k];
			if (!blob) continue;
			keys[k] = LOCAL_MEDIA + newId();
			blobs.push({ key: keys[k], blob });
		}
		const card: Card = {
			id: newId(),
			deckId,
			front,
			back,
			frontImage: keys.frontImage ?? null,
			frontAudio: keys.frontAudio ?? null,
			backImage: keys.backImage ?? null,
			backAudio: keys.backAudio ?? null,
			level: 0,
			dueAt: now,
			lastWrongAt: null,
			createdAt: now,
			updatedAt: now
		};
		await this.ldb.transaction('rw', [this.ldb.cards, this.ldb.blobs, this.ldb.outbox], async () => {
			await this.ldb.cards.put(card);
			await this.ldb.blobs.bulkPut(blobs);
			await this.ldb.outbox.add({ kind: 'card', card: { id: card.id, deckId, front, back }, media: keys });
		});
		this.cards.push(card);
		this.#queued();
		return card;
	}

	async importCards(deckId: string, rows: { front: string; back: string }[]): Promise<Card[]> {
		const now = Date.now();
		const cards: Card[] = rows.map((r) => ({
			id: newId(),
			deckId,
			front: r.front,
			back: r.back,
			frontImage: null,
			frontAudio: null,
			backImage: null,
			backAudio: null,
			level: 0,
			dueAt: now,
			lastWrongAt: null,
			createdAt: now,
			updatedAt: now
		}));
		const op: OutboxOp = { kind: 'import', deckId, rows: cards.map(({ id, front, back }) => ({ id, front, back })) };
		await this.ldb.transaction('rw', [this.ldb.cards, this.ldb.outbox], async () => {
			await this.ldb.cards.bulkPut(cards);
			await this.ldb.outbox.add(op);
		});
		this.cards.push(...cards);
		this.#queued();
		return cards;
	}

	async deleteCard(id: string) {
		await this.ldb.transaction('rw', [this.ldb.cards, this.ldb.outbox], async () => {
			await this.ldb.cards.delete(id);
			await this.ldb.outbox.add({ kind: 'delete', cardId: id });
		});
		this.cards = this.cards.filter((c) => c.id !== id);
		this.#queued();
	}

	/** Records an answer: applied to the card right away, sent to the server later. */
	async answer(cardId: string, correct: boolean, durationMs: number) {
		const i = this.cards.findIndex((c) => c.id === cardId);
		if (i < 0) return;
		const card = $state.snapshot(this.cards[i]);
		const review = {
			id: newId(),
			cardId,
			correct,
			answeredAt: Date.now(),
			durationMs: Math.min(MAX_DURATION_MS, Math.max(0, Math.round(durationMs)))
		};
		const next = step(card, card.lastWrongAt, review);
		const updated: Card = {
			...card,
			level: next.state.level,
			dueAt: next.state.dueAt,
			lastWrongAt: next.lastWrongAt,
			updatedAt: review.answeredAt
		};

		const today = this.stats.today;
		if (today.right + today.wrong === 0) this.stats.streak++;
		if (correct) today.right++;
		else today.wrong++;

		await this.ldb.transaction('rw', [this.ldb.cards, this.ldb.meta, this.ldb.outbox], async () => {
			await this.ldb.cards.put(updated);
			await this.ldb.setMeta('stats', { ...$state.snapshot(this.stats), day: review.answeredAt });
			await this.ldb.outbox.add({ kind: 'review', review });
		});
		// a sync may have replaced the list meanwhile
		const j = this.cards.findIndex((c) => c.id === cardId);
		if (j >= 0) this.cards[j] = updated;
		this.#queued();
	}
}

export const app = new AppState(new LocalDb(), api);
