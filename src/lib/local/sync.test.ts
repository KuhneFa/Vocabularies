import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '#lib/api.ts';
import { fakeServer } from '#lib/testing/fake-server.ts';
import { LocalDb } from './db.ts';
import { flush } from './sync.ts';

let n = 0;
let ldb: LocalDb;
let server: ReturnType<typeof fakeServer>;
const deckId = '00000000-0000-4000-8000-000000000001';

beforeEach(async () => {
	ldb = new LocalDb(`test-sync-${++n}`);
	server = fakeServer();
	await ldb.outbox.add({ kind: 'deck', deck: { id: deckId, name: 'Spanisch A2', languagePair: '' } });
});

describe('flush', () => {
	it('sends queued changes in order and empties the queue', async () => {
		await ldb.outbox.add({
			kind: 'import',
			deckId,
			rows: [{ id: '00000000-0000-4000-8000-000000000002', front: 'la cola', back: 'die Warteschlange' }]
		});
		expect(await flush(ldb, server.api, () => {})).toBe('synced');
		expect(server.calls).toEqual(['createDeck', 'importCards']);
		expect(await ldb.outbox.count()).toBe(0);
	});

	it('keeps everything when the server cannot be reached', async () => {
		server.state.online = false;
		expect(await flush(ldb, server.api, () => {})).toBe('offline');
		expect(await ldb.outbox.count()).toBe(1);
	});

	it('stops and asks for a new login when the session has expired', async () => {
		server.api.createDeck = async () => {
			throw new ApiError('Bitte neu anmelden.', 401);
		};
		expect(await flush(ldb, server.api, () => {})).toBe('auth');
		expect(await ldb.outbox.count()).toBe(1);
	});

	it('drops a change the server rejects for good and goes on with the rest', async () => {
		await ldb.outbox.add({
			kind: 'review',
			review: {
				id: '00000000-0000-4000-8000-000000000003',
				cardId: '00000000-0000-4000-8000-00000000dead',
				correct: true,
				answeredAt: 1,
				durationMs: 0
			}
		});
		await ldb.outbox.add({ kind: 'delete', cardId: '00000000-0000-4000-8000-000000000004' });
		const rejected: string[] = [];
		expect(await flush(ldb, server.api, (m) => rejected.push(m))).toBe('synced');
		expect(rejected).toEqual(['Die Karte gibt es nicht.']);
		expect(server.calls).toEqual(['createDeck', 'review', 'deleteCard']);
	});
});
