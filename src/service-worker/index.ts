// Makes the app work offline:
// - the app's code and static files are stored on install (one cache per version)
// - pages: network first, the last app page served when offline (the app renders in the browser)
// - media: stored on first use and served from the cache, including byte ranges for Safari's audio
// - /api is never cached: the data lives in IndexedDB and is synced by the app itself

import { self } from '$app/service-worker';
import { assets, immutable } from '$app/manifest';
import { version } from '$app/env';

const APP_CACHE = `app-${version}`;
const SHELL_CACHE = 'shell';
const MEDIA_CACHE = 'media';

const PRECACHE = [...immutable, ...assets].map((a) => new URL(a.path, self.location.href).pathname);
const precached = new Set(PRECACHE);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(APP_CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key.startsWith('app-') && key !== APP_CACHE) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;

	if (precached.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname, { cacheName: APP_CACHE }).then((r) => r ?? fetch(req)));
	} else if (url.pathname.startsWith('/media/')) {
		event.respondWith(media(req, url));
	} else if (req.mode === 'navigate' && !url.pathname.startsWith('/api/')) {
		event.respondWith(page(req, url));
	}
});

async function page(req: Request, url: URL): Promise<Response> {
	const cache = await caches.open(SHELL_CACHE);
	try {
		const res = await fetch(req);
		// keep app pages for offline use, but never the login page someone was sent to;
		// the page under '/' stands in for routes not visited yet (the router loads the rest)
		if (res.ok && !res.redirected && url.pathname !== '/login') {
			await cache.put(url.pathname, res.clone());
			if (url.pathname !== '/') await cache.put('/', res.clone());
		}
		return res;
	} catch {
		const cached = (await cache.match(url.pathname)) ?? (await cache.match('/'));
		if (cached) return cached;
		return new Response('Offline, und die App ist auf diesem Gerät noch nicht gespeichert.', {
			status: 503,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}
}

async function media(req: Request, url: URL): Promise<Response> {
	const cache = await caches.open(MEDIA_CACHE);
	let res = await cache.match(url.pathname);
	if (!res) {
		// fetch the whole file (without the Range header) so it can be stored
		res = await fetch(url.pathname, { credentials: 'same-origin' });
		if (!res.ok || res.redirected) return res;
		await cache.put(url.pathname, res.clone());
	}
	const range = req.headers.get('range');
	return range ? slice(res, range) : res;
}

async function slice(res: Response, header: string): Promise<Response> {
	const blob = await res.blob();
	const m = /^bytes=(\d*)-(\d*)$/.exec(header);
	if (!m || (!m[1] && !m[2])) return new Response(blob, { headers: res.headers });

	const size = blob.size;
	const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
	const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
	if (start > end || start >= size) {
		return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } });
	}
	return new Response(blob.slice(start, end + 1), {
		status: 206,
		headers: {
			'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
			'content-range': `bytes ${start}-${end}/${size}`,
			'content-length': String(end - start + 1),
			'accept-ranges': 'bytes'
		}
	});
}
