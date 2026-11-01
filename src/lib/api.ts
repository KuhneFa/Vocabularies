import type { AppData, Card, Deck, ReviewInput } from './types.ts';

/** status 0 means the server could not be reached. */
export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	let res: Response;
	try {
		res = await fetch(url, init);
	} catch {
		throw new ApiError('Keine Verbindung zum Server.', 0);
	}
	if (res.status === 401) throw new ApiError('Bitte neu anmelden.', 401);
	if (!res.ok) {
		let message = `Der Server hat mit Fehler ${res.status} geantwortet.`;
		try {
			message = (await res.json()).message ?? message;
		} catch {
			// keep the generic message
		}
		throw new ApiError(message, res.status);
	}
	return res.status === 204 ? (undefined as T) : res.json();
}

const post = <T>(url: string, body: unknown) =>
	request<T>(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const api = {
	load: () => request<AppData>('/api/data'),
	createDeck: (deck: { id: string; name: string; languagePair: string }) => post<Deck>('/api/decks', deck),
	/** Multipart form with id, deckId, front, back and optional frontImage/frontAudio/backImage/backAudio. */
	createCard: (form: FormData) => request<Card>('/api/cards', { method: 'POST', body: form }),
	importCards: (deckId: string, rows: { id: string; front: string; back: string }[]) =>
		post<Card[]>('/api/cards/import', { deckId, rows }),
	deleteCard: (id: string) => request<void>(`/api/cards/${id}`, { method: 'DELETE' }),
	review: (review: ReviewInput) => post<Card>('/api/reviews', review)
};

export type Api = typeof api;

export const mediaUrl = (name: string) => `/media/${name}`;
