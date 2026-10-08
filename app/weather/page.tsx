'use client';

import { useState } from 'react';
import { useApi, fmt } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader, Grid } from '@/components/Page';
import { KpiCard } from '@/components/KpiCard';
import { Loading, ErrorState, EmptyState } from '@/components/States';

type Weather = {
  district: string; latitude: number; longitude: number; tempC: number | null;
  feelsLikeC: number | null; humidity: number | null; pressure: number | null;
  windSpeed: number | null; description: string | null; observedAt: string | null;
  isHeatwave: boolean; thresholdC: number; source: string;
};

export default function WeatherPage() {
  const regions = useApi<{ regions: { district: string }[] }>('/api/regions');
  const [district, setDistrict] = useState('Jaisalmer');
  const { data, loading, error } = useApi<Weather>(`/api/weather?district=${encodeURIComponent(district)}`, [district]);

  const needsConfig = error?.includes('not configured') || error?.includes('OPENWEATHER_API_KEY');

  return (
    <>
      <PageHeader title="Live Weather">
        Current conditions fetched by the backend from OpenWeather using each district&apos;s coordinates. The
        browser calls this app&apos;s API route; the OpenWeather key is used server-side only and never sent to the client.
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          District{' '}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="ml-1 rounded-md border border-[var(--border)] bg-white px-2 py-1 text-sm"
          >
            {regions.data?.regions.map((r) => <option key={r.district} value={r.district}>{r.district}</option>)}
          </select>
        </label>
      </div>

      {loading ? <Loading label="Contacting OpenWeather…" /> : null}

      {needsConfig ? (
        <Card title="OpenWeather not configured">
          <EmptyState
            message="Live weather is unavailable until an API key is configured."
            hint="Set OPENWEATHER_API_KEY in your .env file (see .env.example) and restart the server. The rest of the application works without it."
          />
        </Card>
      ) : error ? (
        <ErrorState message={error} hint="The backend could not complete the OpenWeather request." />
      ) : null}

      {data && !error ? (
        <>
          <Grid cols={4}>
            <KpiCard label="Temperature" value={fmt(data.tempC, 1)} unit="°C" hint={data.district} />
            <KpiCard label="Feels like" value={fmt(data.feelsLikeC, 1)} unit="°C" />
            <KpiCard label="Humidity" value={data.humidity ?? '—'} unit="%" />
            <KpiCard label="Wind" value={fmt(data.windSpeed, 1)} unit="m/s" />
          </Grid>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Conditions">
              <dl className="space-y-2 text-sm">
                <Row label="District" value={data.district} />
                <Row label="Coordinates" value={`${fmt(data.latitude, 2)}, ${fmt(data.longitude, 2)}`} />
                <Row label="Description" value={data.description ?? '—'} />
                <Row label="Pressure" value={data.pressure ? `${data.pressure} hPa` : '—'} />
                <Row label="Observed at" value={data.observedAt ? new Date(data.observedAt).toLocaleString() : '—'} />
                <Row label="Source" value={data.source} />
              </dl>
            </Card>
            <Card title="Heatwave status">
              <div className={
                'rounded-md p-4 text-sm ' +
                (data.isHeatwave ? 'bg-red-50 text-red-800' : 'bg-slate-50 text-slate-700')
              }>
                {data.isHeatwave
                  ? `Current temperature (${fmt(data.tempC, 1)} °C) is at or above the heatwave threshold of ${fmt(data.thresholdC)} °C.`
                  : `Current temperature (${fmt(data.tempC, 1)} °C) is below the heatwave threshold of ${fmt(data.thresholdC)} °C.`}
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                The threshold is the same value used for the historical analysis, derived from the dataset.
              </p>
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--border)] pb-1">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
