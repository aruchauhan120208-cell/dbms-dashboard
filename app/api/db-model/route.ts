import { guard, ok } from '@/lib/api';
import { introspectSchema } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/db-model — live introspection of the SQLite schema (Experiment 2). */
export async function GET() {
  return guard(async () => {
    const tables = introspectSchema().filter((t) => t.name !== 'RAW_OBSERVATION');
    const relations = tables.map((t) => ({
      name: t.name,
      columns: t.columns.map((c) => ({
        name: c.name,
        type: c.type,
        notNull: !!c.notnull,
        primaryKey: c.pk > 0,
      })),
      primaryKey: t.columns.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => c.name),
      foreignKeys: t.foreignKeys.map((f) => ({ column: f.from, references: `${f.table}(${f.to})` })),
      indexes: t.indexes.map((i) => ({ name: i.name, unique: !!i.unique })),
      rowCount: t.rowCount,
    }));
    return ok({
      database: 'SQLite',
      file: 'db/heatwave.sqlite',
      relations,
      count: relations.length,
    });
  });
}
