'use client';

import { useState } from 'react';
import { useApi, fmt } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader } from '@/components/Page';
import { Loading, ErrorState, EmptyState } from '@/components/States';
import { LineSeries, BarSeries } from '@/components/Charts';

type TempData = {
  monthly: { month: number; min_c: number; avg_c: number; max_c: number; n: number }[];
  yearly: { year: number; avg_c: number; max_c: number }[];
  daily: { date: string; tmax_c: number; district: string }[];
};

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TemperaturePage() {
  const regions = useApi<{ regions: { district: string }[] }>('/api/regions');
  const [district, setDistrict] = useState('');
  const [year, setYear] = useState('');

  const qs = new URLSearchParams();
  if (district) qs.set('district', district);
  if (year) qs.set('year', year);
  const { data, loading, error } = useApi<TempData>(`/api/temperature?${qs.toString()}`, [district, year]);

  const years = Array.from({ length: 20 }, (_, i) => 2006 + i);

  return (
    <>
      <PageHeader title="Temperature Analysis">
        Monthly, yearly and daily TMAX statistics from OBSERVATION (converted from Kelvin to °C in the API).
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          District{' '}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="ml-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
          >
            <option value="">All districts</option>
            {regions.data?.regions.map((r) => (
              <option key={r.district} value={r.district}>{r.district}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Year{' '}
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="ml-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
          >
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Monthly min / average / max TMAX" subtitle="GROUP BY month over the filtered rows">
            {data.monthly.length ? (
              <BarSeries
                data={data.monthly.map((m) => ({ ...m, month: MONTHS[m.month] }))}
                xKey="month"
                series={[
                  { key: 'min_c', name: 'Min °C' },
                  { key: 'avg_c', name: 'Avg °C' },
                  { key: 'max_c', name: 'Max °C' },
                ]}
              />
            ) : <EmptyState message="No observations match these filters." />}
          </Card>

          <Card title="Yearly average & maximum TMAX" subtitle="GROUP BY year">
            {data.yearly.length ? (
              <LineSeries
                data={data.yearly}
                xKey="year"
                series={[
                  { key: 'avg_c', name: 'Avg °C' },
                  { key: 'max_c', name: 'Max °C' },
                ]}
              />
            ) : <EmptyState message="No observations match these filters." />}
          </Card>

          <Card title="Daily TMAX series" subtitle="First 400 matching observations (ORDER BY date)" className="lg:col-span-2">
            {data.daily.length ? (
              <LineSeries data={data.daily} xKey="date" series={[{ key: 'tmax_c', name: 'TMAX °C' }]} height={280} />
            ) : <EmptyState message="No observations match these filters." />}
          </Card>

          <Card title="Monthly summary table" className="lg:col-span-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Min °C</th>
                  <th className="px-3 py-2 text-right">Avg °C</th>
                  <th className="px-3 py-2 text-right">Max °C</th>
                  <th className="px-3 py-2 text-right">Rows</th>
                </tr>
              </thead>
              <tbody>
                {data.monthly.map((m) => (
                  <tr key={m.month} className="border-t border-[var(--border)]">
                    <td className="px-3 py-1.5">{MONTHS[m.month]}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.min_c)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.avg_c)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(m.max_c)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{m.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ) : null}
    </>
  );
}
