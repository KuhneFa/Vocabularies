import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { dataDir } from './db/index.ts';

// Images arrive already scaled down by the browser; audio is stored as recorded
// (m4a on the iPhone, webm or ogg in other browsers).

export const mediaDir = () => join(dataDir(), 'media');

const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'audio/mp4': 'm4a',
	'audio/x-m4a': 'm4a',
	'audio/aac': 'aac',
	'audio/mpeg': 'mp3',
	'audio/webm': 'webm',
	'audio/ogg': 'ogg',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav'
};

const CONTENT_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	gif: 'image/gif',
	m4a: 'audio/mp4',
	aac: 'audio/aac',
	mp3: 'audio/mpeg',
	webm: 'audio/webm',
	ogg: 'audio/ogg',
	wav: 'audio/wav'
};

export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

/** Only names we generated ourselves: no path separators, no guessing other files. */
export const MEDIA_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|m4a|aac|mp3|webm|ogg|wav)$/;

export class MediaError extends Error {}

export function contentType(name: string): string {
	return CONTENT_TYPES[name.split('.').pop()!] ?? 'application/octet-stream';
}

export async function saveMedia(file: File, kind: 'image' | 'audio'): Promise<string> {
	const type = file.type.split(';')[0].trim().toLowerCase();
	const ext = EXTENSIONS[type];
	if (!ext || !type.startsWith(`${kind}/`)) {
		throw new MediaError(`Das Dateiformat ${file.type || 'unbekannt'} wird nicht unterstützt.`);
	}
	if (file.size > MAX_MEDIA_BYTES) throw new MediaError('Die Datei ist größer als 15 MB.');

	mkdirSync(mediaDir(), { recursive: true });
	const name = `${randomUUID()}.${ext}`;
	await writeFile(join(mediaDir(), name), Buffer.from(await file.arrayBuffer()));
	return name;
}
