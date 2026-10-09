'use client';

import type { ReactNode } from 'react';
import { Card } from './KpiCard';

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  empty = 'No rows.',
  maxHeight = 480,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  maxHeight?: number;
}) {
  if (!rows.length) {
    return <div className="py-6 text-center text-sm text-[var(--muted)]">{empty}</div>;
  }
  return (
    <div className="overflow-auto scrollbar-thin" style={{ maxHeight }}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={
                  'border-b border-[var(--border)] px-3 py-2 font-semibold text-slate-700 ' +
                  (c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left')
                }
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="odd:bg-white even:bg-slate-50/50 hover:bg-amber-50/40">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={
                    'border-b border-[var(--border)] px-3 py-1.5 text-slate-700 ' +
                    (c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : '')
                  }
                >
                  {c.render ? c.render(r) : String(r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      {children}
    </Card>
  );
}
