import type { NextRequest } from 'next/server';
import { guard, ok, num, str } from '@/lib/api';
import { query, queryOne } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/observations — paginated, filterable Data Explorer over OBSERVATION.
 * Params: district, year, month, status, q (district search), limit, offset.
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams;
    const district = str(sp.get('district'));
    const status = str(sp.get('status'));
    const year = sp.get('year') ? num(sp.get('year'), 0) : null;
    const month = sp.get('month') ? num(sp.get('month'), 0) : null;
    const q = str(sp.get('q'));
    const limit = Math.min(Math.max(num(sp.get('limit'), 50), 1), 500);
    const offset = Math.max(num(sp.get('offset'), 0), 0);

    const where: string[] = [];
    const params: (string | number)[] = [];
    if (district) { where.push('r.district = ?'); params.push(district); }
    if (status) { where.push('o.status = ?'); params.push(status); }
    if (year) { where.push('CAST(SUBSTR(o.date,1,4) AS INTEGER) = ?'); params.push(year); }
    if (month) { where.push('CAST(SUBSTR(o.date,6,2) AS INTEGER) = ?'); params.push(month); }
    if (q) { where.push('r.district LIKE ?'); params.push('%' + q + '%'); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const total = queryOne<{ n: number }>(
      `SELECT COUNT(*) n FROM OBSERVATION o JOIN REGION r ON r.region_id = o.region_id ${w}`, params,
    )!.n;

    const rows = query(`
      SELECT o.obs_id, r.district, o.date,
             ROUND(o.maxtemp - 273.15, 2) AS tmax_c,
             ROUND(o.avgtemp - 273.15, 2) AS tavg_c,
             o.status, o.source_id
      FROM OBSERVATION o JOIN REGION r ON r.region_id = o.region_id
      ${w} ORDER BY o.date, r.district LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return ok({ rows, total, limit, offset, filters: { district, status, year, month, q } });
  });
}
