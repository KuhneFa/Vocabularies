import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// IDs are UUIDs generated on the device that creates the row, so cards created offline
// on different devices never collide. Rows are soft-deleted (deletedAt) so a deletion
// can be synced to the other devices.

const timestamps = {
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull(),
	deletedAt: integer('deleted_at')
};

export const decks = sqliteTable('decks', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	/** e.g. "ES → DE" */
	languagePair: text('language_pair').notNull().default(''),
	...timestamps
});

export const cards = sqliteTable(
	'cards',
	{
		id: text('id').primaryKey(),
		deckId: text('deck_id')
			.notNull()
			.references(() => decks.id),
		front: text('front').notNull(),
		back: text('back').notNull(),
		// media files live under DATA_DIR/media; the columns hold the file name only
		frontImage: text('front_image'),
		frontAudio: text('front_audio'),
		backImage: text('back_image'),
		backAudio: text('back_audio'),
		// cached result of replaying the review log (see #lib/leitner)
		level: integer('level').notNull().default(0),
		dueAt: integer('due_at').notNull(),
		...timestamps
	},
	(t) => [index('cards_deck_idx').on(t.deckId), index('cards_due_idx').on(t.dueAt)]
);

/** Append-only: one row per answer. Never updated, never deleted. */
export const reviews = sqliteTable(
	'reviews',
	{
		id: text('id').primaryKey(),
		cardId: text('card_id')
			.notNull()
			.references(() => cards.id),
		correct: integer('correct', { mode: 'boolean' }).notNull(),
		answeredAt: integer('answered_at').notNull(),
		durationMs: integer('duration_ms').notNull().default(0),
		receivedAt: integer('received_at')
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => [index('reviews_card_idx').on(t.cardId)]
);

/** Single-user app: one row holding the password hash. */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const sessions = sqliteTable('sessions', {
	/** SHA-256 of the session token; the token itself only lives in the cookie. */
	id: text('id').primaryKey(),
	createdAt: integer('created_at').notNull(),
	expiresAt: integer('expires_at').notNull()
});
