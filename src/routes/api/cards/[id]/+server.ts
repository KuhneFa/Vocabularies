import { db } from '#lib/server/db/index.ts';
import { deleteCard } from '#lib/server/repo.ts';
import { uuid } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = ({ params }) => {
	deleteCard(db(), uuid(params.id, 'id'));
	return new Response(null, { status: 204 });
};
