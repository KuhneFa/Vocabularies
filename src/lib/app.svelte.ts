import { api } from './api.ts';
import type { Card, Deck, Stats } from './types.ts';

/** Everything the app shows, loaded once and kept in sync with each change. */
class AppState {
	decks = $state<Deck[]>([]);
	cards = $state<Card[]>([]);
	stats = $state<Stats>({ today: { right: 0, wrong: 0 }, streak: 0 });
	status = $state<'loading' | 'ready' | 'error'>('loading');
	error = $state('');

	async load() {
		this.status = 'loading';
		try {
			const data = await api.load();
			this.decks = data.decks;
			this.cards = data.cards;
			this.stats = data.stats;
			this.status = 'ready';
		} catch (e) {
			this.error = (e as Error).message;
			this.status = 'error';
		}
	}

	deck(id: string) {
		return this.decks.find((d) => d.id === id);
	}

	cardsOf(deckId: string) {
		return this.cards.filter((c) => c.deckId === deckId);
	}

	upsertCard(card: Card) {
		const i = this.cards.findIndex((c) => c.id === card.id);
		if (i >= 0) this.cards[i] = card;
		else this.cards.push(card);
	}

	removeCard(id: string) {
		this.cards = this.cards.filter((c) => c.id !== id);
	}

	/** Mirrors the server's stats so the overview is right without reloading. */
	recordAnswer(correct: boolean) {
		const { today } = this.stats;
		if (today.right + today.wrong === 0) this.stats.streak++;
		if (correct) today.right++;
		else today.wrong++;
	}
}

export const app = new AppState();
