'use client';

import { useApi } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader, Grid } from '@/components/Page';
import { Loading, ErrorState } from '@/components/States';
import { KpiCard } from '@/components/KpiCard';

type ProbeResult = {
  id: string; label: string; note: string; plan: string; usesIndex: boolean; avgMs: number; reps: number;
};

export default function PerformancePage() {
  const { data, loading, error } = useApi<{
    results: ProbeResult[];
    reps: number;
    comparison: { indexedAvgMs: number; fullScanAvgMs: number; speedup: number | null } | null;
    measuredAt: string;
    caveat: string;
  }>('/api/db-performance');

  return (
    <>
      <PageHeader title="Database Performance">
        Measured at request time (Experiment 8: indexing &amp; query optimization). Each probe is executed
        many times and timed on this machine; the query plan is SQLite&apos;s own <code>EXPLAIN QUERY PLAN</code>.
        Nothing here is hard-coded.
      </PageHeader>

      {loading ? <Loading label="Measuring queries…" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <>
          {data.comparison ? (
            <Grid cols={3}>
              <KpiCard label="Indexed lookup" value={`${data.comparison.indexedAvgMs} ms`} hint="region_id = 1 (uses index)" />
              <KpiCard label="Full scan" value={`${data.comparison.fullScanAvgMs} ms`} hint="region_id + 0 = 1 (no index)" />
              <KpiCard
                label="Index speed-up"
                value={data.comparison.speedup ? `${data.comparison.speedup}×` : '—'}
                hint="scan ÷ indexed, same machine"
              />
            </Grid>
          ) : null}

          <div className="mt-4 space-y-4">
            {data.results.map((r) => (
              <Card key={r.id} title={r.label} subtitle={r.note}>
                <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[var(--muted)]">{r.reps} runs</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">avg {r.avgMs} ms</span>
                  <span className={
                    r.usesIndex
                      ? 'rounded bg-green-100 px-2 py-0.5 text-green-700'
                      : 'rounded bg-amber-100 px-2 py-0.5 text-amber-700'
                  }>
                    {r.usesIndex ? 'uses index' : 'no index (scan)'}
                  </span>
                </div>
                <pre className="overflow-auto scrollbar-thin rounded-md bg-slate-900 p-3 text-xs text-slate-100">
{r.plan}
                </pre>
              </Card>
            ))}
          </div>

          <p className="mt-4 text-xs text-[var(--muted)]">
            {data.caveat} Measured at {new Date(data.measuredAt).toLocaleString()}.
          </p>
        </>
      ) : null}
    </>
  );
}
