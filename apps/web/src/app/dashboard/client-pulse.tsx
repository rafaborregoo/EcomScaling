"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import { MetricVerdict, useMetricAnalysis } from "@/components/metric-verdict";
import { ZoneNoteMark, zoneAnchor } from "@/components/zone-notes";
import { useCopilotAsk } from "@/components/copilot-ask";
import { useRouter } from "next/navigation";
import { ArchiveIcon, CheckIcon, CloseIcon, MessageIcon, PlusIcon, Skeleton, toast } from "@/components/ui";
import type { AssignedConsultant } from "@/hooks/use-assigned-consultant";
import { canShowProfit, salesChangePct, storePulse } from "./store-pulse";
import {
  changeText,
  clientReadable,
  fmtCurrency,
  fmtEur,
  fmtNum,
  MIN_NEW_CUSTOMERS_FOR_CAC,
  monthlyWithProjection,
  pickFinding,
  type PulseFinancial,
} from "./client-pulse-model";
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
    connection: { status: string; last_sync_at: string | null } | null;
  }>;
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
        <button type="button" className={cx(s.btn, s.ghost, s.sm)} onClick={onAsk}>
          Preguntar
        </button>
      ) : null}
    </div>
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
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const consultantName = asConsultant ? "Cliente" : consultant?.full_name?.split(" ")[0] ?? "Tu consultor";

  const items = useMemo<QueueItem[]>(() => {
    const list: QueueItem[] = [];
    for (const diagnostic of proposals) {
      if (diagnostic.output_status !== "pending_approval" || sentOutputs.includes(diagnostic.output_id)) continue;
      const writes = diagnostic.output.proposed_writes;
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
    // Las propuestas de IA esperan una decision humana: van primero, si no quedan tapadas por tareas urgentes.
    // A igual prioridad, lo que vence antes (lo vencido el primero).
    const dueOf = (i: QueueItem) => (i.kind === "task" && i.task.due_at ? Date.parse(i.task.due_at) : Infinity);
    const awaitsDecision = (i: QueueItem) => i.kind === "proposal" || (i.kind === "task" && i.task.status === "proposed");
    return list.sort(
      (a, b) =>
        Number(awaitsDecision(b)) - Number(awaitsDecision(a)) ||
        (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2) ||
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
  const visible = showAll ? filtered : filtered.slice(0, QUEUE_PREVIEW);
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

  return (
    <div className={cx(s.panel, "zone-card")}>
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
        {usefulFilters.length > 1 ? (
        <div className={s.seg} role="group" aria-label="Filtrar trabajo pendiente">
          {usefulFilters.map((f) => (
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
                <li key={item.key} className={cx(s.qi, s.qiProposal, "hover-sweep")}>
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
                      <button type="button" className={cx(s.btn, s.ghost, s.sm, s.iconBtn, s.iconOk)} aria-label="Crear tarea" title="Crear tarea" disabled={busy !== null} onClick={() => void decide(item, "approved")}>
                        <CheckIcon aria-hidden="true" />
                      </button>
                      <button type="button" className={cx(s.btn, s.ghost, s.sm, s.iconBtn, s.iconNo)} aria-label="Descartar" title="Descartar" disabled={busy !== null} onClick={() => void decide(item, "rejected")}>
                        <CloseIcon aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </li>
              );
            }
            if (item.kind === "alert") {
              return (
                <li key={item.key} className={cx(s.qi, "hover-sweep")}>
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
            // Vencida = su fecha ya pasó (comparando días, no horas).
            const overdue = Boolean(task.due_at && Date.parse(task.due_at.slice(0, 10)) < Date.parse(new Date(now).toISOString().slice(0, 10)));
            const rank = PRIORITY_RANK[item.priority] ?? 2;
            const proposed = task.status === "proposed";
            return (
              <li key={item.key} className={cx(s.qi, proposed && s.qiProposal, "hover-sweep")}>
                <span className={cx(s.pr, prioClass(item.priority))} aria-hidden="true" />
                <div>
                  {proposed ? (
                    <p className={s.qiK}>
                      {asConsultant ? "Propuesta tuya · esperando al cliente" : `Propuesta de ${consultantName} · acéptala o recházala`}
                    </p>
                  ) : null}
                  <p className={s.qiT}>{task.title}</p>
                  <div className={s.qiM}>
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
                    {item.mine ? null : who(false, task.assignee_name)}
                    {task.status === "in_progress" ? <span className={cx(s.chip, s.chipAcc)}>En curso</span> : null}
                    {asConsultant && task.is_visible_to_client === false ? <span className={s.chip}>Interna · el cliente no la ve</span> : null}
                    {item.mine && !asConsultant && task.status === "pending" ? (
                      <button type="button" className={s.linkBtn} disabled={busy === task.id} onClick={() => void setStatus(task, "in_progress")}>
                        Empezar
                      </button>
                    ) : null}
                  </div>
                  {task.description ? <TaskDetail text={task.description} label="Ver pasos" /> : null}
                  {(() => {
                    const notes = (task.task_comments ?? []).filter((c) => !c.is_internal && !c.body.startsWith("Resultado:"));
                    if (!notes.length) return null;
                    const open = openComments === task.id;
                    return (
                      <>
                        <button
                          type="button"
                          className={s.cmtBadge}
                          aria-expanded={open}
                          onClick={() => setOpenComments(open ? null : task.id)}
                        >
                          {notes.length === 1 ? "Comentario" : "Comentarios"} ({notes.length})
                        </button>
                        {open ? (
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
                      </>
                    );
                  })()}
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
                          <button type="button" className={s.cmtCancel} onClick={() => setCommenting(null)}>
                            Cancelar
                          </button>
                          <button type="submit" className={s.cmtSend} disabled={!commentText.trim() || busy === task.id}>
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
                  {proposed && !asConsultant ? (
                  <>
                    <button type="button" className={cx(s.btn, s.ghost, s.sm, s.iconBtn, s.iconOk)} aria-label="Aceptar tarea" title="Aceptar tarea" disabled={busy === task.id} onClick={() => void setStatus(task, "pending")}>
                      <CheckIcon aria-hidden="true" />
                    </button>
                    <button type="button" className={cx(s.btn, s.ghost, s.sm, s.iconBtn, s.iconNo)} aria-label="Rechazar tarea" title="Rechazar tarea" disabled={busy === task.id} onClick={() => void setStatus(task, "ignored")}>
                      <CloseIcon aria-hidden="true" />
                    </button>
                  </>
                  ) : proposed ? null : item.mine && !asConsultant ? (
                  <>
                    <button type="button" className={cx(s.btn, s.ghost, s.sm, s.iconBtn, s.iconOk)} aria-label="Marcar como hecha" title="Marcar como hecha" disabled={busy === task.id} onClick={() => { setClosing(task.id); setOutcome(""); }}>
                      <CheckIcon aria-hidden="true" />
                    </button>
                    <button type="button" className={cx(s.btn, s.ghost, s.sm, s.iconBtn)} aria-label="Archivar: ya no me interesa" title="Archivar: ya no me interesa" disabled={busy === task.id} onClick={() => void setStatus(task, "ignored")}>
                      <ArchiveIcon aria-hidden="true" />
                    </button>
                  </>
                  ) : null}
                  {consultant || asConsultant ? (
                    <button
                      type="button"
                      className={cx(s.btn, s.ghost, s.sm, s.iconBtn, s.cmtBtn)}
                      aria-label="Añadir comentario a la tarea"
                      title="Añadir comentario"
                      onClick={() => { setCommenting(commenting === task.id ? null : task.id); setCommentText(""); }}
                    >
                      <MessageIcon aria-hidden="true" />
                      <PlusIcon aria-hidden="true" className={s.cmtPlus} />
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

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

export function ClientPulse({ userId, organizationId, organizationName, connectionId, consultant, asConsultant = false, extraProposals = [], onReload, extraKpis, sideTop }: {
  userId: string;
  organizationId: string;
  organizationName: string;
  connectionId: string | null;
  consultant: AssignedConsultant;
  /** La misma portada vista por el consultor asignado: mismas cifras y lista, con sus textos y sus agentes. */
  asConsultant?: boolean;
  /** Propuestas de agentes que solo ve el consultor (planes semanal y mensual). */
  extraProposals?: Diagnostic[];
  onReload?: () => void;
  /** Cifras de más que solo necesita el consultor, al final de la fila de KPIs. */
  extraKpis?: ReactNode;
  /** Tarjetas propias del consultor, arriba de la columna derecha. */
  sideTop?: ReactNode;
}) {
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const verdictOf = useMetricAnalysis(organizationId, 30, connectionId);

  const metrics = useCachedQuery<Metrics>(`${base}/shopify/metrics?days=30${scope}`);
  const meta = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=30`);
  const klaviyo = useCachedQuery<KlaviyoReport>(`${base}/klaviyo/email-report?days=30`);
  const operations = useCachedQuery<Operations>(`${base}/operations`);
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30&view=overview${scope}`);
  const stockAi = useCachedQuery<Diagnostic>(`${base}/ai/stock-planner?days=30${scope}`);
  // A04: el plan diario propone tareas; sin esto sus propuestas nunca llegaban al widget.
  const plannerAi = useCachedQuery<Diagnostic>(`${base}/ai/task-planner?days=30${scope}`);
  // Con una tienda elegida, el plan de toda la cuenta también trae propuestas: sin él,
  // cliente y consultor veían listas distintas según la tienda que tuviera cada uno.
  const plannerOrgAi = useCachedQuery<Diagnostic>(scope ? `${base}/ai/task-planner?days=30` : null);
  // Sin consultor, el análisis de email es parte del acompañamiento; con
  // consultor lo filtra él.
  const emailAi = useCachedQuery<Diagnostic>(consultant && !asConsultant ? null : `${base}/ai/email-analyst?days=30${scope}`);
  const integrations = useCachedQuery<IntegrationsPayload>(`${base}/integrations`);

  const ask = useCopilotAsk();
  const router = useRouter();
  const [today] = useState(() => new Date());

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
  const storeSelectionRequired = metrics.error?.includes("shopify_store_selection_required") ?? false;
  const financialCurrencyComparable = data?.financial_currency_coverage?.status === "compatible";
  const klaviyoCurrencyComparable = data?.financial_currency_coverage?.klaviyo_status === "compatible";
  const diagnostic = !storeSelectionRequired ? monitor.data : undefined;

  if (metrics.isLoading && !data) {
    return (
      <div className={cx(s.root, s.prio)} role="status" aria-busy="true">
        <header className={s.pHead}>
          <p className={s.pMeta}>{organizationName}</p>
          <p className={s.pTitle}>Cargando {yourStore}…</p>
        </header>
        <Skeleton className="h-24 w-full" aria-hidden="true" />
        <Skeleton className="h-64 w-full" aria-hidden="true" />
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
  // La frase de la IA es el titular; si trae jerga de sistema, la de `storePulse`.
  const headline = clientReadable(diagnostic?.output.headline ?? diagnostic?.output.answer) ?? pulse.headline;
  const daily = data?.daily ?? [];
  const target = (key: string) => data?.metric_targets.find((t) => t.metric_key === key)?.target_value ?? null;

  const proposals = [diagnostic, plannerAi.data, plannerOrgAi.data, stockAi.data, emailAi.data, ...extraProposals]
    .filter((d): d is Diagnostic => Boolean(d))
    .filter((d, i, all) => all.findIndex((o) => o.output_id === d.output_id) === i);
  const analysisDate = diagnostic
    ? new Date(diagnostic.generated_at).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
    : null;

  // Sin un mínimo de clientes nuevos el CAC no es una media sino una anécdota.
  const cacReliable = (financial?.new_customers ?? MIN_NEW_CUSTOMERS_FOR_CAC) >= MIN_NEW_CUSTOMERS_FOR_CAC;
  const showCac = financialCurrencyComparable && financial?.cac_blended != null && cacReliable;

  // Fuentes caídas o con más de un día sin sincronizar: las cifras pueden no estar al día.
  const staleSources = (integrations.data?.providers ?? []).filter(
    (p) =>
      p.connection &&
      p.id !== "fathom" &&
      (!["connected", "syncing"].includes(p.connection.status) ||
        !p.connection.last_sync_at ||
        today.getTime() - Date.parse(p.connection.last_sync_at) > DAY_MS),
  );

  const revenueTarget = financialCurrencyComparable ? target("net_revenue_ex_tax") : null;
  const december = revenueTarget !== null && data
    ? monthlyWithProjection(data.financial_monthly.map((m) => ({ month: m.month, value: m.net_revenue_ex_tax })), today)
        .find((p) => p.month === `${today.getUTCFullYear()}-12`)
    : undefined;

  const metaAcq = meta.data?.acquisition;
  const hasMeta = Boolean(metaAcq && metaAcq.days_with_data > 0);
  const hasKlaviyo = Boolean(klaviyo.data?.connected && klaviyo.data.totals);

  // Lo que hay que vigilar fuera de las tareas: una línea y un enlace a donde se resuelve.
  type Signal = { key: string; tone: "bad" | "warn"; text: string; href: string; action: string };
  const signals: Signal[] = [];
  if (data && data.stock.out_of_stock_items + data.stock.low_stock_items > 0) {
    signals.push({
      key: "stock",
      tone: data.stock.out_of_stock_items > 0 ? "bad" : "warn",
      text: [
        data.stock.out_of_stock_items ? `${fmtNum(data.stock.out_of_stock_items)} agotados` : null,
        data.stock.low_stock_items ? `${fmtNum(data.stock.low_stock_items)} con stock bajo` : null,
      ].filter(Boolean).join(" · "),
      href: "/dashboard?tab=shopify",
      action: "Ver stock",
    });
  }
  if (data && !financialCurrencyComparable) {
    signals.push({ key: "currency", tone: "warn", text: "Rentabilidad pendiente de validar la moneda", href: "/configuracion?section=rentabilidad", action: "Revisar" });
  } else if (financial && !showProfit) {
    signals.push({
      key: "profit",
      tone: "warn",
      text: data?.margin.lines_without_metrics
        ? "Beneficio sin calcular: faltan líneas de pedido por sincronizar"
        : financial.has_settings
        ? `Beneficio sin calcular: faltan costes de ${fmtNum(financial.items_without_cost)} producto(s)`
        : "Beneficio sin calcular: faltan costes y gastos",
      href: financial.has_settings ? "/dashboard?tab=shopify" : "/configuracion?section=rentabilidad",
      action: "Completar",
    });
  }
  if (revenueTarget !== null && december && december.value < revenueTarget) {
    signals.push({ key: "goal", tone: "warn", text: `Por debajo del ritmo para ${formatStoreMoney(revenueTarget)} al mes`, href: "/informes", action: "Ver informe" });
  }

  const channels = [
    {
      key: "shopify",
      name: "Tienda online",
      color: "var(--store)",
      href: "/dashboard?tab=shopify",
      value: data?.funnel?.has_sessions ? `${fmtNum(data.funnel.sessions)} sesiones` : `${fmtNum(data?.sales.orders_count ?? 0)} pedidos`,
      detail: `Ticket medio ${formatStoreMoney(data?.sales.aov ?? 0, 2)}`,
    },
    {
      key: "meta",
      name: "Meta Ads",
      color: "var(--meta)",
      href: hasMeta ? "/dashboard?tab=meta" : "/integraciones/meta",
      value: hasMeta && metaAcq && financialCurrencyComparable && metaAcq.roas != null ? `ROAS ${fmtNum(metaAcq.roas, 2)}×` : hasMeta ? "Conectado" : "Sin conectar",
      detail: hasMeta && metaAcq && financialCurrencyComparable ? `${formatStoreMoney(metaAcq.spend)} invertidos · atribuido por Meta` : hasMeta ? "Importes pendientes de validar la moneda" : "Conecta tu cuenta publicitaria",
    },
    {
      key: "klaviyo",
      name: "Klaviyo",
      color: "var(--klaviyo)",
      href: hasKlaviyo ? "/dashboard?tab=klaviyo" : "/integraciones/klaviyo",
      value: hasKlaviyo && klaviyo.data && klaviyoCurrencyComparable ? formatStoreMoney(klaviyo.data.totals.revenue) : hasKlaviyo ? "Conectado" : "Sin conectar",
      detail: hasKlaviyo && klaviyoCurrencyComparable ? "Atribuidos por Klaviyo" : hasKlaviyo ? "Importes pendientes de validar la moneda" : "Conecta tu email",
    },
  ];

  return (
    <div className={cx(s.root, s.prio)}>
      {/* ------------------------------ Titular ------------------------------ */}
      <header className={s.pHead}>
        <p className={s.pMeta}>
          <span>{organizationName}</span>
          <span>{today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}</span>
          <span>Últimos 30 días</span>
        </p>
        <h1 id="pulse-headline" className={s.pTitle}>
          {headline}
        </h1>
        <div className={s.pHeadFoot}>
          {analysisDate ? (
            <span className={s.pStamp}>
              <span className={s.ia}>IA</span>
              Análisis del {analysisDate}
            </span>
          ) : null}
          <button
            type="button"
            className={cx(s.pAction, "hover-sweep")}
            onClick={() =>
              askCopilot(
                asConsultant
                  ? `Explícame esto sobre ${yourStore}: «${headline}». ¿Por qué pasa y qué harías primero como su consultor?`
                  : `Explícame esto sobre mi tienda: «${headline}». ¿Por qué pasa y qué harías primero?`,
                asConsultant ? `Resumen de ${organizationName}` : "Resumen de tu tienda",
              )
            }
          >
            <span className={s.ia}>IA</span>
            Preguntar por qué
          </button>
        </div>
      </header>

      {metrics.error && !data ? (
        <p className={s.error} role="alert">
          {storeSelectionRequired
            ? "Hay varias tiendas conectadas. Selecciona una en la cabecera para ver sus datos sin mezclarlas."
            : `No hemos podido cargar los datos de ${yourStore}. Revisa que Shopify esté conectado en Integraciones.`}
        </p>
      ) : null}

      {staleSources.length ? (
        <p className={s.pNotice} role="status">
          <span className={cx(s.dot, s.dotWarn)} aria-hidden="true" />
          {staleSources.map((p) => p.name).join(" y ")}{" "}
          {staleSources.every((p) => ["connected", "syncing"].includes(p.connection?.status ?? ""))
            ? `sin sincronizar ${ago(staleSources[0].connection?.last_sync_at ?? null)}: las cifras pueden no estar al día.`
            : "necesita reconectarse."}
          <a href="/integraciones" className="hover-sweep">Revisar</a>
        </p>
      ) : null}

      {/* ------------------------------ Cifras ------------------------------ */}
      {data ? (
        <div className={s.pKpis} aria-label="Cifras clave" id={showCac ? undefined : "insight-metric-cac_new"}>
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
            label="Beneficio neto"
            value={showProfit && financial ? formatStoreMoney(financial.net_profit) : "—"}
            delta={showProfit && financial && previous?.financial.lines_without_metrics === 0 ? <Delta change={salesChangePct(financial.net_profit, previous.financial.net_profit)} /> : null}
            vs={showProfit && previous?.financial.lines_without_metrics === 0 ? formatStoreMoney(previous.financial.net_profit) : null}
            slot={
              showProfit && financial ? (
                <TargetBar
                  value={financial.net_margin_pct}
                  target={target("net_margin_pct") ?? financial.net_margin_pct}
                  max={Math.max(40, (target("net_margin_pct") ?? 0) * 1.4)}
                  text={`Margen ${fmtNum(financial.net_margin_pct, 1)} %${target("net_margin_pct") !== null ? ` · objetivo ${fmtNum(target("net_margin_pct") ?? 0, 1)} %` : ""}`}
                />
              ) : (
                <p className={s.trackTxt}>Pendiente de completar costes</p>
              )
            }
          />
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
              data.funnel?.has_sessions ? (
                <Spark values={data.funnel_daily.map((d) => d.conversion_rate_own ?? 0)} />
              ) : (
                <p className={s.trackTxt}>Sin datos de sesiones todavía</p>
              )
            }
          />
          {showCac && financial?.cac_blended != null ? (
            <Kpi
              verdict={<MetricVerdict analysis={verdictOf("cac_new")} />}
              anchorId="insight-metric-cac_new"
              label="CAC combinado"
              value={formatStoreMoney(financial.cac_blended, 2)}
              slot={<p className={s.trackTxt}>Publicidad entre clientes nuevos</p>}
            />
          ) : null}
          {extraKpis}
        </div>
      ) : null}

      {/* ------------------------------ Prioridades ------------------------------ */}
      <div className={s.pGrid}>
        <section aria-labelledby="pulse-hoy" className={s.pMain}>
          {operations.error && !operations.data ? (
            <p className={s.error}>No se pudieron cargar las tareas: {operations.error}</p>
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

        <aside className={s.pSide} aria-label="Vigilar y canales">
          {sideTop}
          {signals.length ? (
            <section className={cx(s.pBlock, "zone-card")} aria-labelledby="pulse-vigilar">
              <h2 id="pulse-vigilar" className={s.pBlockT}>
                Vigilar <ZoneNoteMark anchor="bloque:vigilar" label="Vigilar" />
              </h2>
              <ul className={s.pList}>
                {signals.map((signal) => (
                  <li key={signal.key}>
                    <a className={cx(s.pRow, "hover-sweep")} href={signal.href}>
                      <span className={cx(s.dot, signal.tone === "bad" ? s.dotBad : s.dotWarn)} aria-hidden="true" />
                      <span className={s.pRowT}>{signal.text}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data ? (
            <section className={cx(s.pBlock, "zone-card")} aria-labelledby="pulse-canales">
              <h2 id="pulse-canales" className={s.pBlockT}>
                Canales <ZoneNoteMark anchor="bloque:canales" label="Canales" />
              </h2>
              <ul className={s.pList}>
                {channels.map((channel) => (
                  <li key={channel.key}>
                    <a className={cx(s.pRow, "hover-sweep")} href={channel.href}>
                      <span className={s.dot} style={{ background: channel.color }} aria-hidden="true" />
                      <span className={s.pRowT}>
                        {channel.name}
                        <small>{channel.detail}</small>
                      </span>
                      <span className={cx(s.pRowV, s.num)}>{channel.value}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className={s.pFoot}>Cada plataforma cuenta su parte; sus cifras no se suman.</p>
            </section>
          ) : null}

          <section className={s.pBlock} aria-label={asConsultant ? "Tu cliente" : consultant ? "Tu consultor" : "Tu copiloto"}>
            {asConsultant ? (
              <a className={cx(s.pRow, "hover-sweep")} href="/mensajes">
                <span className={s.pAvatar} aria-hidden="true">
                  {organizationName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className={s.pRowT}>
                  {organizationName}
                  <small>Hablar con el cliente</small>
                </span>
              </a>
            ) : consultant ? (
              <a className={cx(s.pRow, "hover-sweep")} href="/mensajes">
                <span className={s.pAvatar} aria-hidden="true">
                  {(consultant.full_name ?? "C").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className={s.pRowT}>
                  {consultant.full_name ?? "Tu consultor"}
                  <small>Tu consultor en E-NORA</small>
                </span>
              </a>
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
    <div id={anchorId} className={cx(s.kpi, "zone-card")} role="group" aria-label={label}>
      {/* div y no p: `verdict` es un Popover con botón y capa, que dentro de un <p> rompe la hidratación. */}
      <div className={s.kpiL}>
        {verdict}
        {label}
        <ZoneNoteMark anchor={zoneAnchor("kpi", label)} label={label} />
        {tag ? <span className={cx(s.chip, s.chipWarn)}>{tag}</span> : null}
      </div>
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
