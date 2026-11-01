// Shapes exchanged between server and browser.

export interface Deck {
	id: string;
	name: string;
	languagePair: string;
	createdAt: number;
	updatedAt: number;
}

export type Side = 'front' | 'back';

export interface Card {
	id: string;
	deckId: string;
	front: string;
	back: string;
	/** Media file names, served under /media/<name>. */
	frontImage: string | null;
	frontAudio: string | null;
	backImage: string | null;
	backAudio: string | null;
	level: number;
	dueAt: number;
	createdAt: number;
	updatedAt: number;
}

export interface Stats {
	today: { right: number; wrong: number };
	/** Consecutive days with at least one answer, ending today or yesterday. */
	streak: number;
}

export interface AppData {
	decks: Deck[];
	cards: Card[];
	stats: Stats;
}

export interface ReviewInput {
	id: string;
	cardId: string;
	correct: boolean;
	answeredAt: number;
	durationMs: number;
}

export const MAX_TEXT = 500;
