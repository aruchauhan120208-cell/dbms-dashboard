import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rajasthan Heatwave Monitoring Database System",
  description:
    "DBMS project: a database-backed dashboard for Rajasthan heatwave monitoring, built on the Experiment 2 relational model with SQLite.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="bg-[var(--card)] border-b border-[var(--border)]">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand)] text-white font-bold">
              R
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-semibold text-slate-900">
                Rajasthan Heatwave Monitoring Database System
              </h1>
              <p className="text-xs text-[var(--muted)]">
                DBMS project · Next.js + TypeScript + Tailwind · SQLite · Experiment 2 relational model
              </p>
            </div>
          </div>
        </header>
        <Nav />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-[var(--border)] bg-[var(--card)]">
          <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-[var(--muted)]">
            Historical data: Rajasthan Heatwave 2006–2025 (9 districts). Forecasts use a 7-day moving average —
            a data-based demo method, not machine learning. Live weather via OpenWeather (server-side).
          </div>
        </footer>
      </body>
    </html>
  );
}
