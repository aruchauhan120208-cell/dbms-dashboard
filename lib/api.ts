/** lib/api.ts — small helpers shared by all API route handlers. */
import { NextResponse } from 'next/server';

export function ok(data: unknown, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, data, ...extra });
}

export function fail(message: string, status = 500, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

/** Wrap a handler so DB/runtime errors become clean JSON instead of crashes. */
export async function guard(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, 500);
  }
}

export function num(v: string | null, fallback: number): number {
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function str(v: string | null): string | null {
  if (v === null) return null;
  const t = v.trim();
  return t.length ? t : null;
}
