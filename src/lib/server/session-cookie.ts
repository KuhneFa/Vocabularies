import { dev } from '$app/env';

/** Cookie options for the session token. `secure` is off in dev so the iPhone can test over plain HTTP. */
export function sessionCookie(expiresAt: number) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: !dev,
		expires: new Date(expiresAt)
	};
}
