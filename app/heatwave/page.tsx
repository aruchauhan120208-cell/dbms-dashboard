'use client';

import { useApi, fmt, fmtInt } from '@/lib/useApi';
import { KpiCard, Card } from '@/components/KpiCard';
import { PageHeader, Grid } from '@/components/Page';
import { Loading, ErrorState } from '@/components/States';
import { BarSeries, HBar, BRAND, ACCENT } from '@/components/Charts';

type HeatwaveData = {
  byYear: { year: number; heatwave_days: number; observations: number }[];
  byDistrict: { district: string; heatwave_days: number }[];
  byMonth: { month: number; heatwave_days: number }[];
  totals: { heatwave_days: number; total_rows: number; record_high_c: number };
  thresholdC: number;
  thresholdK: number;
};

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function HeatwavePage() {
  const { data, loading, error } = useApi<HeatwaveData>('/api/heatwave');

  return (
    <>
      <PageHeader title="Heatwave Analysis">
        A heatwave day is a day whose TMAX reaches the threshold of {data ? fmt(data.thresholdC) : '—'} °C
        ({data ? data.thresholdK : '—'} K) — the value at which the dataset&apos;s own HEATWAVE flag flips.
        Events are read from HEATEVE (severity = the raw flag).
      </PageHeader>

      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <>
          <Grid cols={3}>
            <KpiCard label="Heatwave days" value={fmtInt(data.totals.heatwave_days)} hint="severity = 1" />
            <KpiCard label="Total daily records" value={fmtInt(data.totals.total_rows)} hint="HEATEVE rows" />
            <KpiCard label="Record high" value={fmt(data.totals.record_high_c)} unit="°C" hint="max TMAX observed" />
          </Grid>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Heatwave days per year" subtitle="SUM(severity) GROUP BY year">
              <BarSeries data={data.byYear} xKey="year" series={[{ key: 'heatwave_days', name: 'Heatwave days', color: BRAND }]} />
            </Card>
            <Card title="Heatwave days per district" subtitle="JOIN HEATEVE → OBSERVATION → REGION">
              <HBar data={data.byDistrict} yKey="district" valueKey="heatwave_days" colorBy={() => ACCENT} />
            </Card>
            <Card title="Heatwave days by month" subtitle="GROUP BY month" className="lg:col-span-2">
              <BarSeries
                data={data.byMonth.map((m) => ({ ...m, month: MONTHS[m.month] }))}
                xKey="month"
                series={[{ key: 'heatwave_days', name: 'Heatwave days', color: BRAND }]}
              />
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}
