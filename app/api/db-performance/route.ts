import { guard, ok } from '@/lib/api';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Probe = { id: string; label: string; sql: string; plan: string; note: string };

/**
 * GET /api/db-performance — MEASURED query plans and wall-clock timings.
 *
 * Everything here is measured at request time on the running database; nothing
 * is hard-coded. `region_id = ?` can use idx_obs_region_date, whereas
 * `region_id + 0 = ?` defeats the index and forces a full table scan, which lets
 * us show the real difference an index makes (Experiment 8).
 */
const PROBES: Probe[] = [
  {
    id: 'indexed_lookup',
    label: 'Indexed lookup (region_id = 1)',
    sql: 'SELECT COUNT(*) n FROM OBSERVATION WHERE region_id = 1',
    plan: 'SELECT * FROM OBSERVATION WHERE region_id = 1',
    note: 'Uses idx_obs_region_date.',
  },
  {
    id: 'full_scan',
    label: 'Full scan (region_id + 0 = 1)',
    sql: 'SELECT COUNT(*) n FROM OBSERVATION WHERE region_id + 0 = 1',
    plan: 'SELECT * FROM OBSERVATION WHERE region_id + 0 = 1',
    note: 'The expression defeats the index, forcing a full table scan.',
  },
  {
    id: 'date_range_indexed',
    label: 'Indexed date range (date BETWEEN ...)',
    sql: "SELECT COUNT(*) n FROM OBSERVATION WHERE date BETWEEN '2010-05-01' AND '2010-05-31'",
    plan: "SELECT * FROM OBSERVATION WHERE date BETWEEN '2010-05-01' AND '2010-05-31'",
    note: 'Uses idx_obs_date.',
  },
  {
    id: 'heatwave_by_severity',
    label: 'Heatwave events by severity (indexed)',
    sql: 'SELECT COUNT(*) n FROM HEATEVE WHERE severity = 1',
    plan: 'SELECT * FROM HEATEVE WHERE severity = 1',
    note: 'Uses idx_heateve_severity.',
  },
  {
    id: 'district_join',
    label: 'District aggregate over a JOIN',
    sql: `SELECT r.district, ROUND(AVG(o.maxtemp),2) FROM OBSERVATION o
          JOIN REGION r ON r.region_id = o.region_id GROUP BY r.district`,
    plan: `SELECT r.district, AVG(o.maxtemp) FROM OBSERVATION o
          JOIN REGION r ON r.region_id = o.region_id GROUP BY r.district`,
    note: 'Join + aggregation; exercises the region_id index on the join key.',
  },
];

const REPS = 25;

export async function GET() {
  return guard(async () => {
    const results = PROBES.map((p) => {
      // Real query plan as reported by SQLite.
      const planRows = query<{ detail: string }>(`EXPLAIN QUERY PLAN ${p.plan}`);
      const planText = planRows.map((r) => r.detail).join(' | ');

      // Warm-up, then measure REPS executions.
      for (let i = 0; i < 3; i++) query(p.sql);
      const t0 = performance.now();
      for (let i = 0; i < REPS; i++) query(p.sql);
      const totalMs = performance.now() - t0;
      const avgMs = Math.round((totalMs / REPS) * 1000) / 1000;

      return {
        id: p.id,
        label: p.label,
        note: p.note,
        plan: planText,
        usesIndex: /USING (COVERING )?INDEX/i.test(planText),
        avgMs,
        reps: REPS,
      };
    });

    const indexed = results.find((r) => r.id === 'indexed_lookup');
    const scan = results.find((r) => r.id === 'full_scan');
    const speedup =
      indexed && scan && indexed.avgMs > 0 ? Math.round((scan.avgMs / indexed.avgMs) * 100) / 100 : null;

    return ok({
      results,
      reps: REPS,
      comparison: indexed && scan ? { indexedAvgMs: indexed.avgMs, fullScanAvgMs: scan.avgMs, speedup } : null,
      measuredAt: new Date().toISOString(),
      caveat:
        'Timings are measured live on this machine for this database; absolute numbers vary by hardware and load. They are not fixed benchmarks.',
    });
  });
}
