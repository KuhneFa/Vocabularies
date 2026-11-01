import { beforeEach, describe, expect, it } from 'vitest';
import {
	checkPassword,
	createSession,
	deleteSession,
	hasPassword,
	LoginLimiter,
	SESSION_DAYS,
	setPassword,
	validateSession
} from './auth';
import { openDb, type Db } from './db';

const DAY = 24 * 60 * 60 * 1000;

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

describe('password', () => {
	it('accepts only the password that was set', async () => {
		expect(hasPassword(db)).toBe(false);
		expect(await checkPassword(db, 'anything')).toBe(false);

		await setPassword(db, 'la-sobremesa');
		expect(hasPassword(db)).toBe(true);
		expect(await checkPassword(db, 'la-sobremesa')).toBe(true);
		expect(await checkPassword(db, 'la-Sobremesa')).toBe(false);
	});

	it('replaces the old password when set again', async () => {
		await setPassword(db, 'alt');
		await setPassword(db, 'neu');
		expect(await checkPassword(db, 'alt')).toBe(false);
		expect(await checkPassword(db, 'neu')).toBe(true);
	});
});

describe('sessions', () => {
	const now = Date.UTC(2026, 10, 2);

	it('validates a fresh session and rejects unknown tokens', () => {
		const { token, expiresAt } = createSession(db, now);
		expect(validateSession(db, token, now)).toEqual({ expiresAt });
		expect(validateSession(db, 'not-a-token', now)).toBeNull();
	});

	it('expires after 90 days', () => {
		const { token } = createSession(db, now);
		expect(validateSession(db, token, now + SESSION_DAYS * DAY)).toBeNull();
		// and stays gone
		expect(validateSession(db, token, now)).toBeNull();
	});

	it('extends a session that is used in its second half', () => {
		const { token } = createSession(db, now);
		const later = now + 60 * DAY;
		expect(validateSession(db, token, later)).toEqual({ expiresAt: later + SESSION_DAYS * DAY });
	});

	it('ends a session on logout', () => {
		const { token } = createSession(db, now);
		deleteSession(db, token);
		expect(validateSession(db, token, now)).toBeNull();
	});
});

describe('LoginLimiter', () => {
	it('blocks an address after 5 failures for 15 minutes', () => {
		const limiter = new LoginLimiter();
		const t = 1_000_000;
		for (let i = 0; i < 5; i++) {
			expect(limiter.retryAfter('10.0.0.5', t + i)).toBe(0);
			limiter.fail('10.0.0.5', t + i);
		}
		expect(limiter.retryAfter('10.0.0.5', t + 10)).toBeGreaterThan(0);
		expect(limiter.retryAfter('10.0.0.9', t + 10)).toBe(0);
		expect(limiter.retryAfter('10.0.0.5', t + 15 * 60 * 1000 + 1)).toBe(0);
	});

	it('resets after a successful login', () => {
		const limiter = new LoginLimiter();
		for (let i = 0; i < 5; i++) limiter.fail('10.0.0.5', i);
		limiter.succeed('10.0.0.5');
		expect(limiter.retryAfter('10.0.0.5', 10)).toBe(0);
	});
});
