'use client';

import { useEffect, useState } from 'react';

export type ApiState<T> = { data: T | null; loading: boolean; error: string | null };

type Store<T> = { key: string; data: T | null; error: string | null };

/**
 * Client-side hook that fetches a JSON payload from one of this app's API
 * routes. The browser only ever talks to /api/* — never to SQLite or OpenWeather.
 *
 * `loading` is derived by comparing the request key against the key of the last
 * completed request, so no state is set synchronously inside the effect.
 */
export function useApi<T>(path: string, deps: unknown[] = []): ApiState<T> {
  const key = path + '|' + JSON.stringify(deps);
  const [store, setStore] = useState<Store<T>>({ key: '', data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(path, { cache: 'no-store', signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body || body.ok === false) {
          setStore({ key, data: null, error: body?.error ?? `Request failed (HTTP ${res.status})` });
          return;
        }
        setStore({ key, data: (body.data ?? body) as T, error: null });
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return;
        setStore({ key, data: null, error: err?.message ?? 'Network error' });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, path]);

  const settled = store.key === key;
  return {
    data: settled ? store.data : null,
    loading: !settled,
    error: settled ? store.error : null,
  };
}

export function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString();
}
