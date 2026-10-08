import type { NextRequest } from 'next/server';
import { guard, ok, fail, str } from '@/lib/api';
import { queryOne } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/weather?district=Jaisalmer
 *
 * The ONLY place OpenWeather is called. The browser hits this route; this route
 * talks to OpenWeather with the server-side OPENWEATHER_API_KEY. The key is
 * never sent to the client.
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const district = str(req.nextUrl.searchParams.get('district'));
    if (!district) return fail('Missing required query parameter: district', 400);

    const region = queryOne<{ district: string; latitude: number; longitude: number }>(
      'SELECT district, latitude, longitude FROM REGION WHERE district = ?', [district],
    );
    if (!region) return fail(`Unknown district: ${district}`, 404);

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return fail(
        'OpenWeather is not configured: set OPENWEATHER_API_KEY in your .env file (see .env.example) and restart the server.',
        503,
        { configured: false, district: region.district },
      );
    }

    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    url.searchParams.set('lat', String(region.latitude));
    url.searchParams.set('lon', String(region.longitude));
    url.searchParams.set('appid', apiKey);
    url.searchParams.set('units', 'metric');

    let resp: Response;
    try {
      resp = await fetch(url, { cache: 'no-store' });
    } catch (e) {
      return fail(`Could not reach OpenWeather: ${e instanceof Error ? e.message : String(e)}`, 502, {
        configured: true, district: region.district,
      });
    }

    if (resp.status === 401) {
      return fail('OpenWeather rejected the API key (401 Unauthorized). Check OPENWEATHER_API_KEY.', 502, {
        configured: true, district: region.district,
      });
    }
    if (!resp.ok) {
      return fail(`OpenWeather returned HTTP ${resp.status}.`, 502, {
        configured: true, district: region.district,
      });
    }

    const w = await resp.json();
    const tempC = w?.main?.temp ?? null;
    const thresholdC = Math.round((Number(process.env.HEATWAVE_THRESHOLD_K ?? 316.32788) - 273.15) * 100) / 100;

    return ok({
      district: region.district,
      latitude: region.latitude,
      longitude: region.longitude,
      tempC,
      feelsLikeC: w?.main?.feels_like ?? null,
      humidity: w?.main?.humidity ?? null,
      pressure: w?.main?.pressure ?? null,
      windSpeed: w?.wind?.speed ?? null,
      description: w?.weather?.[0]?.description ?? null,
      icon: w?.weather?.[0]?.icon ?? null,
      observedAt: w?.dt ? new Date(w.dt * 1000).toISOString() : null,
      isHeatwave: typeof tempC === 'number' ? tempC >= thresholdC : false,
      thresholdC,
      source: 'OpenWeather (api.openweathermap.org)',
    });
  });
}
