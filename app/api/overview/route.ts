import { guard, ok } from '@/lib/api';
import { queryOne } from '@/lib/db';
import { THRESHOLD_C, THRESHOLD_K } from '@/lib/heatwave';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/overview — headline KPIs, all computed by SQL. */
export async function GET() {
  return guard(async () => {
    const kpi = queryOne<{
      observations: number;
      districts: number;
      first_date: string;
      last_date: string;
      heatwave_events: number;
      avg_tmax_k: number;
      max_tmax_k: number;
      min_tmax_k: number;
      forecasts: number;
      advisories: number;
      stakeholders: number;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM OBSERVATION)                         AS observations,
        (SELECT COUNT(*) FROM REGION)                              AS districts,
        (SELECT MIN(date) FROM OBSERVATION)                        AS first_date,
        (SELECT MAX(date) FROM OBSERVATION)                        AS last_date,
        (SELECT COUNT(*) FROM HEATEVE WHERE severity = 1)          AS heatwave_events,
        (SELECT AVG(maxtemp) FROM OBSERVATION)                     AS avg_tmax_k,
        (SELECT MAX(maxtemp) FROM OBSERVATION)                     AS max_tmax_k,
        (SELECT MIN(maxtemp) FROM OBSERVATION)                     AS min_tmax_k,
        (SELECT COUNT(*) FROM FORECAST)                            AS forecasts,
        (SELECT COUNT(*) FROM ADVISORY)                            AS advisories,
        (SELECT COUNT(*) FROM STAKEHOLDER)                         AS stakeholders
    `)!;

    const perYear = queryOne<{ n: number }>(
      'SELECT COUNT(DISTINCT CAST(SUBSTR(date,1,4) AS INTEGER)) n FROM OBSERVATION',
    )!;

    const hottest = queryOne<{ district: string; date: string; tmax_k: number }>(`
      SELECT r.district, o.date, o.maxtemp AS tmax_k
      FROM OBSERVATION o JOIN REGION r ON r.region_id = o.region_id
      ORDER BY o.maxtemp DESC LIMIT 1
    `)!;

    return ok({
      observations: kpi.observations,
      districts: kpi.districts,
      years: perYear.n,
      firstDate: kpi.first_date,
      lastDate: kpi.last_date,
      heatwaveEvents: kpi.heatwave_events,
      avgTmaxC: round(kpi.avg_tmax_k - 273.15),
      maxTmaxC: round(kpi.max_tmax_k - 273.15),
      minTmaxC: round(kpi.min_tmax_k - 273.15),
      forecasts: kpi.forecasts,
      advisories: kpi.advisories,
      stakeholders: kpi.stakeholders,
      thresholdC: THRESHOLD_C,
      thresholdK: THRESHOLD_K,
      hottest: { district: hottest.district, date: hottest.date, tmaxC: round(hottest.tmax_k - 273.15) },
    });
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
