'use client';

import { useState } from 'react';
import { useApi, fmtInt } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader } from '@/components/Page';
import { Loading, ErrorState, EmptyState } from '@/components/States';

type QueryMeta = { id: string; experiment: string; title: string; description: string; sql: string };
type RunResult = {
  id: string; experiment: string; title: string; description: string; sql: string;
  columns: string[]; rows: Record<string, unknown>[]; rowCount: number; durationMs: number;
};

export default function SqlAnalyticsPage() {
  const { data, loading, error } = useApi<{ queries: QueryMeta[]; count: number }>('/api/sql-analytics');
  const [selected, setSelected] = useState<QueryMeta | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  async function runQuery(q: QueryMeta) {
    setSelected(q);
    setRunning(true);
    setRunError(null);
    setResult(null);
    try {
      const res = await fetch('/api/sql-analytics/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: q.id }),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) setRunError(body.error ?? `HTTP ${res.status}`);
      else setResult(body.data as RunResult);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setRunning(false);
    }
  }

  const grouped = (data?.queries ?? []).reduce<Record<string, QueryMeta[]>>((acc, q) => {
    (acc[q.experiment] ??= []).push(q);
    return acc;
  }, {});

  return (
    <>
      <PageHeader title="SQL Analytics">
        Each query below is executed live against SQLite when you run it, and the real result set plus the
        measured execution time is shown. Queries map to the DBMS experiments (SELECT/WHERE/ORDER BY/BETWEEN/IN/
        NOT IN/LIKE, aggregates/GROUP BY/HAVING, subqueries/joins/views). SQLite has no <code>ALL</code>/<code>FULL OUTER JOIN</code>;
        those are emulated, as noted on the query.
      </PageHeader>

      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            {Object.entries(grouped).map(([exp, qs]) => (
              <Card key={exp} title={exp}>
                <ul className="space-y-1">
                  {qs.map((q) => (
                    <li key={q.id}>
                      <button
                        onClick={() => runQuery(q)}
                        aria-pressed={selected?.id === q.id}
                        className={
                          'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ' +
                          (selected?.id === q.id ? 'bg-[var(--brand)] text-white' : 'hover:bg-slate-100 text-slate-700')
                        }
                      >
                        {q.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-2">
            <Card title={result ? result.title : selected ? selected.title : 'Result'} subtitle={selected?.description}>
              {running ? <Loading label="Running query…" /> : runError ? <ErrorState message={runError} /> : result ? (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                    <span className="rounded bg-slate-100 px-2 py-0.5">{result.experiment}</span>
                    <span>{fmtInt(result.rowCount)} rows</span>
                    <span>measured {result.durationMs} ms</span>
                  </div>
                  <pre className="mb-3 overflow-auto scrollbar-thin rounded-md bg-slate-900 p-3 text-xs text-slate-100">
{result.sql}
                  </pre>
                  {result.rowCount === 0 ? (
                    <EmptyState message="Query ran successfully but returned no rows." />
                  ) : (
                    <div className="overflow-auto scrollbar-thin" style={{ maxHeight: 460 }}>
                      <table className="w-full border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-50">
                          <tr>
                            {result.columns.map((c) => (
                              <th key={c} className="border-b border-[var(--border)] px-2 py-1.5 text-left font-semibold text-slate-700">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((r, i) => (
                            <tr key={i} className="odd:bg-white even:bg-slate-50/50">
                              {result.columns.map((c) => (
                                <td key={c} className="border-b border-[var(--border)] px-2 py-1 tabular-nums text-slate-700">
                                  {r[c] === null || r[c] === undefined ? '—' : String(r[c])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState message="Select a query on the left to run it." hint="The result table and measured time will appear here." />
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
