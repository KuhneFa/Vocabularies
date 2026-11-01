import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

// read lazily: in development .env is loaded in the init hook, after modules are imported
export const dataDir = () => process.env.DATA_DIR ?? 'data';
const migrationsDir = () => process.env.MIGRATIONS_DIR ?? 'drizzle';

/** Opens (and migrates) a database. Pass ':memory:' for tests. */
export function openDb(file: string): Db {
	if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
	const sqlite = new Database(file);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: migrationsDir() });
	return db;
}

let instance: Db | undefined;

/** The app's database, opened on first use. */
export function db(): Db {
	instance ??= openDb(join(dataDir(), 'vokabeln.db'));
	return instance;
}
