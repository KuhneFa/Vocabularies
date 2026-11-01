import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { contentType, MEDIA_NAME, mediaDir } from '#lib/server/media.ts';
import type { RequestHandler } from './$types';

// Supports byte ranges: Safari refuses to play audio from servers that do not.
export const GET: RequestHandler = async ({ params, request }) => {
	if (!MEDIA_NAME.test(params.file)) error(404, 'Nicht gefunden.');
	const path = join(mediaDir(), params.file);
	const size = await stat(path).then(
		(s) => s.size,
		() => error(404, 'Nicht gefunden.')
	);

	const headers = new Headers({
		'content-type': contentType(params.file),
		'accept-ranges': 'bytes',
		// file names are never reused, so the browser may keep them forever
		'cache-control': 'private, max-age=31536000, immutable'
	});

	const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (range && (range[1] || range[2])) {
		const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
		const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
		if (start > end || start >= size) {
			return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
		}
		headers.set('content-range', `bytes ${start}-${end}/${size}`);
		headers.set('content-length', String(end - start + 1));
		const body = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream;
		return new Response(body, { status: 206, headers });
	}

	headers.set('content-length', String(size));
	return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { headers });
};
