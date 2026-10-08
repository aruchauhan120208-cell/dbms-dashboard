import { guard, ok } from '@/lib/api';
import { query } from '@/lib/db';
import { THRESHOLD_C, THRESHOLD_K } from '@/lib/heatwave';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/heatwave — heatwave event analysis driven by HEATEVE. */
export async function GET() {
  return guard(async () => {
    const byYear = query(`
      SELECT CAST(SUBSTR(h.date,1,4) AS INTEGER) AS year,
             SUM(h.severity) AS heatwave_days,
             COUNT(*) AS observations
      FROM HEATEVE h GROUP BY year ORDER BY year
    `);

    const byDistrict = query(`
      SELECT r.district, SUM(h.severity) AS heatwave_days
      FROM HEATEVE h
      JOIN OBSERVATION o ON o.obs_id = h.obs_id
      JOIN REGION r ON r.region_id = o.region_id
      GROUP BY r.district ORDER BY heatwave_days DESC
    `);

    const byMonth = query(`
      SELECT CAST(SUBSTR(h.date,6,2) AS INTEGER) AS month, SUM(h.severity) AS heatwave_days
      FROM HEATEVE h GROUP BY month ORDER BY month
    `);

    const totals = query(`
      SELECT (SELECT COUNT(*) FROM HEATEVE WHERE severity = 1) AS heatwave_days,
             (SELECT COUNT(*) FROM HEATEVE) AS total_rows,
             (SELECT ROUND(MAX(maxtemp) - 273.15, 2) FROM OBSERVATION) AS record_high_c
    `)[0];

    return ok({ byYear, byDistrict, byMonth, totals, thresholdC: THRESHOLD_C, thresholdK: THRESHOLD_K });
  });
}
