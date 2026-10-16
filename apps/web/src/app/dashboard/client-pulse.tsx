"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { MetricVerdict, useMetricAnalysis } from "@/components/metric-verdict";
import { useCopilotAsk } from "@/components/copilot-ask";
import { Skeleton, toast } from "@/components/ui";
import { BarRows, Waterfall } from "@/components/data-bars";
import type { AssignedConsultant } from "@/hooks/use-assigned-consultant";
import { canShowProfit, salesChangePct, storePulse } from "./store-pulse";
import {
  changeText,
  clientReadable,
  fmtCurrency,
  fmtEur,
  fmtNum,
  isClientReadable,
  MIN_NEW_CUSTOMERS_FOR_CAC,
  moneyFlow,
  monthlyWithProjection,
  pickFinding,
  shortMoney,
  unitEconomics,
  type PulseFinancial,
} from "./client-pulse-model";
import s from "./client-pulse.module.css";
import { DashboardSections } from "./dashboard-sections";

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
    financial: { net_profit: number; net_margin_pct: number; lines_without_metrics: number | null };
    conversion_rate_own?: number | null;
  } | null;
  daily: Array<{ date: string; net_sales: number; orders_count: number }>;
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
export type KlaviyoReport = {
  connected: boolean;
  totals: { revenue: number; campaign_revenue: number; flow_revenue: number };
  previous: { revenue: number } | null;
  trend: Array<{ month: string; campaign_revenue: number; flow_revenue: number }>;
  flows: KlaviyoEntity[];
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

export type Finding = { title: string; severity: string; evidence: string; area?: string };
export type Diagnostic = {
  output_id: string;
  output_status: string;
  generated_at: string;
  output: {
    headline?: string;
    answer?: string;
    sections?: Array<{ key: string; label: string; findings: Finding[] }>;
    findings: Finding[];
    recommendations: Array<{ action: string; priority: string }>;
    proposed_writes: Array<{
      title: string;
      description: string;
      priority: string;
      related_product_id?: string | null;
      rationale?: string;
      evidence?: string[];
      owner_role?: "cliente" | "consultor";
      due_hint?: string | null;
    }>;
    confidence: "low" | "medium" | "high";
  };
  envelope?: {
    quality: { confidence: string; dataCompleteness: string };
    sources: Array<{ id: string; label: string }>;
  };
};

type IntegrationsPayload = {
  providers: Array<{
    id: string;
    name: string;
    connection: { status: string; last_sync_at: string | null } | null;
  }>;
};

type Agenda = {
  planning_items: Array<{ id: string; title: string; channel: string; starts_at: string; status: string }>;
  milestones: Array<{ id: string; name: string; target_date: string; status: string; phase_name: string | null }>;
};

type Message = {
  id: string;
  author_kind: "consultant" | "client" | "platform" | "system";
  author_name: string | null;
  body: string;
  attachments: Array<{ filename: string; signed_url: string | null }>;
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

export function Spark({ values }: { values: number[] }) {
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
        <path className={s.sparkArea} d={`${d}L${width} ${height}L0 ${height}Z`} style={{ fill: "var(--store)", opacity: 0.12 }} />
        <path
          className={s.sparkLine}
          d={d}
          pathLength={1}
          style={{ fill: "none", stroke: "var(--store)", strokeWidth: 1.6, strokeLinejoin: "round" }}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <i style={{ top: `${((last[1] / height) * 100).toFixed(1)}%` }} />
    </div>
  );
}

export function TargetBar({ value, target, max, lowerIsBetter = false, text }: {
  value: number;
  target: number;
  max: number;
  lowerIsBetter?: boolean;
  text: string;
}) {
  const ok = lowerIsBetter ? value <= target : value >= target;
  return (
    <div>
      <div className={s.track}>
        <span
          className={s.fill}
          style={{ width: `${Math.min(Math.max(value / max, 0), 1) * 100}%`, background: ok ? "var(--good)" : "var(--warn)" }}
        />
        <span className={s.mark} style={{ left: `${Math.min(target / max, 1) * 100}%` }} />
      </div>
      <p className={s.trackTxt}>{text}</p>
    </div>
  );
}

export function niceStep(raw: number) {
  const power = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const m = raw / power;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * power;
}

export function findingFor(diagnostic: Diagnostic | undefined, pattern: RegExp, taken?: Set<Finding>): Finding | null {
  return pickFinding(diagnostic, pattern, taken);
}

/**
 * Las notas de IA salen del último diagnóstico, que puede tener días. Si sus
 * cifras no coinciden con las del panel (otro periodo), la fecha lo explica
 * en vez de dejar al cliente con dos números distintos sin motivo.
 */
function datedAi(text: string | null | undefined, generatedAt: string | null | undefined) {
  if (!text) return null;
  if (!generatedAt) return text;
  const ageDays = (Date.now() - new Date(generatedAt).getTime()) / 86_400_000;
  if (ageDays < 2) return text;
  return `${text} · análisis del ${new Date(generatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const PRIORITY_LABEL: Record<string, string> = { urgent: "Urgente", critical: "Urgente", high: "Alta", medium: "Media", low: "Baja", info: "Baja" };
const PLANNING_STATUS: Record<string, string> = {
  draft: "Borrador",
  planned: "Planificado",
  scheduled: "Programado",
  pending: "Pendiente",
  in_progress: "En preparación",
  completed: "Hecho",
  done: "Hecho",
};

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

export function SalesChart({ daily, previousAverage, averageLabel = "Media diaria del periodo anterior", pins, active, onPin, currencyCode, label = "Ventas netas por día" }: {
  daily: ChartPoint[];
  previousAverage: number | null;
  averageLabel?: string;
  pins: Pin[];
  active: number | null;
  onPin: (k: number) => void;
  currencyCode?: string | null;
  label?: string;
}) {
  const chartId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = daily.length;
  const height = width < 620 ? 220 : 270;
  const m = { l: 2, r: 64, t: pins.length ? 40 : 14, b: 26 };
  const innerW = Math.max(width - m.l - m.r, 1);
  const innerH = height - m.t - m.b;
  const peak = Math.max(...daily.map((d) => d.value), previousAverage ?? 0, 1);
  const step = niceStep(peak / 3);
  const top = step * Math.ceil(peak / step);
  const x = (i: number) => m.l + (i * innerW) / Math.max(n - 1, 1);
  const y = (v: number) => m.t + innerH - (v / top) * innerH;
  const line = daily.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join("");
  const tickCount = Math.min(width < 620 ? 3 : 5, n);
  const ticks = [...new Set(Array.from({ length: tickCount }, (_, k) => Math.round((k * (n - 1)) / Math.max(tickCount - 1, 1))))];
  const selectedIndex = hover ?? (active !== null ? pins[active]?.index ?? null : null);
  const shown = selectedIndex !== null && n > 0 ? Math.max(0, Math.min(n - 1, selectedIndex)) : null;
  const formatChartMoney = (value: number) => currencyCode ? fmtCurrency(value, currencyCode) : fmtEur(value);

  return (
    <div ref={ref} className={s.chart} role="group" aria-label={label}>
      {width > 0 && n > 1 ? (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--hero-series)", stopOpacity: 0.14 }} />
              <stop offset="1" style={{ stopColor: "var(--hero-series)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          {Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step).map((v) => (
            <g key={v}>
              <line className={s.hcGrid} x1={m.l} x2={width - m.r} y1={y(v)} y2={y(v)} />
              <text className={s.hcLabel} x={width - m.r + 10} y={y(v) + 3.5}>
                {v ? formatChartMoney(v) : "0"}
              </text>
            </g>
          ))}
          {ticks.map((i, k) => (
            <text
              key={i}
              className={s.hcLabel}
              x={x(i)}
              y={height - 6}
              textAnchor={k === 0 ? "start" : k === ticks.length - 1 ? "end" : "middle"}
            >
              {dayLabel(daily[i].date)}
            </text>
          ))}
          <path className={s.hcArea} d={`${line}L${x(n - 1)} ${y(0)}L${x(0)} ${y(0)}Z`} style={{ fill: `url(#${chartId})` }} />
          {previousAverage !== null ? (
            <line className={s.hcPrev} x1={m.l} x2={width - m.r} y1={y(previousAverage)} y2={y(previousAverage)} />
          ) : null}
          <path className={s.hcLine} d={line} />
          {shown !== null ? (
            <>
              <line className={s.hcCursor} x1={x(shown)} x2={x(shown)} y1={m.t} y2={m.t + innerH} />
              <circle className={s.hcDot} r={5} cx={x(shown)} cy={y(daily[shown].value)} />
            </>
          ) : null}
          <rect
            x={m.l}
            y={m.t - 6}
            width={innerW}
            height={innerH + 6}
            style={{ fill: "transparent" }}
            onPointerMove={(event) => {
              const el = ref.current;
              if (!el) return;
              // clientX va en px de pantalla y el SVG en px de layout: con `zoom` en <html> difieren.
              const box = el.getBoundingClientRect();
              const scale = el.offsetWidth ? box.width / el.offsetWidth : 1;
              const i = Math.round((((event.clientX - box.left) / scale - m.l) / innerW) * (n - 1));
              setHover(Math.max(0, Math.min(n - 1, i)));
            }}
            onPointerLeave={() => setHover(null)}
          />
          {pins.map((pin, k) => {
            const px = x(pin.index);
            const py = y(daily[pin.index].value);
            return (
              <g key={`${pin.index}-${k}`}>
                <circle cx={px} cy={py} r={4} style={{ fill: "var(--accent)", stroke: "var(--hero)", strokeWidth: 2.5 }} />
                <g
                  className={cx(s.pin, active === k && s.pinOn)}
                  transform={`translate(${px} 14)`}
                  onClick={() => onPin(k)}
                >
                  <line className={s.pinLine} x1={0} x2={0} y1={13} y2={Math.max(py - 20, 13)} />
                  <circle className={s.pinCircle} r={11} />
                  <text className={s.pinText} y={4}>
                    {k + 1}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      ) : null}
      {n > 1 ? (
        <div className={s.chartControl}>
          <label htmlFor={`${chartId}-day`}>Explorar por día</label>
          <input
            id={`${chartId}-day`}
            type="range"
            min={0}
            max={n - 1}
            value={shown ?? n - 1}
            onChange={(event) => setHover(Number(event.target.value))}
            onFocus={() => setHover(shown ?? n - 1)}
            onBlur={() => setHover(null)}
            aria-valuetext={`${dayLabel(daily[shown ?? n - 1].date, true)}: ${formatChartMoney(daily[shown ?? n - 1].value)}`}
          />
          <output htmlFor={`${chartId}-day`}>
            {dayLabel(daily[shown ?? n - 1].date, true)} · <b>{formatChartMoney(daily[shown ?? n - 1].value)}</b>
            {daily[shown ?? n - 1].detail ? ` · ${daily[shown ?? n - 1].detail}` : ""}
          </output>
        </div>
      ) : null}
      {shown !== null && width > 0 ? (
        <div
          className={s.tip}
          style={{
            left: Math.max(95, Math.min(width - 95, x(shown))),
            top: y(daily[shown].value) - 14,
          }}
        >
          <b>{dayLabel(daily[shown].date, true)}</b>
          <span className={s.num}>
            {formatChartMoney(daily[shown].value)}{daily[shown].detail ? ` · ${daily[shown].detail}` : ""}
          </span>
          {previousAverage !== null ? (
            <span className={s.muted}>
              {averageLabel}: <span className={s.num}>{formatChartMoney(previousAverage)}</span>
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
    <div className={s.secHead}>
      <h2 id={id}>{title}</h2>
      {ai ? (
        <p className={s.aiLine}>
          <span className={s.ia}>{tag}</span>
          {ai}
        </p>
      ) : (
        <p className={s.aiLine}>{fallback ?? ""}</p>
      )}
      {onAsk ? (
        <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={onAsk}>
          Preguntar
        </button>
      ) : null}
    </div>
  );
}

export function AiNote({ finding }: { finding: Finding | null }) {
  if (!finding) return null;
  return (
    <p className={s.aiNote}>
      <span className={s.ia}>A02</span>
      {finding.title}
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
    <details className={s.qiD}>
      <summary>{label}{steps.length > 1 ? ` (${steps.length} pasos)` : ""}</summary>
      {steps.length > 1 ? (
        <ol>
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      ) : (
        <p>{steps[0]}</p>
      )}
    </details>
  );
}

type QueueItem =
  | { kind: "proposal"; key: string; outputId: string; index: number; total: number; title: string; why: string; priority: string; mine: boolean; due: string | null; source: string }
  | { kind: "alert"; key: string; title: string; why: string; priority: string }
  | { kind: "task"; key: string; task: Task; mine: boolean; priority: string };

type Decision = "approved" | "rejected";

// `asConsultant`: la misma cola vista desde la mesa del consultor. Cambia de
// quién es cada propuesta (owner_role) y quién es "el otro" en los filtros.
export function WorkQueue({ base, userId, consultant, asConsultant = false, proposals, operations, reloadAll, onComment }: {
  base: string;
  userId: string;
  consultant: AssignedConsultant;
  asConsultant?: boolean;
  proposals: Diagnostic[];
  operations: Operations | undefined;
  reloadAll: () => void;
  onComment: (text: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "mine" | "consultant" | "ai">("all");
  const [showAll, setShowAll] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Record<number, Decision>>>({});
  const [closing, setClosing] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const consultantName = asConsultant ? "Cliente" : consultant?.full_name?.split(" ")[0] ?? "Tu consultor";

  const items = useMemo<QueueItem[]>(() => {
    const list: QueueItem[] = [];
    for (const diagnostic of proposals) {
      if (diagnostic.output_status !== "pending_approval") continue;
      const writes = diagnostic.output.proposed_writes;
      writes.forEach((write, index) => {
        list.push({
          kind: "proposal",
          key: `${diagnostic.output_id}:${index}`,
          outputId: diagnostic.output_id,
          index,
          total: writes.length,
          title: write.title,
          why: write.description,
          priority: write.priority,
          mine: asConsultant ? write.owner_role === "consultor" : write.owner_role !== "consultor",
          due: write.due_hint ?? null,
          source: diagnostic.output_id,
        });
      });
    }
    for (const alert of operations?.alerts ?? []) {
      if (!["open", "acknowledged"].includes(alert.status)) continue;
      list.push({ kind: "alert", key: alert.id, title: alert.title, why: alert.message, priority: alert.severity });
    }
    for (const task of operations?.tasks ?? []) {
      if (!["pending", "in_progress"].includes(task.status)) continue;
      if (task.due_at && Date.parse(task.due_at) - now > SHORT_TERM_DAYS * DAY_MS) continue;
      list.push({ kind: "task", key: task.id, task, mine: !task.assigned_to || task.assigned_to === userId, priority: task.priority });
    }
    // Las propuestas de IA esperan una decision humana: van primero, si no quedan tapadas por tareas urgentes.
    return list.sort(
      (a, b) =>
        Number(b.kind === "proposal") - Number(a.kind === "proposal") ||
        (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2),
    );
  }, [asConsultant, now, operations, proposals, userId]);

  const laterCount = (operations?.tasks ?? []).filter(
    (t) => ["pending", "in_progress"].includes(t.status) && t.due_at && Date.parse(t.due_at) - now > SHORT_TERM_DAYS * DAY_MS,
  ).length;

  const done = (operations?.tasks ?? [])
    .filter((t) => t.status === "completed" && now - Date.parse(t.updated_at) < 7 * DAY_MS)
    .slice(0, 6);

  const filters = [
    { key: "all" as const, label: "Todo", test: () => true },
    { key: "mine" as const, label: "Tuyas", test: (i: QueueItem) => i.kind !== "alert" && i.mine },
    ...(consultant || asConsultant
      ? [{ key: "consultant" as const, label: asConsultant ? "Del cliente" : `De ${consultantName}`, test: (i: QueueItem) => i.kind !== "alert" && !i.mine }]
      : []),
    { key: "ai" as const, label: "Propuestas IA", test: (i: QueueItem) => i.kind === "proposal" },
  ];
  const activeFilter = filters.find((f) => f.key === filter) ?? filters[0];
  const filtered = items.filter(activeFilter.test);
  const visible = showAll ? filtered : filtered.slice(0, QUEUE_PREVIEW);
  const urgent = items.filter((i) => (PRIORITY_RANK[i.priority] ?? 2) === 0).length;

  async function decide(item: Extract<QueueItem, { kind: "proposal" }>, decision: Decision) {
    const forOutput = { ...(decisions[item.outputId] ?? {}), [item.index]: decision };
    setDecisions((prev) => ({ ...prev, [item.outputId]: forOutput }));
    if (Object.keys(forOutput).length < item.total) return;

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
      toast.success(batch === "approved" ? `${approved} tarea(s) creada(s) en Tareas.` : "Propuestas descartadas.");
      reloadAll();
    } catch {
      toast.danger("No se pudo guardar la decisión por un error de red. Reintenta.");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(task: Task, status: "in_progress" | "completed", note?: string) {
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
      toast.success(status === "completed" ? "Tarea cerrada con su resultado." : "Tarea en curso.");
      setClosing(null);
      setOutcome("");
      reloadAll();
    } catch (cause) {
      toast.danger(cause instanceof Error ? cause.message : "No se pudo actualizar la tarea.");
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

  return (
    <div className={s.panel}>
      <div className={s.panelH}>
        <div>
          <h3>Qué hacer</h3>
          <p className={s.qSum}>
            {items.length ? `${items.length} por resolver` : operations ? "Al día" : "Pendientes de comprobar"}
            {laterCount ? (
              <>
                {" · "}
                <a href="/tareas">{laterCount} más a largo plazo</a>
              </>
            ) : null}
            {urgent ? (
              <>
                {" · "}
                <b>{urgent} urgentes</b>
              </>
            ) : null}
          </p>
        </div>
        {/* Filtrar una lista vacía son cuatro botones a cero: solo con algo que filtrar. */}
        {items.length > 0 ? (
        <div className={s.seg} role="group" aria-label="Filtrar trabajo pendiente">
          {filters.map((f) => (
            <button key={f.key} type="button" aria-pressed={f.key === activeFilter.key} onClick={() => setFilter(f.key)}>
              {f.label}
              <b>{items.filter(f.test).length}</b>
            </button>
          ))}
        </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <Empty action={items.length
          ? <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={() => setFilter("all")}>Ver todo el trabajo</button>
          : !operations ? <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={reloadAll}>Volver a cargar las tareas</button> : undefined}>
          {items.length ? "No hay trabajo pendiente con este filtro." : !operations ? "Aún no se han podido comprobar las tareas de esta tienda." : "No hay tareas ni propuestas pendientes. Puedes revisar tus resultados o continuar con el plan de la semana."}
        </Empty>
      ) : (
        <ul>
          {visible.map((item) => {
            if (item.kind === "proposal") {
              const decided = decisions[item.outputId]?.[item.index];
              const pendingOthers = item.total - Object.keys(decisions[item.outputId] ?? {}).length;
              return (
                <li key={item.key} className={cx(s.qi, s.qiProposal)}>
                  <span className={cx(s.pr, prioClass(item.priority))} aria-hidden="true" />
                  <div>
                    <p className={s.qiK}>
                      <span className={s.ia}>IA</span>Propuesta · crear la tarea necesita tu visto bueno
                    </p>
                    <p className={s.qiT}>{item.title}</p>
                    {item.why ? <TaskDetail text={item.why} label="Por qué" /> : null}
                    <div className={s.qiM}>
                      <span className={cx(s.prioL, prioClass(item.priority) === s.prUrgent && s.prioUrgent)}>
                        {PRIORITY_LABEL[item.priority] ?? item.priority}
                      </span>
                      {who(item.mine)}
                      {item.due ? <span className={s.chip}>{item.due}</span> : null}
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
                      <button type="button" className={cx(s.btn, s.acc, s.sm)} disabled={busy !== null} onClick={() => void decide(item, "approved")}>
                        Crear tarea
                      </button>
                      <button type="button" className={cx(s.btn, s.ghost, s.sm)} disabled={busy !== null} onClick={() => void decide(item, "rejected")}>
                        Descartar
                      </button>
                    </div>
                  )}
                </li>
              );
            }
            if (item.kind === "alert") {
              return (
                <li key={item.key} className={s.qi}>
                  <span className={cx(s.pr, prioClass(item.priority))} aria-hidden="true" />
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
            return (
              <li key={item.key} className={s.qi}>
                <span className={cx(s.pr, prioClass(item.priority))} aria-hidden="true" />
                <div>
                  <p className={s.qiT}>{task.title}</p>
                  {task.description ? <TaskDetail text={task.description} label="Ver pasos" /> : null}
                  <div className={s.qiM}>
                    <span className={cx(s.prioL, prioClass(item.priority) === s.prUrgent && s.prioUrgent, prioClass(item.priority) === s.prHigh && s.prioHigh)}>
                      {PRIORITY_LABEL[item.priority] ?? item.priority}
                    </span>
                    {who(item.mine, task.assignee_name)}
                    {task.categories.slice(0, 1).map((c) => (
                      <span key={c} className={s.chip}>
                        {c}
                      </span>
                    ))}
                    {task.due_at ? <span className={s.chip}>{dayLabel(task.due_at, true)}</span> : null}
                    <span className={cx(s.chip, task.status === "in_progress" && s.chipAcc)}>
                      {task.status === "in_progress" ? "En curso" : "Pendiente"}
                    </span>
                  </div>
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
                        <button type="submit" className={cx(s.btn, s.sm)} disabled={!outcome.trim() || busy === task.id}>
                          Registrar
                        </button>
                        <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={() => setClosing(null)}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
                <div className={s.qiA}>
                  {item.mine ? (
                    <>
                      {task.status === "pending" ? (
                        <button type="button" className={cx(s.btn, s.ghost, s.sm)} disabled={busy === task.id} onClick={() => void setStatus(task, "in_progress")}>
                          Empezar
                        </button>
                      ) : null}
                      <button type="button" className={cx(s.btn, s.sm)} disabled={busy === task.id} onClick={() => { setClosing(task.id); setOutcome(""); }}>
                        Hecha
                      </button>
                    </>
                  ) : consultant || asConsultant ? (
                    <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={() => onComment(`Sobre «${task.title}»: `)}>
                      Comentar
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > QUEUE_PREVIEW ? (
        <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Ver menos" : `Ver las ${filtered.length} (${filtered.length - QUEUE_PREVIEW} más)`}
        </button>
      ) : null}

      {done.length ? (
        <details className={s.done}>
          <summary>Hechas esta semana ({done.length})</summary>
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
        </details>
      ) : null}
    </div>
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
  const messages = useCachedQuery<{ messages: Message[] }>(`${base}/consultant-messages`);
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
            <div key={message.id} className={cx(s.msg, mine && s.mine)}>
              {message.body}
              {message.attachments.map((file) =>
                file.signed_url ? (
                  <a key={file.filename} className={s.file} href={file.signed_url} target="_blank" rel="noreferrer">
                    {file.filename}
                  </a>
                ) : (
                  <span key={file.filename} className={s.file}>
                    {file.filename}
                  </span>
                ),
              )}
              <span className={s.msgW}>
                {mine ? "Tú" : message.author_name ?? name} · {dayLabel(message.created_at, true)}{" "}
                {new Date(message.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
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
        <button type="submit" className={s.btn} disabled={sending || !draft.trim()}>
          Enviar
        </button>
      </form>
      <div className={s.linkRow}>
        <a className={cx(s.btn, s.ghost, s.sm)} href="/mensajes">
          Abrir el chat con adjuntos
        </a>
      </div>
    </div>
  );
}

function CopilotCard({ onAsk }: { onAsk: (question: string, label: string) => void }) {
  const questions = [
    "¿Qué debería hacer primero esta semana?",
    "¿Por qué han cambiado mis ventas este mes?",
    "¿Qué productos debería reponer?",
  ];
  return (
    <div className={s.panel}>
      <div className={s.person}>
        <span className={s.avatar} aria-hidden="true" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          IA
        </span>
        <div>
          <b>Tu copiloto</b>
          <span>Conoce tus ventas, tu stock y tus campañas</span>
        </div>
      </div>
      <p className={s.aiNote}>
        No tienes consultor asignado. Pregúntale al copiloto lo que le preguntarías a uno.
      </p>
      <div className={s.qfB} style={{ marginTop: 14 }}>
        {questions.map((q) => (
          <button key={q} type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={() => onAsk(q, "Tu tienda")}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

export function ClientPulse({ userId, organizationId, organizationName, connectionId, consultant }: {
  userId: string;
  organizationId: string;
  organizationName: string;
  connectionId: string | null;
  consultant: AssignedConsultant;
}) {
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const verdictOf = useMetricAnalysis(organizationId, 30, connectionId);
  const [agendaQuery] = useState(() => {
    const from = new Date();
    const to = new Date(from.getTime() + 28 * DAY_MS);
    return `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&scope=${encodeURIComponent(organizationId)}`;
  });

  const metrics = useCachedQuery<Metrics>(`${base}/shopify/metrics?days=30${scope}`);
  const meta = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=30`);
  const klaviyo = useCachedQuery<KlaviyoReport>(`${base}/klaviyo/email-report?days=30`);
  const operations = useCachedQuery<Operations>(`${base}/operations`);
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30&view=overview${scope}`);
  const stockAi = useCachedQuery<Diagnostic>(`${base}/ai/stock-planner?days=30${scope}`);
  // A04: el plan diario propone tareas; sin esto sus propuestas nunca llegaban al widget.
  const plannerAi = useCachedQuery<Diagnostic>(`${base}/ai/task-planner?days=30${scope}`);
  // Sin consultor, el análisis de email es parte del acompañamiento; con
  // consultor lo filtra él.
  const emailAi = useCachedQuery<Diagnostic>(consultant ? null : `${base}/ai/email-analyst?days=30${scope}`);
  const integrations = useCachedQuery<IntegrationsPayload>(`${base}/integrations`);
  const agenda = useCachedQuery<Agenda>(`/v1/consultant/agenda?${agendaQuery}`);

  const ask = useCopilotAsk();
  const [activePin, setActivePin] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState<string | null>(null);
  const messageRef = useRef<HTMLInputElement>(null);
  const [today] = useState(() => new Date());

  function askCopilot(question: string, focusLabel: string) {
    ask({ question, focusLabel, reference: { period_label: "Últimos 30 días", filters: { days: "30" } } });
  }

  function reloadAll() {
    invalidateApiGetCache();
    invalidateCachedQueries(base);
    operations.reload();
    monitor.reload();
    stockAi.reload();
    plannerAi.reload();
    emailAi.reload();
  }

  async function runAgent(runPath: string, label: string, reload: () => void, view?: string) {
    setRunning(runPath);
    try {
      const viewQuery = view ? `&view=${encodeURIComponent(view)}` : "";
      const response = await apiFetch(`${base}${runPath}?days=30${scope}${viewQuery}`, { method: "POST" });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(`${label} actualizado.`);
      reload();
    } catch {
      toast.danger("No se pudo lanzar el análisis por un error de red.");
    } finally {
      setRunning(null);
    }
  }

  function comment(text: string) {
    setDraft(text);
    messageRef.current?.focus();
  }

  const data = metrics.data;
  const formatStoreMoney = (value: number | null | undefined, decimals = 0) =>
    fmtCurrency(value, data?.currency_code, decimals);
  const pins = usePins(data?.daily, operations.data?.alerts);
  const storeSelectionRequired = metrics.error?.includes("shopify_store_selection_required") ?? false;
  const financialCurrencyComparable = data?.financial_currency_coverage?.status === "compatible";
  const klaviyoCurrencyComparable = data?.financial_currency_coverage?.klaviyo_status === "compatible";
  const diagnostic = !storeSelectionRequired ? monitor.data : undefined;
  const monitorPending = !diagnostic && /agent_diagnostic_pending/.test(monitor.error ?? "");
  const monitorNoData = !diagnostic && /agent_sin_datos/.test(monitor.error ?? "");

  if (metrics.isLoading && !data) {
    return (
      <div className={s.root}>
        <div className={s.hero} role="status" aria-busy="true">
          <p className={s.heroMeta}>{organizationName}</p>
          <p className={s.headline}>Cargando tu tienda…</p>
          <Skeleton className="h-32 w-full" aria-hidden="true" />
        </div>
      </div>
    );
  }

  // ---- derivados ----
  const financial = data?.financial;
  const showProfit = financialCurrencyComparable && financial
    ? canShowProfit({
        hasFinancialSettings: financial.has_settings,
        itemsWithoutCost: financial.items_without_cost,
        linesWithoutNetMetrics: data?.margin.lines_without_metrics,
      })
    : false;
  const previous = data?.previous_period ?? null;
  const pulse = storePulse({
    netSales: data?.sales.net_sales ?? 0,
    netProfit: showProfit ? financial?.net_profit ?? null : null,
    hasFinancialSettings: showProfit && (financial?.has_settings ?? false),
    previousNetSales: previous?.sales.net_sales ?? null,
  });
  const aiHeadline = diagnostic?.output.headline ?? diagnostic?.output.answer ?? null;
  const headline = aiHeadline || pulse.headline;
  const daily = data?.daily ?? [];
  const previousAverage = previous && daily.length ? previous.sales.net_sales / daily.length : null;
  const target = (key: string) => data?.metric_targets.find((t) => t.metric_key === key)?.target_value ?? null;

  const proposals = [diagnostic, plannerAi.data, stockAi.data, emailAi.data].filter((d): d is Diagnostic => Boolean(d));
  const nextStep = diagnostic?.output.recommendations
    .slice()
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2))[0];

  // Sin un mínimo de clientes nuevos el CAC no es una media sino una anécdota.
  const cacReliable = (financial?.new_customers ?? MIN_NEW_CUSTOMERS_FOR_CAC) >= MIN_NEW_CUSTOMERS_FOR_CAC;
  const profitPerOrder = financialCurrencyComparable && financial && financial.orders_count > 0 ? financial.net_profit / financial.orders_count : null;
  // Cada sección se queda con un hallazgo distinto: las específicas eligen
  // primero y la genérica (Canales) se queda con lo que sobra.
  const takenFindings = new Set<Finding>();
  const moneyAi = findingFor(diagnostic, /rentab|margen|finan|beneficio|profit|coste|unit/i, takenFindings);
  const storeAi = findingFor(diagnostic, /conver|embudo|tienda|web|cro|carrito|checkout/i, takenFindings);
  const metaAi = findingFor(diagnostic, /meta|anunc|ads|paid/i, takenFindings);
  const klaviyoAi = emailAi.data?.output.findings[0] ?? findingFor(diagnostic, /email|klaviyo|crm|reten|flujo/i, takenFindings);
  const channelsAi = findingFor(diagnostic, /adquis|marketing|canal/i, takenFindings);
  const planAi = findingFor(diagnostic, /objetivo|camino|crecim|plan|tendencia/i, takenFindings);
  // El planificador de stock a veces escribe con nombres de campo; al cliente
  // solo le llega lo que se lee como una frase.
  const stockHeadline =
    [
      stockAi.data?.output.headline,
      ...(stockAi.data?.output.findings.map((finding) => finding.title) ?? []),
      findingFor(diagnostic, /stock|invent|reposi/i, takenFindings)?.title,
    ].find((text): text is string => typeof text === "string" && isClientReadable(text)) ?? null;
  const stockFindings = (stockAi.data?.output.findings ?? [])
    .filter((finding) => isClientReadable(finding.title))
    .map((finding) => ({ ...finding, evidence: clientReadable(finding.evidence) ?? "" }));
  const dated = (finding: Finding | null) => datedAi(finding?.title, diagnostic?.generated_at);

  const metaAcq = meta.data?.acquisition;
  const hasMeta = Boolean(metaAcq && metaAcq.days_with_data > 0);
  const hasKlaviyo = Boolean(klaviyo.data?.connected && klaviyo.data.totals);

  return (
    <div className={s.root}>
      <DashboardSections items={[
    { id: "pulse-headline", label: "Resumen" },
    { id: "pulse-hoy", label: "Qué hacer" },
    ...(financial ? [{ id: "pulse-dinero", label: "Dinero" }] : []),
    ...(data ? [{ id: "pulse-canales", label: "Canales" }, { id: "pulse-stock", label: "Stock" }, { id: "pulse-plan", label: "Plan" }] : []),
  ]} />
      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.hero} aria-labelledby="pulse-headline">
        <div className={s.heroTop}>
          <div>
            <p className={s.heroMeta}>
              <span>{organizationName}</span>
              <span>{today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" })}</span>
              <span>Últimos 30 días frente a los 30 anteriores</span>
            </p>
            <h1 id="pulse-headline" className={s.headline}>
              Tu tienda, de un vistazo
            </h1>
            <p className={s.headlineDetail}>Tus resultados y las prioridades para esta semana.</p>
            {metrics.error && !data ? (
              <p className={s.headlineDetail}>
                {storeSelectionRequired
                  ? "Hay varias tiendas conectadas. Selecciona una en la cabecera para consultar sus datos sin mezclar tiendas."
                  : "No hemos podido cargar los datos de tu tienda. Revisa que Shopify esté conectado en Integraciones."}
              </p>
            ) : null}
            <div className={s.heroActions}>
              <button
                type="button"
                className={cx(s.btn, s.acc)}
                onClick={() =>
                  askCopilot(`Explícame esto sobre mi tienda: «${headline}». ¿Por qué pasa y qué harías primero?`, "Resumen de tu tienda")
                }
              >
                <span className={s.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>
                  IA
                </span>
                Preguntar por qué
              </button>
              <a className={cx(s.btn, s.ghost)} href="#pulse-hoy">
                Ver qué hacer
              </a>
            </div>
          </div>
          <aside className={s.heroSide} aria-label="Análisis de la IA">
            {diagnostic ? (
              <>
                <details className={s.analysisDisclosure}>
                  <summary>
                  <strong>
                    Análisis del {dayLabel(diagnostic.generated_at, true)},{" "}
                    {new Date(diagnostic.generated_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  </strong>
                  </summary>
                  <p>La lectura corresponde a esa fecha; las cifras muestran el periodo actual. Actualiza el análisis si necesitas una lectura nueva.</p>
                </details>
                <button
                  type="button"
                  className={cx(s.btn, s.ghost, s.sm)}
                  disabled={running !== null}
                  onClick={() => void runAgent("/ai/monitor-run", "Análisis", monitor.reload, "overview")}
                >
                  {running === "/ai/monitor-run" ? "Analizando…" : "Actualizar análisis"}
                </button>
              </>
            ) : monitorNoData ? (
              <p>Cuando se sincronice tu tienda, la IA empezará a analizarla.</p>
            ) : (
              <>
                <p>
                  <span className={s.ia}>A02</span>
                  <strong>{monitorPending ? "El primer análisis está pendiente" : "Sin análisis todavía"}</strong>
                </p>
                <p>La IA revisa tus pedidos, costes y campañas y te dice qué está pasando y qué haría.</p>
                <button
                  type="button"
                  className={cx(s.btn, s.acc, s.sm)}
                  disabled={running !== null}
                  onClick={() => void runAgent("/ai/monitor-run", "Análisis", monitor.reload, "overview")}
                >
                  {running === "/ai/monitor-run" ? "Analizando… puede tardar 1-2 min" : "Analizar ahora"}
                </button>
              </>
            )}
          </aside>
        </div>

        {data && !financialCurrencyComparable ? (
          <div className={s.panel} role="status" style={{ marginTop: 16 }}>
            <strong>Rentabilidad pendiente de validar por moneda</strong>
            <p className={s.trackTxt}>
              {data.financial_currency_coverage?.status === "incompatible"
                ? `Hay fuentes en monedas distintas a ${data.currency_code ?? "la tienda"}: ${data.financial_currency_coverage.mismatched_sources.map((item) => `${item.source} (${item.currencies.join(", ")})`).join("; ")}.`
                : `No se pudo confirmar la moneda de todas las fuentes financieras${data.financial_currency_coverage?.unknown_sources.length ? `: ${data.financial_currency_coverage.unknown_sources.join(", ")}` : ""}.`}
              {" "}La lectura de la IA sigue disponible aunque la moneda esté pendiente. Los cálculos que comparan importes entre fuentes permanecen sujetos a validar la moneda; no se convierte moneda automáticamente.
            </p>
          </div>
        ) : null}

        {daily.length > 1 ? (
          <details className={s.chartDisclosure}>
            <summary>Evolución diaria de ventas <span>Comparar días y consultar alertas</span></summary>
          <SalesChart
            daily={daily.map((d) => ({ date: d.date, value: d.net_sales, detail: `${fmtNum(d.orders_count)} pedidos` }))}
            previousAverage={previousAverage}
            currencyCode={data?.currency_code}
              pins={pins}
              active={activePin}
              onPin={(k) => setActivePin((current) => (current === k ? null : k))}
            />
            <div className={s.legend} aria-hidden="true">
              <span>
                <i className={s.lgLine} />
                Ventas netas por día
              </span>
              {previousAverage !== null ? (
                <span>
                  <i className={s.lgPrev} />
                  Media diaria del periodo anterior
                </span>
              ) : null}
              {pins.length ? (
                <span>
                  <i className={s.lgPin} />
                  Alertas detectadas en el periodo
                </span>
              ) : null}
            </div>
            {pins.length ? (
              <ol className={s.notes}>
                {pins.map((pin, k) => (
                  <li key={`${pin.date}-${k}`}>
                    <button
                      type="button"
                      className={s.note}
                      aria-pressed={activePin === k}
                      onClick={() => setActivePin((current) => (current === k ? null : k))}
                    >
                      <span className={s.noteH}>
                        <span className={s.noteN}>{k + 1}</span>
                        {dayLabel(pin.date, true)} · {pin.source}
                      </span>
                      <p>{pin.title}</p>
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
          </details>
        ) : null}
      </section>

      {/* ------------------------------ KPIs ------------------------------ */}
      {data ? (
        <div className={s.kpis} aria-label="Cifras clave">
          <Kpi
            label="Ventas netas"
            value={formatStoreMoney(data.sales.net_sales)}
            delta={<Delta change={salesChangePct(data.sales.net_sales, previous?.sales.net_sales ?? null)} />}
            vs={previous ? formatStoreMoney(previous.sales.net_sales) : null}
            slot={<Spark values={daily.map((d) => d.net_sales)} />}
          />
          <Kpi
            label="Pedidos"
            value={fmtNum(data.sales.orders_count)}
            delta={<Delta change={salesChangePct(data.sales.orders_count, previous?.sales.orders_count ?? null)} />}
            vs={previous ? fmtNum(previous.sales.orders_count) : null}
            slot={<Spark values={daily.map((d) => d.orders_count)} />}
          />
          <Kpi
            label="Ticket medio"
            value={formatStoreMoney(data.sales.aov, 2)}
            delta={<Delta change={salesChangePct(data.sales.aov, previous?.sales.aov ?? null)} />}
            vs={previous ? formatStoreMoney(previous.sales.aov, 2) : null}
            slot={<Spark values={daily.filter((d) => d.orders_count > 0).map((d) => d.net_sales / d.orders_count)} />}
          />
          {showProfit && financial ? (
            <Kpi
              label="Beneficio neto"
              value={formatStoreMoney(financial.net_profit)}
            delta={<Delta change={previous?.financial.lines_without_metrics === 0 ? salesChangePct(financial.net_profit, previous.financial.net_profit) : null} />}
            vs={previous?.financial.lines_without_metrics === 0 ? formatStoreMoney(previous.financial.net_profit) : null}
              slot={
                <TargetBar
                  value={financial.net_margin_pct}
                  target={target("net_margin_pct") ?? financial.net_margin_pct}
                  max={Math.max(40, (target("net_margin_pct") ?? 0) * 1.4)}
                  text={`Margen ${fmtNum(financial.net_margin_pct, 1)} %${target("net_margin_pct") !== null ? ` · objetivo ${fmtNum(target("net_margin_pct") ?? 0, 1)} %` : ""}`}
                />
              }
            />
          ) : (
            <Kpi
              label="Beneficio neto"
              tag={!financialCurrencyComparable ? "moneda pendiente" : data?.margin.lines_without_metrics !== 0 ? "cobertura pendiente" : financial?.has_settings ? "faltan costes" : "falta configurar"}
              value="—"
              slot={
                <p className={s.trackTxt}>
                  {!financialCurrencyComparable
                    ? "Consulta el aviso de moneda antes de usar el beneficio, el margen o el CAC."
                    : data?.margin.lines_without_metrics !== 0
                    ? `Falta cobertura neta en ${data?.margin.lines_without_metrics ?? "algunas"} líneas de pedido; sincronízalas antes de consultar beneficio y margen.`
                    : financial?.has_settings
                    ? `Faltan los costes de ${financial.items_without_cost} producto(s)`
                    : "Sin costes ni gastos no se puede calcular"}
                </p>
              }
            />
          )}
          <Kpi
            verdict={<MetricVerdict analysis={verdictOf("conversion")} />}
            anchorId="insight-metric-conversion"
            label="Conversión"
            value={data.funnel?.has_sessions && data.funnel.conversion_rate_own !== null ? `${fmtNum(data.funnel.conversion_rate_own * 100, 2)} %` : "—"}
            delta={
              data.funnel?.conversion_rate_own != null && previous?.conversion_rate_own != null ? (
                <Delta change={(data.funnel.conversion_rate_own - previous.conversion_rate_own) * 100} suffix="pp" />
              ) : null
            }
            vs={previous?.conversion_rate_own != null ? `${fmtNum(previous.conversion_rate_own * 100, 2)} %` : null}
            slot={
              target("conversion_rate") !== null && data.funnel?.conversion_rate_own != null ? (
                <TargetBar
                  value={data.funnel.conversion_rate_own * 100}
                  target={target("conversion_rate") ?? 0}
                  max={Math.max((target("conversion_rate") ?? 0) * 1.6, data.funnel.conversion_rate_own * 120)}
                  text={`Objetivo ${fmtNum(target("conversion_rate") ?? 0, 2)} %`}
                />
              ) : data.funnel?.has_sessions ? (
                <Spark values={data.funnel_daily.map((d) => d.conversion_rate_own ?? 0)} />
              ) : (
                <p className={s.trackTxt}>Sin datos de sesiones todavía</p>
              )
            }
          />
          <Kpi
            verdict={<MetricVerdict analysis={verdictOf("cac_new")} />}
            anchorId="insight-metric-cac_new"
            label="CAC combinado"
            value={financialCurrencyComparable && financial?.cac_blended != null && cacReliable ? formatStoreMoney(financial.cac_blended, 2) : "—"}
            tag={financialCurrencyComparable && financial?.cac_blended != null && !cacReliable ? "muestra pequeña" : undefined}
            slot={
              financialCurrencyComparable && financial?.cac_blended != null && !cacReliable ? (
                <p className={s.trackTxt} title="Dividir toda la publicidad entre tan pocos clientes nuevos no da un coste por cliente fiable.">
                  Solo {fmtNum(financial.new_customers ?? 0)} {financial.new_customers === 1 ? "cliente nuevo" : "clientes nuevos"} en el periodo
                </p>
              ) : financialCurrencyComparable && target("cac_blended") !== null && financial?.cac_blended != null ? (
                <TargetBar
                  value={financial.cac_blended}
                  target={target("cac_blended") ?? 0}
                  max={Math.max((target("cac_blended") ?? 0) * 1.6, financial.cac_blended * 1.2)}
                  lowerIsBetter
                  text={`Objetivo ≤ ${formatStoreMoney(target("cac_blended") ?? 0)} por cliente nuevo`}
                />
              ) : (
                <p className={s.trackTxt}>Toda la publicidad entre clientes nuevos</p>
              )
            }
          />
        </div>
      ) : null}

      {diagnostic && aiHeadline ? (
        <section className={s.sec} aria-labelledby="pulse-reading">
          <div className={s.panel}>
            <h2 id="pulse-reading" className={s.qiT}><span className={s.ia}>A02</span> Qué está pasando</h2>
            <p className={s.headlineDetail}>{aiHeadline}</p>
          </div>
        </section>
      ) : null}

      {/* ------------------------------ Hoy ------------------------------ */}
      <section className={s.sec} aria-labelledby="pulse-hoy">
        <SectionHead
          id="pulse-hoy"
          title="Hoy"
          ai={nextStep ? `Lo primero: ${nextStep.action}` : null}
          onAsk={() => askCopilot("Con las métricas y tareas visibles de esta tienda, ¿qué única prioridad debería iniciar esta semana? Justifícala con su métrica, fuente y periodo; indica si falta evidencia.", "Qué hacer hoy")}
        />
        <div className={s.two}>
          {operations.error && !operations.data ? (
            <div className={s.panel}>
              <p className={s.error}>No se pudieron cargar tus tareas: {operations.error}</p>
            </div>
          ) : (
            <WorkQueue
              base={base}
              userId={userId}
              consultant={consultant}
              proposals={proposals}
              operations={operations.data}
              reloadAll={reloadAll}
              onComment={comment}
            />
          )}
          {consultant ? (
            <ConsultantThread base={base} name={consultant.full_name ?? "Tu consultor"} role="Tu consultor en E-NORA" draft={draft} setDraft={setDraft} inputRef={messageRef} />
          ) : (
            <CopilotCard onAsk={askCopilot} />
          )}
        </div>
      </section>

      {/* ------------------------------ Dinero ------------------------------ */}
          {financial ? (
        <section className={s.sec} aria-labelledby="pulse-dinero">
          <SectionHead
            id="pulse-dinero"
            title="Dinero"
            ai={dated(moneyAi)}
            fallback={showProfit && profitPerOrder !== null ? `De cada pedido te quedan ${formatStoreMoney(profitPerOrder, 2)}.` : null}
            onAsk={() => askCopilot("¿Qué partida reduce más mi rentabilidad y qué debería revisar primero? Cita cifra, fuente y periodo; si falta un coste, dime cuál.", "Dónde se va el dinero")}
          />
          {showProfit ? (
            <MoneyPanels financial={financial} currencyCode={data?.currency_code ?? null} />
          ) : (
            <div className={s.panel}>
              <Empty
                action={
                  <div className={s.qfB}>
                    <a className={cx(s.btn, s.sm)} href="/shopify">
                      Añadir costes de producto
                    </a>
                    <a className={cx(s.btn, s.ghost, s.sm)} href="/configuracion?section=rentabilidad">
                      Configurar gastos
                    </a>
                  </div>
                }
              >
                {!financialCurrencyComparable
                  ? "No mostramos estos cálculos hasta validar que Shopify, costes y publicidad usan la misma moneda."
                  : financial.has_settings
                  ? `Para enseñarte de dónde sale tu beneficio faltan los costes de ${financial.items_without_cost} producto(s). Un beneficio sin ellos sería un número que te creerías y no es real.`
                  : "Para enseñarte de dónde sale tu beneficio necesitamos tus costes de producto y tus gastos fijos."}
              </Empty>
            </div>
          )}
        </section>
      ) : null}

      {/* ------------------------------ Canales ------------------------------ */}
      {data ? (
        <section className={s.sec} aria-labelledby="pulse-canales">
          <SectionHead
            id="pulse-canales"
            title="Canales"
            ai={dated(channelsAi)}
            fallback="Cada plataforma cuenta su parte de las ventas."
            onAsk={() =>
              askCopilot(
                "Compara por separado lo que registran Shopify, Meta y Klaviyo en sus propios periodos. ¿Qué señal permite priorizar una revisión? No sumes ingresos atribuidos y explica cualquier incompatibilidad de moneda.",
                "Canales",
              )
            }
          />
          <div className={s.three}>
            <StorePanel data={data} note={storeAi} onAsk={() => askCopilot("Según las etapas medibles de la tienda, ¿dónde cae más la conversión y qué dato respalda la conclusión? Si faltan sesiones o eventos, indícalo.", "Tienda online")} />
            <div className={s.panel}>
              <div className={s.panelH}>
                <div>
                  <h3>
                    <i className={s.sw} style={{ background: "var(--meta)" }} />
                    Meta Ads
                  </h3>
                  <p className={s.sub}>Cifras atribuidas según Meta</p>
                </div>
                <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={() => askCopilot("En el periodo analizado, ¿qué métrica de Meta Ads merece revisión primero y qué cambio propondrías? Cita la campaña, la cifra y el periodo; no afirmes que el cambio ya se hizo.", "Meta Ads")}>
                  Preguntar
                </button>
              </div>
              {hasMeta && metaAcq && financialCurrencyComparable ? (
              <MetaBody meta={meta.data as MetaMetrics} breakeven={showProfit ? financial?.breakeven_roas ?? null : null} currencyCode={data.currency_code ?? null} />
              ) : hasMeta && metaAcq ? (
                <Empty>Importes y ROAS ocultos hasta comprobar que la inversión publicitaria usa la moneda de la tienda.</Empty>
              ) : (
                <Empty action={<a className={cx(s.btn, s.sm)} href="/integraciones/meta">Conectar Meta Ads</a>}>
                  Conecta tu cuenta publicitaria para ver inversión, ROAS y compras atribuidas.
                </Empty>
              )}
              {hasMeta ? <AiNote finding={metaAi} /> : null}
            </div>
            <div className={s.panel}>
              <div className={s.panelH}>
                <div>
                  <h3>
                    <i className={s.sw} style={{ background: "var(--klaviyo)" }} />
                    Klaviyo
                  </h3>
                  <p className={s.sub}>Ingresos atribuidos según Klaviyo</p>
                </div>
                <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={() => askCopilot("En el periodo analizado, ¿qué email o flujo de Klaviyo revisaría primero y qué métrica lo justifica? Distingue ingresos atribuidos de ventas de Shopify.", "Klaviyo")}>
                  Preguntar
                </button>
              </div>
              {hasKlaviyo && klaviyo.data && klaviyoCurrencyComparable ? (
                <KlaviyoBody report={klaviyo.data} currencyCode={data.currency_code ?? null} />
              ) : hasKlaviyo && klaviyo.data ? (
                <Empty
                  action={
                    <a className={cx(s.btn, s.ghost, s.sm)} href="/configuracion?section=rentabilidad">
                      Configurar moneda de Klaviyo
                    </a>
                  }
                >
                  {data.financial_currency_coverage?.klaviyo_status === "incompatible"
                    ? `Los ingresos de Klaviyo están confirmados en ${data.financial_currency_coverage.klaviyo_currency_code ?? "otra moneda"} y Shopify en ${data.currency_code ?? "una moneda distinta"}. Se mantienen separados para evitar comparar importes distintos.`
                    : "La moneda preferida de la cuenta no confirma la moneda de los ingresos atribuidos. Confírmala en la configuración financiera; los importes seguirán ocultos hasta entonces."}
                </Empty>
              ) : (
                <Empty action={<a className={cx(s.btn, s.sm)} href="/integraciones/klaviyo">Conectar Klaviyo</a>}>
                  Conecta Klaviyo para ver cuánto generan tus emails y flujos.
                </Empty>
              )}
              {hasKlaviyo ? <AiNote finding={klaviyoAi} /> : null}
            </div>
          </div>
          {(hasMeta && financialCurrencyComparable || hasKlaviyo && klaviyoCurrencyComparable) ? (
            <Attribution
              storeSales={data.sales.net_sales}
              meta={hasMeta && financialCurrencyComparable ? metaAcq?.purchase_value ?? null : null}
              klaviyo={hasKlaviyo && klaviyoCurrencyComparable ? klaviyo.data?.totals.revenue ?? null : null}
              currencyCode={data.currency_code ?? null}
            />
          ) : null}
        </section>
      ) : null}

      {/* ------------------------------ Stock ------------------------------ */}
      {data ? (
        <section className={s.sec} aria-labelledby="pulse-stock">
          <SectionHead
            id="pulse-stock"
            title="Stock"
            ai={stockHeadline}
            tag={stockAi.data ? "A06" : "A02"}
            onAsk={() => askCopilot("¿Qué productos tienen mayor riesgo de rotura según ventas, stock y previsión disponibles? Prioriza la reposición y da cantidades solo si hay cobertura, plazo de entrega y unidades suficientes para calcularlas; cita la evidencia.", "Stock")}
          />
          <div className={s.panel}>
            <div className={s.stockStats}>
              <div className={cx(s.stat, data.stock.out_of_stock_items > 0 && s.statBad)}>
                <span className={s.lbl}>Agotados</span>
                <span className={s.num}>{fmtNum(data.stock.out_of_stock_items)}</span>
              </div>
              <div className={cx(s.stat, data.stock.low_stock_items > 0 && s.statWarn)}>
                <span className={s.lbl}>Stock bajo</span>
                <span className={s.num}>{fmtNum(data.stock.low_stock_items)}</span>
              </div>
              <div className={s.stat}>
                <span className={s.lbl}>Productos con stock controlado</span>
                <span className={s.num}>{fmtNum(data.stock.tracked_items)}</span>
              </div>
            </div>
            {stockAi.data ? (
              <ul className={s.findings}>
                {stockFindings.slice(0, 5).map((finding, i) => (
                  <li key={i} className={s.finding}>
                    <span className={cx(s.pr, prioClass(finding.severity))} aria-hidden="true" />
                    <div>
                      <p className={s.qiT}>{finding.title}</p>
                      {finding.evidence ? <p className={s.findingE}>{finding.evidence}</p> : null}
                    </div>
                  </li>
                ))}
                {stockAi.data.output_status === "pending_approval" && stockAi.data.output.proposed_writes.length ? (
                  <li className={s.finding}>
                    <span />
                    <p className={s.muted}>
                      La IA propone {stockAi.data.output.proposed_writes.length} tarea(s) de reposición. Las tienes en <a href="#pulse-hoy">Hoy</a> para aprobarlas.
                    </p>
                  </li>
                ) : null}
              </ul>
            ) : (
              <div className={s.qfB} style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className={cx(s.btn, s.ghost, s.sm)}
                  disabled={running !== null}
                  onClick={() => void runAgent("/ai/stock-planner-run", "Análisis de stock", stockAi.reload)}
                >
                  {running === "/ai/stock-planner-run" ? "Cruzando stock y ventas…" : "Pedir a la IA qué reponer"}
                </button>
                <a className={cx(s.btn, s.ghost, s.sm)} href="/shopify">
                  Ver inventario completo
                </a>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* ------------------------------ Plan ------------------------------ */}
      {data ? (
        <section className={s.sec} aria-labelledby="pulse-plan">
          <SectionHead
            id="pulse-plan"
            title="Plan"
            ai={dated(planAi)}
            onAsk={() => askCopilot("Con las ventas del periodo y el objetivo configurado, ¿voy al ritmo necesario? Cuantifica la diferencia, cita la fecha y la fuente, y señala los datos que falten.", "Tu objetivo")}
          />
          <div className={s.two}>
            <GoalPanel
              monthly={data.financial_monthly}
              revenueTarget={financialCurrencyComparable ? target("net_revenue_ex_tax") : null}
              marginTarget={financialCurrencyComparable ? target("net_margin_pct") : null}
              margin={showProfit ? financial?.net_margin_pct ?? null : null}
              currencyCode={data.currency_code ?? null}
              today={today}
            />
            <div className={s.panel}>
              <div className={s.panelH}>
                <div>
                  <h3>Próximas 4 semanas</h3>
                  <p className={s.sub}>Plan de marketing e hitos de tu camino</p>
                </div>
              </div>
              <AgendaList agenda={agenda.data} error={agenda.error} />
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------ Integraciones ------------------------------ */}
      <IntegrationsFooter payload={integrations.data} />
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

export function Kpi({ label, value, delta, vs, slot, tag, verdict, anchorId }: {
  label: string;
  value: string;
  delta?: ReactNode;
  vs?: string | null;
  slot: ReactNode;
  tag?: string;
  /** Punto del analista de métricas (`<MetricVerdict>`), junto a la etiqueta. */
  verdict?: ReactNode;
  /** Ancla del ✨ (`insight-metric-<id>`): el menú de la IA lleva hasta aquí y parpadea. */
  anchorId?: string;
}) {
  return (
    <div id={anchorId} className={s.kpi} role="group" aria-label={label}>
      <p className={s.kpiL}>
        {verdict}
        {label}
        {tag ? <span className={cx(s.chip, s.chipWarn)}>{tag}</span> : null}
      </p>
      <p className={s.kpiV}>{value}</p>
      <p className={s.kpiD}>
        {delta}
        {vs ? (
          <span>
            vs <span className={s.num}>{vs}</span>
          </span>
        ) : (
          <span>&nbsp;</span>
        )}
      </p>
      <div className={s.slot}>{slot}</div>
    </div>
  );
}

const UNIT_COLORS: Record<string, string> = {
  prod: "var(--ink-2)",
  ship: "var(--ink-3)",
  fee: "var(--line)",
  ads: "var(--warn)",
  fix: "var(--ink)",
  other: "var(--sunken)",
  profit: "var(--good)",
};

function MoneyPanels({ financial, currencyCode }: { financial: Metrics["financial"]; currencyCode: string | null }) {
  const formatMoney = (value: number, decimals = 0) => fmtCurrency(value, currencyCode, decimals);
  const ads = Object.entries(financial.ads_by_platform ?? {})
    .filter(([, v]) => v > 0)
    .map(([platform, v]) => `${platform === "meta" ? "Meta" : platform === "google" ? "Google" : platform} ${fmtNum(v)}`)
    .join(" · ");
  const rows = moneyFlow(financial, ads || undefined);
  const base = financial.net_revenue_ex_tax || 1;
  const slices = unitEconomics(financial);
  const positive = slices.filter((x) => x.value > 0);
  const totalSlices = positive.reduce((acc, x) => acc + x.value, 0) || 1;
  const perOrder = financial.orders_count > 0 ? financial.net_profit / financial.orders_count : 0;
  const gaugeMax = Math.max(financial.mbee, financial.cac_per_order) * 1.2 || 1;

  return (
    <div className={s.two}>
      <div className={s.panel}>
        <div className={s.panelH}>
          <div>
            <h3>De las ventas al beneficio</h3>
            <p className={s.sub}>Últimos 30 días · porcentajes sobre el ingreso sin IVA</p>
          </div>
        </div>
        <Waterfall
          ariaLabel="De las ventas al beneficio"
          rows={rows.map((row) => ({
            key: row.label,
            label: row.label,
            hint: row.hint,
            value: row.value,
            kind: row.kind,
            display: formatMoney(row.value),
            share: row.kind !== "total" && row.label !== "IVA" ? `${fmtNum((Math.abs(row.value) / base) * 100, 1)} %` : row.label === "Ingreso sin IVA" ? "100 %" : undefined,
            color: row.label === "Publicidad" ? "var(--warn)" : undefined,
          }))}
        />
      </div>
      <div className={s.panel}>
        <div className={s.panelH}>
          <div>
            <h3>Lo que deja cada pedido</h3>
            <p className={s.sub}>
              Ticket medio sin IVA: <span className={s.num}>{formatMoney(financial.aov_ex_tax, 2)}</span>
            </p>
          </div>
        </div>
        <div className={s.ueBig}>
          <span className={s.num} style={{ color: perOrder < 0 ? "var(--bad)" : "var(--good)" }}>
            {formatMoney(perOrder, 2)}
          </span>
          <span>de beneficio por pedido</span>
        </div>
        <div className={s.ueBar} aria-hidden="true">
          {positive.map((slice) => (
            <i key={slice.key} style={{ width: `${(slice.value / totalSlices) * 100}%`, background: UNIT_COLORS[slice.key] }} title={`${slice.label}: ${formatMoney(slice.value, 2)}`} />
          ))}
        </div>
        <div className={s.ueLeg}>
          {slices.map((slice) => (
            <div key={slice.key}>
              <i className={s.sw} style={{ background: UNIT_COLORS[slice.key] }} />
              <span>{slice.label}</span>
              <span className={s.num}>{formatMoney(slice.value, 2)}</span>
            </div>
          ))}
        </div>
        {financial.mbee > 0 ? (
          <div className={s.headroom}>
            <p className={s.lbl}>Techo de publicidad</p>
            <div className={s.gauge} aria-hidden="true">
              <span className={s.fill} style={{ width: `${(financial.cac_per_order / gaugeMax) * 100}%` }} />
              <span className={s.gaugeLim} style={{ left: `${(financial.mbee / gaugeMax) * 100}%` }} />
              <span className={s.gaugeLbl} style={{ left: `${(financial.mbee / gaugeMax) * 100}%`, top: -22, transform: "translateX(-50%)", color: "var(--bad)" }}>
                {formatMoney(financial.mbee, 2)}
              </span>
              <span className={s.gaugeLbl} style={{ left: 0, top: 18, color: "var(--warn)" }}>
                hoy {formatMoney(financial.cac_per_order, 2)}
              </span>
            </div>
            <p>
              Puedes gastar hasta <b>{formatMoney(financial.mbee, 2)}</b> de publicidad por pedido antes de perder dinero. Ahora gastas{" "}
              <b>{formatMoney(financial.cac_per_order, 2)}</b>.
              {financial.breakeven_roas ? (
                <>
                  {" "}
                  Tu ROAS de equilibrio es <b>{fmtNum(financial.breakeven_roas, 2)}×</b>.
                </>
              ) : null}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StorePanel({ data, note, onAsk }: { data: Metrics; note: Finding | null; onAsk: () => void }) {
  const funnel = data.funnel;
  const steps =
    funnel?.has_sessions
      ? [
          { label: "Sesiones", value: funnel.sessions, pct: 100, hint: "Visitas a la tienda online" },
          ...(funnel.has_funnel_steps
            ? [
                { label: "Añaden al carrito", value: funnel.cart_additions, pct: (funnel.cart_additions / (funnel.sessions || 1)) * 100, hint: "de las sesiones" },
                { label: "Llegan al pago", value: funnel.checkouts_reached, pct: (funnel.checkouts_reached / (funnel.cart_additions || 1)) * 100, hint: "de los que añaden al carrito" },
                { label: "Sesiones con compra", value: funnel.purchases, pct: (funnel.purchases / (funnel.checkouts_reached || 1)) * 100, hint: "de los que llegan al pago (sesiones, no pedidos)" },
              ]
            : [{ label: "Pedidos", value: funnel.orders_count, pct: (funnel.conversion_rate_own ?? 0) * 100, hint: "de las sesiones" }]),
        ]
      : [];
  const top = data.top_products.slice(0, 5);
  const topRevenue = Math.max(...top.map((p) => p.revenue), 1);
  return (
    <div className={s.panel}>
      <div className={s.panelH}>
        <div>
          <h3>
            <i className={s.sw} style={{ background: "var(--store)" }} />
            Tienda online
          </h3>
          <p className={s.sub}>Shopify · últimos 30 días</p>
        </div>
        <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={onAsk}>
          Preguntar
        </button>
      </div>
      {steps.length ? (
        // Cada barra mide cuánto de las sesiones llega hasta ahí; el porcentaje
        // de debajo es el paso respecto al anterior.
        <BarRows
          variant="stack"
          ariaLabel="Embudo de la tienda online"
          max={Math.max(steps[0]?.value ?? 0, 1)}
          rows={steps.map((step, i) => ({
            key: step.label,
            label: step.label,
            value: Math.max(step.value, (steps[0]?.value ?? 0) * 0.01),
            display: fmtNum(step.value),
            sub: i === 0 ? step.hint : `${fmtNum(step.pct, 1)} % ${step.hint}`,
          }))}
        />
      ) : (
        <p className={s.muted}>Todavía no hay datos de sesiones de la tienda online.</p>
      )}
      {top.length ? (
        <>
          <div className={s.subH}>
            <p className={s.lbl}>Más vendidos</p>
            <p className={s.lbl}>Ventas</p>
          </div>
          <BarRows
            variant="stack"
            size="sm"
            ariaLabel="Productos más vendidos"
            max={topRevenue}
            rows={top.map((product) => ({
              key: product.product_id,
              label: product.title,
              value: product.revenue,
              display: fmtCurrency(product.revenue, data.currency_code),
              color: "var(--ink-3)",
            }))}
          />
        </>
      ) : null}
      <AiNote finding={note} />
    </div>
  );
}

function MetaBody({ meta, breakeven, currencyCode }: { meta: MetaMetrics; breakeven: number | null; currencyCode: string | null }) {
  const money = (value: number, decimals = 0) => fmtCurrency(value, currencyCode, decimals);
  const acq = meta.acquisition;
  const campaigns = meta.campaigns
    .map((c) => ({ id: c.campaign_id, name: c.campaign_name ?? "Sin nombre", spend: Number(c.spend) || 0, roas: c.roas === null ? null : Number(c.roas), purchases: Number(c.purchases) || 0 }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);
  const scale = Math.max(5, ...campaigns.map((c) => c.roas ?? 0));
  return (
    <>
      <div className={s.minis}>
        <div className={s.mini}>
          <span className={s.lbl}>Inversión</span>
          <span className={s.num}>{money(acq.spend)}</span>
        </div>
        <div className={s.mini}>
          <span className={s.lbl}>ROAS atribuido</span>
          <span className={s.num}>{acq.roas !== null ? `${fmtNum(acq.roas, 2)}×` : "—"}</span>
          {breakeven ? <small>equilibrio {fmtNum(breakeven, 2)}×</small> : null}
        </div>
        <div className={s.mini}>
          <span className={s.lbl}>CPA atribuido</span>
          <span className={s.num}>{acq.cac !== null ? money(acq.cac, 2) : "—"}</span>
        </div>
        <div className={s.mini}>
          <span className={s.lbl}>Compras atribuidas</span>
          <span className={s.num}>{fmtNum(acq.purchases)}</span>
          <small>{money(acq.purchase_value)} atribuidos por Meta</small>
        </div>
      </div>
      {campaigns.length ? (
        <div className={s.tblWrap} role="region" aria-label="Tabla de resultados; desliza para ver todas las columnas" tabIndex={0}>
          <table className={s.tbl} aria-label="Resultados del periodo seleccionado">
            <thead>
              <tr>
                <th scope="col">Campaña</th>
                <th scope="col">Gasto</th>
                <th scope="col">ROAS</th>
                <th scope="col">Compras</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className={s.tdN}>{money(c.spend)}</td>
                  <td>
                    <span className={s.roas}>
                      <span className={s.roasBar} title={breakeven ? `La línea roja marca el ROAS de equilibrio (${fmtNum(breakeven, 2)}×)` : undefined}>
                        <i style={{ width: `${((c.roas ?? 0) / scale) * 100}%` }} />
                        {breakeven ? <b style={{ left: `${(breakeven / scale) * 100}%` }} /> : null}
                      </span>
                      <span className={s.num}>{c.roas !== null ? `${fmtNum(c.roas, 1)}×` : "—"}</span>
                    </span>
                  </td>
                  <td className={s.tdN}>{fmtNum(c.purchases)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function KlaviyoBody({ report, currencyCode }: { report: KlaviyoReport; currencyCode: string | null }) {
  const money = (value: number, decimals = 0) => fmtCurrency(value, currencyCode, decimals);
  const { totals } = report;
  const total = totals.flow_revenue + totals.campaign_revenue || 1;
  const trend = report.trend.slice(-6);
  const trendMax = Math.max(...trend.map((t) => t.flow_revenue + t.campaign_revenue), 1);
  const flows = report.flows.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  const change = report.previous ? salesChangePct(totals.revenue, report.previous.revenue) : null;
  return (
    <>
      <div className={s.kv}>
        <span className={s.num}>{money(totals.revenue)}</span>
        <span className={s.muted}>atribuidos por Klaviyo</span>
        <Delta change={change} />
      </div>
      <div className={s.split} aria-hidden="true">
        <i style={{ width: `${(totals.flow_revenue / total) * 100}%`, background: "var(--klaviyo)" }} />
        <i style={{ width: `${(totals.campaign_revenue / total) * 100}%`, background: "color-mix(in srgb, var(--klaviyo) 40%, white)" }} />
      </div>
      <div className={s.splitL}>
        <span>
          Flujos <span className={s.num}>{money(totals.flow_revenue)}</span>
        </span>
        <span>
          Campañas <span className={s.num}>{money(totals.campaign_revenue)}</span>
        </span>
      </div>
      {trend.length > 1 ? (
        <>
          <div className={s.trend} aria-label="Ingresos atribuidos por Klaviyo por mes">
            {trend.map((t) => (
              <div key={t.month} className={s.tcol} title={`${t.month}: flujos ${money(t.flow_revenue)}, campañas ${money(t.campaign_revenue)}`}>
                <i style={{ height: `${(t.campaign_revenue / trendMax) * 100}%`, background: "color-mix(in srgb, var(--klaviyo) 40%, white)" }} />
                <i style={{ height: `${(t.flow_revenue / trendMax) * 100}%`, background: "var(--klaviyo)" }} />
              </div>
            ))}
          </div>
          <div className={s.tlab}>
            {trend.map((t) => (
              <span key={t.month}>{MONTHS[Number(t.month.slice(5, 7)) - 1] ?? t.month}</span>
            ))}
          </div>
        </>
      ) : null}
      {flows.length ? (
        <div style={{ marginTop: 14 }}>
          {flows.map((flow) => (
            <div key={flow.id} className={s.flow}>
              <span>{flow.name}</span>
              <span className={s.num}>{money(flow.revenue)}</span>
              <span className={cx(s.num, s.muted)}>
                {flow.revenue_per_recipient !== null ? `${money(flow.revenue_per_recipient, 2)}/dest.` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function Attribution({ storeSales, meta, klaviyo, currencyCode }: { storeSales: number; meta: number | null; klaviyo: number | null; currencyCode: string | null }) {
  const money = (value: number) => fmtCurrency(value, currencyCode);
  const base = storeSales || 1;
  const rows = [
    { label: "Ventas de tu tienda", value: storeSales, color: "var(--ink)" },
    ...(meta !== null ? [{ label: "Meta se atribuye", value: meta, color: "var(--meta)" }] : []),
    ...(klaviyo !== null ? [{ label: "Klaviyo se atribuye", value: klaviyo, color: "var(--klaviyo)" }] : []),
  ];
  const both = meta !== null && klaviyo !== null;
  return (
    <div className={cx(s.panel, s.attr)}>
      <div>
        <h3>Cada plataforma cuenta su parte</h3>
        <p>
          Una misma compra puede aparecer en Meta y en Klaviyo a la vez, porque cada una usa su propia ventana de atribución. Por eso sus
          cifras no se suman. La única venta que no se repite es la de tu tienda.
        </p>
      </div>
      <BarRows
        ariaLabel="Ventas de la tienda frente a lo que se atribuye cada plataforma"
        max={base}
        rows={[
          ...rows.map((row) => ({
            key: row.label,
            label: row.label,
            value: row.value,
            display: money(row.value),
            share: `${Math.round((row.value / base) * 100)} %`,
            color: row.color,
          })),
          ...(both
            ? [
                {
                  key: "sum",
                  label: "Si las sumaras",
                  value: (meta ?? 0) + (klaviyo ?? 0),
                  display: money((meta ?? 0) + (klaviyo ?? 0)),
                  share: `${Math.round((((meta ?? 0) + (klaviyo ?? 0)) / base) * 100)} %`,
                  dashed: true,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

function GoalPanel({ monthly, revenueTarget, marginTarget, margin, currencyCode, today }: {
  monthly: Metrics["financial_monthly"];
  revenueTarget: number | null;
  marginTarget: number | null;
  margin: number | null;
  currencyCode: string | null;
  today: Date;
}) {
  const money = (value: number) => fmtCurrency(value, currencyCode);
  const currencySymbol = currencyCode ? (new Intl.NumberFormat("es-ES", { style: "currency", currency: currencyCode }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currencyCode) : "";
  const points = monthlyWithProjection(
    monthly.map((m) => ({ month: m.month, value: m.net_revenue_ex_tax })),
    today,
  );
  if (!points.length) {
    return (
      <div className={s.panel}>
        <Empty>Cuando haya meses completos de ventas, aquí verás tu evolución y hacia dónde vas.</Empty>
      </div>
    );
  }
  const year = today.getUTCFullYear();
  const byMonth = new Map(points.map((p) => [p.month, p]));
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const max = Math.max(...points.map((p) => p.value), revenueTarget ?? 0) * 1.12 || 1;
  const december = byMonth.get(`${year}-12`);
  const onTrack = revenueTarget !== null && december ? december.value >= revenueTarget : null;
  return (
    <div className={s.panel}>
      <div className={s.panelH}>
        <div>
          <h3>{revenueTarget !== null ? `Tu objetivo: ${money(revenueTarget)} al mes` : `Tus ingresos en ${year}`}</h3>
          <p className={s.sub}>Ingresos sin IVA por mes · proyección al ritmo de los últimos meses</p>
        </div>
        {onTrack !== null ? (
          <span className={cx(s.chip, onTrack ? s.chipGood : s.chipWarn)}>{onTrack ? "Vas al ritmo" : "Por debajo del ritmo"}</span>
        ) : null}
      </div>
      <div className={s.goal}>
        {months.map((key) => {
          const point = byMonth.get(key);
          const labelled = point && (point.kind === "current" || key === `${year}-12`);
          return (
            <div
              key={key}
              className={cx(s.gcol, point?.kind === "current" && s.gcolCur, point?.kind === "projection" && s.gcolProj)}
              title={point ? `${MONTHS[Number(key.slice(5)) - 1]}: ${money(point.value)}${point.kind === "projection" ? " (proyección)" : point.kind === "current" ? " (en curso)" : ""}` : undefined}
            >
              {labelled && point ? (
                <span className={s.gcolV} style={{ bottom: `calc(${(point.value / max) * 100}% + 5px)` }}>
                  {shortMoney(point.value, currencySymbol)}
                </span>
              ) : null}
              <i style={{ height: `${point ? (point.value / max) * 100 : 0}%` }} />
            </div>
          );
        })}
        {revenueTarget !== null ? (
          <div className={s.tline} style={{ bottom: `${(revenueTarget / max) * 100}%` }}>
            <span>objetivo {money(revenueTarget)}</span>
          </div>
        ) : null}
      </div>
      <div className={s.glab}>
        {MONTHS.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <div className={s.goalLeg}>
        <span>
          <i className={s.sw} style={{ background: "var(--ink)" }} />
          Mes en curso
        </span>
        <span>
          <i className={s.sw} style={{ background: "var(--ink-3)" }} />
          Meses cerrados
        </span>
        <span>
          <i className={s.sw} style={{ boxShadow: "inset 0 0 0 1.5px var(--accent-ink)", background: "var(--accent-soft)" }} />
          Proyección
        </span>
      </div>
      {marginTarget !== null && margin !== null ? (
        <div className={s.second}>
          <div className={s.secondT}>
            <span>Margen neto ≥ {fmtNum(marginTarget, 1)} %</span>
            <span className={s.num}>{fmtNum(margin, 1)} %</span>
          </div>
          <TargetBar value={margin} target={marginTarget} max={Math.max(marginTarget * 1.4, margin * 1.1, 1)} text="" />
        </div>
      ) : null}
    </div>
  );
}

function AgendaList({ agenda, error }: { agenda: Agenda | undefined; error: string | null }) {
  if (error && !agenda) return <p className={s.error}>No se pudo cargar la agenda.</p>;
  const entries = [
    ...(agenda?.planning_items ?? []).map((item) => ({
      id: item.id,
      at: item.starts_at,
      title: item.title,
      chips: [item.channel],
      status: PLANNING_STATUS[item.status] ?? item.status,
    })),
    ...(agenda?.milestones ?? []).map((milestone) => ({
      id: milestone.id,
      at: milestone.target_date,
      title: milestone.name,
      chips: ["Hito", ...(milestone.phase_name ? [milestone.phase_name] : [])],
      status: PLANNING_STATUS[milestone.status] ?? milestone.status,
    })),
  ]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(0, 6);
  if (!entries.length) return <Empty>No hay nada planificado para las próximas 4 semanas.</Empty>;
  return (
    <ul>
      {entries.map((entry) => {
        const d = new Date(entry.at.length === 10 ? `${entry.at}T12:00:00Z` : entry.at);
        return (
          <li key={entry.id} className={s.ev}>
            <div className={s.date}>
              <small>{WEEKDAYS[d.getUTCDay()]}</small>
              <b>{d.getUTCDate()}</b>
            </div>
            <div>
              <p className={s.evT}>{entry.title}</p>
              <div className={s.evM}>
                {entry.chips.map((chip) => (
                  <span key={chip} className={s.chip}>
                    {chip}
                  </span>
                ))}
                <span className={cx(s.chip, s.chipAcc)}>{entry.status}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function IntegrationsFooter({ payload }: { payload: IntegrationsPayload | undefined }) {
  const connected = (payload?.providers ?? []).filter((p) => p.connection && p.id !== "fathom");
  if (!connected.length) return null;
  const needsAction = connected.some((p) => !["connected", "syncing"].includes(p.connection?.status ?? ""));
  return (
    <footer className={s.integr} aria-label="Estado de las integraciones">
      {connected.map((provider) => {
        const ok = ["connected", "syncing"].includes(provider.connection?.status ?? "");
        return (
          <span key={provider.id}>
            <span className={cx(s.dot, !ok && s.dotWarn)} />
            <b>{provider.name}</b>
            {ok ? ago(provider.connection?.last_sync_at ?? null) : "necesita reconectarse"}
          </span>
        );
      })}
      {needsAction ? (
        <a className={cx(s.btn, s.ghost, s.sm)} href="/integraciones">
          Revisar integraciones
        </a>
      ) : null}
    </footer>
  );
}
