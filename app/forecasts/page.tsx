'use client';

import { useApi, fmt } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader } from '@/components/Page';
import { Loading, ErrorState } from '@/components/States';
import { HBar, BRAND, ACCENT } from '@/components/Charts';
import { DataTable } from '@/components/DataTable';

type Forecast = {
  forecast_id: number; district: string; forecast_date: string;
  predicted_temperature: number; predicted_c: number; obs_id: number;
  basis_last_date: string; exceeds_threshold: boolean;
};

export default function ForecastsPage() {
  const { data, loading, error } = useApi<{
    forecasts: Forecast[]; method: string; thresholdC: number; thresholdK: number;
  }>('/api/forecasts');

  return (
    <>
      <PageHeader title="Forecasts">
        Each forecast is the <strong>7-day moving average of observed TMAX</strong> for that district — a simple
        data-based demo method, <strong>not machine learning</strong>. One forecast per district is stored in
        FORECAST. Threshold: {data ? fmt(data.thresholdC) : '—'} °C.
      </PageHeader>

      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Predicted temperature by district" subtitle="Bars at or above the threshold would be shown in red">
            <HBar
              data={data.forecasts}
              yKey="district"
              valueKey="predicted_c"
              colorBy={(d) => (d.exceeds_threshold ? BRAND : ACCENT)}
            />
          </Card>

          <Card title="Method">
            <p className="text-sm text-slate-700">{data.method}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li>• predicted_temperature = mean of the previous 7 observed TMAX values (same district).</li>
              <li>• Forecast date = the day after the district&apos;s last observation (2025-07-01).</li>
              <li>• Stored in FORECAST with its region_id and obs_id, exactly per the Experiment-2 model.</li>
            </ul>
          </Card>

          <Card title="Forecast rows" className="lg:col-span-2">
            <DataTable<Forecast>
              rows={data.forecasts}
              columns={[
                { key: 'forecast_id', header: 'forecast_id', align: 'right' },
                { key: 'district', header: 'District' },
                { key: 'forecast_date', header: 'Forecast date' },
                { key: 'basis_last_date', header: 'Basis (last obs)' },
                { key: 'predicted_c', header: 'Predicted °C', align: 'right', render: (r) => fmt(r.predicted_c) },
                {
                  key: 'exceeds_threshold', header: 'Meets threshold', align: 'center',
                  render: (r) => (r.exceeds_threshold ? 'Yes' : 'No'),
                },
              ]}
            />
          </Card>
        </div>
      ) : null}
    </>
  );
}
