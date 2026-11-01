import { error, json } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { createCards, deckExists } from '#lib/server/repo.ts';
import { readJson, text, uuid } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

const MAX_ROWS = 1000;

/** Text-only cards in bulk: { deckId, rows: [{ id, front, back }] } */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJson(request);
	const deckId = uuid(body.deckId, 'deckId');
	if (!deckExists(db(), deckId)) error(404, 'Den Stapel gibt es nicht.');
	if (!Array.isArray(body.rows) || body.rows.length === 0) error(400, 'Keine Karten zum Importieren.');
	if (body.rows.length > MAX_ROWS) error(400, `Höchstens ${MAX_ROWS} Karten auf einmal.`);

	const rows = body.rows.map((r: Record<string, unknown>, i: number) => ({
		id: uuid(r?.id, `Zeile ${i + 1}: id`),
		deckId,
		front: text(r?.front, `Zeile ${i + 1}: Vorderseite`),
		back: text(r?.back, `Zeile ${i + 1}: Rückseite`)
	}));
	return json(createCards(db(), rows), { status: 201 });
};
