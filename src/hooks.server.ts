import { existsSync } from 'node:fs';
import type { Handle, ServerInit } from '@sveltejs/kit/hooks';
import { deleteExpiredSessions, SESSION_COOKIE, setPassword, validateSession } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { sessionCookie } from '#lib/server/session-cookie.ts';

const PUBLIC_PATHS = new Set(['/login']);

export const init: ServerInit = async () => {
	// local development reads .env; in Docker the variables come from compose
	if (existsSync('.env')) process.loadEnvFile('.env');

	// the password is set through the environment, so changing it means: edit, restart
	const password = process.env.APP_PASSWORD;
	if (password) await setPassword(db(), password);
	else console.warn('APP_PASSWORD ist nicht gesetzt: Anmelden ist erst möglich, wenn ein Passwort festgelegt wurde.');

	deleteExpiredSessions(db());
};

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const session = token ? validateSession(db(), token) : null;

	if (token && session) event.cookies.set(SESSION_COOKIE, token, sessionCookie(session.expiresAt));
	if (token && !session) event.cookies.delete(SESSION_COOKIE, { path: '/' });
	event.locals.loggedIn = !!session;

	if (!session && !PUBLIC_PATHS.has(event.url.pathname)) {
		if (event.url.pathname.startsWith('/api/')) {
			return new Response('Nicht angemeldet', { status: 401 });
		}
		return new Response(null, { status: 303, headers: { location: '/login' } });
	}

	return resolve(event);
};
