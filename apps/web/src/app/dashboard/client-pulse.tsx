"use client";

import { buttonVariants } from "@/components/ui/button";
import { A02Reading } from "@/components/a02-reading";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import { useActiveConnection } from "@/components/active-connection";
import { useCachedQuery } from "@/lib/use-cached-query";
import { A29Insight, MetricVerdict, useAiExplanation, useMetricAnalysis } from "@/components/metric-verdict";
import { AiFigure, AiInsight, AiTag, type AiFindingData, type AiStepData } from "@/components/ai-insight";
import type { MetricAnalysis } from "@e-nora/contracts";
import { ZoneCard, ZoneNoteMark, zoneAnchor } from "@/components/zone-notes";
import { useCopilotAsk } from "@/components/copilot-ask";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, ArchiveIcon, ToggleGroup, ToggleGroupItem, Attachment, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle, AttachmentTrigger, Banner, Bubble, BubbleContent, Message, MessageContent, MessageFooter, ErrorBlock, CheckIcon, CloseIcon, MessageIcon, PlusIcon, Skeleton, toast, Collapsible, CollapsibleContent, CollapsibleMore, CollapsibleTrigger, IconChevronDown, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tabs } from "@/components/ui";
import { FileTypeIcon, fileMeta } from "@/lib/file-meta";
import type { AssignedConsultant } from "@/hooks/use-assigned-consultant";
import { canShowProfit, financialComparabilityMessage, salesChangePct, storePulse, type FinancialComparabilityView } from "./store-pulse";
import {
  changeText,
  channelReading,
  channelSync,
  CHANNEL_SYNC_LABEL,
  clientReadable,
  chartScale,
  evidenceText,
  fmtCurrency,
  pickGoals,
  type GoalObjective,
  fmtEur,
  fmtNum,
  MIN_NEW_CUSTOMERS_FOR_CAC,
  moneyFlow,
  monthlyWithProjection,
  pickFinding,
  type Evidence,
  type PulseFinancial,
} from "./client-pulse-model";
import { Area, AreaChart as RechartsAreaChart, CartesianGrid, Line, LineChart as RechartsLineChart, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import s from "./client-pulse.module.css";

/**
 * Panel del cliente, vista "Pulso".
 *
 * Responde a "¿cómo va mi tienda y qué tengo que hacer?" en este orden: una
 * frase (de la IA si ya ha analizado la tienda, si no la de `storePulse`), la
 * curva de ventas, las cifras, y después lo accionable. Todo lo que escribe
 * la IA va en serif cursiva con la marca "IA": el cliente tiene que distinguir
 * a simple vista qué es dato y qué es interpretación.
 *
 * Lenguaje visual propio (tokens en client-pulse.module.css), no el de
 * @/components/ui: es un rediseño pedido expresamente para esta vista.
 */

const DAY_MS = 86_400_000;
// El widget enseña lo de corto plazo; el resto vive en Tareas.
const SHORT_TERM_DAYS = 14;
// Filas visibles antes de pedir "Ver todas".
const QUEUE_PREVIEW = 5;
export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

// ---------------------------------------------------------------------------
// Contratos (solo los campos que pinta esta vista)
// ---------------------------------------------------------------------------

export type Metrics = {
  financial_comparability?: FinancialComparabilityView;
  currency_code?: string | null;
  financial_currency_coverage?: {
    status: "compatible" | "incompatible" | "unknown";
    currency_code: string | null;
    mismatched_sources: Array<{ source: string; currencies: string[] }>;
    unknown_sources: string[];
    klaviyo_status?: "compatible" | "incompatible" | "unknown";
    klaviyo_currency_code?: string | null;
    klaviyo_unknown?: boolean;
  };
  sales: { net_sales: number; orders_count: number; aov: number };
  top_products: Array<{ product_id: string; title: string; quantity_sold: number; revenue: number; lines_with_exact_metrics: number; lines_with_estimated_metrics: number; lines_without_metrics: number }>;
  stock: { tracked_items: number; low_stock_items: number; out_of_stock_items: number };
  financial: PulseFinancial & {
    has_settings: boolean;
    items_without_cost: number;
    net_margin_pct: number;
    ads_by_platform: Record<string, number>;
    cac_blended: number | null;
    new_customers?: number;
    mbee: number;
    breakeven_roas: number | null;
  };
  margin: {
    lines_with_exact_metrics: number;
    lines_with_estimated_metrics: number;
    lines_without_metrics: number;
  };
  financial_monthly: Array<{ month: string; net_revenue_ex_tax: number }>;
  metric_targets: Array<{ metric_key: string; target_value: number }>;
  previous_period: {
    sales: { net_sales: number; orders_count: number; aov: number };
    financial: { net_profit: number; net_margin_pct: number; lines_without_metrics: number | null; comparability?: FinancialComparabilityView };
    conversion_rate_own?: number | null;
    daily?: Array<{ date: string; net_sales: number; orders_count: number; conversion_rate_own: number | null }>;
  } | null;
  daily: Array<{ date: string; net_sales: number; orders_count: number; net_profit: number | null }>;
  funnel: {
    has_sessions: boolean;
    sessions: number;
    orders_count: number;
    cart_additions: number;
    checkouts_reached: number;
    purchases: number;
    has_funnel_steps: boolean;
    conversion_rate_own: number | null;
  } | null;
  funnel_daily: Array<{ date: string; conversion_rate_own: number | null }>;
};

export type MetaMetrics = {
  acquisition: {
    spend: number;
    purchases: number;
    purchase_value: number;
    roas: number | null;
    cac: number | null;
    days_with_data: number;
  };
  campaigns: Array<{
    campaign_id: string;
    campaign_name: string | null;
    spend: number | string | null;
    purchases: number | string | null;
    roas: number | string | null;
  }>;
};

type KlaviyoEntity = { id: string; name: string; revenue: number; revenue_per_recipient: number | null };
type KlaviyoCampaign = KlaviyoEntity & { subject: string | null; send_time: string | null; recipients: number; open_rate: number | null; click_rate: number | null };
export type KlaviyoReport = {
  connected: boolean;
  connection?: { status: string; last_sync_at: string | null; last_error_message: string | null } | null;
  totals: { revenue: number; campaign_revenue: number; flow_revenue: number };
  previous: { revenue: number } | null;
  trend: Array<{ month: string; campaign_revenue: number; flow_revenue: number }>;
  flows: KlaviyoEntity[];
  campaigns?: KlaviyoCampaign[];
};

type Task = {
  id: string;
  status: string;
  priority: string;
  categories: string[];
  title: string;
  description: string | null;
  due_at: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  updated_at: string;
  is_visible_to_client?: boolean;
  task_comments?: Array<{ body: string; is_internal: boolean; created_at: string }>;
};
export type Alert = {
  id: string;
  status: string;
  severity: string;
  title: string;
  message: string;
  first_detected_at: string;
};
export type Operations = { tasks: Task[]; alerts: Alert[] };

export type Finding = { title: string; severity: string; evidence: Evidence; area?: string; figures?: AiFindingData["figures"] };
export type A02MetricReview = { metric_key: string; rating: "positive" | "neutral" | "attention" | "critical" | "insufficient"; summary: string };
type DiagnosticRecommendation = { action: string; priority: string; owner?: string; expected_impact?: string };
export type Diagnostic = {
  output_id: string;
  output_status: string;
  generated_at: string;
  pending_outputs?: Diagnostic[];
  agent_code?: string;
  scope_label?: string;
  requested_scope?: string;
  result_scope?: string;
  output: {
    headline?: string;
    answer?: string;
    sections?: Array<{ key: string; label: string; findings: Finding[]; recommendations?: DiagnosticRecommendation[] }>;
    metric_reviews?: A02MetricReview[];
    findings: Finding[];
    recommendations: DiagnosticRecommendation[];
    warnings?: string[];
    proposed_writes?: Array<{
      title: string;
      description: string;
      priority: string;
      related_product_id?: string | null;
      rationale?: string;
      evidence?: Evidence[];
      owner_role?: "cliente" | "consultor";
      due_hint?: string | null;
    }>;
    proposal_decisions?: Array<{ index: number; status: string; reason?: string; task_id?: string }>;
    weekly_demand_coverage?: "available" | "unavailable" | "incomplete";
    product_count?: number;
    returned_count?: number;
    truncated?: boolean;
    confidence: "low" | "medium" | "high";
  };
  stale?: boolean;
  envelope?: {
    quality: { confidence: string; dataCompleteness: string };
    sources: Array<{ id: string; label: string }>;
  };
};

type IntegrationsPayload = {
  providers: Array<{
    id: string;
    name: string;
    connection: { status: string; last_sync_at: string | null; last_error_message?: string | null } | null;
  }>;
};

type ThreadMessage = {
  id: string;
  author_kind: "consultant" | "client" | "platform" | "system";
  author_name: string | null;
  body: string;
  attachments: Array<{ filename: string; signed_url: string | null; content_type?: string; byte_size?: number }>;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Utilidades de presentación
// ---------------------------------------------------------------------------

export function dayLabel(iso: string, long = false) {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return long ? `${WEEKDAYS[d.getUTCDay()]} ${base}` : base;
}

export function ago(iso: string | null) {
  if (!iso) return "sin sincronizar";
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

export function Delta({ change, invert = false, suffix }: { change: number | null; invert?: boolean; suffix?: string }) {
  if (change === null || !Number.isFinite(change)) return null;
  const up = change > 0;
  const good = invert ? !up : up;
  return (
    <span className={cx(s.delta, good ? s.deltaGood : s.deltaBad)}>
      {up ? "▲" : "▼"} {suffix ? `${fmtNum(Math.abs(change), 2)} ${suffix}` : changeText(change)}
    </span>
  );
}

export function Spark({ values, color = "var(--store)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const width = 200;
  const height = 34;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, i) => [
    (i * width) / (values.length - 1),
    height - pad - ((value - min) / (max - min || 1)) * (height - 2 * pad),
  ]);
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const last = points[points.length - 1];
  return (
    <div className={s.spark}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <path className={s.sparkArea} d={`${d}L${width} ${height}L0 ${height}Z`} style={{ fill: color, opacity: 0.12 }} />
        <path
          className={s.sparkLine}
          d={d}
          pathLength={1}
          style={{ fill: "none", stroke: color, strokeWidth: 1.6, strokeLinejoin: "round" }}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <i style={{ top: `${((last[1] / height) * 100).toFixed(1)}%`, background: color }} />
    </div>
  );
}

export function TargetBar({ value, target, max, lowerIsBetter = false, text, color }: {
  value: number;
  target: number;
  max: number;
  lowerIsBetter?: boolean;
  text: string;
  /** Si se indica, la barra usa este color en vez del verde/ámbar según objetivo. */
  color?: string;
}) {
  const ok = lowerIsBetter ? value <= target : value >= target;
  return (
    <div>
      <div className={s.track}>
        <span
          className={s.fill}
          style={{ width: `${Math.min(Math.max(value / max, 0), 1) * 100}%`, background: color ?? (ok ? "var(--good)" : "var(--warn)") }}
        />
        <span className={s.mark} style={{ left: `${Math.min(target / max, 1) * 100}%` }} />
      </div>
      <p className={s.trackTxt} data-tone={value < 0 ? "bad" : undefined}>{text}</p>
    </div>
  );
}

export { niceStep } from "./client-pulse-model";

export function findingFor(diagnostic: Diagnostic | undefined, pattern: RegExp, taken?: Set<Finding>): Finding | null {
  return pickFinding(diagnostic, pattern, taken);
}

export function a02FindingText(diagnostic: Diagnostic | undefined, pattern: RegExp): string | null {
  if (!diagnostic) return null;
  return findingFor(diagnostic, pattern)?.title ?? "A02 no ha señalado un hallazgo específico en esta sección.";
}

const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

const PRIORITY_RANK: Record<string, number> = { urgent: 0, critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const PRIORITY_LABEL: Record<string, string> = { urgent: "Urgente", critical: "Urgente", high: "Alta", medium: "Media", low: "Baja", info: "Baja" };

export function prioClass(priority: string) {
  const rank = PRIORITY_RANK[priority] ?? 2;
  return rank === 0 ? s.prUrgent : rank === 1 ? s.prHigh : rank >= 3 ? s.prLow : undefined;
}

// ---------------------------------------------------------------------------
// Curva de ventas del hero
// ---------------------------------------------------------------------------

/** Un punto de la curva de la cabecera: ventas, gasto... lo que toque. */
export type ChartPoint = { date: string; value: number; detail?: string };

export type Pin = { index: number; title: string; source: string; date: string };

// Official shadcn/ui chart-area-linear, adapted to existing data and annotations.
export function SalesChart({ daily, previousAverage, averageLabel = "Media diaria del periodo anterior", pins, active, onPin, currencyCode, label = "Ventas netas por día", format }: {
  daily: ChartPoint[];
  previousAverage: number | null;
  averageLabel?: string;
  pins: Pin[];
  active: number | null;
  onPin: (k: number) => void;
  currencyCode?: string | null;
  label?: string;
  format?: (value: number) => string;
}) {
  const formatValue = format ?? ((value: number) => currencyCode ? fmtCurrency(value, currencyCode) : fmtEur(value));
  const config = { value: { label, color: "#2563eb" } } satisfies ChartConfig;
  const selectedPin = active === null ? undefined : pins[active];
  return (
    <div className={s.chart}>
      {daily.length ? (
        <ChartContainer config={config} className="w-full" style={{ height: 270, aspectRatio: "auto" }} role="group" aria-label={label}>
          <RechartsAreaChart accessibilityLayer data={daily} margin={{ left: 12, right: 12, top: pins.length ? 22 : 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(value) => dayLabel(String(value))} />
            <YAxis hide domain={[(min: number) => Math.min(0, min, previousAverage ?? 0), (max: number) => Math.max(0, max, previousAverage ?? 0)]} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" valueFormatter={formatValue} labelFormatter={(value) => {
              const point = daily.find((row) => row.date === value);
              return `${dayLabel(String(value), true)}${point?.detail ? ` · ${point.detail}` : ""}`;
            }} />} />
            <Area dataKey="value" type="monotone" fill="var(--color-value)" fillOpacity={0.4} stroke="var(--color-value)" dot={daily.length === 1} isAnimationActive={false} />
            {previousAverage !== null ? <ReferenceLine y={previousAverage} stroke="var(--muted)" strokeDasharray="4 4" /> : null}
            {selectedPin && daily[selectedPin.index] ? <ReferenceLine x={daily[selectedPin.index].date} stroke="var(--color-value)" strokeDasharray="4 4" /> : null}
            {pins.map((pin, index) => daily[pin.index] ? (
              <ReferenceDot key={pin.date + "-" + index} x={daily[pin.index].date} y={daily[pin.index].value} r={active === index ? 6 : 4} fill="var(--color-value)" stroke="var(--background)" label={{ value: index + 1, position: "top", fill: "var(--color-value)", fontSize: 12 }} role="button" tabIndex={0} aria-label={pin.title} onClick={() => onPin(index)} onKeyDown={(_dot, event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPin(index); } }} />
            ) : null)}
          </RechartsAreaChart>
        </ChartContainer>
      ) : <p className={s.chartEmpty}>Todavía no hay datos diarios de este periodo.</p>}
      {previousAverage !== null ? <p className="mt-2 text-xs text-muted">{averageLabel}: {formatValue(previousAverage)}</p> : null}
    </div>
  );
}

