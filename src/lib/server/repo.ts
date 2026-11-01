import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { addDays, replay, startOfDay } from '#lib/leitner.ts';
import type { AppData, Card, Deck, ReviewInput, Stats } from '#lib/types.ts';
import type { Db } from './db/index.ts';
import { cards, decks, reviews } from './db/schema';

// All writes are idempotent on the client-generated id, so a request that is retried
// after a dropped connection (or replayed by the offline sync later) does no harm.

const deckFields = {
	id: decks.id,
	name: decks.name,
	languagePair: decks.languagePair,
	createdAt: decks.createdAt,
	updatedAt: decks.updatedAt
};

const cardFields = {
	id: cards.id,
	deckId: cards.deckId,
	front: cards.front,
	back: cards.back,
	frontImage: cards.frontImage,
	frontAudio: cards.frontAudio,
	backImage: cards.backImage,
	backAudio: cards.backAudio,
	level: cards.level,
	dueAt: cards.dueAt,
	// spelled out: drizzle leaves column names unqualified here, so "id" would mean reviews.id
	lastWrongAt: sql<number | null>`(select max(r.answered_at) from reviews r where r.card_id = "cards"."id" and r.correct = 0)`,
	createdAt: cards.createdAt,
	updatedAt: cards.updatedAt
};

export function loadAll(db: Db, now = Date.now()): AppData {
	return {
		decks: db.select(deckFields).from(decks).where(isNull(decks.deletedAt)).orderBy(decks.createdAt).all(),
		cards: db.select(cardFields).from(cards).where(isNull(cards.deletedAt)).orderBy(cards.createdAt).all(),
		stats: getStats(db, now)
	};
}

export function createDeck(db: Db, input: { id: string; name: string; languagePair: string }, now = Date.now()): Deck {
	db.insert(decks)
		.values({ ...input, createdAt: now, updatedAt: now })
		.onConflictDoNothing()
		.run();
	return db.select(deckFields).from(decks).where(eq(decks.id, input.id)).get()!;
}

export interface CardInput {
	id: string;
	deckId: string;
	front: string;
	back: string;
	frontImage?: string | null;
	frontAudio?: string | null;
	backImage?: string | null;
	backAudio?: string | null;
}

export function getCard(db: Db, id: string): Card | undefined {
	return db.select(cardFields).from(cards).where(eq(cards.id, id)).get();
}

export function deckExists(db: Db, id: string): boolean {
	return !!db.select({ id: decks.id }).from(decks).where(and(eq(decks.id, id), isNull(decks.deletedAt))).get();
}

export function createCards(db: Db, inputs: CardInput[], now = Date.now()): Card[] {
	if (inputs.length === 0) return [];
	db.insert(cards)
		.values(inputs.map((c) => ({ ...c, level: 0, dueAt: now, createdAt: now, updatedAt: now })))
		.onConflictDoNothing()
		.run();
	return inputs.map((c) => getCard(db, c.id)!);
}

export function deleteCard(db: Db, id: string, now = Date.now()): void {
	db.update(cards).set({ deletedAt: now, updatedAt: now }).where(eq(cards.id, id)).run();
}

/** Stores an answer and recomputes the card's compartment from its whole review log. */
export function addReview(db: Db, r: ReviewInput, now = Date.now()): Card | undefined {
	return db.transaction((tx) => {
		const card = tx.select({ createdAt: cards.createdAt }).from(cards).where(eq(cards.id, r.cardId)).get();
		if (!card) return undefined;

		tx.insert(reviews).values({ ...r, receivedAt: now }).onConflictDoNothing().run();
		const log = tx
			.select({ correct: reviews.correct, answeredAt: reviews.answeredAt })
			.from(reviews)
			.where(eq(reviews.cardId, r.cardId))
			.all();
		const state = replay(card.createdAt, log);
		tx.update(cards).set({ level: state.level, dueAt: state.dueAt, updatedAt: now }).where(eq(cards.id, r.cardId)).run();
		return tx.select(cardFields).from(cards).where(eq(cards.id, r.cardId)).get();
	});
}

export function getStats(db: Db, now = Date.now()): Stats {
	const today = startOfDay(now);
	const todays = db
		.select({ correct: reviews.correct })
		.from(reviews)
		.where(gte(reviews.answeredAt, today))
		.all();

	const days = new Set(
		db
			.select({ answeredAt: reviews.answeredAt })
			.from(reviews)
			.all()
			.map((r) => startOfDay(r.answeredAt))
	);
	let day = days.has(today) ? today : addDays(today, -1);
	let streak = 0;
	while (days.has(day)) {
		streak++;
		day = addDays(day, -1);
	}

	return {
		today: { right: todays.filter((r) => r.correct).length, wrong: todays.filter((r) => !r.correct).length },
		streak
	};
}
