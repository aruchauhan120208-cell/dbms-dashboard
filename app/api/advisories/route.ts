import { guard, ok } from '@/lib/api';
import { query } from '@/lib/db';
import { THRESHOLD_C } from '@/lib/heatwave';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/advisories — ADVISORY joined to HEATEVE and its REGION.
 * Advisories exist only where a forecast satisfied the heatwave condition; an
 * empty result is reported honestly (no fabricated active advisories).
 */
export async function GET() {
  return guard(async () => {
    const advisories = query(`
      SELECT a.advisory_id, a.issue_date, a.issue_time, a.msg,
             h.event_id, h.date AS event_date, h.severity,
             r.district,
             (SELECT COUNT(*) FROM ADVISORY_STAKEHOLDER ast WHERE ast.advisory_id = a.advisory_id) AS stakeholders
      FROM ADVISORY a
      LEFT JOIN HEATEVE h ON h.event_id = a.event_id
      LEFT JOIN OBSERVATION o ON o.obs_id = h.obs_id
      LEFT JOIN REGION r ON r.region_id = o.region_id
      ORDER BY a.issue_date DESC, a.advisory_id DESC
    `);

    return ok({
      advisories,
      count: advisories.length,
      thresholdC: THRESHOLD_C,
      message: advisories.length
        ? null
        : 'No active predicted advisories: no 7-day moving-average forecast reached the heatwave threshold.',
    });
  });
}
