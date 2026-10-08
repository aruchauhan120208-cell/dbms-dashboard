import type { NextRequest } from 'next/server';
import { guard, fail, ok } from '@/lib/api';
import { query } from '@/lib/db';
import { loadQueries } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sql-analytics/run  { id }
 * Executes one allow-listed named query against SQLite and returns the REAL
 * result set plus the measured execution time. Only ids present in
 * db/analytics_queries.json can run — arbitrary SQL is not accepted.
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    let id: string | undefined;
    try {
      const body = await req.json();
      id = body?.id;
    } catch {
      return fail('Invalid JSON body; expected { "id": "<query id>" }', 400);
    }
    if (!id || typeof id !== 'string') return fail('Missing query id', 400);

    const q = loadQueries().find((x) => x.id === id);
    if (!q) return fail(`Unknown query id: ${id}`, 404);

    const started = performance.now();
    const rows = query(q.sql);
    const durationMs = Math.round((performance.now() - started) * 1000) / 1000;

    const columns = rows.length ? Object.keys(rows[0] as object) : [];
    return ok({
      id: q.id,
      experiment: q.experiment,
      title: q.title,
      description: q.description,
      sql: q.sql,
      columns,
      rows,
      rowCount: rows.length,
      durationMs,
    });
  });
}
