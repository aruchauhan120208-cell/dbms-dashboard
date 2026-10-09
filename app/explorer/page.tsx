'use client';

import { useState } from 'react';
import { useApi, fmt, fmtInt } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader } from '@/components/Page';
import { Loading, ErrorState, EmptyState } from '@/components/States';
import { DataTable } from '@/components/DataTable';

type Row = {
  obs_id: number; district: string; date: string; tmax_c: number; tavg_c: number; status: string; source_id: number;
};

const PAGE = 50;

export default function ExplorerPage() {
  const regions = useApi<{ regions: { district: string }[] }>('/api/regions');
  const [district, setDistrict] = useState('');
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);

  const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
  if (district) qs.set('district', district);
  if (status) qs.set('status', status);
  if (year) qs.set('year', year);
  if (month) qs.set('month', month);
  if (q) qs.set('q', q);

  const { data, loading, error } = useApi<{ rows: Row[]; total: number }>(
    `/api/observations?${qs.toString()}`,
    [district, status, year, month, q, offset],
  );

  const years = Array.from({ length: 20 }, (_, i) => 2006 + i);
  const months = [3, 4, 5, 6];

  function reset(fn: () => void) {
    fn();
    setOffset(0);
  }

  return (
    <>
      <PageHeader title="Data Explorer">
        Browse the OBSERVATION table (joined to REGION). Filters run as SQL WHERE clauses on the server;
        results are paginated {PAGE} rows at a time.
      </PageHeader>

      <Card title="Filters">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            Search district
            <input
              value={q}
              onChange={(e) => reset(() => setQ(e.target.value))}
              placeholder="e.g. Bar"
              className="mt-1 block rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            District
            <select value={district} onChange={(e) => reset(() => setDistrict(e.target.value))}
              className="mt-1 block rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm">
              <option value="">All</option>
              {regions.data?.regions.map((r) => <option key={r.district} value={r.district}>{r.district}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Status
            <select value={status} onChange={(e) => reset(() => setStatus(e.target.value))}
              className="mt-1 block rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm">
              <option value="">All</option>
              <option value="heatwave">heatwave</option>
              <option value="normal">normal</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Year
            <select value={year} onChange={(e) => reset(() => setYear(e.target.value))}
              className="mt-1 block rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm">
              <option value="">All</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Month
            <select value={month} onChange={(e) => reset(() => setMonth(e.target.value))}
              className="mt-1 block rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm">
              <option value="">All</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <button
            onClick={() => { setQ(''); setDistrict(''); setStatus(''); setYear(''); setMonth(''); setOffset(0); }}
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </Card>

      <div className="mt-4">
        <Card
          title={data ? `${fmtInt(data.total)} matching rows` : 'Observations'}
          subtitle="OBSERVATION ⋈ REGION"
        >
          {loading ? <Loading /> : error ? <ErrorState message={error} /> : data && data.rows.length === 0 ? (
            <EmptyState message="No rows match the current filters." />
          ) : data ? (
            <>
              <DataTable<Row>
                rows={data.rows}
                columns={[
                  { key: 'obs_id', header: 'obs_id', align: 'right' },
                  { key: 'district', header: 'District' },
                  { key: 'date', header: 'Date' },
                  { key: 'tmax_c', header: 'TMAX °C', align: 'right', render: (r) => fmt(r.tmax_c) },
                  { key: 'tavg_c', header: 'T2M °C', align: 'right', render: (r) => fmt(r.tavg_c) },
                  {
                    key: 'status', header: 'Status', align: 'center',
                    render: (r) => (
                      <span className={
                        r.status === 'heatwave'
                          ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700'
                          : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                      }>{r.status}</span>
                    ),
                  },
                ]}
              />
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">
                  Showing {offset + 1}–{Math.min(offset + PAGE, data.total)} of {fmtInt(data.total)}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE))}
                    className="rounded-md border border-[var(--border)] bg-white px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-[var(--muted)]"
                  >
                    Previous
                  </button>
                  <button
                    disabled={offset + PAGE >= data.total}
                    onClick={() => setOffset(offset + PAGE)}
                    className="rounded-md border border-[var(--border)] bg-white px-3 py-1 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-[var(--muted)]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </Card>
      </div>
    </>
  );
}
