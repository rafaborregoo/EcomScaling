"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "./button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./chart-primitives";
export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle, type ChartConfig } from "./chart-primitives";
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
  ReferenceArea,
  Cell,
  ScatterChart as RScatterChart,
  Scatter,
  ZAxis,
} from "recharts";

// Modelos oficiales de shadcn/ui sobre Recharts. Las API de series conservan
// los datos, formatos y acciones de las pantallas existentes.

type Serie = { key: string; label?: string; color?: string };

// Los gráficos tienen paleta propia: no heredan el acento de marca (verde).
const SERIES_COLORS = [
  "var(--chart-series-1)",
  "var(--chart-series-2)",
  "var(--chart-series-3)",
  "var(--chart-series-4)",
  "var(--chart-series-5)",
  "var(--chart-series-6)",
  "var(--chart-series-7)",
  "var(--chart-series-8)",
];

const AXIS_TICK = { fill: "var(--color-muted)", fontSize: 11 } as const;
const AXIS_PROPS = {
  tick: AXIS_TICK,
  tickLine: false,
  axisLine: { stroke: "var(--color-separator)" },
} as const;

// Ancho reservado para las etiquetas de categoría en barras horizontales y
// nº máx. de caracteres antes de recortar con "…". Sin esto, los nombres
// largos de cliente se solapan entre sí y se salen sobre las barras.
const CATEGORY_AXIS_WIDTH = 116;
const CATEGORY_LABEL_MAX = 18;

function CategoryTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const full = String(payload?.value ?? "");
  const short =
    full.length > CATEGORY_LABEL_MAX
      ? `${full.slice(0, CATEGORY_LABEL_MAX - 1).trimEnd()}…`
      : full;
  return (
    <text
      x={x}
      y={y}
      dy={3}
      textAnchor="end"
      fill="var(--color-muted)"
      fontSize={12}
    >
      {short}
      <title>{full}</title>
    </text>
  );
}

const TOOLTIP_PROPS = {
  contentStyle: {
    borderRadius: "var(--radius)",
    border: "1px solid var(--color-separator)",
    fontSize: 12,
    padding: "6px 10px",
    boxShadow: "0 8px 24px -12px rgb(15 15 15 / 0.2)",
  },
  labelStyle: { color: "var(--color-muted)", fontSize: 11, marginBottom: 2 },
} as const;

function withColors(series: Serie[]): Required<Serie>[] {
  return series.map((serie, index) => ({
    ...serie,
    label: serie.label ?? serie.key,
    color: serie.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
  }));
}

type ChartData = Array<Record<string, number | string>>;

