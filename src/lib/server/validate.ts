import { error } from '@sveltejs/kit';
import { MAX_TEXT } from '#lib/types.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function uuid(value: unknown, field: string): string {
	if (typeof value !== 'string' || !UUID.test(value)) error(400, `${field} fehlt oder ist ungültig.`);
	return value;
}

export function text(value: unknown, field: string, { required = true } = {}): string {
	const s = typeof value === 'string' ? value.trim() : '';
	if (required && !s) error(400, `${field} darf nicht leer sein.`);
	if (s.length > MAX_TEXT) error(400, `${field} ist länger als ${MAX_TEXT} Zeichen.`);
	return s;
}

export function timestamp(value: unknown, field: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) error(400, `${field} ist ungültig.`);
	return Math.round(value);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
	try {
		const body = await request.json();
		if (body && typeof body === 'object' && !Array.isArray(body)) return body;
	} catch {
		// fall through
	}
	error(400, 'Ungültige Anfrage.');
}
