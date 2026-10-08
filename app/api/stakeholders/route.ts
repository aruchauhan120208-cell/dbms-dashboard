import { guard, ok } from '@/lib/api';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/stakeholders — STAKEHOLDER with ADVISORY_STAKEHOLDER links.
 * The source dataset contains no stakeholder records, so this table is
 * intentionally empty; the response says so rather than inventing records.
 */
export async function GET() {
  return guard(async () => {
    const stakeholders = query(`
      SELECT s.stakeholder_id, s.type, s.org, s.contact, s.role,
             (SELECT COUNT(*) FROM ADVISORY_STAKEHOLDER a WHERE a.stakeholder_id = s.stakeholder_id) AS advisories
      FROM STAKEHOLDER s ORDER BY s.stakeholder_id
    `);
    const links = query(`
      SELECT ast.advisory_id, ast.stakeholder_id, s.org, a.issue_date
      FROM ADVISORY_STAKEHOLDER ast
      JOIN STAKEHOLDER s ON s.stakeholder_id = ast.stakeholder_id
      LEFT JOIN ADVISORY a ON a.advisory_id = ast.advisory_id
    `);
    return ok({
      stakeholders,
      links,
      count: stakeholders.length,
      message: stakeholders.length
        ? null
        : 'No stakeholder records: the source dataset contains no stakeholder data, and none were fabricated.',
    });
  });
}
