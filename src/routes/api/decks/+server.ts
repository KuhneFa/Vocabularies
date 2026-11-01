import { json } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { createDeck } from '#lib/server/repo.ts';
import { readJson, text, uuid } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await readJson(request);
	const deck = createDeck(db(), {
		id: uuid(body.id, 'id'),
		name: text(body.name, 'Name'),
		languagePair: text(body.languagePair, 'Sprachpaar', { required: false })
	});
	return json(deck, { status: 201 });
};
