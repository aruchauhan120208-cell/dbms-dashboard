'use client';

import { useApi, fmt, fmtInt } from '@/lib/useApi';
import { KpiCard, Card } from '@/components/KpiCard';
import { PageHeader, Grid } from '@/components/Page';
import { Loading, ErrorState } from '@/components/States';
import { BarSeries, BRAND } from '@/components/Charts';

type Overview = {
  observations: number; districts: number; years: number;
  firstDate: string; lastDate: string; heatwaveEvents: number;
  avgTmaxC: number; maxTmaxC: number; minTmaxC: number;
  forecasts: number; advisories: number; stakeholders: number;
  thresholdC: number; thresholdK: number;
  hottest: { district: string; date: string; tmaxC: number };
};

export default function OverviewPage() {
  const { data, loading, error } = useApi<Overview>('/api/overview');
  const hw = useApi<{ byYear: { year: number; heatwave_days: number }[] }>('/api/heatwave');

  return (
    <>
      <PageHeader title="Overview">
        Headline figures for the Rajasthan heatwave dataset, computed directly from SQLite. A heatwave day
        is TMAX ≥ {data ? fmt(data.thresholdC) : '—'} °C, the threshold derived from the dataset&apos;s own flag.
      </PageHeader>

      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <>
          <Grid cols={4}>
            <KpiCard label="Observations" value={fmtInt(data.observations)} hint="OBSERVATION rows" />
            <KpiCard label="Districts" value={fmtInt(data.districts)} hint="REGION rows" />
            <KpiCard label="Period" value={`${data.years} yrs`} hint={`${data.firstDate} → ${data.lastDate}`} />
            <KpiCard label="Heatwave days" value={fmtInt(data.heatwaveEvents)} hint="HEATEVE severity = 1" />
          </Grid>

          <div className="mt-4">
            <Grid cols={4}>
              <KpiCard label="Average TMAX" value={fmt(data.avgTmaxC)} unit="°C" />
              <KpiCard label="Record high" value={fmt(data.maxTmaxC)} unit="°C" hint={`${data.hottest.district}, ${data.hottest.date}`} />
              <KpiCard label="Lowest TMAX" value={fmt(data.minTmaxC)} unit="°C" />
              <KpiCard label="Active advisories" value={fmtInt(data.advisories)} hint={`${fmtInt(data.forecasts)} forecast rows`} />
            </Grid>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Heatwave days per year" subtitle="SUM(severity) grouped by year — from HEATEVE">
              {hw.loading ? <Loading /> : hw.error ? <ErrorState message={hw.error} /> : (
                <BarSeries
                  data={hw.data!.byYear}
                  xKey="year"
                  series={[{ key: 'heatwave_days', name: 'Heatwave days', color: BRAND }]}
                />
              )}
            </Card>
            <Card title="About this system">
              <ul className="space-y-2 text-sm text-slate-700">
                <li>• <strong>Architecture:</strong> Frontend → API routes → SQLite. Live weather: Frontend → API route → OpenWeather → API route → Frontend.</li>
                <li>• <strong>Schema:</strong> the eight Experiment-2 relations (SOURCE, REGION, OBSERVATION, FORECAST, HEATEVE, ADVISORY, STAKEHOLDER, ADVISORY_STAKEHOLDER).</li>
                <li>• <strong>Data:</strong> {fmtInt(data.observations)} daily observations imported from the provided CSV.</li>
                <li>• <strong>Forecasting:</strong> 7-day moving average of TMAX (demo method, not ML).</li>
                <li>• <strong>Advisories:</strong> generated only when a forecast meets the heatwave threshold — currently {data.advisories}.</li>
              </ul>
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}
