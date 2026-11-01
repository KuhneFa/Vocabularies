import { fail, redirect } from '@sveltejs/kit';
import { checkPassword, createSession, hasPassword, LoginLimiter, SESSION_COOKIE } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { sessionCookie } from '#lib/server/session-cookie.ts';
import type { Actions, PageServerLoad } from './$types';

const limiter = new LoginLimiter();

export const load: PageServerLoad = ({ locals }) => {
	if (locals.loggedIn) redirect(303, '/');
	return { passwordSet: hasPassword(db()) };
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const addr = getClientAddress();
		const wait = limiter.retryAfter(addr);
		if (wait > 0) {
			const minutes = Math.ceil(wait / 60_000);
			return fail(429, { message: `Zu viele Fehlversuche. Versuch es in ${minutes} Minuten wieder.` });
		}

		const password = String((await request.formData()).get('password') ?? '');
		if (!(await checkPassword(db(), password))) {
			limiter.fail(addr);
			return fail(400, { message: 'Das Passwort stimmt nicht.' });
		}

		limiter.succeed(addr);
		const { token, expiresAt } = createSession(db());
		cookies.set(SESSION_COOKIE, token, sessionCookie(expiresAt));
		redirect(303, '/');
	}
};