export type PulseSeries = {
  key: string;
  label: string;
  color: string;
  values: Array<number | null>;
  format: (value: number) => string;
  /** Cifra del periodo y su variación: lo que antes enseñaba la tarjeta. */
  total: ReactNode;
  delta?: ReactNode;
  /** Valor comparable del periodo anterior, cuando la fuente lo proporciona. */
  previous?: ReactNode;
  /** Línea de comparación, alineada por posición con `values`. */
  previousValues?: Array<number | null>;
  /** Solo si la comparación no es día a día, como una media. */
  previousLabel?: string;
  /** 1 para euros enteros y pedidos: sin marcas de medio pedido en el eje. */
  minStep?: number;
  aiNotice?: ReactNode;
};

/**
 * Una métrica cada vez, con su unidad en el eje y su periodo anterior en línea
 * discontinua: euros, pedidos y porcentajes no se leen en una misma escala.
 * Pulsar una cifra cambia la métrica del gráfico.
 */
export function PulseChart({ dates, previousDates, series, anchorId }: {
  dates: string[];
  previousDates: string[];
  series: PulseSeries[];
  anchorId?: string;
}) {
  const [selected, setSelected] = useState(series[0]?.key);
  // La serie elegida puede desaparecer al cambiar de tienda (el beneficio es opcional).
  const active = series.find((serie) => serie.key === selected) ?? series[0];
  if (!active) return null;
  const finite = (value: number | null | undefined) => (value != null && Number.isFinite(value) ? value : null);
  const previousValues = active.previousValues ?? [];
  // Todo a cero suele ser una tienda sin histórico, no un periodo sin ventas.
  const hasPrevious = previousValues.some((value) => finite(value));
  const rows = dates.map((date, index) => ({
    date,
    previousDate: active.previousLabel ? undefined : previousDates[index],
    current: finite(active.values[index]),
    previous: hasPrevious ? finite(previousValues[index]) : null,
  }));
  const plotted = rows.flatMap((row) => [row.current, row.previous]).filter((value) => value !== null);
  const scale = chartScale(plotted, null, active.minStep);
  const config: ChartConfig = {
    current: { label: active.label, color: active.color },
    previous: { label: active.previousLabel ?? "Periodo anterior", color: active.color },
  };
  const range = (days: string[]) => `${dayLabel(days[0])} – ${dayLabel(days[days.length - 1])}`;
  return (
    <div className={s.pChart} id={anchorId}>
      <div className={s.pChartKpis} role="group" aria-label="Indicadores principales">
        {series.map((serie) => (
          <div key={serie.key} className={s.pChartKpiWrap} style={{ "--serie": serie.color } as CSSProperties}>
            <button className={s.pChartKpi} type="button" aria-pressed={serie.key === active.key} onClick={() => setSelected(serie.key)}>
              <span className={s.pChartKpiLabel}><i aria-hidden="true" />{serie.label}</span>
              <span className={s.pChartKpiValue}>{serie.total}</span>
              <span className={s.pChartKpiMeta}>{serie.delta}<span className={s.pChartPrevious}>Anterior: {serie.previous ?? "—"}</span></span>
            </button>
            {serie.aiNotice ? <span className={s.pChartKpiNotice}>{serie.aiNotice}</span> : null}
          </div>
        ))}
      </div>
      {dates.length ? (
        <div className={s.pChartPlot} style={{ "--serie": active.color } as CSSProperties}>
          <div className={s.pChartLegend}>
            <strong>{active.label} por día</strong>
            <span><i aria-hidden="true" />{range(dates)}</span>
            {hasPrevious
              ? <span><i aria-hidden="true" data-previous />{active.previousLabel ?? `Periodo anterior · ${range(previousDates)}`}</span>
              : <span>Sin datos del periodo anterior</span>}
          </div>
          <ChartContainer config={config} className="w-full" style={{ height: 346, aspectRatio: "auto" }} role="group" aria-label={`${active.label} por día`}>
            <RechartsLineChart accessibilityLayer data={rows} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={(value) => dayLabel(String(value))} />
              <YAxis width={68} tickLine={false} axisLine={false} domain={[scale.bottom, scale.top]} ticks={scale.ticks} tickFormatter={(value) => active.format(Number(value))} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" valueFormatter={(value) => active.format(value)} labelFormatter={(value) => {
                const previousDate = rows.find((row) => row.date === value)?.previousDate;
                return `${dayLabel(String(value), true)}${hasPrevious && previousDate ? ` frente a ${dayLabel(previousDate, true)}` : ""}`;
              }} />} />
              {hasPrevious ? <Line dataKey="previous" type="monotone" stroke="var(--color-previous)" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} isAnimationActive={false} /> : null}
              <Line dataKey="current" type="monotone" stroke="var(--color-current)" strokeWidth={2.25} dot={false} connectNulls={false} isAnimationActive={false} />
            </RechartsLineChart>
          </ChartContainer>
        </div>
      ) : <p className={s.chartEmpty}>Todavía no hay datos diarios de este periodo.</p>}
    </div>
  );
}

/**
 * Lectura de A29 con la estructura común de la IA, tal cual la devuelve: conclusión,
 * hallazgos con sus cifras y "Qué hacer" solo con los pasos de quien mira.
 * Si A29 falla, queda `fallback`.
 */
export function A29Reading({ analysis, tag, audience, fallback = null }: {
  analysis: MetricAnalysis & { explain_path: string };
  tag: string;
  audience: "cliente" | "consultor";
  fallback?: ReactNode;
}) {
  const { data, error } = useAiExplanation(analysis.explain_path);
  if (error) return <>{fallback ?? <p className={cx(s.aiLine, s.muted)}>La IA no ha podido leer esta cifra ahora. Vuelve a abrirla en un rato.</p>}</>;
  if (!data) {
    return (
      <p className={s.aiLine}>
        <AiTag>{tag}</AiTag>
        <span className={s.muted}>Analizando esta cifra…</span>
      </p>
    );
  }
  return <A29Insight data={data} tag={tag} audience={audience} />;
}

/** La salida completa de un agente con la estructura común de la IA. */
export function DiagnosticReading({ tag, diagnostic, audience, maxFindings, footer }: {
  tag?: string;
  diagnostic: Diagnostic;
  audience?: "cliente" | "consultor";
  maxFindings?: number;
  footer?: ReactNode;
}) {
  const { output } = diagnostic;
  const findings = [...(output.sections ?? []).flatMap((section) => section.findings), ...(output.findings ?? [])]
    .filter((finding, index, all) => all.findIndex((other) => other.title === finding.title) === index)
    .sort((a, b) => (FINDING_RANK[a.severity] ?? 3) - (FINDING_RANK[b.severity] ?? 3))
    .slice(0, maxFindings);
  return (
    <AiInsight
      tag={tag}
      summary={plainText(output.headline ?? output.answer)}
      findings={findings.map((finding) => ({
        title: plainText(finding.title) ?? finding.title,
        severity: finding.severity,
        evidence: finding.evidence ? plainText(evidenceText(finding.evidence)) : null,
        figures: finding.figures,
      }))}
      steps={output.recommendations ?? []}
      audience={audience}
      warnings={output.warnings}
      footer={footer}
    />
  );
}

/** Un hallazgo suelto (A02 sobre una cifra) con la estructura común de la IA. */
export function FindingReading({ tag, finding, steps = [], audience }: {
  tag: string;
  finding: Finding | null;
  steps?: AiStepData[];
  audience?: "cliente" | "consultor";
}) {
  const evidence = finding?.evidence ? clientReadable(evidenceText(finding.evidence)) : null;
  return (
    <AiInsight
      tag={tag}
      summary={finding ? clientReadable(finding.title) ?? finding.title : "La IA no ha señalado nada sobre esta cifra en su último análisis."}
      detail={evidence}
      figures={finding?.figures ?? []}
      steps={steps}
      audience={audience}
    />
  );
}

/** Lo que el agente propone hacer en la misma sección que el hallazgo (A02 agrupa por área). */
export function findingSteps(diagnostic: Diagnostic | undefined, finding: Finding | null): AiStepData[] {
  if (!diagnostic || !finding) return [];
  const section = diagnostic.output.sections?.find((item) => item.findings.includes(finding));
  return (section?.recommendations ?? []).slice(0, 2);
}

/**
 * A02 es el diagnóstico general del negocio, no el analista de una cifra.
 * Conservamos temporalmente este wrapper para las tarjetas antiguas, pero no
 * mostramos recomendaciones de A02 como si fueran una valoración individual.
 * Las valoraciones por métrica corresponden a A29 (MetricVerdict).
 */
export function A02MetricNotice(_props: {
  diagnostic?: Diagnostic;
  metricLabel: string;
  metricKey?: string;
  pattern?: RegExp;
  audience?: "cliente" | "consultor";
}) {
  return null;
}

// ---------------------------------------------------------------------------
// Piezas de sección
// ---------------------------------------------------------------------------

export function SectionHead({ id, title, ai, fallback, onAsk, tag = "A02" }: {
  tag?: string;
  id: string;
  title: string;
  ai: string | null;
  fallback?: string | null;
  onAsk?: () => void;
}) {
  return (
    <div className={cx(s.secHead, "zone-card")}>
      <h2 id={id}>
        {title} <ZoneNoteMark anchor={`seccion:${id}`} label={title} />
      </h2>
      {ai ? (
        <p className={s.aiLine}>
          <span className={s.ia}>{tag}</span>
          {ai}
        </p>
      ) : (
        <p className={s.aiLine}>{fallback ?? ""}</p>
      )}
      {onAsk ? (
        <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={onAsk}>
          Preguntar
        </button>
      ) : null}
    </div>
  );
}

