import type { NextRequest } from 'next/server';
import { guard, ok, num, str } from '@/lib/api';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/temperature?district=&year=
 * Temperature analysis: monthly aggregates, per-year averages, daily series.
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams;
    const district = str(sp.get('district'));
    const year = sp.get('year') ? num(sp.get('year'), 0) : null;

    const where: string[] = [];
    const params: (string | number)[] = [];
    if (district) { where.push('r.district = ?'); params.push(district); }
    if (year) { where.push('CAST(SUBSTR(o.date,1,4) AS INTEGER) = ?'); params.push(year); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const monthly = query(`
      SELECT CAST(SUBSTR(o.date,6,2) AS INTEGER) AS month,
             ROUND(MIN(o.maxtemp) - 273.15, 2) AS min_c,
             ROUND(AVG(o.maxtemp) - 273.15, 2) AS avg_c,
             ROUND(MAX(o.maxtemp) - 273.15, 2) AS max_c,
             COUNT(*) AS n
      FROM OBSERVATION o JOIN REGION r ON r.region_id = o.region_id
      ${w} GROUP BY month ORDER BY month
    `, params);

    const yearly = query(`
      SELECT CAST(SUBSTR(o.date,1,4) AS INTEGER) AS year,
             ROUND(AVG(o.maxtemp) - 273.15, 2) AS avg_c,
             ROUND(MAX(o.maxtemp) - 273.15, 2) AS max_c
      FROM OBSERVATION o JOIN REGION r ON r.region_id = o.region_id
      ${w} GROUP BY year ORDER BY year
    `, params);

    const daily = query(`
      SELECT o.date, ROUND(o.maxtemp - 273.15, 2) AS tmax_c, r.district
      FROM OBSERVATION o JOIN REGION r ON r.region_id = o.region_id
      ${w} ORDER BY o.date LIMIT 400
    `, params);

    return ok({ monthly, yearly, daily, filters: { district, year } });
  });
}
