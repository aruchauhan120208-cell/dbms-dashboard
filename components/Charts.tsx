'use client';

import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Cell,
} from 'recharts';

const AXIS = { fontSize: 11, fill: '#64748b' };
export const BRAND = '#b91c1c';
export const ACCENT = '#ea580c';
export const SERIES = ['#b91c1c', '#ea580c', '#0891b2', '#7c3aed', '#059669', '#d97706'];

type Datum = Record<string, string | number | boolean | null | undefined>;
type Series = { key: string; name: string; color?: string };

function tickFmt(v: unknown) {
  return String(v);
}

export function LineSeries({
  data, xKey, series, height = 260, refLine,
}: { data: Datum[]; xKey: string; series: Series[]; height?: number; refLine?: { y: number; label: string } }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={AXIS} tickFormatter={tickFmt} />
        <YAxis tick={AXIS} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {refLine ? <ReferenceLine y={refLine.y} stroke={BRAND} strokeDasharray="4 4" label={{ value: refLine.label, fontSize: 11, fill: BRAND }} /> : null}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color ?? SERIES[i % SERIES.length]}
            dot={false}
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({
  data, xKey, series, height = 260, refLine,
}: { data: Datum[]; xKey: string; series: Series[]; height?: number; refLine?: { y: number; label: string } }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={AXIS} tickFormatter={tickFmt} interval={0} angle={data.length > 12 ? -45 : 0} textAnchor={data.length > 12 ? 'end' : 'middle'} height={data.length > 12 ? 50 : 30} />
        <YAxis tick={AXIS} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {refLine ? <ReferenceLine y={refLine.y} stroke={BRAND} strokeDasharray="4 4" /> : null}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color ?? SERIES[i % SERIES.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaSeries({
  data, xKey, series, height = 240,
}: { data: Datum[]; xKey: string; series: Series[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} tick={AXIS} tickFormatter={tickFmt} />
        <YAxis tick={AXIS} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color ?? SERIES[i % SERIES.length]} fill={s.color ?? SERIES[i % SERIES.length]} fillOpacity={0.15} strokeWidth={2} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bar chart that colour-codes each bar (e.g. above/below threshold). */
export function HBar({
  data, yKey, valueKey, height = 260, colorBy,
}: {
  data: Datum[]; yKey: string; valueKey: string; height?: number;
  colorBy?: (d: Datum) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={AXIS} />
        <YAxis type="category" dataKey={yKey} tick={AXIS} width={96} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey={valueKey} radius={[0, 3, 3, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorBy ? colorBy(d) : BRAND} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
