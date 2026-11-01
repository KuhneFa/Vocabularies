import { json } from '@sveltejs/kit';
import { db } from '#lib/server/db/index.ts';
import { loadAll } from '#lib/server/repo.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => json(loadAll(db()));
