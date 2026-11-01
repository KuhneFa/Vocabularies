// Karteikasten (Leitner system): a card moves one compartment up when answered
// correctly and back to compartment 1 when answered wrong. Compartment 0 means "new".
// The card's state is never stored as the source of truth: it is replayed from the
// append-only review log, so reviews from several offline devices merge without conflicts.

export const MAX_LEVEL = 5;

/** Days until the next review, indexed by compartment. */
export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16] as const;

export interface Review {
	correct: boolean;
	/** Unix time in milliseconds. */
	answeredAt: number;
}

export interface CardState {
	level: number;
	/** Unix time in milliseconds from which the card is due. */
	dueAt: number;
}

/** Midnight (local time) of the day that contains `t`. */
export function startOfDay(t: number): number {
	const d = new Date(t);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/** Midnight (local time) `days` calendar days after the day that contains `t`. */
export function addDays(t: number, days: number): number {
	const d = new Date(startOfDay(t));
	d.setDate(d.getDate() + days);
	return d.getTime();
}

export function isDue(state: CardState, now: number): boolean {
	return state.dueAt < addDays(now, 1);
}

/**
 * Applies one answer. A card answered wrong earlier on the same day stays in
 * compartment 1 even if a later answer that day is correct.
 */
export function step(
	state: CardState,
	lastWrongAt: number | null,
	review: Review
): { state: CardState; lastWrongAt: number | null } {
	const day = startOfDay(review.answeredAt);
	if (!review.correct) {
		return { state: { level: 1, dueAt: addDays(day, 1) }, lastWrongAt: review.answeredAt };
	}
	if (lastWrongAt !== null && startOfDay(lastWrongAt) === day) {
		return { state: { level: 1, dueAt: addDays(day, INTERVAL_DAYS[1]) }, lastWrongAt };
	}
	const level = Math.min(MAX_LEVEL, state.level + 1);
	return { state: { level, dueAt: addDays(day, INTERVAL_DAYS[level]) }, lastWrongAt };
}

/** Replays a card's reviews in time order. */
export function replay(createdAt: number, reviews: readonly Review[]): CardState {
	let state: CardState = { level: 0, dueAt: createdAt };
	let lastWrongAt: number | null = null;
	for (const r of [...reviews].sort((a, b) => a.answeredAt - b.answeredAt)) {
		({ state, lastWrongAt } = step(state, lastWrongAt, r));
	}
	return state;
}
