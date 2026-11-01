import { error, json } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { MediaError, saveMedia } from '#lib/server/media.ts';
import { createCards, deckExists, getCard } from '#lib/server/repo.ts';
import { text, uuid } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

/** One card with optional image and audio per side, sent as multipart form data. */
export const POST: RequestHandler = async ({ request }) => {
	const form = await request.formData();
	const id = uuid(form.get('id'), 'id');
	const deckId = uuid(form.get('deckId'), 'deckId');
	if (!deckExists(db(), deckId)) error(404, 'Den Stapel gibt es nicht.');

	// a retried upload must not store the files twice
	const existing = getCard(db(), id);
	if (existing) return json(existing);

	const file = (name: string) => {
		const v = form.get(name);
		return v instanceof File && v.size > 0 ? v : null;
	};

	try {
		const media = async (name: string, kind: 'image' | 'audio') => {
			const f = file(name);
			return f ? saveMedia(f, kind) : null;
		};
		const [card] = createCards(db(), [
			{
				id,
				deckId,
				front: text(form.get('front'), 'Vorderseite'),
				back: text(form.get('back'), 'Rückseite'),
				frontImage: await media('frontImage', 'image'),
				frontAudio: await media('frontAudio', 'audio'),
				backImage: await media('backImage', 'image'),
				backAudio: await media('backAudio', 'audio')
			}
		]);
		return json(card, { status: 201 });
	} catch (e) {
		if (e instanceof MediaError) error(400, e.message);
		throw e;
	}
};
