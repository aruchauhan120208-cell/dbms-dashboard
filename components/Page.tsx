import type { ReactNode } from 'react';

export function PageHeader({
  title,
  children,
  right,
}: {
  title: string;
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="max-w-3xl">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {children ? <div className="mt-1 text-sm text-[var(--muted)]">{children}</div> : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

export function Grid({ children, cols = 4 }: { children: ReactNode; cols?: number }) {
  const map: Record<number, string> = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  };
  return <div className={`grid grid-cols-1 gap-4 ${map[cols] ?? map[4]}`}>{children}</div>;
}
