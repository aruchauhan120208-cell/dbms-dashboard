import { guard, ok } from '@/lib/api';
import { query } from '@/lib/db';
import { THRESHOLD_C, THRESHOLD_K } from '@/lib/heatwave';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/forecasts — FORECAST rows joined to their REGION.
 * Method: 7-day moving average of observed TMAX. Demo method, not ML.
 */
export async function GET() {
  return guard(async () => {
    const forecasts = query<{
      forecast_id: number; district: string; forecast_date: string;
      predicted_temperature: number; obs_id: number; basis_last_date: string;
    }>(`
      SELECT f.forecast_id, r.district, f.forecast_date, f.predicted_temperature, f.obs_id,
             o.date AS basis_last_date
      FROM FORECAST f
      JOIN REGION r ON r.region_id = f.region_id
      LEFT JOIN OBSERVATION o ON o.obs_id = f.obs_id
      ORDER BY f.predicted_temperature DESC
    `);

    return ok({
      forecasts: forecasts.map((f) => ({
        ...f,
        predicted_c: Math.round((f.predicted_temperature - 273.15) * 100) / 100,
        exceeds_threshold: f.predicted_temperature >= THRESHOLD_K,
      })),
      method: '7-day moving average of observed TMAX (data-based demo method, not machine learning)',
      thresholdC: THRESHOLD_C,
      thresholdK: THRESHOLD_K,
    });
  });
}
