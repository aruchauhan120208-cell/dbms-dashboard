'use client';

import { useApi, fmt } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader } from '@/components/Page';
import { Loading, ErrorState, EmptyState } from '@/components/States';
import { DataTable } from '@/components/DataTable';

type Advisory = {
  advisory_id: number; issue_date: string; issue_time: string; msg: string;
  event_id: number; event_date: string; severity: number; district: string; stakeholders: number;
};

export default function AdvisoriesPage() {
  const { data, loading, error } = useApi<{
    advisories: Advisory[]; count: number; thresholdC: number; message: string | null;
  }>('/api/advisories');

  return (
    <>
      <PageHeader title="Advisories">
        An advisory is generated <strong>only</strong> when a forecast actually meets the heatwave threshold
        ({data ? fmt(data.thresholdC) : '—'} °C). No qualifying forecast means no advisories — reported honestly.
      </PageHeader>

      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <Card title={`Advisory records (${data.count})`} subtitle="ADVISORY joined to HEATEVE and REGION">
          {data.count === 0 ? (
            <EmptyState
              message="No active predicted advisories."
              hint={data.message ?? 'No 7-day moving-average forecast reached the heatwave threshold.'}
            />
          ) : (
            <DataTable<Advisory>
              rows={data.advisories}
              columns={[
                { key: 'advisory_id', header: 'advisory_id', align: 'right' },
                { key: 'district', header: 'District' },
                { key: 'event_date', header: 'Event date' },
                { key: 'severity', header: 'Severity', align: 'right' },
                { key: 'issue_date', header: 'Issued' },
                { key: 'issue_time', header: 'Time' },
                { key: 'msg', header: 'Message' },
                { key: 'stakeholders', header: 'Stakeholders', align: 'right' },
              ]}
            />
          )}
        </Card>
      ) : null}
    </>
  );
}