export function DiagnosticScopeNote({ diagnostic }: { diagnostic?: Diagnostic }) {
  if (diagnostic?.result_scope !== "overview" || !diagnostic.requested_scope) return null;
  return (
    <p className={s.aiLine}>
      <span className={s.ia}>A02</span>
      Lectura general del negocio mientras se prepara la lectura específica de este canal.
    </p>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      <p>{children}</p>
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

// Gravedad de un hallazgo: los agentes no usan todos la misma escala.
const FINDING_RANK: Record<string, number> = { business_threat: 0, critical: 0, urgent: 0, error: 0, high: 1, warning: 2, moderate: 2, medium: 2, low: 3, info: 4, positive: 4 };
const FINDINGS_SHOWN = 4;

/** Texto de un agente para leer de un vistazo: sin marcas de markdown. */
const plainText = (text: string | null | undefined) => clientReadable(text)?.replace(/\*\*|__|`/g, "") ?? null;

// Lo que han leído los agentes de la tienda, en una fila por agente: su frase
// (dos líneas como mucho), los tres hallazgos más graves por título y la prueba
// al abrir cada uno. Un agente sin lectura no ocupa sitio.
function AgentInsights({ agents }: {
  agents: Array<{ key: string; label: string; diagnostic?: Diagnostic }>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const withData = agents.filter((agent): agent is { key: string; label: string; diagnostic: Diagnostic } => Boolean(agent.diagnostic));
  if (!withData.length) return null;

  return (
    <section className={cx(s.pBlock, s.aiBlock)} aria-labelledby="pulse-agent-insights">
      <h2 className={s.pBlockT} id="pulse-agent-insights">Qué ha detectado la IA</h2>
      <ul className={s.aiAgents}>
        {withData.map(({ key, label, diagnostic }) => {
          const summary = plainText(diagnostic.output.headline ?? diagnostic.output.answer);
          const isLabCliResult = diagnostic.output.warnings?.some((warning) => warning.includes("Codex CLI")) ?? false;
          const findings = [
            ...(diagnostic.output.sections ?? []).flatMap((section) => section.findings),
            ...(diagnostic.output.findings ?? []),
          ]
            .filter((finding, index, all) => all.findIndex((other) => other.title === finding.title) === index)
            .sort((a, b) => (FINDING_RANK[a.severity] ?? 3) - (FINDING_RANK[b.severity] ?? 3));
          const open = expanded === key;
          const renderFinding = (finding: (typeof findings)[number], index: number) => {
            const evidence = finding.evidence ? plainText(evidenceText(finding.evidence)) : null;
            const rank = FINDING_RANK[finding.severity] ?? 3;
            const key = `${finding.title}-${index}`;
            const dataRank = rank <= 1 ? "high" : rank === 2 ? "mid" : "low";
            const title = plainText(finding.title) ?? finding.title;
            return evidence || finding.figures?.length ? (
              <AccordionItem key={key} value={key} data-rank={dataRank}>
                <AccordionTrigger>{title}</AccordionTrigger>
                <AccordionContent>
                  {finding.figures?.length ? (
                    <div className={s.aiFigures}>
                      {finding.figures.map((figure, figureIndex) => <AiFigure key={`${figure.label}-${figureIndex}`} {...figure} tone={rank <= 1 && figure.change_pct != null ? "bad" : null} />)}
                    </div>
                  ) : null}
                  {evidence ? <p>{evidence}</p> : null}
                </AccordionContent>
              </AccordionItem>
            ) : (
              <p key={key} data-rank={dataRank}>{title}</p>
            );
          };
          return (
            <li key={key} className={s.aiAgent}>
              <p className={s.aiAgentH}>
                <b>{label}</b>
                <span className={cx(diagnostic.stale && s.aiStale)}>
                  {diagnostic.stale ? `Datos de ${ago(diagnostic.generated_at)}` : ago(diagnostic.generated_at)}
                </span>
              </p>
              {summary ? <p className={s.aiAgentSum}>{summary}</p> : null}
              {isLabCliResult ? <p className={s.aiAgentSum}>Resultado de laboratorio sobre datos de TEST; no es una ejecución del agente mediante API.</p> : null}
              {diagnostic.result_scope === "overview" && diagnostic.requested_scope && diagnostic.requested_scope !== "overview" ? (
                <p className={s.aiAgentSum}>Lectura general de A02; todavía no hay una lectura específica para este canal.</p>
              ) : null}
              {findings.length ? (
                <Collapsible open={open} onOpenChange={(next) => setExpanded(next ? key : null)}>
                  <Accordion multiple className={s.aiFindings}>
                    {findings.slice(0, FINDINGS_SHOWN).map(renderFinding)}
                  </Accordion>
                  {findings.length > FINDINGS_SHOWN ? (
                    <>
                      <CollapsibleContent>
                        <Accordion multiple className={s.aiFindings}>
                          {findings.slice(FINDINGS_SHOWN).map((finding, index) => renderFinding(finding, index + FINDINGS_SHOWN))}
                        </Accordion>
                      </CollapsibleContent>
                      <CollapsibleTrigger className={s.qiToggle}>
                        {open ? "Ver menos" : `${findings.length - FINDINGS_SHOWN} hallazgos más`}
                      </CollapsibleTrigger>
                    </>
                  ) : null}
                </Collapsible>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// "Qué hacer": propuestas de la IA + avisos + tareas en una sola lista
// ---------------------------------------------------------------------------

// Las tareas del Camino llegan como un párrafo "1) … 2) …": se parten en pasos.
function splitSteps(text: string): string[] {
  const steps = text.split(/ *(?<![0-9,./])(?=[0-9]{1,2}[)] )/).map((part) => part.replace(/^[0-9]{1,2}[)] */, "").trim()).filter(Boolean);
  return steps.length > 1 ? steps : [text.trim()];
}

function TaskDetail({ text, label = "Ver detalle" }: { text: string; label?: string }) {
  const steps = splitSteps(text);
  return (
    <Collapsible className={s.qiD}>
      <CollapsibleTrigger>{label}{steps.length > 1 ? ` (${steps.length} pasos)` : ""}<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
      <CollapsibleContent>
      {steps.length > 1 ? (
        <ol>
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      ) : (
        <p>{steps[0]}</p>
      )}
    </CollapsibleContent>
    </Collapsible>
  );
}

type QueueItem =
  | { kind: "proposal"; key: string; outputId: string; index: number; total: number; title: string; why: string; priority: string; mine: boolean; due: string | null; source: string; sourceLabel: string }
  | { kind: "alert"; key: string; title: string; why: string; priority: string }
  | { kind: "task"; key: string; task: Task; mine: boolean; priority: string };

type Decision = "approved" | "rejected";

// `asConsultant`: la misma cola vista desde la mesa del consultor. Cambia de
// quién es cada propuesta (owner_role) y quién es "el otro" en los filtros.
export function WorkQueue({ base, userId, consultant, asConsultant = false, proposals, operations, reloadAll, title = "Qué hacer", titleId }: {
  base: string;
  userId: string;
  consultant: AssignedConsultant;
  asConsultant?: boolean;
  proposals: Diagnostic[];
  operations: Operations | undefined;
  reloadAll: () => void;
  /** Ya no se usa: comentar se hace sobre la propia tarea. Se mantiene por compatibilidad. */
  onComment?: (text: string) => void;
  title?: string;
  /** Si la cola es la sección principal de la vista, su título hace de ancla. */
  titleId?: string;
  /** Una línea de la IA sobre qué atacar primero, encima de la lista. */
  lead?: string | null;
}) {
  const [filter, setFilter] = useState<"all" | "mine" | "consultant" | "ai">("all");
  const [showAll, setShowAll] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Record<number, Decision>>>({});
  const [sentOutputs, setSentOutputs] = useState<string[]>([]);
  const [goneTasks, setGoneTasks] = useState<string[]>([]);
  const [goneProposals, setGoneProposals] = useState<string[]>([]);
  const [closing, setClosing] = useState<string | null>(null);
  const [commenting, setCommenting] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [openSteps, setOpenSteps] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const consultantName = asConsultant ? "Cliente" : consultant?.full_name?.split(" ")[0] ?? "Tu consultor";

  const items = useMemo<QueueItem[]>(() => {
    const list: QueueItem[] = [];
    const seenOutputs = new Set<string>();
    for (const diagnostic of proposals.flatMap((item) => item.pending_outputs?.length ? item.pending_outputs : [item])) {
      if (seenOutputs.has(diagnostic.output_id)) continue;
      seenOutputs.add(diagnostic.output_id);
      if (diagnostic.output_status !== "pending_approval" || sentOutputs.includes(diagnostic.output_id)) continue;
      // Los diagnósticos de solo lectura (como A02) usan su contrato nativo
      // de secciones/recomendaciones y no incluyen propuestas de escritura.
      const writes = Array.isArray(diagnostic.output.proposed_writes)
        ? diagnostic.output.proposed_writes
        : [];
      // Las descartadas una a una ya están guardadas en el servidor (proposal_edits).
      const dismissed = new Set<number>(
        ((diagnostic.output as { proposal_edits?: Array<{ index?: number; skip?: boolean }> }).proposal_edits ?? [])
          .filter((edit) => edit.skip === true && Number.isInteger(edit.index))
          .map((edit) => Number(edit.index)),
      );
      const live = writes.length - dismissed.size;
      writes.forEach((write, index) => {
        if (dismissed.has(index) || goneProposals.includes(`${diagnostic.output_id}:${index}`)) return;
        list.push({
          kind: "proposal",
          key: `${diagnostic.output_id}:${index}`,
          outputId: diagnostic.output_id,
          index,
          total: live,
          title: write.title,
          why: write.description,
          priority: write.priority,
          mine: asConsultant ? write.owner_role === "consultor" : write.owner_role !== "consultor",
          due: write.due_hint ?? null,
          source: diagnostic.output_id,
          sourceLabel: diagnostic.agent_code === "a04_generador_tareas"
            ? `A04 · Plan diario${diagnostic.scope_label ? ` · ${diagnostic.scope_label.toLowerCase()}` : ""}`
            : "Propuesta IA",
        });
      });
    }
    for (const alert of operations?.alerts ?? []) {
      if (!["open", "acknowledged"].includes(alert.status)) continue;
      list.push({ kind: "alert", key: alert.id, title: alert.title, why: alert.message, priority: alert.severity });
    }
    for (const task of operations?.tasks ?? []) {
      if (!["proposed", "pending", "in_progress"].includes(task.status) || goneTasks.includes(task.id)) continue;
      // Una propuesta del consultor espera decisión, venza cuando venza.
      if (task.status !== "proposed" && task.due_at && Date.parse(task.due_at) - now > SHORT_TERM_DAYS * DAY_MS) continue;
      list.push({ kind: "task", key: task.id, task, mine: asConsultant ? task.assigned_to === userId : !task.assigned_to || task.assigned_to === userId, priority: task.priority });
    }
    // Primero lo más grave, sea propuesta o tarea: solo se enseñan las cinco primeras.
    // A igual gravedad, lo que espera una decisión; luego lo que vence antes.
    const dueOf = (i: QueueItem) => (i.kind === "task" && i.task.due_at ? Date.parse(i.task.due_at) : Infinity);
    const awaitsDecision = (i: QueueItem) => i.kind === "proposal" || (i.kind === "task" && i.task.status === "proposed");
    return list.sort(
      (a, b) =>
        (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) ||
        Number(awaitsDecision(b)) - Number(awaitsDecision(a)) ||
        dueOf(a) - dueOf(b),
    );
  }, [asConsultant, goneProposals, goneTasks, now, operations, proposals, sentOutputs, userId]);

  const laterCount = (operations?.tasks ?? []).filter(
    (t) => ["pending", "in_progress"].includes(t.status) && t.due_at && Date.parse(t.due_at) - now > SHORT_TERM_DAYS * DAY_MS,
  ).length;

  const done = (operations?.tasks ?? [])
    .filter((t) => t.status === "completed" && now - Date.parse(t.updated_at) < 7 * DAY_MS)
    .slice(0, 6);

  const filters = [
    { key: "all" as const, label: "Todo", test: () => true },
    { key: "mine" as const, label: "Tuyas", test: (i: QueueItem) => i.kind === "task" && i.mine },
    ...(consultant || asConsultant
      ? [{ key: "consultant" as const, label: asConsultant ? "Del cliente" : `De ${consultantName}`, test: (i: QueueItem) => i.kind === "task" && !i.mine }]
      : []),
    { key: "ai" as const, label: "Propuestas IA", test: (i: QueueItem) => i.kind === "proposal" },
  ];
  // Un filtro a cero no filtra nada: solo se enseñan los que tienen algo.
  const usefulFilters = filters.filter((f) => f.key === "all" || items.some(f.test));
  const activeFilter = usefulFilters.find((f) => f.key === filter) ?? usefulFilters[0];
  const filtered = items.filter(activeFilter.test);
  const visible = filtered.slice(0, QUEUE_PREVIEW);
  const urgent = items.filter((i) => (PRIORITY_RANK[i.priority] ?? 2) === 0).length;

  async function decide(item: Extract<QueueItem, { kind: "proposal" }>, decision: Decision) {
    const forOutput = { ...(decisions[item.outputId] ?? {}), [item.index]: decision };
    setDecisions((prev) => ({ ...prev, [item.outputId]: forOutput }));
    if (Object.keys(forOutput).length < item.total) {
      // Descartar una propuesta se guarda al momento: si no, el consultor la seguiría viendo.
      if (decision === "rejected") {
        setBusy(item.key);
        try {
          const response = await apiFetch(`${base}/ai/outputs/${item.outputId}/decision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ decision: "dismiss_proposal", edits: [{ index: item.index, skip: true }] }),
          });
          if (!response.ok) throw new Error(await readApiError(response));
          setDecisions((prev) => {
            const next = { ...(prev[item.outputId] ?? {}) };
            delete next[item.index];
            return { ...prev, [item.outputId]: next };
          });
          setGoneProposals((prev) => [...prev, item.key]);
          toast.success("Propuesta descartada.");
          reloadAll();
        } catch (cause) {
          setDecisions((prev) => {
            const next = { ...(prev[item.outputId] ?? {}) };
            delete next[item.index];
            return { ...prev, [item.outputId]: next };
          });
          toast.danger(cause instanceof Error && cause.message ? `No se pudo descartar: ${cause.message}` : "No se pudo descartar la propuesta.");
        } finally {
          setBusy(null);
        }
      }
      return;
    }

    // El endpoint decide la tanda entera: se envía cuando todas tienen respuesta.
    const approved = Object.values(forOutput).filter((d) => d === "approved").length;
    const batch: Decision = approved > 0 ? "approved" : "rejected";
    const edits =
      batch === "approved"
        ? Object.entries(forOutput).flatMap(([index, d]) => (d === "approved" ? [] : [{ index: Number(index), skip: true }]))
        : undefined;
    setBusy(item.key);
    try {
      const response = await apiFetch(`${base}/ai/outputs/${item.outputId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: batch, ...(edits ? { edits } : {}) }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        setDecisions((prev) => ({ ...prev, [item.outputId]: {} }));
        return;
      }
      setSentOutputs((prev) => [...prev, item.outputId]);
      toast.success(batch === "approved" ? `${approved} tarea(s) creada(s) en Tareas.` : "Propuestas descartadas.");
      reloadAll();
    } catch (cause) {
      console.error("decision_failed", cause);
      setDecisions((prev) => ({ ...prev, [item.outputId]: {} }));
      toast.danger(cause instanceof Error && cause.message ? `No se pudo guardar la decisión: ${cause.message}` : "No se pudo guardar la decisión. Reintenta.");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(task: Task, status: "pending" | "in_progress" | "completed" | "ignored", note?: string) {
    setBusy(task.id);
    try {
      if (note) {
        const comment = await apiFetch(`${base}/tasks/${task.id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: `Resultado: ${note}`, isInternal: false }),
        });
        if (!comment.ok) throw new Error(await readApiError(comment));
      }
      const response = await apiFetch(`${base}/tasks/${task.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      if (status !== "in_progress") setGoneTasks((prev) => [...prev, task.id]);
      toast.success(
        task.status === "proposed"
          ? status === "pending" ? "Tarea aceptada: ya está en tu lista." : "Propuesta rechazada. Tu consultor lo verá."
          : status === "completed" ? "Tarea cerrada con su resultado." : status === "ignored" ? "Tarea archivada. La encontrarás en Tareas, filtro Ignoradas." : "Tarea en curso.",
      );
      setClosing(null);
      setOutcome("");
      reloadAll();
    } catch (cause) {
      toast.danger(cause instanceof Error ? cause.message : "No se pudo actualizar la tarea.");
    } finally {
      setBusy(null);
    }
  }

  // Comentario sobre la tarea, visible para el cliente y el consultor (no es el chat).
  async function submitComment(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault();
    const body = commentText.trim();
    if (!body) return;
    setBusy(task.id);
    try {
      const response = await apiFetch(`${base}/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, isInternal: false }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      toast.success("Comentario añadido a la tarea.");
      setCommenting(null);
      setCommentText("");
      setOpenComments(task.id);
      reloadAll();
    } catch (cause) {
      toast.danger(cause instanceof Error ? cause.message : "No se pudo guardar el comentario.");
    } finally {
      setBusy(null);
    }
  }

  function submitOutcome(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault();
    if (!outcome.trim()) return;
    void setStatus(task, "completed", outcome.trim());
  }

  function who(mine: boolean, name?: string | null) {
    return mine ? (
      <span className={s.who}>
        <i>Tú</i>Tú
      </span>
    ) : (
      <span className={cx(s.who, s.whoOther)}>
        <i>{(name ?? consultantName).slice(0, 2).toUpperCase()}</i>
        {name ?? consultantName}
      </span>
    );
  }

  const renderQueueItem = (item: (typeof filtered)[number]) => {
            if (item.kind === "proposal") {
              const decided = decisions[item.outputId]?.[item.index];
              const pendingOthers = item.total - Object.keys(decisions[item.outputId] ?? {}).length;
              const isA04 = item.sourceLabel.startsWith("A04");
              return (
                <li key={item.key} className={cx(s.qi, s.qiProposal, "task-lift")}>
                  <span className={cx(s.pr, prioClass(item.priority))} aria-hidden="true" />
                  <span className={s.qiAv} data-tone="ia" aria-hidden="true">{isA04 ? "A04" : "IA"}</span>
                  <div>
                    <p className={s.qiK}>
                      <span className={s.ia}>{isA04 ? "A04" : "IA"}</span>
                      <span className={s.qiSource}>{isA04 ? item.sourceLabel.replace(/^A04 · /, "") : "Propuesta"}</span>
                      <span className={s.qiHint}>
                        {isA04 ? "· Propuesta · " : "· "}
                        {asConsultant
                          ? "puedes decidirla; el cliente también"
                          : consultant
                            ? "puedes decidirla o esperar a tu consultor"
                            : "puedes crear la tarea o descartarla"}
                      </span>
                    </p>
                    <p className={s.qiT}>{item.title}</p>
                    {item.why ? <TaskDetail text={item.why} label="Por qué" /> : null}
                    <div className={s.qiM}>
                      <span className={cx(s.prioL, prioClass(item.priority) === s.prUrgent && s.prioUrgent)}>
                        {PRIORITY_LABEL[item.priority] ?? item.priority}
                      </span>
                      {item.due ? <span className={s.chip} title={item.due}>{item.due}</span> : null}
                      {decided ? (
                        <span className={cx(s.chip, decided === "approved" ? s.chipGood : undefined)}>
                          {decided === "approved" ? "Aprobada" : "Descartada"}
                          {pendingOthers > 0 ? ` · faltan ${pendingOthers} por decidir` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {decided ? (
                    <span />
                  ) : (
                    <div className={s.qiA}>
                      <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: s.iconOk })} aria-label="Crear tarea" title="Crear tarea" disabled={busy !== null} onClick={() => void decide(item, "approved")}>
                        <CheckIcon aria-hidden="true" /><span className={s.btnLabel}>Crear tarea</span>
                      </button>
                      <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: s.iconNo })} aria-label="Descartar" title="Descartar" disabled={busy !== null} onClick={() => void decide(item, "rejected")}>
                        <CloseIcon aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </li>
              );
            }
            if (item.kind === "alert") {
              return (
                <li key={item.key} className={cx(s.qi, "task-lift")}>
                  <span className={cx(s.pr, prioClass(item.priority))} aria-hidden="true" />
                  <span className={s.qiAv} data-tone="high" aria-hidden="true">!</span>
                  <div>
                    <p className={s.qiK} style={{ color: "var(--warn)" }}>Aviso</p>
                    <p className={s.qiT}>{item.title}</p>
                    {item.why ? <TaskDetail text={item.why} label="Por qué" /> : null}
                  </div>
                  <span />
                </li>
              );
            }
            const { task } = item;
            // Vencida = su fecha ya pasó (comparando días, no horas).
            const overdue = Boolean(task.due_at && Date.parse(task.due_at.slice(0, 10)) < Date.parse(new Date(now).toISOString().slice(0, 10)));
            const rank = PRIORITY_RANK[item.priority] ?? 2;
            const proposed = task.status === "proposed";
            // Cerrar es la acción principal de una tarea propia (del cliente o del
            // consultor): el círculo de la izquierda. Las del otro no se cierran desde aquí.
            const canClose = !proposed && item.mine;
            const steps = task.description ? splitSteps(task.description) : [];
            const notes = (task.task_comments ?? []).filter((c) => !c.is_internal && !c.body.startsWith("Resultado:"));
            const stepsOpen = openSteps === task.id;
            const notesOpen = openComments === task.id;
            return (
              <li key={item.key} className={cx(s.qi, s.qiTask, proposed && s.qiProposal, "task-lift")}>
                <span className={s.qiAv} data-tone={rank === 0 ? "urgent" : rank === 1 ? "high" : undefined} aria-hidden="true">
                  {item.mine ? "TÚ" : initials(task.assignee_name ?? consultantName)}
                </span>
                {canClose ? (
                  <button
                    type="button"
                    className={cx(s.qiCheck, rank === 0 ? s.qiCheckUrgent : rank === 1 ? s.qiCheckHigh : undefined)}
                    aria-label="Marcar como hecha"
                    title="Marcar como hecha"
                    aria-pressed={closing === task.id}
                    disabled={busy === task.id}
                    onClick={() => {
                      setClosing(closing === task.id ? null : task.id);
                      setOutcome("");
                    }}
                  >
                    <CheckIcon aria-hidden="true" /><span className={s.btnLabel}>Hecha</span>
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
                <div>
                  {proposed ? (
                    <p className={s.qiK}>
                      {asConsultant ? "Propuesta tuya · esperando al cliente" : `Propuesta de ${consultantName} · acéptala o recházala`}
                    </p>
                  ) : null}
                  <p className={s.qiT}>{task.title}</p>
                  {/* Una sola línea de datos: prioridad, fecha, de quién, pasos y comentarios. */}
                  <div className={s.qiM}>
                    {item.mine ? <span className={s.qiMine}>Tú</span> : who(false, task.assignee_name)}
                    {/* Solo se nombra la prioridad cuando cambia algo: urgente o alta. */}
                    {rank <= 1 ? (
                      <span className={cx(s.prioL, rank === 0 ? s.prioUrgent : s.prioHigh)}>
                        {PRIORITY_LABEL[item.priority] ?? item.priority}
                      </span>
                    ) : null}
                    {task.due_at ? (
                      <span className={cx(s.chip, overdue && s.chipBad)}>
                        {overdue ? "Vencida · " : ""}
                        {dayLabel(task.due_at, true)}
                      </span>
                    ) : null}
                    {task.status === "in_progress" ? <span className={cx(s.chip, s.chipAcc)}>En curso</span> : null}
                    {asConsultant && task.is_visible_to_client === false ? <span className={s.chip}>Interna · el cliente no la ve</span> : null}
                    {steps.length ? (
                      <button type="button" className={s.qiToggle} aria-expanded={stepsOpen} onClick={() => setOpenSteps(stepsOpen ? null : task.id)}>
                        {steps.length > 1 ? `${steps.length} pasos` : "Detalle"}
                      </button>
                    ) : null}
                    {notes.length ? (
                      <button type="button" className={cx(s.qiToggle, s.qiToggleNote)} aria-expanded={notesOpen} onClick={() => setOpenComments(notesOpen ? null : task.id)}>
                        <MessageIcon aria-hidden="true" />
                        {notes.length}
                      </button>
                    ) : null}
                  </div>
                  {stepsOpen ? (
                    steps.length > 1 ? (
                      <ol className={s.qiSteps}>
                        {steps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className={s.qiSteps}>{steps[0]}</p>
                    )
                  ) : null}
                  {notesOpen ? (
                    <ul className={s.cmtList}>
                      {notes
                        .slice()
                        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
                        .map((c, i) => (
                          <li key={`${c.created_at}-${i}`}>
                            {c.body}
                            <small>{dayLabel(c.created_at, true)}</small>
                          </li>
                        ))}
                    </ul>
                  ) : null}
                  {commenting === task.id ? (
                    <form className={s.cmtBox} onSubmit={(event) => void submitComment(event, task)}>
                      <label className="sr-only" htmlFor={`pulse-comment-${task.id}`}>Comentario sobre la tarea</label>
                      <textarea
                        id={`pulse-comment-${task.id}`}
                        className={s.cmtInput}
                        rows={2}
                        maxLength={2000}
                        value={commentText}
                        onChange={(event) => setCommentText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                          if (event.key === "Escape") setCommenting(null);
                        }}
                        placeholder={asConsultant ? "Escribe un comentario para el cliente…" : "Escribe un comentario para tu consultor…"}
                        autoFocus
                      />
                      <div className={s.cmtFoot}>
                        <span className={s.cmtHint}>
                          <MessageIcon aria-hidden="true" />
                          {asConsultant ? "Lo verá el cliente en esta tarea" : "Lo verá tu consultor en esta tarea"}
                          <kbd>Ctrl + Enter</kbd>
                        </span>
                        <div className={s.cmtActions}>
                          <button type="button" className={buttonVariants({ variant: "ghost", size: "sm" })} onClick={() => setCommenting(null)}>
                            Cancelar
                          </button>
                          <button type="submit" className={buttonVariants({ size: "sm" })} disabled={!commentText.trim() || busy === task.id}>
                            {busy === task.id ? "Enviando…" : "Comentar"}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : null}
                  {closing === task.id ? (
                    <form className={s.qf} onSubmit={(event) => submitOutcome(event, task)}>
                      <label htmlFor={`pulse-outcome-${task.id}`}>¿Qué resultado tuvo?</label>
                      <textarea
                        id={`pulse-outcome-${task.id}`}
                        rows={2}
                        value={outcome}
                        onChange={(event) => setOutcome(event.target.value)}
                        placeholder="Ej.: pedido hecho, llega el día 12"
                        autoFocus
                      />
                      <div className={s.qfB}>
                        <button type="submit" className={buttonVariants({ size: "sm" })} disabled={!outcome.trim() || busy === task.id}>
                          Registrar
                        </button>
                        <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={() => setClosing(null)}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
                <div className={s.qiA}>
                  {proposed && !asConsultant ? (
                  <>
                    <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: s.iconOk })} aria-label="Aceptar tarea" title="Aceptar tarea" disabled={busy === task.id} onClick={() => void setStatus(task, "pending")}>
                      <CheckIcon aria-hidden="true" /><span className={s.btnLabel}>Aceptar</span>
                    </button>
                    <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: s.iconNo })} aria-label="Rechazar tarea" title="Rechazar tarea" disabled={busy === task.id} onClick={() => void setStatus(task, "ignored")}>
                      <CloseIcon aria-hidden="true" /><span className={s.btnLabel}>Descartar</span>
                    </button>
                  </>
                  ) : canClose ? (
                    <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Archivar: ya no me interesa" title="Archivar: ya no me interesa" disabled={busy === task.id} onClick={() => void setStatus(task, "ignored")}>
                      <ArchiveIcon aria-hidden="true" /><span className={s.btnLabel}>No me interesa</span>
                    </button>
                  ) : null}
                  {consultant || asConsultant ? (
                    <button
                      type="button"
                      className={buttonVariants({ variant: "ghost", size: "icon-sm", className: s.cmtBtn })}
                      aria-label="Añadir comentario a la tarea"
                      title="Añadir comentario"
                      onClick={() => { setCommenting(commenting === task.id ? null : task.id); setCommentText(""); }}
                    >
                      <MessageIcon aria-hidden="true" />
                      <PlusIcon aria-hidden="true" className={s.cmtPlus} /><span className={s.btnLabel}>Comentar</span>
                    </button>
                  ) : null}
                </div>
              </li>
            );
          };

  return (
    <>
      <div className={s.panelH}>
        <div>
          <h3 id={titleId}>
            {title} <ZoneNoteMark anchor={zoneAnchor("bloque", title)} label={title} />
          </h3>
          <p className={s.qSum}>
            {items.length ? `${items.length} por resolver` : operations ? "Al día" : "Pendientes de comprobar"}
            {laterCount ? (
              <>
                {" · "}
                <Link href="/tareas">{laterCount} más a largo plazo</Link>
              </>
            ) : null}
            {urgent ? (
              <>
                {" · "}
                <b>{urgent} urgentes</b>
              </>
            ) : null}
            {items.some((i) => i.kind === "proposal") ? (
              <span className={s.qSumHint}>
                {" · "}
                {asConsultant
                  ? "las propuestas puedes decidirlas; el cliente también"
                  : consultant
                    ? "las propuestas puedes decidirlas o esperar a tu consultor"
                    : "de cada propuesta puedes crear la tarea o descartarla"}
              </span>
            ) : null}
          </p>
        </div>
        {/* Filtrar una lista vacía son cuatro botones a cero: solo con algo que filtrar. */}
        {usefulFilters.length > 1 ? (
        <ToggleGroup aria-label="Filtrar trabajo pendiente" spacing={1.5} value={activeFilter.key} onValueChange={setFilter}>
          {usefulFilters.map((f) => (
            <ToggleGroupItem key={f.key} value={f.key}>
              {f.label}
              <span className="text-xs text-muted tabular-nums">{items.filter(f.test).length}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <Empty action={items.length
          ? <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={() => setFilter("all")}>Ver todo el trabajo</button>
          : !operations ? <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={reloadAll}>Volver a cargar las tareas</button> : undefined}>
          {items.length ? "No hay trabajo pendiente con este filtro." : !operations ? "Aún no se han podido comprobar las tareas de esta tienda." : "No hay tareas ni propuestas pendientes. Puedes revisar tus resultados o continuar con el plan de la semana."}
        </Empty>
      ) : (
        <Collapsible open={showAll} onOpenChange={setShowAll}>
          <ul>
            {filtered.slice(0, QUEUE_PREVIEW).map(renderQueueItem)}
          </ul>
          {filtered.length > QUEUE_PREVIEW ? (
            <>
              <CollapsibleContent>
                <ul className={s.qiMore}>{filtered.slice(QUEUE_PREVIEW).map(renderQueueItem)}</ul>
              </CollapsibleContent>
              <CollapsibleMore
                count={filtered.length - QUEUE_PREVIEW}
                more={`Ver las ${filtered.length} (${filtered.length - QUEUE_PREVIEW} más)`}
              />
            </>
          ) : null}
        </Collapsible>
      )}

      {done.length ? (
        <Collapsible className={s.done}>
          <CollapsibleTrigger>Hechas esta semana ({done.length})<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
          <CollapsibleContent>
          <ul>
            {done.map((task) => {
              const result = task.task_comments?.find((c) => !c.is_internal && c.body.startsWith("Resultado:"));
              return (
                <li key={task.id}>
                  <div>
                    <s>{task.title}</s>
                    {result ? <span className={s.muted} style={{ display: "block", fontSize: 12.5 }}>{result.body.replace(/^Resultado:\s*/, "")}</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </CollapsibleContent>
        </Collapsible>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Objetivos (los manda Mi Camino) y ventas por mes
// ---------------------------------------------------------------------------

/** En los extremos el aviso se alinea con la barra para no salirse de la tarjeta. */
const tipEdge = (index: number, total: number, margin: number) =>
  index < margin ? "start" : index >= total - margin ? "end" : undefined;

// El estado vive aquí para que pasar el ratón no vuelva a pintar toda la portada.
function DailySales({ days, money }: {
  days: Array<{ date: string; net_sales: number }>;
  money: (value: number) => string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const lastDay = days.at(-1);
  const shown = (hovered === null ? null : days[hovered]) ?? lastDay;
  const max = Math.max(...days.map((day) => day.net_sales), 1);
  return (
    <>
      <div className={s.gLiveHead}>
        <div>
          <h2 id="pulse-dia">Ventas por día</h2>
          <p>Días cerrados · últimos 30 días</p>
        </div>
        {shown ? <span className={s.gLivePill}><i aria-hidden="true" />{dayLabel(shown.date)}</span> : null}
      </div>
      {shown && lastDay ? (
        <>
          <p className={s.gLiveV}>{money(shown.net_sales)}<small>el {dayLabel(shown.date, true)}</small></p>
          <div className={s.gBars} role="img" aria-label={`Ventas netas de los últimos ${days.length} días cerrados`} onPointerLeave={() => setHovered(null)}>
            {days.map((day, index) => (
              <span
                key={day.date}
                className={s.gTip}
                data-tip={`${dayLabel(day.date, true)} · ${money(day.net_sales)}`}
                data-edge={tipEdge(index, days.length, 5)}
                style={{ "--share": Math.max(0.03, Math.max(day.net_sales, 0) / max) } as CSSProperties}
                onPointerEnter={() => setHovered(index)}
              >
                <i />
              </span>
            ))}
          </div>
          <div className={s.gBarsAxis}><span>{dayLabel(days[0].date)}</span><span>{dayLabel(lastDay.date)}</span></div>
        </>
      ) : <p className={s.chartEmpty}>Todavía no hay días cerrados en este periodo.</p>}
    </>
  );
}

function GoalsCard({ objectives, money, href }: {
  objectives: GoalObjective[];
  money: (value: number) => string;
  href: string;
}) {
  const { main, others } = pickGoals(objectives);
  const format = (value: number, unit: string) =>
    unit === "money" ? money(value) : unit === "pct" ? `${fmtNum(value, 1)} %` : unit === "ratio" ? `${fmtNum(value, 2)}×` : fmtNum(value);
  const pct = main ? Math.min(100, Math.max(0, main.progress_pct ?? 0)) : 0;
  return (
    <Link className={cx(s.pBlock, s.gGoal, "zone-card")} href={href} aria-label="Ver objetivos en Mi Camino">
      {main ? (
        <>
          <div className={s.gGoalHead}>
            <h2>Hacia {format(main.target_value, main.unit)}</h2>
            <p>{main.label}{main.measurement?.period_label ? ` · ${main.measurement.period_label}` : ""}</p>
          </div>
          <div className={s.gGoalMain}>
            <div className={s.gRing} role="img" aria-label={`${fmtNum(pct)} % del objetivo`}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle cx="60" cy="60" r="52" pathLength={100} />
                <circle cx="60" cy="60" r="52" pathLength={100} strokeDasharray={`${pct} 100`} />
              </svg>
              <span><b>{fmtNum(pct)} %</b><small>del objetivo</small></span>
            </div>
            <dl className={s.gGoalFacts}>
              <div><dt>Llevas</dt><dd>{format(main.actual_value ?? 0, main.unit)}</dd></div>
              {pct < 100
                ? <div><dt>Faltan</dt><dd>{format(main.target_value - (main.actual_value ?? 0), main.unit)}</dd></div>
                : <div><dt>Estado</dt><dd>Cumplido</dd></div>}
            </dl>
          </div>
          {others.length ? (
            <ul className={s.gGoalOthers}>
              {others.map((objective) => (
                <li key={objective.id}>
                  <span>{objective.label}</span>
                  <b>{objective.progress_pct === null ? "Sin datos" : `${fmtNum(Math.max(0, objective.progress_pct))} %`}</b>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <div className={s.gGoalHead}>
          <h2>Sin objetivos con datos</h2>
          <p>Se fijan en Mi Camino</p>
        </div>
      )}
    </Link>
  );
}

function MonthsCard({ monthly, currentMonth, money }: {
  monthly: Array<{ month: string; net_revenue_ex_tax: number }>;
  /** AAAA-MM del mes en curso: va a medias y por eso se distingue. */
  currentMonth: string;
  money: (value: number) => string;
}) {
  const months = monthly.slice(-MONTH_BARS).map((row) => ({
    key: row.month.slice(0, 7),
    value: row.net_revenue_ex_tax,
    label: new Date(`${row.month.slice(0, 7)}-15T00:00:00Z`).toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" }).replace(".", ""),
    name: new Date(`${row.month.slice(0, 7)}-15T00:00:00Z`).toLocaleDateString("es-ES", { month: "long", timeZone: "UTC" }),
  }));
  const closed = months.filter((month) => month.key !== currentMonth).at(-1);
  if (months.length < 2 || !closed) return null;
  const max = Math.max(...months.map((month) => month.value), 1);
  return (
    <section className={cx(s.pBlock, s.gMonths, "zone-card")} aria-labelledby="pulse-months">
      <div className={s.gGoalHead}>
        <h2 id="pulse-months">Ventas por mes</h2>
        <p>{closed.name[0].toUpperCase() + closed.name.slice(1)} cerró en {money(closed.value)}</p>
      </div>
      <ol className={s.gMonthBars}>
        {months.map((month, index) => (
          <li
            key={month.key}
            className={s.gTip}
            data-current={month.key === currentMonth || undefined}
            data-tip={`${month.name}${month.key === currentMonth ? " en curso" : ""} · ${money(month.value)}`}
            data-edge={tipEdge(index, months.length, 2)}
            style={{ "--share": Math.max(0.02, Math.max(month.value, 0) / max) } as CSSProperties}
          >
            <i />
            <span>{month.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Campañas de email y anuncios de Meta, cada uno con su atribución
// ---------------------------------------------------------------------------

type MetaAd = {
  ad_id: string;
  campaign_id?: string | null;
  ad_name: string;
  campaign_name: string;
  spend: number;
  spend_currency: string | null;
  outbound_ctr: number | null;
  purchases: number;
  roas: number | null;
  enough_volume: boolean;
};
const MARKETING_ROWS = 5;
const MONTH_BARS = 7;
const rate = (ratio: number | null | undefined, digits = 1) => (ratio == null ? "—" : `${fmtNum(ratio * 100, digits)} %`);

function MarketingResults({ adsUrl, route, hasMeta, emails, emailsFailed, emailMoney, onRetryEmails }: {
  adsUrl: string;
  route: (href: string) => string;
  hasMeta: boolean;
  emails: KlaviyoCampaign[] | null;
  emailsFailed: boolean;
  /** Null si la moneda de Klaviyo no se puede comparar con la de la tienda. */
  emailMoney: ((value: number) => string) | null;
  onRetryEmails: () => void;
}) {
  const [chosenTab, setTab] = useState<string | null>(null);
  // Sin envíos recientes se abre en los anuncios, en vez de en una pestaña vacía.
  const tab = chosenTab ?? (emails?.length === 0 && hasMeta ? "meta" : "email");
  // Los anuncios se piden al abrir su pestaña: es la consulta más pesada del widget.
  const ads = useCachedQuery<{ creatives: MetaAd[]; unavailable?: string[] }>(tab === "meta" && hasMeta ? adsUrl : null);
  const adsFailed = (Boolean(ads.error) && !ads.data) || Boolean(ads.data?.unavailable?.includes("creatives"));
  const retry = (onRetry: () => void) => <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={onRetry}>Volver a cargar</button>;
  const loading = <Skeleton className="h-40 w-full" />;

  const recentEmails = (emails ?? [])
    .slice()
    .sort((a, b) => (b.send_time ?? "").localeCompare(a.send_time ?? ""))
    .slice(0, MARKETING_ROWS);
  const topAds = (ads.data?.creatives ?? []).slice().sort((a, b) => b.spend - a.spend).slice(0, MARKETING_ROWS);

  const emailPanel = emailsFailed ? (
    <Empty action={retry(onRetryEmails)}>No se han podido cargar las campañas de email.</Empty>
  ) : emails === null ? loading : recentEmails.length === 0 ? (
    <Empty>Sin campañas enviadas en los últimos 30 días.</Empty>
  ) : (
    <>
      <Table aria-label="Resultados de las últimas campañas de email">
        <TableHeader>
          <TableRow>
            <TableHead>Campaña</TableHead>
            <TableHead className={s.gMkN}>Destinatarios</TableHead>
            <TableHead className={s.gMkN}>Apertura</TableHead>
            <TableHead className={s.gMkN}>Clics</TableHead>
            <TableHead className={s.gMkN}>Atribuidos por Klaviyo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recentEmails.map((campaign) => (
            <TableRow key={campaign.id} className={s.gMkRow}>
              <TableCell>
                <Link className={s.gMkName} href={route(`/klaviyo/campanas/${encodeURIComponent(campaign.id)}`)}>{campaign.name}</Link>
                <small className={s.gMkSub}>{campaign.send_time ? `Enviada el ${dayLabel(campaign.send_time, true)}` : "Sin fecha de envío"}</small>
              </TableCell>
              <TableCell className={s.gMkN}>{fmtNum(campaign.recipients)}</TableCell>
              <TableCell className={s.gMkN}>{rate(campaign.open_rate)}</TableCell>
              <TableCell className={s.gMkN}>{rate(campaign.click_rate, 2)}</TableCell>
              <TableCell className={s.gMkN}>{emailMoney ? emailMoney(campaign.revenue) : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {emailMoney ? null : <p className={s.gNote}>Importes pendientes de validar la moneda.</p>}
    </>
  );

  const adsPanel = !hasMeta ? (
    <Empty action={<Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={route("/integraciones/meta")}>Conectar Meta Ads</Link>}>
      Conecta tu cuenta publicitaria para ver tus anuncios.
    </Empty>
  ) : adsFailed ? (
    <Empty action={retry(() => ads.reload())}>No se han podido cargar los anuncios de Meta.</Empty>
  ) : !ads.data ? loading : topAds.length === 0 ? (
    <Empty>Sin anuncios con gasto en los últimos 30 días.</Empty>
  ) : (
    <Table aria-label="Resultados de los anuncios de Meta con más inversión">
      <TableHeader>
        <TableRow>
          <TableHead>Anuncio</TableHead>
          <TableHead className={s.gMkN}>Inversión</TableHead>
          <TableHead className={s.gMkN}>CTR</TableHead>
          <TableHead className={s.gMkN}>Compras</TableHead>
          <TableHead className={s.gMkN}>ROAS atribuido por Meta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {topAds.map((ad) => (
          <TableRow key={ad.ad_id} className={s.gMkRow}>
            <TableCell>
              {/* Un anuncio no tiene ficha propia: la suya es la de su campaña. */}
              {ad.campaign_id
                ? <Link className={s.gMkName} href={route(`/meta/campanas/${encodeURIComponent(ad.campaign_id)}`)}>{ad.ad_name}</Link>
                : <span className={s.gMkName}>{ad.ad_name}</span>}
              <small className={s.gMkSub}>{ad.campaign_name}</small>
            </TableCell>
            <TableCell className={s.gMkN}>{fmtCurrency(ad.spend, ad.spend_currency)}</TableCell>
            <TableCell className={s.gMkN}>{ad.enough_volume ? rate(ad.outbound_ctr, 2) : "—"}</TableCell>
            <TableCell className={s.gMkN}>{fmtNum(ad.purchases)}</TableCell>
            <TableCell className={s.gMkN}>{!ad.enough_volume ? "Poco volumen" : ad.roas == null ? "—" : `${fmtNum(ad.roas, 2)}×`}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <section className={cx(s.gMk, "zone-card")} aria-label="Campañas y anuncios">
      <span className={s.gMkNote}><ZoneNoteMark anchor="bloque:marketing" label="Campañas y anuncios" /></span>
      <Tabs
        items={[{ value: "email", label: "Campañas de email" }, { value: "meta", label: "Anuncios de Meta" }]}
        value={tab}
        onChange={setTab}
        panels={{ email: emailPanel, meta: adsPanel }}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Conversación con el consultor (o el copiloto si no hay)
// ---------------------------------------------------------------------------

// El hilo es el mismo para los dos lados (`consultant-messages` de la
// organización); `viewer` solo decide qué burbujas son "mías".
export function ConsultantThread({ base, name, role, viewer = "client", draft, setDraft, inputRef }: {
  base: string;
  name: string;
  role: string;
  viewer?: "client" | "consultant";
  draft: string;
  setDraft: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const messages = useCachedQuery<{ messages: ThreadMessage[] }>(`${base}/consultant-messages`);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const list = messages.data?.messages ?? [];
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [list.length]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const response = await apiFetch(`${base}/consultant-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachments: [] }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      setDraft("");
      invalidateApiGetCache();
      messages.reload();
    } catch {
      toast.danger("No se pudo enviar el mensaje por un error de red.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={s.panel}>
      <div className={s.person}>
        <span className={s.avatar} aria-hidden="true">
          {initials}
        </span>
        <div>
          <b>{name}</b>
          <span>{role}</span>
        </div>
      </div>
      <div className={s.thread} ref={scrollRef} aria-live="polite">
        {messages.isLoading ? <p className={s.empty}>Cargando conversación…</p> : null}
        {!messages.isLoading && list.length === 0 ? (
          <p className={s.empty}>Todavía no habéis hablado por aquí. Escríbele lo que necesites.</p>
        ) : null}
        {list.slice(-12).map((message) => {
          const mine = viewer === "client" ? message.author_kind === "client" : message.author_kind === "consultant" || message.author_kind === "platform";
          return (
            <Message key={message.id} align={mine ? "end" : "start"}>
              <MessageContent>
                <Bubble>
                  <BubbleContent className={cx(s.msg, mine && s.mine)}>
                    {message.body}
                    {message.attachments.map((file) => {
                      return (
                        <Attachment key={file.filename} size="sm" className="mt-1.5 w-60 max-w-full">
                          <AttachmentMedia><FileTypeIcon filename={file.filename} contentType={file.content_type} /></AttachmentMedia>
                          <AttachmentContent>
                            <AttachmentTitle>{file.filename}</AttachmentTitle>
                            <AttachmentDescription>{fileMeta(file.filename, file.byte_size, file.content_type)}</AttachmentDescription>
                          </AttachmentContent>
                          {file.signed_url ? (
                            <AttachmentTrigger render={<a href={file.signed_url} target="_blank" rel="noreferrer" aria-label={`Abrir ${file.filename}`} />} />
                          ) : null}
                        </Attachment>
                      );
                    })}
                  </BubbleContent>
                </Bubble>
                <MessageFooter>
                  {mine ? "Tú" : message.author_name ?? name} · {dayLabel(message.created_at, true)}{" "}
                  {new Date(message.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </MessageFooter>
              </MessageContent>
            </Message>
          );
        })}
      </div>
      <form className={s.composer} onSubmit={send}>
        <label className="sr-only" htmlFor="pulse-message">
          Mensaje para {name}
        </label>
        <input
          id="pulse-message"
          ref={inputRef}
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Escribe a ${name.split(" ")[0]}…`}
        />
        <button type="submit" className={buttonVariants()} disabled={sending || !draft.trim()}>
          Enviar
        </button>
      </form>
      <div className={s.linkRow}>
        <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href="/mensajes">
          Abrir el chat con adjuntos
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

export function ClientPulse({ userId, organizationId, organizationName, connectionId, consultant, asConsultant = false, extraProposals = [], onReload, extraKpis, extraKpiDetails, sideTop }: {
  userId: string;
  /** Nombre de quien mira, para el saludo de la portada. */
  organizationId: string;
  organizationName: string;
  connectionId: string | null;
  consultant: AssignedConsultant;
  /** La misma portada vista por el consultor asignado: mismas cifras y lista, con sus textos y sus agentes. */
  asConsultant?: boolean;
  /** Propuestas de agentes que solo ve el consultor (planes semanal y mensual). */
  extraProposals?: Diagnostic[];
  onReload?: () => void;
  /** Cifras de más que solo necesita el consultor, al final de la fila de KPIs. Reciben qué cifra está abierta y cómo abrir la suya. */
  extraKpis?: (open: string | null, toggle: (key: string) => () => void) => ReactNode;
  /** Detalle de esas cifras de más, por la misma clave que usan en `toggle`. */
  extraKpiDetails?: Record<string, KpiDetailData>;
  /** Tarjetas propias del consultor, arriba de la columna derecha. */
  sideTop?: ReactNode;
}) {
  const base = `/v1/organizations/${organizationId}`;
  const { stores: scopeStores } = useActiveConnection();
  const scopeLabel = connectionId ? scopeStores?.find((store) => store.connectionId === connectionId)?.label ?? "Tienda seleccionada" : "Todas las tiendas del cliente";
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const verdictOf = useMetricAnalysis(organizationId, 30, connectionId);

  const metrics = useCachedQuery<Metrics>(`${base}/shopify/metrics?days=30${scope}`);
  const goals = useCachedQuery<{ objectives: GoalObjective[] }>(`${base}/objectives${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`);
  const meta = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=30${scope}`);
  const klaviyo = useCachedQuery<KlaviyoReport>(`${base}/klaviyo/email-report?days=30${scope}`);
  const operations = useCachedQuery<Operations>(`${base}/operations?${scope.replace(/^&/, "")}`);
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30&view=overview${scope}`);
  const stockAi = useCachedQuery<Diagnostic>(`${base}/ai/stock-planner?days=30${scope}`);
  // A04: el plan diario propone tareas; sin esto sus propuestas nunca llegaban al widget.
  const plannerAi = useCachedQuery<Diagnostic>(`${base}/ai/task-planner?days=30${scope}`);
  // Con una tienda elegida, el plan de toda la cuenta también trae propuestas: sin él,
  // cliente y consultor veían listas distintas según la tienda que tuviera cada uno.
  const plannerOrgAi = useCachedQuery<Diagnostic>(scope ? `${base}/ai/task-planner?days=30` : null);
  // Sin consultor, el análisis de email es parte del acompañamiento; con
  // consultor lo filtra él.
  const emailAi = useCachedQuery<Diagnostic>(consultant && !asConsultant ? null : `${base}/ai/email-analyst${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`);
  const integrations = useCachedQuery<IntegrationsPayload>(`${base}/integrations`);

  const ask = useCopilotAsk();
  const router = useRouter();
  const [today] = useState(() => new Date());
  // Cifra abierta: su gráfico, la lectura de la IA y a dónde ir a ver más.
  const { openKpi, toggleKpi, closeKpi, closingKpi } = useKpiDisclosure();

  function askCopilot(question: string, focusLabel: string) {
    ask({ question, focusLabel, reference: { period_label: "Últimos 30 días", filters: { days: "30" } } });
  }

  function reloadAll() {
    invalidateApiGetCache();
    operations.reload();
    monitor.reload();
    stockAi.reload();
    plannerAi.reload();
    plannerOrgAi.reload();
    emailAi.reload();
    onReload?.();
  }

  // Lo mismo dicho desde el lado del consultor.
  const yourStore = asConsultant ? `la tienda de ${organizationName}` : "tu tienda";

  const data = metrics.data;
  const formatStoreMoney = (value: number | null | undefined, decimals = 0) =>
    fmtCurrency(value, data?.currency_code, decimals);
  const storeSelectionRequired = metrics.errorCode === "shopify_store_selection_required";
  // Solo estos fallos significan "Shopify no está bien conectado". Un timeout o un 500
  // es la API o la base tardando: culpar a la conexión mandaba a Integraciones sin motivo.
  const storeNotConnected = ["shopify_connection_not_found", "shopify_currency_unavailable", "store_access_denied"].includes(metrics.errorCode ?? "");
  const financialCurrencyComparable = (data?.financial_comparability?.currency_status ?? data?.financial_currency_coverage?.status) === "compatible";
  const klaviyoCurrencyComparable = data?.financial_currency_coverage?.klaviyo_status === "compatible";
  const diagnostic = !storeSelectionRequired ? monitor.data : undefined;

  if (metrics.isLoading && !data) {
    return (
      <div className={cx(s.root, s.prio, s.glass)} data-glass role="status" aria-busy="true">
        <header className={s.pHead}>
          <div className={s.gHeadText}>
            <p className={s.pTitle}>Cargando {yourStore}…</p>
          </div>
        </header>
        <Skeleton className="h-24 w-full" aria-hidden="true" />
        <Skeleton className="h-64 w-full" aria-hidden="true" />
      </div>
    );
  }

  // ---- derivados ----
  const financial = data?.financial;
  const financialCanDisplay = data?.financial_comparability?.status === "comparable" || data?.financial_comparability?.status === "estimated";
  const showProfit = financialCurrencyComparable && financial && financialCanDisplay
    ? canShowProfit({
        hasFinancialSettings: financial.has_settings,
        itemsWithoutCost: financial.items_without_cost,
        linesWithoutNetMetrics: data?.margin.lines_without_metrics,
      })
    : false;
  const previous = data?.previous_period ?? null;
  const funnelConversionByDate = new Map(
    (data?.funnel_daily ?? []).map((day) => [day.date.slice(0, 10), day.conversion_rate_own] as const),
  );
  const pulse = storePulse({
    netSales: data?.sales.net_sales ?? 0,
    netProfit: data?.financial_comparability?.can_use_financial_model ? financial?.net_profit ?? null : null,
    hasFinancialSettings: data?.financial_comparability?.can_use_financial_model === true && (financial?.has_settings ?? false),
    previousNetSales: previous?.sales.net_sales ?? null,
  });
  // La frase de la IA es el titular; si trae jerga de sistema, la de `storePulse`.
  const headline = clientReadable(diagnostic?.output.headline ?? diagnostic?.output.answer) ?? pulse.headline;
  const daily = data?.daily ?? [];
  const currentDayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  // Hoy es un día todavía abierto: conserva su fecha en el eje, pero no lo dibuja
  // como cero ni como una caída frente a días completos. Los totales siguen intactos.
  const isCurrentDay = (date: string) => date.slice(0, 10) === currentDayKey;
  const closedDays = daily.filter((day) => !isCurrentDay(day.date));
  const previousDaily = previous?.daily ?? [];
  // Frente a hoy cae el último día del periodo anterior, cortado a la misma hora:
  // sin esto la comparación dibuja una caída que no existe.
  const previousSeries = (pick: (day: (typeof previousDaily)[number]) => number | null) =>
    previousDaily.map((day, index) => (daily[index] && isCurrentDay(daily[index].date) ? null : pick(day)));
  const target = (key: string) => data?.metric_targets.find((t) => t.metric_key === key)?.target_value ?? null;

  const proposals = [diagnostic, plannerAi.data, plannerOrgAi.data, stockAi.data, emailAi.data, ...extraProposals]
    .filter((d): d is Diagnostic => Boolean(d))
    .filter((d, i, all) => all.findIndex((o) => o.output_id === d.output_id) === i);

  // Sin un mínimo de clientes nuevos el CAC no es una media sino una anécdota.
  const cacReliable = (financial?.new_customers ?? MIN_NEW_CUSTOMERS_FOR_CAC) >= MIN_NEW_CUSTOMERS_FOR_CAC;
  const showCac = financialCurrencyComparable && financial?.cac_blended != null && cacReliable;

  // Conexión y sincronización de cada canal. Null mientras no se sabe.
  // Con una cuenta de Klaviyo por tienda, /integrations da la peor de todas:
  // con tienda elegida manda la suya, y si no tiene ninguna, no está conectada.
  const providers = integrations.data?.providers.map((provider) =>
    provider.id === "klaviyo" && connectionId && klaviyo.data
      ? { ...provider, connection: klaviyo.data.connected ? klaviyo.data.connection ?? provider.connection : null }
      : provider,
  );
  const syncOf = (id: string) => (providers ? channelSync(providers.find((p) => p.id === id)?.connection, today.getTime()) : null);
  const sourcesIn = (state: "stale" | "failed" | "reconnect") => (providers ?? []).filter((p) => p.connection && p.id !== "fathom" && channelSync(p.connection, today.getTime()) === state);
  const reconnectSources = sourcesIn("reconnect");
  const delayedSources = sourcesIn("stale");
  const failedSources = sourcesIn("failed");
  const sourceNotice = [
    reconnectSources.length ? `${reconnectSources.map((p) => p.name).join(" y ")} ${reconnectSources.length > 1 ? "necesitan" : "necesita"} reconectarse.` : null,
    delayedSources.length ? `${delayedSources.map((p) => p.name).join(" y ")} no ${delayedSources.length > 1 ? "se sincronizan" : "se sincroniza"} ${ago(delayedSources[0].connection?.last_sync_at ?? null)}: las cifras pueden no estar al día.` : null,
    failedSources.length ? `La última sincronización de ${failedSources.map((p) => p.name).join(" y ")} falló: las cifras pueden estar incompletas.` : null,
  ].filter(Boolean).join(" ");

  const revenueTarget = financialCurrencyComparable ? target("net_revenue_ex_tax") : null;
  const december = revenueTarget !== null && data
    ? monthlyWithProjection(data.financial_monthly.map((m) => ({ month: m.month, value: m.net_revenue_ex_tax })), today)
        .find((p) => p.month === `${today.getUTCFullYear()}-12`)
    : undefined;

  const metaAcq = meta.data?.acquisition;
  const hasMeta = Boolean(metaAcq && metaAcq.days_with_data > 0);
  const klaviyoCampaigns = klaviyo.data?.campaigns?.length ?? 0;
  // Actividad real: sin envíos ni flujos, su «0 €» no es un resultado.
  const hasKlaviyo = Boolean(klaviyo.data?.connected && klaviyo.data.totals && (klaviyo.data.totals.revenue > 0 || klaviyoCampaigns > 0 || klaviyo.data.flows.length > 0));

  // Lo que hay que vigilar fuera de las tareas: una línea y un enlace a donde se resuelve.
  type Signal = { key: string; tone: "bad" | "warn"; text: string; impact: string; href: string };
  const signals: Signal[] = [];
  if (data && data.stock.out_of_stock_items + data.stock.low_stock_items > 0) {
    signals.push({
      key: "stock",
      tone: data.stock.out_of_stock_items > 0 ? "bad" : "warn",
      text: [
        data.stock.out_of_stock_items ? `${fmtNum(data.stock.out_of_stock_items)} agotados` : null,
        data.stock.low_stock_items ? `${fmtNum(data.stock.low_stock_items)} con stock bajo` : null,
      ].filter(Boolean).join(" · "),
      impact: data.stock.out_of_stock_items > 0 ? "No se pueden vender hasta reponerlos" : "Pueden agotarse si no se reponen",
      href: withPortalRouteContext(
        data.stock.out_of_stock_items > 0
          ? "/shopify/inventario?filter=out"
          : "/shopify/inventario?filter=low",
        organizationId,
        connectionId,
      ),
    });
  }
  if (data && !financialCurrencyComparable) {
    signals.push({ key: "currency", tone: "warn", text: "Rentabilidad pendiente de validar la moneda", impact: "Beneficio y márgenes no se pueden calcular", href: withPortalRouteContext("/configuracion?section=rentabilidad", organizationId, connectionId) });
  } else if (financial && !data?.financial_comparability?.can_use_financial_model) {
    signals.push({
      key: "profit",
      tone: "warn",
      text: financialComparabilityMessage(data?.financial_comparability),
      impact: "La cifra de beneficio aún no es fiable",
      href: withPortalRouteContext(financial.has_settings ? "/shopify" : "/configuracion?section=rentabilidad", organizationId, connectionId),
    });
  }
  if (revenueTarget !== null && december && december.value < revenueTarget) {
    signals.push({ key: "goal", tone: "warn", text: `Por debajo del ritmo para ${formatStoreMoney(revenueTarget)} al mes`, impact: `La proyección de diciembre se queda en ${formatStoreMoney(december.value)}`, href: withPortalRouteContext("/informes", organizationId, connectionId) });
  }

  // Sin saber el estado de la conexión (cargando o fallida), manda lo que han
  // devuelto las métricas; sin ellas tampoco, no se afirma que esté desconectado.
  const metaSync = syncOf("meta_ads") ?? (hasMeta ? "ok" : "unknown");
  const klaviyoSync = syncOf("klaviyo") ?? (hasKlaviyo ? "ok" : "unknown");
  const metaMoney = financialCurrencyComparable && metaAcq?.roas != null;
  const klaviyoMoney = klaviyoCurrencyComparable && klaviyo.data;
  const channels = [
    {
      key: "shopify",
      name: "Tienda online",
      sync: syncOf("shopify"),
      href: withPortalRouteContext("/shopify", organizationId, connectionId),
      value: data?.funnel?.has_sessions ? `${fmtNum(data.funnel.sessions)} sesiones` : `${fmtNum(data?.sales.orders_count ?? 0)} pedidos`,
      detail: `Ticket medio ${formatStoreMoney(data?.sales.aov ?? 0, 2)}`,
    },
    {
      key: "meta",
      name: "Meta Ads",
      sync: metaSync,
      href: withPortalRouteContext(hasMeta && metaSync !== "reconnect" ? "/meta" : "/integraciones/meta", organizationId, connectionId),
      ...channelReading({
        name: "Meta",
        sync: metaSync,
        hasData: hasMeta,
        metric: metaMoney ? `ROAS ${fmtNum(metaAcq?.roas ?? 0, 2)}×` : `${fmtNum(metaAcq?.purchases ?? 0)} compras`,
        detail: metaMoney ? `${formatStoreMoney(metaAcq?.spend)} invertidos · atribuido por Meta` : "Atribuidas por Meta · importes pendientes de validar la moneda",
        emptyDetail: "Sin actividad en los últimos 30 días",
        connectDetail: "Conecta tu cuenta publicitaria",
      }),
    },
    {
      key: "klaviyo",
      name: "Klaviyo",
      sync: klaviyoSync,
      href: withPortalRouteContext(hasKlaviyo && klaviyoSync !== "reconnect" ? "/klaviyo" : "/integraciones/klaviyo", organizationId, connectionId),
      ...channelReading({
        name: "Klaviyo",
        sync: klaviyoSync,
        hasData: hasKlaviyo,
        metric: klaviyoMoney ? formatStoreMoney(klaviyo.data?.totals.revenue) : `${fmtNum(klaviyoCampaigns)} campañas`,
        detail: klaviyoMoney ? "Atribuidos por Klaviyo" : "Enviadas en 30 días · importes pendientes de validar la moneda",
        emptyDetail: "Sin envíos en los últimos 30 días",
        connectDetail: "Conecta tu email",
      }),
    },
  ];

  // ---- detalle de la cifra abierta ----
  const route = (href: string) => withPortalRouteContext(href, organizationId, connectionId);
  const iaTag = asConsultant ? "A02" : "IA";
  // A02 (salud del negocio) no tiene una ficha por cifra: se busca su hallazgo sobre el tema.
  const audience = asConsultant ? "consultor" as const : "cliente" as const;
  const a02Reading = (pattern: RegExp) => {
    const finding = findingFor(diagnostic, pattern);
    if (!finding) return null;
    return <FindingReading tag={iaTag} finding={finding} steps={findingSteps(diagnostic, finding)} audience={audience} />;
  };
  // A29 (analista de métricas) cuando la cifra tiene ficha; si no, A02.
  const a29Reading = (id: "conversion" | "cac_new", fallback: RegExp) => {
    const analysis = verdictOf(id);
    return analysis && analysis.verdict !== "insufficient"
      ? <A29Reading analysis={analysis} tag={asConsultant ? "A29" : "IA"} audience={audience} fallback={a02Reading(fallback)} />
      : a02Reading(fallback);
  };
  const perDay = (total: number | null | undefined) => (total != null && daily.length ? total / daily.length : null);
  const flow = showProfit && financial ? moneyFlow(financial) : [];
  const flowBase = Math.max(...flow.map((row) => Math.abs(row.value)), 1);
  const kpiDetails: Record<string, KpiDetailData> = {
    sales: {
      title: "Ventas netas",
      chart: (
        <SalesChart
          daily={daily.map((d) => ({ date: d.date, value: d.net_sales, detail: `${fmtNum(d.orders_count)} pedidos` }))}
          previousAverage={perDay(previous?.sales.net_sales)}
          pins={[]}
          active={null}
          onPin={() => undefined}
          currencyCode={data?.currency_code}
        />
      ),
      ai: a02Reading(/ventas|ingres|factur|ticket/i),
      href: route("/shopify"),
      action: "Ver ventas en Shopify",
    },
    orders: {
      title: "Pedidos",
      chart: (
        <SalesChart
          daily={daily.map((d) => ({ date: d.date, value: d.orders_count }))}
          previousAverage={perDay(previous?.sales.orders_count)}
          pins={[]}
          active={null}
          onPin={() => undefined}
          label="Pedidos por día"
          format={(value) => fmtNum(value, value % 1 ? 1 : 0)}
        />
      ),
      ai: a02Reading(/pedido|compra|ticket/i),
      href: route("/shopify"),
      action: "Ver pedidos en Shopify",
    },
    profit: {
      title: "Beneficio neto",
      // Sin serie diaria de beneficio: la cascada de ventas a beneficio del periodo.
      chart: flow.length ? (
        <ul className={s.kdFlow} aria-label="De las ventas al beneficio">
          {flow.map((row) => (
            <li key={row.label} data-kind={row.kind} data-tone={row.value < 0 ? "bad" : undefined}>
              <span>{row.label}</span>
              <i style={{ width: `${(Math.abs(row.value) / flowBase) * 100}%` }} aria-hidden="true" />
              <b className={s.num}>{formatStoreMoney(row.value)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.trackTxt}>Completa los costes para ver de dónde sale el beneficio.</p>
      ),
      ai: a02Reading(/benefic|margen|rentab|coste/i),
      href: route(showProfit ? "/informes" : "/configuracion?section=rentabilidad"),
      action: showProfit ? "Ver el informe de rentabilidad" : "Completar costes",
    },
    conversion: {
      title: "Conversión",
      chart: data?.funnel?.has_sessions ? (
        <SalesChart
          daily={(data.funnel_daily ?? []).map((d) => ({ date: d.date, value: (d.conversion_rate_own ?? 0) * 100 }))}
          previousAverage={previous?.conversion_rate_own != null ? previous.conversion_rate_own * 100 : null}
          averageLabel="Periodo anterior"
          pins={[]}
          active={null}
          onPin={() => undefined}
          label="Conversión por día"
          format={(value) => `${fmtNum(value, 2)} %`}
        />
      ) : (
        <p className={s.trackTxt}>Sin datos de sesiones todavía.</p>
      ),
      ai: a29Reading("conversion", /conversi|embudo|carrito|checkout/i),
      href: route("/shopify"),
      action: "Ver el embudo en Shopify",
    },
    cac: {
      title: "CAC combinado",
      chart: financial ? (
        <p className={s.trackTxt}>
          {formatStoreMoney(financial.ads_spend)} en publicidad entre {fmtNum(financial.new_customers ?? 0)} clientes nuevos.
        </p>
      ) : null,
      ai: a29Reading("cac_new", /cac|adquisi|captaci|nuevos/i),
      href: route(hasMeta ? "/meta" : "/informes"),
      action: hasMeta ? "Ver campañas en Meta" : "Ver informes",
    },
  };
  const detail = openKpi ? kpiDetails[openKpi] ?? extraKpiDetails?.[openKpi] ?? null : null;

  return (
    <div className={cx(s.root, s.prio, s.glass)} data-glass>
      {/* ------------------------------ Titular ------------------------------ */}
      <header className={s.pHead}>
        <div className={s.gHeadText}>
          <h1 id="pulse-headline" className={s.pTitle}>
            {headline}
          </h1>
        </div>
      </header>

      {metrics.error && !data ? (
        <Banner
          tone={storeSelectionRequired ? "info" : "warn"}
          action={!storeSelectionRequired && !storeNotConnected ? (
            <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={() => metrics.reload()}>
              Reintentar
            </button>
          ) : null}
        >
          {storeSelectionRequired
            ? "Tienes varias tiendas conectadas. Elige una en la cabecera para ver sus datos sin mezclarlas."
            : storeNotConnected
              ? `No hemos podido cargar los datos de ${yourStore}. Comprueba en Integraciones que Shopify sigue conectado.`
              : `Los datos de ${yourStore} están tardando más de lo normal. La conexión con Shopify está bien; reintenta en unos segundos.`}
        </Banner>
      ) : null}

      {sourceNotice ? (
        <Banner tone="warn" action={<Link href="/integraciones" className={buttonVariants({ variant: "secondary", size: "sm" })}>Revisar</Link>}>
          {sourceNotice}
        </Banner>
      ) : null}

      {/* ------------------------------ Cifras ------------------------------ */}
      {data ? (
        <div className={s.gStage}>
        <section className={s.gHero} aria-label={connectionId ? scopeLabel : organizationName}>
          <div className={s.gHeroTop}>
            <span className={s.gPill}>
              Últimos 30 días{daily.length ? ` · ${dayLabel(daily[0].date)} – ${dayLabel(daily[daily.length - 1].date)}` : ""}
            </span>
            {data.currency_code ? <span className={s.gBadge}>{data.currency_code}</span> : null}
          </div>
        <PulseChart
          anchorId="insight-metric-conversion"
          dates={daily.map((d) => d.date)}
          previousDates={previousDaily.map((d) => d.date)}
          series={[
            {
              key: "sales",
              label: "Ventas netas",
              color: "var(--g-sales)",
              values: daily.map((d) => isCurrentDay(d.date) ? null : d.net_sales),
              format: (v) => formatStoreMoney(v),
              total: formatStoreMoney(data.sales.net_sales),
              delta: <Delta change={salesChangePct(data.sales.net_sales, previous?.sales.net_sales ?? null)} />,
              previous: previous ? formatStoreMoney(previous.sales.net_sales) : null,
              previousValues: previousSeries((d) => d.net_sales),
              minStep: 1,
              aiNotice: <A02MetricNotice diagnostic={diagnostic} metricLabel="Ventas netas" metricKey="sales_net_sales" pattern={/ventas|ingresos|factur/i} audience={asConsultant ? "consultor" : "cliente"} />,
            },
            {
              key: "orders",
              label: "Pedidos",
              color: "var(--g-orders)",
              values: daily.map((d) => isCurrentDay(d.date) ? null : d.orders_count),
              format: (v) => fmtNum(v),
              total: fmtNum(data.sales.orders_count),
              delta: <Delta change={salesChangePct(data.sales.orders_count, previous?.sales.orders_count ?? null)} />,
              previous: previous ? fmtNum(previous.sales.orders_count) : null,
              previousValues: previousSeries((d) => d.orders_count),
              minStep: 1,
              aiNotice: <A02MetricNotice diagnostic={diagnostic} metricLabel="Pedidos" metricKey="orders_count" pattern={/pedidos|órdenes|orders/i} audience={asConsultant ? "consultor" : "cliente"} />,
            },
            ...(showProfit && financial && daily.some((d) => d.net_profit != null)
              ? [{
                  key: "profit",
                  label: data?.financial_comparability?.status === "estimated" ? "Beneficio estimado" : "Beneficio neto",
                  color: "var(--g-profit)",
                  values: daily.map((d) => isCurrentDay(d.date) ? null : d.net_profit),
                  format: (v: number) => formatStoreMoney(v),
                  total: formatStoreMoney(financial.net_profit),
                  delta: data?.financial_comparability?.can_use_financial_model && previous?.financial.comparability?.can_use_financial_model ? <Delta change={salesChangePct(financial.net_profit, previous.financial.net_profit)} /> : null,
                  previous: data?.financial_comparability?.can_use_financial_model && previous?.financial.comparability?.can_use_financial_model ? formatStoreMoney(previous.financial.net_profit) : null,
                  previousValues: data?.financial_comparability?.can_use_financial_model && previous?.financial.comparability?.can_use_financial_model ? daily.map(() => perDay(previous.financial.net_profit)) : undefined,
                  previousLabel: "Media diaria del periodo anterior",
                  minStep: 1,
                  aiNotice: <A02MetricNotice diagnostic={diagnostic} metricLabel="Beneficio neto" metricKey="net_profit" pattern={/beneficio|margen|rentab|coste/i} audience={asConsultant ? "consultor" : "cliente"} />,
                }]
              : []),
            ...(data.funnel?.has_sessions && data.funnel.conversion_rate_own != null
              ? [{
                  key: "conversion",
                  label: "Conversión",
                  color: "var(--g-conversion)",
                  values: daily.map((day) => {
                    if (isCurrentDay(day.date)) return null;
                    const rate = funnelConversionByDate.get(day.date.slice(0, 10));
                    return rate == null ? null : rate * 100;
                  }),
                  format: (v: number) => `${fmtNum(v, 2)} %`,
                  total: `${fmtNum(data.funnel.conversion_rate_own * 100, 2)} %`,
                  delta: previous?.conversion_rate_own != null ? <Delta change={(data.funnel.conversion_rate_own - previous.conversion_rate_own) * 100} suffix="pp" /> : null,
                  previous: previous?.conversion_rate_own != null ? `${fmtNum(previous.conversion_rate_own * 100, 2)} %` : null,
                  previousValues: previousSeries((d) => (d.conversion_rate_own == null ? null : d.conversion_rate_own * 100)),
                  aiNotice: <A02MetricNotice diagnostic={diagnostic} metricLabel="Conversión" metricKey="conversion_rate" pattern={/conversi|embudo|carrito|checkout/i} audience={asConsultant ? "consultor" : "cliente"} />,
                }]
              : []),
          ]}
        />
        </section>

        {/* Ventas día a día y lo que más se vende: el "en directo" de una tienda. */}
        <section className={s.gLive} aria-labelledby="pulse-dia">
          <DailySales days={closedDays} money={formatStoreMoney} />
          {data.top_products.length ? (
            <div className={s.gTopBlock}>
              <div className={s.gLiveHead}>
                <div>
                  <h3 id="pulse-top">Productos más vendidos</h3>
                  <p>Por ingresos · últimos 30 días</p>
                </div>
              </div>
              <ul className={s.gTop} aria-labelledby="pulse-top">
                {data.top_products.slice(0, 5).map((product, index) => (
                  <li key={product.product_id}>
                    <span className={s.gTopN} aria-hidden="true">{index + 1}</span>
                    <span>{product.title}</span>
                    <b className={s.num}>{formatStoreMoney(product.revenue)}</b>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        </div>
      ) : null}

      {/* Canales: cada plataforma en su tarjeta, con su color. */}
      {data ? (
        <section className="zone-card" aria-labelledby="pulse-canales">
          <h2 id="pulse-canales" className="sr-only">Canales</h2>
          <div className={s.gCards}>
            {channels.map((channel) => (
              <Link key={channel.key} className={s.gCard} data-channel={channel.key} href={channel.href}>
                <span className={s.gCardL}>
                  <i aria-hidden="true" />{channel.name}
                  {channel.sync ? <span className={s.gCardS} data-sync={channel.sync}>{CHANNEL_SYNC_LABEL[channel.sync]}</span> : null}
                </span>
                <b className={cx(s.gCardV, s.num)} data-empty={channel.value === "Sin datos" || channel.value === "Sin conectar" || undefined}>{channel.value}</b>
                <span className={s.gCardF}>
                  <span className={s.gCardD}>
                    {channel.detail}
                  </span>
                  {channel.key === "shopify" ? <Spark values={closedDays.map((day) => day.orders_count)} color="var(--tint)" /> : null}
                </span>
              </Link>
            ))}
          </div>
          <p className={s.gNote}>
            Cada plataforma cuenta su parte; sus cifras no se suman. <ZoneNoteMark anchor="bloque:canales" label="Canales" />
          </p>
        </section>
      ) : null}

      {/* CAC y las cifras de más del consultor siguen como tarjetas. */}
      {data && (showCac || extraKpis) ? (
        <div className={s.pKpis} aria-label="Más cifras" id={showCac ? undefined : "insight-metric-cac_new"}>
          {showCac && financial?.cac_blended != null ? (
            <Kpi
              metric="cac"
              open={openKpi === "cac"}
              onOpen={toggleKpi("cac")}
              verdict={<MetricVerdict analysis={verdictOf("cac_new")} />}
              anchorId="insight-metric-cac_new"
              label="CAC combinado"
              value={formatStoreMoney(financial.cac_blended, 2)}
              slot={<p className={s.trackTxt}>Publicidad entre clientes nuevos</p>}
              aiNotice={<A02MetricNotice diagnostic={diagnostic} metricLabel="CAC combinado" metricKey="cac_blended" pattern={/cac|adquisi|captaci|nuevos/i} audience={asConsultant ? "consultor" : "cliente"} />}
            />
          ) : null}
          {extraKpis?.(openKpi, toggleKpi)}
        </div>
      ) : null}

      {detail ? (
        <KpiDetail
          key={openKpi}
          metric={openKpi ?? undefined}
          closing={closingKpi}
          {...detail}
          ai={detail.ai ?? <p className={s.aiLine}>La IA no ha señalado nada sobre esta cifra en su último análisis.</p>}
          onClose={closeKpi}
          onAsk={() =>
            askCopilot(
              `¿Cómo va ${detail.title.toLowerCase()} en ${yourStore} estos 30 días y qué haría para mejorar esta cifra?`,
              detail.title,
            )
          }
        />
      ) : null}

      {data ? (
        <MarketingResults
          adsUrl={`${base}/meta/insights?days=30${scope}`}
          route={route}
          hasMeta={hasMeta}
          emails={klaviyo.data ? klaviyo.data.campaigns ?? [] : null}
          emailsFailed={Boolean(klaviyo.error) && !klaviyo.data}
          emailMoney={klaviyoCurrencyComparable ? (value) => formatStoreMoney(value) : null}
          onRetryEmails={() => klaviyo.reload()}
        />
      ) : null}

      {/* ------------------------------ Prioridades ------------------------------ */}
      <A02Reading spot="home" diagnostic={monitor.data} loading={monitor.isLoading} error={monitor.error} errorCode={monitor.errorCode} organizationId={organizationId} connectionId={connectionId} onRetry={monitor.reload} />
      <div className={s.pGrid}>
        <div className={s.gMainCol}>
        <section aria-labelledby="pulse-hoy" className={s.pMain}>
          {operations.error && !operations.data ? (
            <ErrorBlock title="No se han podido cargar las tareas" onRetry={() => operations.reload()}>{operations.error}</ErrorBlock>
          ) : (
            <WorkQueue
              base={base}
              userId={userId}
              consultant={asConsultant ? null : consultant}
              asConsultant={asConsultant}
              proposals={proposals}
              operations={operations.data}
              reloadAll={reloadAll}
              onComment={() => router.push("/mensajes")}
              title="Prioridades"
              titleId="pulse-hoy"
            />
          )}
        </section>
          {asConsultant && connectionId ? (
            <div className={s.pMainExtras}>
              <AgentInsights agents={[
                { key: "stock", label: "Stock", diagnostic: stockAi.data },
                { key: "email", label: "Email", diagnostic: emailAi.data },
              ]} />
            </div>
          ) : null}
        </div>

        <aside className={s.pSide} aria-label="Objetivos, Vigilar y canales">
          {sideTop}
          {goals.data ? (
            <GoalsCard objectives={goals.data.objectives} money={formatStoreMoney} href={withPortalRouteContext("/camino?vista=objetivos", organizationId, connectionId)} />
          ) : null}
          {data ? <MonthsCard monthly={data.financial_monthly} currentMonth={today.toISOString().slice(0, 7)} money={formatStoreMoney} /> : null}
          {signals.length ? (
            <section className={cx(s.pBlock, "zone-card")} aria-labelledby="pulse-vigilar">
              <h2 id="pulse-vigilar" className={s.pBlockT}>
                Vigilar <ZoneNoteMark anchor="bloque:vigilar" label="Vigilar" />
              </h2>
              <ul className={s.pList}>
                {signals.map((signal) => (
                  <li key={signal.key}>
                    <Link className={cx(s.gSignal, "hover-sweep")} href={signal.href}>
                      <span className={s.gSignalSev} data-tone={signal.tone}>{signal.tone === "bad" ? "Alta" : "Media"}</span>
                      <b>{signal.text}</b>
                      <span>{signal.impact}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className={s.pBlock} aria-label={asConsultant ? "Tu cliente" : consultant ? "Tu consultor" : "Tu copiloto"}>
            {asConsultant ? (
              <Link className={cx(s.pRow, "hover-sweep")} href="/mensajes">
                <span className={s.pAvatar} aria-hidden="true">
                  {initials(organizationName)}
                </span>
                <span className={s.pRowT}>
                  {organizationName}
                  <small>Hablar con el cliente</small>
                </span>
              </Link>
            ) : consultant ? (
              <Link className={cx(s.pRow, "hover-sweep")} href="/mensajes">
                <span className={s.pAvatar} aria-hidden="true">
                  {initials(consultant.full_name ?? "C")}
                </span>
                <span className={s.pRowT}>
                  {consultant.full_name ?? "Tu consultor"}
                  <small>Tu consultor en E-NORA</small>
                </span>
              </Link>
            ) : (
              <button
                type="button"
                className={cx(s.pRow, "hover-sweep")}
                onClick={() => askCopilot("¿Qué debería hacer primero esta semana?", "Tu tienda")}
              >
                <span className={cx(s.pAvatar, s.pAvatarIa)} aria-hidden="true">IA</span>
                <span className={s.pRowT}>
                  Tu copiloto
                  <small>Conoce tus ventas, tu stock y tus campañas</small>
                </span>
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

// Las alertas que ocurrieron dentro de la ventana de la curva se marcan sobre
// el día en que se detectaron. Máximo cuatro: más chinchetas ya no se leen.
export function usePins(daily: Array<{ date: string }> | undefined, alerts: Alert[] | undefined): Pin[] {
  return useMemo(() => {
    if (!daily || daily.length < 2 || !alerts) return [];
    const indexByDate = new Map(daily.map((d, i) => [d.date.slice(0, 10), i]));
    return alerts
      .map((alert) => ({ alert, index: indexByDate.get(alert.first_detected_at.slice(0, 10)) }))
      .filter((row): row is { alert: Alert; index: number } => row.index !== undefined)
      .sort((a, b) => a.index - b.index)
      .slice(-4)
      .map(({ alert, index }) => ({
        index,
        title: alert.title,
        source: PRIORITY_LABEL[alert.severity] ?? "Alerta",
        date: daily[index].date,
      }));
  }, [daily, alerts]);
}

export type KpiDetailData = { title: string; chart: ReactNode; ai: ReactNode; href: string; action: string };

/** Una sola cifra abierta; cambiar de cifra cancela el cierre pendiente. */
export function useKpiDisclosure() {
  const [openKpi, setOpenKpi] = useState<string | null>(null);
  const [closingKpi, setClosingKpi] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);

  const closeKpi = () => {
    if (closeTimer.current !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpenKpi(null);
      return;
    }
    setClosingKpi(true);
    // Misma duración que kpiDetailOut; el contenido sale antes de retirar su espacio.
    closeTimer.current = setTimeout(() => {
      setOpenKpi(null);
      setClosingKpi(false);
      closeTimer.current = null;
    }, 160);
  };

  const toggleKpi = (key: string) => () => {
    if (openKpi === key && !closingKpi) {
      closeKpi();
      return;
    }
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setClosingKpi(false);
    setOpenKpi(key);
  };

  return { openKpi, toggleKpi, closeKpi, closingKpi };
}

/** Detalle de una cifra abierta: gráfico, lectura (IA o datos) y a dónde ir a ver más. */
export function KpiDetail({ title, chart, ai, href, action, metric, closing = false, onClose, onAsk }: {
  title: string;
  chart: ReactNode;
  ai: ReactNode;
  href: string;
  action: string;
  metric?: string;
  closing?: boolean;
  onClose: () => void;
  onAsk: () => void;
}) {
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const close = () => {
    const trigger = sectionRef.current?.parentElement?.querySelector<HTMLButtonElement>('button[aria-expanded="true"][aria-controls="pulse-kpi-detail"]');
    onClose();
    trigger?.focus({ preventScroll: true });
  };
  return (
    <section
      ref={sectionRef}
      id="pulse-kpi-detail"
      className={s.kpiDetail}
      data-metric={metric}
      data-closing={closing || undefined}
      inert={closing}
      aria-labelledby={headingId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <header className={s.kpiDetailH}>
        <h2 id={headingId}>
          {title}
          <small>Últimos 30 días</small>
        </h2>
        <button type="button" className={buttonVariants({ variant: "ghost", size: "icon-sm", className: s.kpiDetailX })} aria-label={`Cerrar detalle de ${title}`} onClick={close}>
          <CloseIcon aria-hidden="true" />
        </button>
      </header>
      {chart}
      {ai}
      <div className={s.kpiDetailF}>
        <Link className={buttonVariants({ size: "sm" })} href={href}>
          {action}
        </Link>
        <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} onClick={onAsk}>
          Preguntar a la IA
        </button>
      </div>
    </section>
  );
}

/** Barras por cliente o tienda: pasar el ratón resalta, pulsar abre ese cliente. */
export function KpiBars({ rows, onSelect, label = "Por cliente" }: {
  rows: Array<{ key: string; id: string; name: string; value: number | null; text: string; tone?: "bad" }>;
  onSelect: (id: string) => void;
  label?: string;
}) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value ?? 0)), 1);
  if (!rows.length) return <p className={s.trackTxt}>Sin datos de los clientes todavía.</p>;
  return (
    <ul className={s.kdFlow} aria-label={label}>
      {rows.map((row) => (
        <li key={row.key}>
          <button type="button" className={s.kdRow} data-tone={row.value != null && row.value < 0 ? "bad" : row.tone} onClick={() => onSelect(row.id)}>
            <span>{row.name}</span>
            <i style={{ width: `${row.value != null ? (Math.abs(row.value) / max) * 100 : 0}%` }} aria-hidden="true" />
            <b className={s.num}>{row.text}</b>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Kpi({ label, value, numericValue, previousNumericValue, delta, vs, slot, tag, verdict, aiNotice, anchorId, metric, open = false, onOpen }: {
  /** Con `onOpen`, toda la tarjeta abre su detalle (gráfico, IA y acción) debajo de la fila. */
  open?: boolean;
  onOpen?: () => void;
  label: string;
  value: ReactNode;
  /** El estado se obtiene del dato, nunca del importe ya formateado. */
  numericValue?: number | null;
  previousNumericValue?: number | null;
  metric?: string;
  delta?: ReactNode;
  vs?: string | null;
  slot: ReactNode;
  tag?: string;
  /** Punto del analista de métricas (`<MetricVerdict>`), junto a la etiqueta. */
  verdict?: ReactNode;
  aiNotice?: ReactNode;
  /** Ancla del ✨ (`insight-metric-<id>`): el menú de la IA lleva hasta aquí y parpadea. */
  anchorId?: string;
}) {
  return (
    <ZoneCard anchor={zoneAnchor("kpi", label)} label={label} id={anchorId} className={cx(s.kpi, onOpen && s.kpiBtn, open && s.kpiOn)} previewClassName={cx(s.root, s.kpiStage)} role="group" aria-label={label} data-metric={metric}>
      {/* Capa clicable bajo los botones propios de la tarjeta (punto del analista, notas). */}
      {onOpen ? (
        <button
          type="button"
          className={s.kpiHit}
          aria-expanded={open}
          aria-controls={open ? "pulse-kpi-detail" : undefined}
          aria-label={`${open ? "Cerrar" : "Ver"} el detalle de ${label}`}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (open && event.key === "Escape") {
              event.preventDefault();
              onOpen();
            }
          }}
        />
      ) : null}
      {/* div y no p: `verdict` es un Popover con botón y capa, que dentro de un <p> rompe la hidratación. */}
      <div className={s.kpiL}>
        {verdict}
        {label}
        {aiNotice}
        <ZoneNoteMark anchor={zoneAnchor("kpi", label)} label={label} />
        {tag ? <span className={cx(s.chip, s.chipWarn)}>{tag}</span> : null}
      </div>
      <p className={s.kpiV} data-tone={numericValue != null && numericValue < 0 ? "bad" : undefined}>{value}</p>
      <p className={s.kpiD}>
        {delta}
        {vs ? (
          <span>
            vs <span className={s.num} data-tone={previousNumericValue != null && previousNumericValue < 0 ? "bad" : undefined}>{vs}</span>
          </span>
        ) : (
          <span>&nbsp;</span>
        )}
      </p>
      <div className={s.slot}>{slot}</div>
    </ZoneCard>
  );
}
