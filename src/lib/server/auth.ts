import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { eq, lt } from 'drizzle-orm';
import type { Db } from './db';
import { sessions, settings } from './db/schema';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const DAY_MS = 24 * 60 * 60 * 1000;
export const SESSION_DAYS = 90;
export const SESSION_COOKIE = 'session';
const PASSWORD_KEY = 'password_hash';

// --- Password -----------------------------------------------------------------

/** Format: scrypt$<salt hex>$<hash hex> */
export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const hash = await scryptAsync(password, salt, 64);
	return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [algo, saltHex, hashHex] = stored.split('$');
	if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
	const expected = Buffer.from(hashHex, 'hex');
	const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
	return timingSafeEqual(actual, expected);
}

export async function setPassword(db: Db, password: string): Promise<void> {
	const value = await hashPassword(password);
	db.insert(settings)
		.values({ key: PASSWORD_KEY, value })
		.onConflictDoUpdate({ target: settings.key, set: { value } })
		.run();
}

export function hasPassword(db: Db): boolean {
	return !!db.select().from(settings).where(eq(settings.key, PASSWORD_KEY)).get();
}

export async function checkPassword(db: Db, password: string): Promise<boolean> {
	const row = db.select().from(settings).where(eq(settings.key, PASSWORD_KEY)).get();
	return row ? verifyPassword(password, row.value) : false;
}

// --- Sessions -----------------------------------------------------------------

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Creates a session and returns the token for the cookie. */
export function createSession(db: Db, now = Date.now()): { token: string; expiresAt: number } {
	const token = randomBytes(32).toString('base64url');
	const expiresAt = now + SESSION_DAYS * DAY_MS;
	db.insert(sessions).values({ id: hashToken(token), createdAt: now, expiresAt }).run();
	return { token, expiresAt };
}

/**
 * Checks a session token. Sessions in their second half are extended, so a device
 * used at least every 45 days stays logged in. Returns the new expiry, or null.
 */
export function validateSession(db: Db, token: string, now = Date.now()): { expiresAt: number } | null {
	const id = hashToken(token);
	const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
	if (!row) return null;
	if (row.expiresAt <= now) {
		db.delete(sessions).where(eq(sessions.id, id)).run();
		return null;
	}
	if (row.expiresAt - now < (SESSION_DAYS / 2) * DAY_MS) {
		const expiresAt = now + SESSION_DAYS * DAY_MS;
		db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
		return { expiresAt };
	}
	return { expiresAt: row.expiresAt };
}

export function deleteSession(db: Db, token: string): void {
	db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
}

export function deleteExpiredSessions(db: Db, now = Date.now()): void {
	db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
}

// --- Rate limit for login attempts --------------------------------------------

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

/** In-memory, per client address. Fine for a single server process. */
export class LoginLimiter {
	private failures = new Map<string, number[]>();

	private recent(addr: string, now: number): number[] {
		const list = (this.failures.get(addr) ?? []).filter((t) => now - t < WINDOW_MS);
		this.failures.set(addr, list);
		return list;
	}

	/** Milliseconds until the next attempt is allowed, 0 if allowed now. */
	retryAfter(addr: string, now = Date.now()): number {
		const list = this.recent(addr, now);
		return list.length < MAX_FAILURES ? 0 : WINDOW_MS - (now - list[0]);
	}

	fail(addr: string, now = Date.now()): void {
		this.recent(addr, now).push(now);
	}

	succeed(addr: string): void {
		this.failures.delete(addr);
	}
}
