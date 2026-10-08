'use client';

import { useApi, fmtInt } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader } from '@/components/Page';
import { Loading, ErrorState } from '@/components/States';

type Relation = {
  name: string;
  columns: { name: string; type: string; notNull: boolean; primaryKey: boolean }[];
  primaryKey: string[];
  foreignKeys: { column: string; references: string }[];
  indexes: { name: string; unique: boolean }[];
  rowCount: number;
};

export default function DbModelPage() {
  const { data, loading, error } = useApi<{
    database: string; file: string; relations: Relation[]; count: number;
  }>('/api/db-model');

  return (
    <>
      <PageHeader title="Database Model">
        Live introspection of the SQLite schema (read from <code>sqlite_master</code> and <code>PRAGMA</code>),
        which implements the Experiment-2 relational model. Primary keys and foreign keys below are the
        database&apos;s actual constraints, not a description.
      </PageHeader>

      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
            <span className="rounded bg-slate-100 px-2 py-1">{data.database}</span>
            <span className="rounded bg-slate-100 px-2 py-1">{data.file}</span>
            <span className="rounded bg-slate-100 px-2 py-1">{data.count} relations</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.relations.map((r) => (
              <Card
                key={r.name}
                title={r.name}
                subtitle={`${fmtInt(r.rowCount)} rows · PK: ${r.primaryKey.join(', ') || '—'}`}
              >
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1">Column</th>
                      <th className="py-1">Type</th>
                      <th className="py-1">Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.columns.map((c) => (
                      <tr key={c.name} className="border-t border-[var(--border)]">
                        <td className="py-1 font-medium text-slate-800">
                          {c.name}
                          {c.notNull ? <span className="ml-1 text-[10px] text-slate-400">NOT NULL</span> : null}
                        </td>
                        <td className="py-1 text-slate-500">{c.type || '—'}</td>
                        <td className="py-1">
                          {c.primaryKey ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700">PK</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {r.foreignKeys.length ? (
                  <div className="mt-2">
                    <div className="text-[11px] font-semibold text-slate-600">Foreign keys</div>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                      {r.foreignKeys.map((f, i) => (
                        <li key={i}>
                          {f.column} → {f.references}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {r.indexes.length ? (
                  <div className="mt-2 text-[11px] text-slate-500">
                    Indexes: {r.indexes.map((i) => i.name).join(', ')}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
