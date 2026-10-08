'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const SECTIONS: { href: string; label: string }[] = [
  { href: '/', label: 'Overview' },
  { href: '/temperature', label: 'Temperature Analysis' },
  { href: '/heatwave', label: 'Heatwave Analysis' },
  { href: '/regions', label: 'Regional Analysis' },
  { href: '/forecasts', label: 'Forecasts' },
  { href: '/advisories', label: 'Advisories' },
  { href: '/stakeholders', label: 'Stakeholders' },
  { href: '/explorer', label: 'Data Explorer' },
  { href: '/sql', label: 'SQL Analytics' },
  { href: '/model', label: 'Database Model' },
  { href: '/performance', label: 'Database Performance' },
  { href: '/weather', label: 'Live Weather' },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--card)]">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin py-1">
          {SECTIONS.map((s) => {
            const active = s.href === '/' ? pathname === '/' : pathname.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={
                  'whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
                  (active
                    ? 'bg-[var(--brand)] text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')
                }
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
