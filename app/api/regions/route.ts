import { guard, ok } from '@/lib/api';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/regions — per-district statistics (JOIN REGION <-> OBSERVATION). */
export async function GET() {
  return guard(async () => {
    const regions = query(`
      SELECT r.region_id, r.district, ROUND(r.latitude,2) AS latitude, ROUND(r.longitude,2) AS longitude,
             COUNT(o.obs_id) AS observations,
             ROUND(MIN(o.maxtemp) - 273.15, 2) AS min_c,
             ROUND(AVG(o.maxtemp) - 273.15, 2) AS avg_c,
             ROUND(MAX(o.maxtemp) - 273.15, 2) AS max_c,
             SUM(CASE WHEN o.status = 'heatwave' THEN 1 ELSE 0 END) AS heatwave_days
      FROM REGION r
      LEFT JOIN OBSERVATION o ON o.region_id = r.region_id
      GROUP BY r.region_id ORDER BY avg_c DESC
    `);
    return ok({ regions });
  });
}
