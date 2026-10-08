import type { ReactNode } from 'react';

export function KpiCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-slate-900">{value}</span>
        {unit ? <span className="text-sm text-[var(--muted)]">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-4 ${className}`}>
      {title ? (
        <header className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
