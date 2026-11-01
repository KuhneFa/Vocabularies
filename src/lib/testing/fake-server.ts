import { randomUUID } from 'node:crypto';
import { ApiError, type Api } from '#lib/api.ts';
import { openDb } from '#lib/server/db/index.ts';
import { addReview, createCards, createDeck, deleteCard, loadAll } from '#lib/server/repo.ts';

/**
 * The real server logic on an in-memory database, behind the same interface the browser
 * uses. `online = false` makes every call fail like a dropped connection.
 */
export function fakeServer() {
	const db = openDb(':memory:');
	const calls: string[] = [];
	const state = { online: true };

	const guard = (name: string) => {
		calls.push(name);
		if (!state.online) throw new ApiError('Keine Verbindung zum Server.', 0);
	};

	const api: Api = {
		load: async () => (guard('load'), loadAll(db)),
		createDeck: async (deck) => (guard('createDeck'), createDeck(db, deck)),
		createCard: async (form) => {
			guard('createCard');
			const field = (k: string) => String(form.get(k));
			const media = (k: string) => (form.get(k) instanceof Blob ? `${randomUUID()}.bin` : null);
			return createCards(db, [
				{
					id: field('id'),
					deckId: field('deckId'),
					front: field('front'),
					back: field('back'),
					frontImage: media('frontImage'),
					frontAudio: media('frontAudio'),
					backImage: media('backImage'),
					backAudio: media('backAudio')
				}
			])[0];
		},
		importCards: async (deckId, rows) => (guard('importCards'), createCards(db, rows.map((r) => ({ ...r, deckId })))),
		deleteCard: async (id) => (guard('deleteCard'), deleteCard(db, id)),
		review: async (review) => {
			guard('review');
			const card = addReview(db, review);
			if (!card) throw new ApiError('Die Karte gibt es nicht.', 404);
			return card;
		}
	};

	return { api, db, calls, state };
}
