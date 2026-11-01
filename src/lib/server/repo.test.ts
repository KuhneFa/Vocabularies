import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '#lib/leitner.ts';
import { openDb, type Db } from './db/index.ts';
import { addReview, createCards, createDeck, deleteCard, getStats, loadAll } from './repo.ts';

const T0 = new Date(2026, 10, 2, 9, 0).getTime();
const at = (dayOffset: number, hour = 9) => new Date(2026, 10, 2 + dayOffset, hour, 0).getTime();
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

let db: Db;
let deckId: string;
beforeEach(() => {
	db = openDb(':memory:');
	deckId = createDeck(db, { id: uuid(), name: 'Spanisch A2', languagePair: 'ES → DE' }, T0).id;
});

function card(front = 'la cuenta', back = 'die Rechnung') {
	return createCards(db, [{ id: uuid(), deckId, front, back }], T0)[0];
}

const review = (cardId: string, correct: boolean, answeredAt: number, id = uuid()) => ({
	id,
	cardId,
	correct,
	answeredAt,
	durationMs: 4000
});

describe('decks and cards', () => {
	it('creates a deck once even if the request is repeated', () => {
		const again = createDeck(db, { id: deckId, name: 'anders', languagePair: '' }, T0 + 1);
		expect(again.name).toBe('Spanisch A2');
		expect(loadAll(db, T0).decks).toHaveLength(1);
	});

	it('starts new cards in compartment 0, due right away', () => {
		const c = card();
		expect(c).toMatchObject({ level: 0, dueAt: T0, frontImage: null });
	});

	it('keeps media file names', () => {
		const [c] = createCards(db, [{ id: uuid(), deckId, front: 'el sol', back: 'die Sonne', frontImage: 'a.jpg', backAudio: 'b.m4a' }], T0);
		expect(c).toMatchObject({ frontImage: 'a.jpg', backAudio: 'b.m4a', frontAudio: null });
	});

	it('hides deleted cards', () => {
		const c = card();
		card('el andén', 'der Bahnsteig');
		deleteCard(db, c.id, T0 + 1);
		expect(loadAll(db, T0).cards.map((x) => x.front)).toEqual(['el andén']);
	});
});

describe('addReview', () => {
	it('moves the card according to the review log', () => {
		const c = card();
		expect(addReview(db, review(c.id, true, at(0)))).toMatchObject({ level: 1, dueAt: addDays(at(0), 1) });
		expect(addReview(db, review(c.id, true, at(1)))).toMatchObject({ level: 2, dueAt: addDays(at(1), 2) });
		expect(addReview(db, review(c.id, false, at(3)))).toMatchObject({ level: 1, dueAt: addDays(at(3), 1) });
	});

	it('counts a review sent twice only once', () => {
		const c = card();
		const r = review(c.id, true, at(0));
		addReview(db, r);
		expect(addReview(db, r)).toMatchObject({ level: 1 });
	});

	it('places a review that arrives late at its real time', () => {
		const c = card();
		addReview(db, review(c.id, true, at(1)));
		// answered offline on day 0, synced after the day-1 answer
		expect(addReview(db, review(c.id, true, at(0)))).toMatchObject({ level: 2, dueAt: addDays(at(1), 2) });
	});

	it('ignores reviews for unknown cards', () => {
		expect(addReview(db, review(uuid(), true, at(0)))).toBeUndefined();
	});
});

describe('getStats', () => {
	it('counts today’s answers and the streak of days', () => {
		const c = card();
		for (const d of [-3, -2, -1]) addReview(db, review(c.id, true, at(d)));
		addReview(db, review(c.id, true, at(0, 8)));
		addReview(db, review(c.id, false, at(0, 9)));
		expect(getStats(db, at(0, 20))).toEqual({ today: { right: 1, wrong: 1 }, streak: 4 });
	});

	it('keeps the streak alive until the end of the day', () => {
		const c = card();
		addReview(db, review(c.id, true, at(-2)));
		addReview(db, review(c.id, true, at(-1)));
		expect(getStats(db, at(0)).streak).toBe(2);
		expect(getStats(db, at(1)).streak).toBe(0);
	});
});
