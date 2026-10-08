'use client';

import { useApi, fmt, fmtInt } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader } from '@/components/Page';
import { Loading, ErrorState } from '@/components/States';
import { HBar, ACCENT, BRAND } from '@/components/Charts';
import { DataTable } from '@/components/DataTable';

type Region = {
  region_id: number; district: string; latitude: number; longitude: number;
  observations: number; min_c: number; avg_c: number; max_c: number; heatwave_days: number;
};

export default function RegionsPage() {
  const { data, loading, error } = useApi<{ regions: Region[] }>('/api/regions');

  return (
    <>
      <PageHeader title="Regional Analysis">
        Per-district statistics from a LEFT JOIN between REGION and OBSERVATION, ordered by average TMAX.
      </PageHeader>

      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Average TMAX by district" subtitle="AVG(maxtemp) GROUP BY district">
            <HBar data={data.regions} yKey="district" valueKey="avg_c" colorBy={() => ACCENT} />
          </Card>
          <Card title="Heatwave days by district" subtitle="days with severity = 1">
            <HBar data={data.regions} yKey="district" valueKey="heatwave_days" colorBy={() => BRAND} />
          </Card>

          <Card title="District detail" className="lg:col-span-2">
            <DataTable<Region>
              rows={data.regions}
              columns={[
                { key: 'region_id', header: 'region_id', align: 'right' },
                { key: 'district', header: 'District' },
                { key: 'latitude', header: 'Latitude', align: 'right', render: (r) => fmt(r.latitude, 2) },
                { key: 'longitude', header: 'Longitude', align: 'right', render: (r) => fmt(r.longitude, 2) },
                { key: 'observations', header: 'Observations', align: 'right', render: (r) => fmtInt(r.observations) },
                { key: 'min_c', header: 'Min °C', align: 'right', render: (r) => fmt(r.min_c) },
                { key: 'avg_c', header: 'Avg °C', align: 'right', render: (r) => fmt(r.avg_c) },
                { key: 'max_c', header: 'Max °C', align: 'right', render: (r) => fmt(r.max_c) },
                { key: 'heatwave_days', header: 'Heatwave days', align: 'right', render: (r) => fmtInt(r.heatwave_days) },
              ]}
            />
          </Card>
        </div>
      ) : null}
    </>
  );
}
