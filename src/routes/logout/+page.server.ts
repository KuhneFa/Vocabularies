import { redirect } from '@sveltejs/kit';
import { deleteSession, SESSION_COOKIE } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import type { Actions } from './$types';

export const actions: Actions = {
	default: ({ cookies }) => {
		const token = cookies.get(SESSION_COOKIE);
		if (token) deleteSession(db(), token);
		cookies.delete(SESSION_COOKIE, { path: '/' });
		redirect(303, '/login');
	}
};
