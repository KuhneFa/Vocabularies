import { startOfDay } from './leitner.ts';
import type { Card } from './types.ts';

export const FACH = ['Neu', 'Fach 1', 'Fach 2', 'Fach 3', 'Fach 4', 'Fach 5'];
export const INTERVAL_LABEL = ['–', 'täglich', '2 Tage', '4 Tage', '8 Tage', '16 Tage'];

export function levelCounts(cards: Card[]): number[] {
	return FACH.map((_, i) => cards.filter((c) => c.level === i).length);
}

/** "neu", "heute fällig", "morgen", "in 4 Tagen" */
export function relativeDue(card: Card, now = Date.now()): string {
	if (card.level === 0) return 'neu';
	const days = Math.round((startOfDay(card.dueAt) - startOfDay(now)) / 86_400_000);
	if (days <= 0) return 'heute fällig';
	if (days === 1) return 'morgen';
	return `in ${days} Tagen`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
