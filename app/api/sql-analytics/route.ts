import { guard, ok } from '@/lib/api';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type AnalyticsQuery = {
  id: string; experiment: string; title: string; description: string; sql: string;
};

export function loadQueries(): AnalyticsQuery[] {
  const file = path.join(process.cwd(), 'db', 'analytics_queries.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  return json.queries as AnalyticsQuery[];
}

/** GET /api/sql-analytics — the catalogue of runnable named queries. */
export async function GET() {
  return guard(async () => {
    const queries = loadQueries().map(({ id, experiment, title, description, sql }) => ({
      id, experiment, title, description, sql,
    }));
    return ok({ queries, count: queries.length });
  });
}
