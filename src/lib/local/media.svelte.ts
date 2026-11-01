import { SvelteMap } from 'svelte/reactivity';
import { mediaUrl } from '#lib/api.ts';
import { LOCAL_MEDIA, type LocalDb } from './db.ts';

// Media names are either server file names (served from /media, cached by the service
// worker) or "local:<uuid>" for files that have not been uploaded yet.

const objectUrls = new SvelteMap<string, string>();
const loading = new Set<string>();

/**
 * A URL usable in <img src> or new Audio(). For local media this is undefined until the
 * blob has been read from IndexedDB; the map is reactive, so the caller re-renders.
 */
export function mediaSrc(ldb: LocalDb, name: string): string | undefined {
	if (!name.startsWith(LOCAL_MEDIA)) return mediaUrl(name);
	const url = objectUrls.get(name);
	if (!url && !loading.has(name)) {
		loading.add(name);
		ldb.blobs.get(name).then((row) => {
			if (row) objectUrls.set(name, URL.createObjectURL(row.blob));
			loading.delete(name);
		});
	}
	return url;
}
