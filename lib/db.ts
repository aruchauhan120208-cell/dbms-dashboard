/**
 * lib/db.ts — server-only SQLite access layer.
 *
 * Uses Node's built-in `node:sqlite` (Node 22.5+, stable enough in 24/26) so the
 * project needs no native module. The frontend NEVER imports this file: every
 * read goes through an API route under app/api.
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const DB_PATH =
  process.env.HEATWAVE_DB_PATH ?? path.join(process.cwd(), 'db', 'heatwave.sqlite');

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON');
  _db = db;
  return db;
}

export type Row = Record<string, unknown>;

/** Run a read query; returns plain row objects. */
export function query<T = Row>(sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = getDb().prepare(sql);
  return stmt.all(...params) as T[];
}

/** Run a read query expected to return a single row (or undefined). */
export function queryOne<T = Row>(sql: string, params: (string | number | null)[] = []): T | undefined {
  const stmt = getDb().prepare(sql);
  return stmt.get(...params) as T | undefined;
}

/** Execute a statement that writes; returns { changes, lastInsertRowid }. */
export function run(sql: string, params: (string | number | null)[] = []) {
  const stmt = getDb().prepare(sql);
  return stmt.run(...params);
}

/** Live schema introspection (used by the Database Model section). */
export function introspectSchema() {
  const tables = query<{ name: string; sql: string }>(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return tables.map((t) => {
    const columns = query<{ name: string; type: string; notnull: number; pk: number; dflt_value: string | null }>(
      `PRAGMA table_info(${JSON.stringify(t.name).replace(/"/g, "'")})`,
    );
    const foreignKeys = query<{ id: number; seq: number; table: string; from: string; to: string }>(
      `PRAGMA foreign_key_list(${JSON.stringify(t.name).replace(/"/g, "'")})`,
    );
    const indexes = query<{ name: string; unique: number; origin: string }>(
      `PRAGMA index_list(${JSON.stringify(t.name).replace(/"/g, "'")})`,
    );
    const rowCount = queryOne<{ n: number }>(`SELECT COUNT(*) n FROM "${t.name}"`)?.n ?? 0;
    return { name: t.name, sql: t.sql, columns, foreignKeys, indexes, rowCount };
  });
}
