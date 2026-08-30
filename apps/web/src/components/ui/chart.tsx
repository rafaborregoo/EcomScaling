"use client";

import { useId, type ComponentProps } from "react";
import {
  ResponsiveContainer,
  AreaChart as RAreaChart,
  Area,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

// Charts sobre Recharts con los tokens del design system (ADR-0020). HeroUI v3
// (no-Pro) no trae charts; `@heroui-pro/react` es un wrapper de Recharts con
// tema HeroUI -- aqui se hace lo mismo con `recharts` directo y nuestros
// tokens, con una API de props simple (no compound) porque los usos actuales
// son series planas.

type Serie = { key: string; label?: string; color?: string };

// Acento de marca primero; el resto para series secundarias.
const SERIES_COLORS = [
  "var(--accent)",
  "var(--color-warn-deep)",
  "var(--color-success)",
];

const AXIS_TICK = { fill: "var(--color-muted)", fontSize: 11 } as const;
const AXIS_PROPS = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: { stroke: "var(--color-line)" },
} as const;

const TOOLTIP_PROPS = {
  contentStyle: {
    borderRadius: "var(--radius)",
    border: "1px solid var(--color-edge)",
    fontSize: 12,
    padding: "6px 10px",
    boxShadow: "0 8px 24px -12px rgb(15 15 15 / 0.2)",
  },
  labelStyle: { color: "var(--color-muted)", fontSize: 11, marginBottom: 2 },
} as const;

type TooltipFormatter = NonNullable<
  ComponentProps<typeof Tooltip>["formatter"]
>;

function makeTooltipFormatter(
  valueFormatter?: (value: number) => string,
): TooltipFormatter | undefined {
  if (!valueFormatter) return undefined;
  return (value) => valueFormatter(Number(value));
}

function withColors(series: Serie[]): Required<Serie>[] {
  return series.map((serie, index) => ({
    ...serie,
    label: serie.label ?? serie.key,
    color: serie.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
  }));
}

type ChartData = Array<Record<string, number | string>>;

const SPARK_TONE = {
  brand: "var(--accent)",
  success: "var(--color-success)",
  danger: "var(--danger)",
} as const;

// Sparkline: área sin ejes, sin grid, sin tooltip -- solo la forma de la
// tendencia, para ir dentro de una tarjeta KPI (ver `Metric`).
export function Sparkline({
  data,
  tone = "brand",
  height = 48,
}: {
  data: number[];
  tone?: keyof typeof SPARK_TONE;
  height?: number;
}) {
  const gradientId = useId();
  const color = SPARK_TONE[tone];
  const points = data.map((value, index) => ({ index, value }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RAreaChart
        data={points}
        margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="index" hide />
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />
      </RAreaChart>
    </ResponsiveContainer>
  );
}

export function AreaChart({
  data,
  xKey,
  series,
  height = 220,
  valueFormatter,
}: {
  data: ChartData;
  xKey: string;
  series: Serie[];
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  const resolved = withColors(series);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RAreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS_PROPS} />
        <YAxis
          {...AXIS_PROPS}
          width={48}
          tickFormatter={
            valueFormatter ? (value) => valueFormatter(Number(value)) : undefined
          }
        />
        <Tooltip
          {...TOOLTIP_PROPS}
          cursor={{ stroke: "var(--color-edge)" }}
          formatter={makeTooltipFormatter(valueFormatter)}
        />
        {resolved.map((serie) => (
          <Area
            key={serie.key}
            type="monotone"
            dataKey={serie.key}
            name={serie.label}
            stroke={serie.color}
            fill={serie.color}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
      </RAreaChart>
    </ResponsiveContainer>
  );
}

export function BarChart({
  data,
  xKey,
  series,
  height = 220,
  valueFormatter,
  horizontal = false,
}: {
  data: ChartData;
  xKey: string;
  series: Serie[];
  height?: number;
  valueFormatter?: (value: number) => string;
  // true = barras horizontales (categorías en el eje Y). Útil para rankings.
  horizontal?: boolean;
}) {
  const resolved = withColors(series);
  const axisFormatter = valueFormatter
    ? (value: number | string) => valueFormatter(Number(value))
    : undefined;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <CartesianGrid stroke="var(--color-line)" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS_PROPS} tickFormatter={axisFormatter} />
            <YAxis
              type="category"
              dataKey={xKey}
              {...AXIS_PROPS}
              width={120}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} width={48} tickFormatter={axisFormatter} />
          </>
        )}
        <Tooltip
          {...TOOLTIP_PROPS}
          cursor={{ fill: "var(--color-surface)" }}
          formatter={makeTooltipFormatter(valueFormatter)}
        />
        {resolved.map((serie) => (
          <Bar
            key={serie.key}
            dataKey={serie.key}
            name={serie.label}
            fill={serie.color}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={horizontal ? 22 : 48}
          />
        ))}
      </RBarChart>
    </ResponsiveContainer>
  );
}
