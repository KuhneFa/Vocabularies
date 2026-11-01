import { error, json } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { addReview } from '#lib/server/repo.ts';
import { readJson, timestamp, uuid } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

const MAX_DURATION_MS = 10 * 60 * 1000;

/** One answer; responds with the card's new compartment and due date. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await readJson(request);
	if (typeof body.correct !== 'boolean') error(400, 'correct fehlt.');
	const card = addReview(db(), {
		id: uuid(body.id, 'id'),
		cardId: uuid(body.cardId, 'cardId'),
		correct: body.correct,
		answeredAt: timestamp(body.answeredAt, 'answeredAt'),
		durationMs: Math.min(MAX_DURATION_MS, timestamp(body.durationMs ?? 0, 'durationMs'))
	});
	if (!card) error(404, 'Die Karte gibt es nicht.');
	return json(card);
};
