import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppState } from './app.svelte.ts';
import { loadAll } from './server/repo.ts';
import { LocalDb } from './local/db.ts';
import { fakeServer } from './testing/fake-server.ts';

let n = 0;
let server: ReturnType<typeof fakeServer>;
let app: AppState;

beforeEach(async () => {
	server = fakeServer();
	app = new AppState(new LocalDb(`test-app-${++n}`), server.api);
	await app.init();
});

const photo = () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });

describe('offline', () => {
	it('keeps working without the server and catches up once it is back', async () => {
		server.state.online = false;

		const deck = await app.createDeck('Spanisch A2', 'ES → DE');
		const card = await app.addCard(deck.id, 'el sol', 'die Sonne', { frontImage: photo() });
		await app.answer(card.id, true, 4000);
		await app.syncNow();

		expect(app.sync).toBe('offline');
		expect(app.pending).toBe(3);
		expect(app.cards[0]).toMatchObject({ front: 'el sol', level: 1 });
		expect(app.cards[0].frontImage).toMatch(/^local:/);
		expect(loadAll(server.db).decks).toHaveLength(0);

		server.state.online = true;
		await app.syncNow();

		expect(app.sync).toBe('synced');
		expect(app.pending).toBe(0);
		const onServer = loadAll(server.db);
		expect(onServer.decks.map((d) => d.name)).toEqual(['Spanisch A2']);
		expect(onServer.cards[0]).toMatchObject({ front: 'el sol', level: 1 });
		expect(app.cards[0].frontImage).toBe(onServer.cards[0].frontImage);
		expect(await app.ldb.blobs.count()).toBe(0);
	});

	it('applies answers the same way the server does', async () => {
		const deck = await app.createDeck('Englisch', '');
		const card = await app.addCard(deck.id, 'invoice', 'die Rechnung', {});
		await app.syncNow();
		server.state.online = false;

		await app.answer(card.id, true, 1000);
		await app.answer(card.id, false, 1000);
		await app.answer(card.id, true, 1000); // same day as the wrong answer: stays in Fach 1
		const local = { level: app.cards[0].level, dueAt: app.cards[0].dueAt };

		server.state.online = true;
		await app.syncNow();
		expect(local.level).toBe(1);
		expect(app.cards[0]).toMatchObject(local);
	});

	it('updates today’s numbers and the streak right away', async () => {
		const deck = await app.createDeck('Italienisch', '');
		const card = await app.addCard(deck.id, 'il binario', 'das Gleis', {});
		server.state.online = false;
		await app.answer(card.id, true, 1000);
		await app.answer(card.id, false, 1000);
		expect(app.stats).toEqual({ today: { right: 1, wrong: 1 }, streak: 1 });
	});
});

describe('several devices', () => {
	it('fills a new device on its first sync', async () => {
		const deck = await app.createDeck('Spanisch A2', '');
		await app.importCards(deck.id, [
			{ front: 'la cola', back: 'die Warteschlange' },
			{ front: 'el andén', back: 'der Bahnsteig' }
		]);
		await app.syncNow();

		const phone = new AppState(new LocalDb(`test-app-${++n}`), server.api);
		await phone.init();
		expect(phone.hasSynced).toBe(false);
		await phone.syncNow();
		expect(phone.hasSynced).toBe(true);
		expect(phone.cards.map((c) => c.front).sort()).toEqual(['el andén', 'la cola']);
	});

	it('merges answers given offline on two devices', async () => {
		const deck = await app.createDeck('Spanisch A2', '');
		const card = await app.addCard(deck.id, 'la cuenta', 'die Rechnung', {});
		await app.syncNow();
		const phone = new AppState(new LocalDb(`test-app-${++n}`), server.api);
		await phone.init();
		await phone.syncNow();

		server.state.online = false;
		await app.answer(card.id, true, 1000);
		await phone.answer(card.id, true, 1000);
		server.state.online = true;
		await app.syncNow();
		await phone.syncNow();
		await app.syncNow();

		// both answers count, whichever device synced first
		expect(loadAll(server.db).cards[0].level).toBe(2);
		expect(app.cards[0].level).toBe(2);
		expect(phone.cards[0].level).toBe(2);
	});

	it('does not bring back a card deleted on this device', async () => {
		const deck = await app.createDeck('Spanisch A2', '');
		const card = await app.addCard(deck.id, 'el recado', 'die Besorgung', {});
		await app.syncNow();
		await app.deleteCard(card.id);
		await app.syncNow();
		expect(app.cards).toHaveLength(0);
		expect(loadAll(server.db).cards).toHaveLength(0);
	});
});