const SPARK_TONE = {
  brand: "var(--chart-series-1)",
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

// Igual de "chromeless" que Sparkline (sin ejes, sin grid, sin tooltip) pero
// grande y multi-serie: una linea por entidad (cliente, producto...), cada una
// con su propio color -- para "todos a la vez, de un vistazo", no para leer
// una cifra exacta (para eso esta AreaChart/BarChart con ejes y tooltip).
export function MultiSparkline({
  data,
  xKey,
  series,
  height = 180,
}: {
  data: ChartData;
  xKey: string;
  series: Required<Serie>[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RAreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey={xKey} hide />
        <YAxis hide domain={[0, "dataMax"]} />
        {series.map((serie) => (
          <Area
            key={serie.key}
            type="monotone"
            dataKey={serie.key}
            name={serie.label}
            stroke={serie.color}
            strokeWidth={2}
            fill={serie.color}
            fillOpacity={0.08}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </RAreaChart>
    </ResponsiveContainer>
  );
}

export type ChartAction = { label: string; onPress: () => void };
type ChartRow = Record<string, number | string>;

/**
 * Interacción de los gráficos de línea/área:
 *  - pasar el ratón: cruz y valor (tooltip);
 *  - clic en un punto: lo fija y enseña sus acciones (`actions`);
 *  - arrastrar: elige un tramo y avisa a la página (`onSelectRange`).
 * Sin ninguna de las dos props, el gráfico es el de siempre.
 */
export function AreaChart({
  data,
  xKey,
  series,
  height = 220,
  valueFormatter,
  actions,
  onSelectRange,
  selectedRange,
  axisValueFormatter,
}: {
  data: ChartData;
  xKey: string;
  series: Serie[];
  height?: number;
  valueFormatter?: (value: number) => string;
  // Formato corto para el eje; el tooltip usa valueFormatter.
  axisValueFormatter?: (value: number) => string;
  actions?: (row: ChartRow) => ChartAction[];
  onSelectRange?: (from: string | number, to: string | number) => void;
  selectedRange?: { from: string | number; to: string | number } | null;
}) {
  const resolved = withColors(series);
  const interactive = Boolean(actions || onSelectRange);
  const [pinned, setPinned] = useState<ChartRow | null>(null);
  const [drag, setDrag] = useState<{ from: string | number; to: string | number } | null>(null);
  const indexOf = (label: string | number) => data.findIndex((row) => row[xKey] === label);
  const labelOf = (state: { activeLabel?: string | number } | undefined) => state?.activeLabel;

  function finishDrag() {
    if (!drag) return;
    const current = drag;
    setDrag(null);
    if (current.from === current.to) {
      const row = data[indexOf(current.from)];
      if (row && actions) setPinned(row);
      return;
    }
    const [from, to] = indexOf(current.from) <= indexOf(current.to) ? [current.from, current.to] : [current.to, current.from];
    setPinned(null);
    onSelectRange?.(from, to);
  }
  const config = Object.fromEntries(resolved.map((serie) => [serie.key, { label: serie.label, color: serie.color }]));
  const area = (
    <ChartContainer config={config} className="w-full" style={{ height, aspectRatio: "auto" }}>
      <RAreaChart
        accessibilityLayer
        data={data}
        margin={{ left: 12, right: 12 }}
        style={interactive ? { cursor: "crosshair", userSelect: "none" } : undefined}
        onMouseDown={interactive ? (state) => { const label = labelOf(state as never); if (label != null) setDrag({ from: label, to: label }); } : undefined}
        onMouseMove={interactive ? (state) => { const label = labelOf(state as never); if (drag && label != null) setDrag({ ...drag, to: label }); } : undefined}
        onMouseUp={interactive ? finishDrag : undefined}
        onMouseLeave={interactive ? () => setDrag(null) : undefined}
      >
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis
          hide
          domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
          tickFormatter={
            (axisValueFormatter ?? valueFormatter)
              ? (value) => (axisValueFormatter ?? valueFormatter)!(Number(value))
              : undefined
          }
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" {...(valueFormatter ? { valueFormatter } : {})} />} />
        {resolved.map((serie) => (
          <Area
            key={serie.key}
            type="linear"
            dataKey={serie.key}
            name={serie.label}
            stroke={serie.color}
            fill={serie.color}
            fillOpacity={0.4}
            isAnimationActive={false}
          />
        ))}
        {drag && drag.from !== drag.to ? (
          <ReferenceArea x1={drag.from} x2={drag.to} fill="var(--color-accent)" fillOpacity={0.16} stroke="var(--color-accent)" />
        ) : null}
        {!drag && selectedRange ? (
          <ReferenceArea x1={selectedRange.from} x2={selectedRange.to} fill="var(--color-accent)" fillOpacity={0.1} />
        ) : null}
      </RAreaChart>
    </ChartContainer>
  );
  if (!interactive) return area;
  return (
    <div>
      {area}
      {pinned ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-separator bg-surface px-3 py-2 text-sm" role="status">
          <strong className="font-semibold">{String(pinned[xKey])}</strong>
          {resolved.map((serie) => (
            <span key={serie.key} className="text-muted">
              {serie.label}: <span className="font-medium text-foreground">{valueFormatter ? valueFormatter(Number(pinned[serie.key])) : String(pinned[serie.key])}</span>
            </span>
          ))}
          <span className="ml-auto flex flex-wrap gap-2">
            {(actions?.(pinned) ?? []).map((action) => (
              <Button key={action.label} size="sm" variant="secondary" onClick={action.onPress}>
                {action.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setPinned(null)}>
              Cerrar
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function BarChart({
  data,
  xKey,
  series,
  height = 220,
  valueFormatter,
  horizontal = false,
  stacked = false,
  axisValueFormatter,
  onBarClick,
  domain,
}: {
  data: ChartData;
  xKey: string;
  series: Serie[];
  height?: number;
  valueFormatter?: (value: number) => string;
  // true = barras horizontales (categorías en el eje Y). Útil para rankings.
  horizontal?: boolean;
  // true = series apiladas (partes de un total, p. ej. flows + campañas).
  stacked?: boolean;
  // Formato corto para el eje (p. ej. "1,2 k€"); el tooltip usa valueFormatter.
  axisValueFormatter?: (value: number) => string;
  // Clic en una barra: abre su detalle. Las barras se resaltan al pasar el ratón.
  onBarClick?: (row: ChartRow) => void;
  // Escala fija del eje de valores (p. ej. [0, 100] para repartos en %).
  domain?: [number, number];
}) {
  const resolved = withColors(series);
  const axisBase = axisValueFormatter ?? valueFormatter;
  const axisFormatter = axisBase
    ? (value: number | string) => axisBase(Number(value))
    : undefined;
  const config = Object.fromEntries(resolved.map((serie) => [serie.key, { label: serie.label, color: serie.color }]));

  return (
    <ChartContainer config={config} className="w-full" style={{ height, aspectRatio: "auto" }}>
      <RBarChart
        accessibilityLayer
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
        // El clic va al gráfico, no a la barra: la barra resaltada se vuelve a
        // pintar al pasar el ratón y se comía el clic. Así vale toda la franja.
        {...(onBarClick
          ? {
              style: { cursor: "pointer" },
              onClick: (state: { activeIndex?: unknown }) => {
                const row = data[Number(state?.activeIndex)];
                if (row) onBarClick(row);
              },
            }
          : {})}
      >
        {!horizontal ? <CartesianGrid vertical={false} /> : null}
        {horizontal ? (
          <>
            <XAxis
              type="number"
              hide
              tickFormatter={axisFormatter}
              tickCount={domain ? 5 : 4}
              height={20}
              {...(domain ? { domain, allowDataOverflow: true } : {})}
            />
            <YAxis
              type="category"
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tick={<CategoryTick />}
              interval={0}
              width={CATEGORY_AXIS_WIDTH}
              tickMargin={6}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis hide {...(domain ? { domain, allowDataOverflow: true } : {})} />
          </>
        )}
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator={horizontal ? "dot" : "dashed"} {...(valueFormatter ? { valueFormatter } : {})} />} />
        {resolved.map((serie, index) => (
          <Bar
            key={serie.key}
            dataKey={serie.key}
            name={serie.label}
            fill={serie.color}
            {...(stacked ? { stackId: "total" } : {})}
            // Apiladas: solo el segmento de arriba lleva el extremo redondeado.
            radius={
              stacked && index < resolved.length - 1
                ? [0, 0, 0, 0]
                : horizontal ? 5 : 4
            }
            isAnimationActive={false}
            {...(onBarClick
              ? {
                  cursor: "pointer",
                  activeBar: { fillOpacity: 0.82, stroke: "var(--color-foreground)", strokeWidth: 1 },
                }
              : {})}
          />
        ))}
      </RBarChart>
    </ChartContainer>
  );
}

export type BubblePoint = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  detail?: ReactNode;
};

/**
 * Burbujas para la cartera: una por cliente o cuenta. Eje Y = urgencia (más
 * alto, antes), eje X = peso (más a la derecha, más grande el negocio). Pasar
 * el ratón enseña el motivo; el clic abre al cliente.
 */
export function BubbleChart({
  points,
  height = 300,
  xFormatter,
  xLabel,
  yLabel,
  onPointClick,
}: {
  points: BubblePoint[];
  height?: number;
  xFormatter?: (value: number) => string;
  xLabel?: string;
  yLabel?: string;
  onPointClick?: (point: BubblePoint) => void;
}) {
  const [hot, setHot] = useState<string | null>(null);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RScatterChart margin={{ top: 12, right: 16, bottom: 16, left: 0 }}>
        <CartesianGrid stroke="var(--color-separator)" />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          {...AXIS_PROPS}
          tickCount={4}
          tickFormatter={xFormatter ? (value) => xFormatter(Number(value)) : undefined}
          label={xLabel ? { value: xLabel, position: "insideBottom", offset: -8, fill: "var(--color-muted)", fontSize: 11 } : undefined}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          domain={[0, 100]}
          {...AXIS_PROPS}
          width={40}
          tickCount={5}
        />
        <ZAxis type="number" dataKey="size" range={[90, 900]} />
        <Tooltip
          {...TOOLTIP_PROPS}
          cursor={{ strokeDasharray: "3 3", stroke: "var(--color-separator)" }}
          content={({ active, payload }) => {
            const point = active ? (payload?.[0]?.payload as BubblePoint | undefined) : undefined;
            if (!point) return null;
            return (
              <div className="max-w-64 rounded-lg border border-separator bg-background px-3 py-2 text-xs shadow-lg">
                <p className="font-semibold">{point.label}</p>
                {point.detail ? <div className="mt-1 text-muted">{point.detail}</div> : null}
                {onPointClick ? <p className="mt-1.5 font-medium text-accent">Clic para abrir</p> : null}
              </div>
            );
          }}
        />
        <Scatter
          data={points}
          animationDuration={600}
          onMouseEnter={(entry: { payload?: BubblePoint }) => setHot(entry?.payload?.id ?? null)}
          onMouseLeave={() => setHot(null)}
          onClick={(entry: { payload?: BubblePoint }) => entry?.payload && onPointClick?.(entry.payload)}
          cursor={onPointClick ? "pointer" : undefined}
        >
          {points.map((point) => (
            <Cell
              key={point.id}
              fill={point.color}
              fillOpacity={hot === null || hot === point.id ? 0.8 : 0.3}
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ))}
        </Scatter>
      </RScatterChart>
    </ResponsiveContainer>
  );
}
