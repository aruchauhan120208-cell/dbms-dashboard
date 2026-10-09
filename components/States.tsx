import type { ReactNode } from 'react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--muted)]" role="status">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--brand)]" />
      {label}
    </div>
  );
}

export function ErrorState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="font-semibold">Something went wrong</div>
      <div className="mt-1">{message}</div>
      {hint ? <div className="mt-1 text-red-700">{hint}</div> : null}
    </div>
  );
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] bg-slate-50 p-6 text-center text-sm text-[var(--muted)]">
      <div className="font-medium text-slate-700">{message}</div>
      {hint ? <div className="mt-1">{hint}</div> : null}
    </div>
  );
}

export function SectionIntro({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>;
}
