import Dexie, { type Table } from 'dexie';
import type { Card, Deck, MediaKey, ReviewInput } from '#lib/types.ts';

// The device's own copy of everything (IndexedDB). The app reads only from here, so it
// works offline; changes go into the outbox and are sent to the server when it is reachable.

export type OutboxOp =
	| { kind: 'deck'; deck: { id: string; name: string; languagePair: string } }
	| {
			kind: 'card';
			card: { id: string; deckId: string; front: string; back: string };
			/** Keys into `blobs` for media recorded or picked on this device. */
			media: Partial<Record<MediaKey, string>>;
	  }
	| { kind: 'import'; deckId: string; rows: { id: string; front: string; back: string }[] }
	| { kind: 'delete'; cardId: string }
	| { kind: 'review'; review: ReviewInput };

export type OutboxEntry = OutboxOp & { seq?: number };

/** Media that only exists on this device yet; cards refer to it as "local:<uuid>". */
export const LOCAL_MEDIA = 'local:';

export class LocalDb extends Dexie {
	decks!: Table<Deck, string>;
	cards!: Table<Card, string>;
	outbox!: Table<OutboxEntry, number>;
	blobs!: Table<{ key: string; blob: Blob }, string>;
	meta!: Table<{ key: string; value: unknown }, string>;

	constructor(name = 'karteikasten') {
		super(name);
		this.version(1).stores({
			decks: 'id',
			cards: 'id, deckId',
			outbox: '++seq',
			blobs: 'key',
			meta: 'key'
		});
	}

	async getMeta<T>(key: string): Promise<T | undefined> {
		return (await this.meta.get(key))?.value as T | undefined;
	}

	setMeta(key: string, value: unknown) {
		return this.meta.put({ key, value });
	}
}
