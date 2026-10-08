'use client';

import { useApi } from '@/lib/useApi';
import { Card } from '@/components/KpiCard';
import { PageHeader } from '@/components/Page';
import { Loading, ErrorState, EmptyState } from '@/components/States';

type Stakeholder = {
  stakeholder_id: number; type: string; org: string; contact: string; role: string; advisories: number;
};

export default function StakeholdersPage() {
  const { data, loading, error } = useApi<{
    stakeholders: Stakeholder[]; count: number; message: string | null;
  }>('/api/stakeholders');

  return (
    <>
      <PageHeader title="Stakeholders">
        STAKEHOLDER records and their ADVISORY_STAKEHOLDER links (the Experiment-2 associative relation).
      </PageHeader>

      {loading ? <Loading /> : null}
      {error ? <ErrorState message={error} /> : null}

      {data ? (
        <Card title={`Stakeholders (${data.count})`} subtitle="STAKEHOLDER + ADVISORY_STAKEHOLDER">
          {data.count === 0 ? (
            <EmptyState
              message="No stakeholder records."
              hint={data.message ?? 'The provided dataset contains no stakeholder data, and none were fabricated.'}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-700">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Organisation</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2 text-right">Advisories</th>
                </tr>
              </thead>
              <tbody>
                {data.stakeholders.map((s) => (
                  <tr key={s.stakeholder_id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-1.5">{s.stakeholder_id}</td>
                    <td className="px-3 py-1.5">{s.type}</td>
                    <td className="px-3 py-1.5">{s.org}</td>
                    <td className="px-3 py-1.5">{s.contact}</td>
                    <td className="px-3 py-1.5">{s.role}</td>
                    <td className="px-3 py-1.5 text-right">{s.advisories}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">
            Note: this section is intentionally empty. The project&apos;s source material contains no stakeholder
            data, so the table is left empty rather than filled with invented people or organisations.
          </p>
        </Card>
      ) : null}
    </>
  );
}
