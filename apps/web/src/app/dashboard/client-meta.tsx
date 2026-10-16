"use client";

import { useMemo, useState, type ReactNode } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { MetricVerdict, useMetricAnalysis } from "@/components/metric-verdict";
import { useCopilotAsk } from "@/components/copilot-ask";
import type { AssignedConsultant } from "@/hooks/use-assigned-consultant";
import { Skeleton, toast } from "@/components/ui";
import { DIMENSION_LABEL, ENTITY_LABEL, RANKING_PRESENTATION, ROAS_SHIFT_PCT } from "../meta/insights-sections";
import { groupRankingRowsByDimensionCurrency } from "../meta/creative-currency";
import { fmtEur, fmtNum } from "./client-pulse-model";
import {
  cx,
  Empty,
  findingFor,
  Kpi,
  SalesChart,
  SectionHead,
  TargetBar,
  WorkQueue,
  dayLabel,
  type Diagnostic,
  type Operations,
  type Pin,
} from "./client-pulse";
import s from "./client-pulse.module.css";
import { DashboardSections } from "./dashboard-sections";
import { metaAttributionLabel } from "./dashboard-labels";

/**
 * Pestaña Meta Ads del panel del cliente.
 *
 * Todo lo que aquí es "compras" o "ingresos" es lo que Meta se atribuye con
 * su ventana, no ventas de la tienda (ADR-0021): por eso cada cifra lo dice y
 * el ROAS se juzga contra el ROAS de equilibrio que sale de los costes reales
 * de la tienda, no contra un número de manual.
 *
 * Lo que sí son hechos (gasto, impresiones, clics, CPM, CPC) va sin matiz.
 */

type Period = number | "all";
const PERIODS: Period[] = [7, 30, 90];

const periodButton = (p: Period) => (p === "all" ? "Todo" : p === 180 ? "6 meses" : p === 365 ? "1 año" : `${p} días`);
const periodPhrase = (p: Period) => (p === "all" ? "todo el histórico" : `los últimos ${p} días`);

type AdFilter = "all" | "good" | "bad" | "low";

function formatMetaAmount(value: number | null | undefined, currency: string | null) {
  if (value == null) return "—";
  if (!currency) return `${fmtNum(value)} · moneda desconocida`;
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${fmtNum(value)} ${currency}`;
  }
}

type Creative = {
  ad_id: string;
  ad_name: string;
  ad_set_name: string;
  campaign_name: string;
  effective_status: string | null;
  spend: number;
  spend_currency: string | null;
  impressions: number;
  outbound_ctr: number | null;
  hook_rate: number | null;
  hold_rate: number | null;
  quality_ranking: string | null;
  engagement_rate_ranking: string | null;
  conversion_rate_ranking: string | null;
  purchases: number;
  roas: number | null;
  cost_per_purchase: number | null;
  purchase_attribution_window: string | null;
  has_video: boolean;
  enough_volume: boolean;
};

type MetaInsights = {
  currency: string | null;
  min_impressions_for_rates: number;
  change_window_days: number;
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    purchase_value: number;
    roas: number | null;
    cac: number | null;
    cpm: number | null;
    cpc: number | null;
    days_with_data: number;
    purchase_action_types: string[];
  } | null;
  daily_spend: Array<{ bucket_date: string; spend: number }>;
  daily_roas: Array<{ bucket_date: string; roas: number | null }>;
  creatives: Creative[];
  ranking_distribution: Array<{ dimension: string; ranking_value: string; ads: number; spend: number | null; spend_share: number | null; currency_code: string | null }>;
  learning: Array<{
    ad_set_id: string;
    ad_set_name: string;
    campaign_name: string;
    learning_stage_status: string | null;
    learning_conversions: number | null;
    learning_conversions_needed: number | null;
    conversions_missing: number | null;
    daily_budget: number | null;
    days_since_account_activity: number | null;
    last_account_activity_description: string | null;
  }>;
  pixels: Array<{
    pixel_id: string;
    pixel_name: string | null;
    is_unavailable: boolean | null;
    hours_since_last_fire: number | null;
    event_name: string | null;
    events_total: number;
    days_with_events: number;
    days_in_period: number;
    days_missing: number;
  }>;
  audiences: Array<{
    audience_id: string;
    audience_name: string | null;
    subtype: string | null;
    approximate_count_lower: number | null;
    approximate_count_upper: number | null;
    retention_days: number | null;
    is_lookalike: boolean;
    lookalike_ratio: number | null;
    lookalike_country: string | null;
    origin_name: string | null;
    delivery_status_description: string | null;
    ad_sets_using: number;
  }>;
  changes: Array<{
    event_time: string;
    event_type: string;
    translated_event_type: string | null;
    object_name: string | null;
    entity_level: string;
    spend_before: number;
    spend_after: number;
    roas_before: number | null;
    roas_after: number | null;
    cpa_before: number | null;
    cpa_after: number | null;
    roas_delta_pct: number | null;
  }>;
  unavailable: string[];
};

type MetaMetrics = {
  campaigns: Array<{ campaign_id: string; campaign_name: string | null; spend: number | string | null; purchases: number | string | null; roas: number | string | null }>;
};

type ShopifyFinance = { financial: { breakeven_roas: number | null; mbee: number; has_settings: boolean; items_without_cost: number } };

const pct = (ratio: number | null | undefined, digits = 1) => (ratio == null ? "—" : `${fmtNum(ratio * 100, digits)} %`);
const roasText = (v: number | null | undefined) => (v == null ? "—" : `${fmtNum(v, 2)}×`);

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  CAMPAIGN_PAUSED: "Campaña pausada",
  ADSET_PAUSED: "Conjunto pausado",
  DELETED: "Borrado",
  ARCHIVED: "Archivado",
  WITH_ISSUES: "Con problemas",
  DISAPPROVED: "Rechazado",
  PENDING_REVIEW: "En revisión",
};

function rankingChip(value: string | null) {
  const presentation = RANKING_PRESENTATION[value ?? "SIN_VEREDICTO"] ?? RANKING_PRESENTATION.SIN_VEREDICTO;
  const tone = presentation.tone === "success" ? s.chipGood : presentation.tone === "warn" ? s.chipWarn : presentation.tone === "danger" ? s.chipBad : undefined;
  return <span className={cx(s.chip, tone)}>{presentation.label}</span>;
}

function RoasBar({ roas, breakeven, scale }: { roas: number | null; breakeven: number | null; scale: number }) {
  return (
    <span className={s.roas}>
      <span className={s.roasBar} title={breakeven ? `La línea roja marca tu ROAS de equilibrio (${fmtNum(breakeven, 2)}×)` : undefined}>
        <i style={{ width: `${Math.min((roas ?? 0) / scale, 1) * 100}%` }} />
        {breakeven ? <b style={{ left: `${Math.min(breakeven / scale, 1) * 100}%` }} /> : null}
      </span>
      <span className={s.num}>{roasText(roas)}</span>
    </span>
  );
}

export function ClientMeta({ organizationId, organizationName, connectionId, userId, asConsultant = false, consultant = null, days: daysProp, onDaysChange, periods = PERIODS, afterHero, hideFullLink = false }: {
  organizationId: string;
  organizationName: string;
  connectionId: string | null;
  userId: string;
  asConsultant?: boolean;
  consultant?: AssignedConsultant;
  /** Periodo controlado desde fuera (/meta lo comparte con otros bloques). */
  days?: Period;
  onDaysChange?: (days: Period) => void;
  periods?: Period[];
  /** Bloque entre el hero y las cifras (en /meta: fiabilidad de las cifras y navegación). */
  afterHero?: ReactNode;
  hideFullLink?: boolean;
}) {
  const [localDays, setLocalDays] = useState<Period>(30);
  const days = daysProp ?? localDays;
  const setDays = (next: Period) => {
    setLocalDays(next);
    onDaysChange?.(next);
  };
  const [adFilter, setAdFilter] = useState<AdFilter>("all");
  const [activePin, setActivePin] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [monitorRunning, setMonitorRunning] = useState(false);
  const ask = useCopilotAsk();
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const verdictOf = useMetricAnalysis(organizationId, days, connectionId);

  const insights = useCachedQuery<MetaInsights>(`${base}/meta/insights?days=${days}${scope}`);
  const metrics = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=${days}`);
  const shop = useCachedQuery<ShopifyFinance>(`${base}/shopify/metrics?days=${days}${scope}`);
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30&view=meta${scope}`);
  // "Operativa de Meta Ads" es consultantOnly (ver dashboard-ai-agents.ts): sin
  // consultor mirando esta pestaña, no hay nadie que la pida.
  const operativaMeta = useCachedQuery<Diagnostic>(asConsultant ? `${base}/ai/operativa-meta?days=30${scope}` : null);
  const operations = useCachedQuery<Operations>(`${base}/operations`);

  const data = insights.data;
  const askCopilot = (question: string, focusLabel: string) => ask({ question: `${question} (Meta Ads, ${periodPhrase(days)})`, focusLabel, reference: { period_label: periodPhrase(days), filters: { days: String(days) } } });
  const proposals = [operativaMeta.data].filter((d): d is Diagnostic => Boolean(d));

  async function runOperativaMeta() {
    setRunning(true);
    try {
      const response = await apiFetch(`${base}/ai/operativa-meta-run?days=30${scope}`, { method: "POST" });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Operativa de Meta Ads actualizada.");
      operativaMeta.reload();
    } catch {
      toast.danger("No se pudo lanzar el análisis por un error de red.");
    } finally {
      setRunning(false);
    }
  }

  async function runMonitorMeta() {
    setMonitorRunning(true);
    try {
      const response = await apiFetch(`${base}/ai/monitor-run?days=30${scope}&view=meta`, { method: "POST" });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Lectura A02 de Meta Ads actualizada.");
      monitor.reload();
    } catch {
      toast.danger("No se pudo lanzar el análisis de Meta por un error de red.");
    } finally {
      setMonitorRunning(false);
    }
  }

  // Los cambios en la cuenta son las chinchetas de esta curva: lo que alguien
  // tocó y el día en que lo tocó.
  const points = useMemo(() => {
    const roasByDate = new Map((data?.daily_roas ?? []).map((r) => [r.bucket_date, r.roas]));
    return (data?.daily_spend ?? []).map((d) => {
      const roas = roasByDate.get(d.bucket_date);
      return { date: d.bucket_date, value: d.spend, detail: roas != null ? `ROAS ${fmtNum(roas, 2)}×` : undefined };
    });
  }, [data]);
  const pins = useMemo<Pin[]>(() => {
    const index = new Map(points.map((p, i) => [p.date.slice(0, 10), i]));
    return (data?.changes ?? [])
      .map((c) => ({ change: c, i: index.get(c.event_time.slice(0, 10)) }))
      .filter((row): row is { change: MetaInsights["changes"][number]; i: number } => row.i !== undefined)
      .sort((a, b) => a.i - b.i)
      .slice(-4)
      .map(({ change, i }) => ({
        index: i,
        date: points[i].date,
        source: ENTITY_LABEL[change.entity_level] ?? change.entity_level,
        title: `${change.translated_event_type ?? change.event_type}${change.object_name ? ` · ${change.object_name}` : ""}${
          change.roas_before != null && change.roas_after != null ? `. ROAS ${roasText(change.roas_before)} → ${roasText(change.roas_after)}` : ""
        }`,
      }));
  }, [data, points]);

  if (insights.isLoading && !data) {
    return (
      <div className={s.root}>
        <div className={s.hero} role="status" aria-busy="true">
          <p className={s.heroMeta}>{organizationName} · Meta Ads</p>
          <p className={s.headline}>Cargando tus anuncios…</p>
          <Skeleton className="h-32 w-full" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  if (!data || !summary || summary.days_with_data === 0) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <p className={s.heroMeta}>{organizationName} · Meta Ads</p>
          <h1 className={s.headline}>{insights.error && !data ? "No hemos podido cargar Meta Ads" : "Meta Ads todavía no tiene datos"}</h1>
          <p className={s.headlineDetail}>
            {asConsultant
              ? "Las integraciones de este cliente solo se consultan desde su propia organización."
              : "Conecta tu cuenta publicitaria para ver inversión, ROAS y compras atribuidas. Si ya la conectaste, la primera sincronización puede tardar unos minutos."}
          </p>
          {!asConsultant ? (
            <div className={s.heroActions}>
              <a className={cx(s.btn, s.acc)} href="/integraciones/meta">
                {insights.error ? "Revisar conexión de Meta Ads" : "Conectar Meta Ads"}
              </a>
            </div>
          ) : null}
          {insights.error ? <div className={s.heroActions}><button type="button" className={cx(s.btn, s.ghost)} onClick={insights.reload}>Reintentar la carga</button></div> : null}
        </div>
      </div>
    );
  }

  // ---- derivados ----
  const diagnostic = monitor.data;
  const finance = shop.data?.financial;
  const breakeven = finance?.has_settings && finance.items_without_cost === 0 ? finance.breakeven_roas : null;
  const mbee = finance?.has_settings && finance.items_without_cost === 0 && finance.mbee > 0 ? finance.mbee : null;
  const metaAi = findingFor(diagnostic, /meta|anunc|ads|paid|adquis|campa/i);
  const headline =
    metaAi?.title ??
    `Has invertido ${fmtEur(summary.spend)} en Meta y Meta se atribuye ${fmtEur(summary.purchase_value)} en ventas (ROAS ${roasText(summary.roas)}).`;
  const attributionWindow = metaAttributionLabel(data.creatives.map((creative) => creative.purchase_attribution_window));
  const ctr = summary.impressions > 0 ? summary.clicks / summary.impressions : null;
  const avgSpend = points.length ? summary.spend / points.length : null;
  // Sin ROAS de equilibrio (faltan costes), la referencia es recuperar lo
  // gastado: ROAS 1.
  const roasFloor = breakeven ?? 1;
  const floorLabel = breakeven ? "Equilibrio" : "Referencia";
  const adKind = (c: Creative): Exclude<AdFilter, "all"> => (!c.enough_volume ? "low" : c.roas != null && c.roas >= roasFloor ? "good" : "bad");
  const allCreatives = data.creatives.slice().sort((a, b) => b.spend - a.spend);
  const adCounts = { all: allCreatives.length, good: 0, bad: 0, low: 0 };
  allCreatives.forEach((c) => { adCounts[adKind(c)] += 1; });
  const creatives = allCreatives.filter((c) => adFilter === "all" || adKind(c) === adFilter).slice(0, 10);
  const roasScale = Math.max(5, breakeven ?? 0, ...allCreatives.map((c) => c.roas ?? 0));
  const campaigns = (metrics.data?.campaigns ?? [])
    .map((c) => ({ id: c.campaign_id, name: c.campaign_name ?? "Sin nombre", spend: Number(c.spend) || 0, purchases: Number(c.purchases) || 0, roas: c.roas == null ? null : Number(c.roas) }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);
  const learning = data.learning.filter((l) => l.learning_stage_status === "LEARNING" || l.learning_stage_status === "LEARNING_LIMITED");
  const rankingGroups = groupRankingRowsByDimensionCurrency(data.ranking_distribution);
  const failed = (block: string) => data.unavailable.includes(block);

  return (
    <div className={s.root}>
      <DashboardSections items={[{"id":"meta-headline","label":"Resumen"},{"id":"meta-pendiente","label":"Qué hacer"},{"id":"meta-ads","label":"Anuncios"},{"id":"meta-learn","label":"Aprendizaje"},{"id":"meta-measure","label":"Medición"},{"id":"meta-changes","label":"Cambios"}]} />
      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.hero} aria-labelledby="meta-headline">
        <div className={s.heroTop}>
          <div>
            <div className={s.heroMeta} style={{ alignItems: "center" }}>
              <span>{organizationName} · Meta Ads</span>
              <div className={cx(s.seg, s.heroSeg)} role="group" aria-label="Periodo">
                {periods.map((p) => (
                  <button key={p} type="button" aria-pressed={p === days} onClick={() => { setDays(p); setActivePin(null); }}>
                    {periodButton(p)}
                  </button>
                ))}
              </div>
            </div>
            <h1 id="meta-headline" className={s.headline}>
              Meta Ads: inversión y retorno
            </h1>
            <p className={s.headlineDetail}>{metaAi ? <span className={s.ia}>A02</span> : null}{headline}</p>
            <p className={s.headlineDetail}>
              {fmtNum(summary.purchases)} compras atribuidas por Meta{attributionWindow ? ` (${attributionWindow})` : ""}. Son las que Meta se adjudica, no las ventas de tu tienda.
            </p>
            <div className={s.heroActions}>
              <button type="button" className={cx(s.btn, s.acc)} onClick={() => askCopilot("En el periodo analizado, ¿qué resultado de Meta Ads merece atención primero y qué cambio probarías? Cita campaña, métrica y gasto; señala las limitaciones de atribución.", "Meta Ads")}>
                <span className={s.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>
                  IA
                </span>
                Preguntar qué haría
              </button>
              <button type="button" className={cx(s.btn, s.ghost)} disabled={monitorRunning} onClick={() => void runMonitorMeta()}>
                {monitorRunning ? "Analizando Meta…" : "Actualizar análisis"}
              </button>
              {hideFullLink ? null : (
                <a className={cx(s.btn, s.ghost)} href="/meta">
                  Analítica completa
                </a>
              )}
            </div>
          </div>
          <aside className={s.heroSide} aria-label="Cómo leer estas cifras">
            <p>
              <strong>¿Rentan tus anuncios?</strong>
            </p>
            <div className={s.compare}>
              <div>
                <span>ROAS atribuido</span>
                <span className={s.num}>{roasText(summary.roas)}</span>
              </div>
              <div>
                <span>ROAS de equilibrio</span>
                <span className={s.num}>{roasText(breakeven)}</span>
              </div>
              <div>
                <span>Días con datos</span>
                <span className={s.num}>
                  {fmtNum(summary.days_with_data)}
                </span>
              </div>
            </div>
            <p>
              {breakeven
                ? summary.roas != null && summary.roas >= breakeven
                  ? "Por encima del equilibrio: según Meta, lo que inviertes se paga con el margen de lo que vendes."
                  : "Por debajo del equilibrio: según Meta, la publicidad cuesta más de lo que deja el margen."
                : "Con tus costes de producto completos calcularemos el ROAS a partir del que no pierdes dinero."}
            </p>
          </aside>
        </div>
        {points.length > 1 ? (
          <>
            <SalesChart
              label="Inversión diaria en Meta Ads"
              daily={points}
              previousAverage={avgSpend}
              averageLabel="Gasto medio diario"
              pins={pins}
              active={activePin}
              onPin={(k) => setActivePin((c) => (c === k ? null : k))}
            />
            <div className={s.legend} aria-hidden="true">
              <span>
                <i className={s.lgLine} />
                Gasto por día
              </span>
              <span>
                <i className={s.lgPrev} />
                Gasto medio del periodo
              </span>
              {pins.length ? (
                <span>
                  <i className={s.lgPin} />
                  Cambios en la cuenta
                </span>
              ) : null}
            </div>
            {pins.length ? (
              <ol className={s.notes}>
                {pins.map((pin, k) => (
                  <li key={`${pin.date}-${k}`}>
                    <button type="button" className={s.note} aria-pressed={activePin === k} onClick={() => setActivePin((c) => (c === k ? null : k))}>
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
          </>
        ) : null}
      </section>

      <section className={s.sec} aria-label="Lectura ejecutiva de Meta Ads">
        <div className={s.panel}>
          <h2 className={s.readingTitle}><span className={s.ia}>A02</span> Lectura de Meta Ads</h2>
          <p className={s.headlineDetail}>
            {monitor.data?.output.headline ?? "El análisis específico de Meta Ads aparecerá aquí cuando termine su primera ejecución."}
          </p>
        </div>
      </section>

      {afterHero}

      {/* ------------------------------ Cifras ------------------------------ */}
      <div className={cx(s.kpis, s.kpis4)} aria-label="Cifras de Meta Ads">
        <Kpi label="Inversión" value={fmtEur(summary.spend)} slot={<p className={s.trackTxt}>{avgSpend !== null ? `${fmtEur(avgSpend)} al día de media` : " "}</p>} />
        <Kpi label="Ingresos atribuidos" value={fmtEur(summary.purchase_value)} slot={<p className={s.trackTxt}>Lo que Meta se atribuye{attributionWindow ? ` · ${attributionWindow}` : ""}</p>} />
        <Kpi
          verdict={<MetricVerdict analysis={verdictOf("meta_roas")} />}
          anchorId="insight-metric-meta_roas"
          label="ROAS atribuido"
          value={roasText(summary.roas)}
          slot={
            breakeven && summary.roas != null ? (
              <TargetBar value={summary.roas} target={breakeven} max={Math.max(breakeven * 2, summary.roas * 1.2)} text={`Equilibrio ${roasText(breakeven)}`} />
            ) : (
              <p className={s.trackTxt}>Ingresos atribuidos / inversión</p>
            )
          }
        />
        <Kpi
          label="CPA atribuido"
          value={summary.cac != null ? fmtEur(summary.cac, 2) : "—"}
          slot={
            mbee && summary.cac != null ? (
              <TargetBar value={summary.cac} target={mbee} max={Math.max(mbee * 1.6, summary.cac * 1.2)} lowerIsBetter text={`Techo por pedido ${fmtEur(mbee, 2)}`} />
            ) : (
              <p className={s.trackTxt}>Inversión / compras atribuidas</p>
            )
          }
        />
        <Kpi label="Compras atribuidas" value={fmtNum(summary.purchases)} slot={<p className={s.trackTxt}>{summary.purchase_action_types.length > 1 ? "Varias definiciones de compra: no comparables" : "Según Meta"}</p>} />
        <Kpi label="CPM" value={summary.cpm != null ? fmtEur(summary.cpm, 2) : "—"} slot={<p className={s.trackTxt}>Coste por 1.000 impresiones</p>} />
        <Kpi label="CPC" value={summary.cpc != null ? fmtEur(summary.cpc, 2) : "—"} slot={<p className={s.trackTxt}>Coste por clic</p>} />
        <Kpi label="CTR" value={pct(ctr, 2)} slot={<p className={s.trackTxt}>{fmtNum(summary.clicks)} clics de {fmtNum(summary.impressions)} impresiones</p>} />
      </div>

      {/* ------------------------------ Pendiente ------------------------------ */}
      <section className={s.sec} aria-labelledby="meta-pendiente">
        <SectionHead
          id="meta-pendiente"
          title="Pendiente en Meta Ads"
          ai={null}
          fallback="Si tienes consultor, aquí caen sus propuestas de operativa sobre esta cuenta."
          onAsk={() => askCopilot("Con el rendimiento de Meta y las tareas abiertas, ¿qué única revisión priorizarías esta semana? Cita la campaña, la métrica y el periodo; indica si faltan datos.", "Pendiente en Meta Ads")}
        />
        {asConsultant || proposals.length ? (
          <WorkQueue
            base={base}
            userId={userId}
            consultant={consultant}
            asConsultant={asConsultant}
            proposals={proposals}
            operations={operations.data}
            reloadAll={() => { invalidateApiGetCache(); invalidateCachedQueries(base); operations.reload(); operativaMeta.reload(); }}
            onComment={() => toast.success("Coméntalo desde el chat en la pestaña Pulso.")}
          />
        ) : null}
        {asConsultant && !operativaMeta.data ? (
          <button type="button" className={cx(s.btn, s.ghost, s.sm)} disabled={running} onClick={() => void runOperativaMeta()}>
            {running ? "Revisando la operativa…" : "Lanzar operativa de Meta Ads"}
          </button>
        ) : null}
      </section>

      {/* ------------------------------ Anuncios ------------------------------ */}
      <section className={s.sec} aria-labelledby="meta-ads">
        <SectionHead
          id="meta-ads"
          title="Anuncios"
          ai={findingFor(diagnostic, /creativ|anuncio|fatiga|frecuen|hook|v[ií]deo/i)?.title ?? null}
          fallback={`Ordenados por gasto. La marca indica ${breakeven ? "el ROAS de equilibrio de la tienda" : "el ROAS 1× para recuperar la inversión en anuncios"}.`}
          onAsk={() => askCopilot("¿Qué anuncios tienen evidencia suficiente para probar una pausa o un aumento gradual de presupuesto? Para cada propuesta, cita gasto, resultado, ventana y limitaciones; si no alcanza la evidencia, recomienda observar.", "Anuncios de Meta")}
        />
        {!failed("creatives") && allCreatives.length > 1 ? (
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>ROAS por anuncio</h3>
                <p className={s.sub}>El largo de cada barra representa el ROAS.</p>
              </div>
            </div>
            <SpendRoasRanking creatives={allCreatives} floor={roasFloor} floorLabel={floorLabel} kind={adKind} />
          </div>
        ) : null}
        <div className={s.panel}>
          {allCreatives.length > 0 ? (
            <div className={s.seg} role="group" aria-label="Filtrar anuncios" style={{ marginBottom: 14 }}>
              {(
                [
                  ["all", "Todos"],
                  ["good", breakeven != null ? "Sobre equilibrio" : "ROAS ≥ 1"],
                  ["bad", breakeven != null ? "Bajo equilibrio" : "ROAS < 1"],
                  ["low", "Volumen insuficiente"],
                ] as Array<[AdFilter, string]>
              ).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={adFilter === key} onClick={() => setAdFilter(key)}>
                  {label} <b>{adCounts[key]}</b>
                </button>
              ))}
            </div>
          ) : null}
          {failed("creatives") ? (
            <p className={s.error}>No se pudieron cargar los anuncios. No significa que no haya.</p>
          ) : creatives.length === 0 ? (
            <Empty>{allCreatives.length ? "Ningún anuncio en este grupo." : "No hay anuncios con gasto en este periodo."}</Empty>
          ) : (
            <div className={s.tblWrap} role="region" aria-label="Anuncios; desliza para comparar sus métricas" tabIndex={0} style={{ marginTop: 0 }}>
              <table className={s.tbl} aria-label="Rendimiento de anuncios según Meta">
                <thead>
                  <tr>
                    <th scope="col">Anuncio</th>
                    <th scope="col">Gasto</th>
                    <th scope="col">ROAS</th>
                    <th scope="col">CPA</th>
                    <th scope="col">CTR</th>
                    <th scope="col">Gancho / retención</th>
                    <th scope="col">Calidad</th>
                    <th scope="col">Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {creatives.map((c) => (
                    <tr key={c.ad_id}>
                      <td style={{ minWidth: 200 }}>
                        <b style={{ fontWeight: 600 }}>{c.ad_name}</b>
                        <span className={s.muted} style={{ display: "block", fontSize: 11.5 }}>
                          {c.campaign_name} · {STATUS_LABEL[c.effective_status ?? ""] ?? c.effective_status ?? ""}
                        </span>
                      </td>
                      <td className={s.tdN}>{formatMetaAmount(c.spend, c.spend_currency)}</td>
                      <td>
                        <RoasBar roas={c.roas} breakeven={breakeven} scale={roasScale} />
                      </td>
                      <td className={s.tdN}>{c.cost_per_purchase != null ? formatMetaAmount(c.cost_per_purchase, c.spend_currency) : "—"}</td>
                      <td className={s.tdN}>{c.enough_volume ? pct(c.outbound_ctr, 2) : "—"}</td>
                      <td className={s.tdN}>{c.has_video && c.enough_volume ? `${pct(c.hook_rate, 0)} / ${pct(c.hold_rate, 0)}` : "—"}</td>
                      <td>{rankingChip(c.quality_ranking)}</td>
                      <td>{rankingChip(c.conversion_rate_ranking)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {creatives.some((c) => !c.enough_volume) ? (
            <p className={s.trackTxt} style={{ whiteSpace: "normal" }}>
              «—» en tasas: menos de {fmtNum(data.min_impressions_for_rates)} impresiones, todavía es ruido. Gancho = quien ve los 3 primeros segundos; retención = quien sigue viéndolo.
            </p>
          ) : null}
        </div>
        <div className={s.two}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Campañas</h3>
                <p className={s.sub}>Gasto y ROAS atribuido por campaña</p>
              </div>
            </div>
            {campaigns.length ? (
              <div className={s.tblWrap} role="region" aria-label="Campañas publicitarias; desliza para comparar columnas" tabIndex={0} style={{ marginTop: 0 }}>
                <table className={s.tbl} aria-label="Inversión y retorno atribuido por campaña de Meta">
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
                        <td className={s.tdN}>{fmtEur(c.spend)}</td>
                        <td>
                          <RoasBar roas={c.roas} breakeven={breakeven} scale={roasScale} />
                        </td>
                        <td className={s.tdN}>{fmtNum(c.purchases)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Sin campañas con gasto en este periodo.</Empty>
            )}
          </div>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Qué opina Meta de tus anuncios</h3>
                <p className={s.sub}>Reparto de tu gasto según el veredicto de subasta</p>
              </div>
            </div>
            {rankingGroups.length === 0 ? (
              <Empty>Meta aún no ha emitido veredictos sobre tus anuncios.</Empty>
            ) : (
              <div className={s.fn}>
                {rankingGroups.map((group) => {
                  const { dimension, currencyCode, rows } = group;
                  return (
                    <div key={`${dimension}:${currencyCode ?? "unknown"}`}>
                      <p className={s.lbl}>
                        {DIMENSION_LABEL[dimension] ?? dimension} · {currencyCode ?? "moneda desconocida"}
                      </p>
                      <div className={s.stack} aria-hidden="true">
                        {rows.map((r) => {
                          const tone = RANKING_PRESENTATION[r.ranking_value]?.tone;
                          const color = tone === "success" ? "var(--good)" : tone === "warn" ? "var(--warn)" : tone === "danger" ? "var(--bad)" : "var(--sunken)";
                          return <i key={r.ranking_value} style={{ width: `${(r.spend_share ?? 0) * 100}%`, background: color }} title={`${RANKING_PRESENTATION[r.ranking_value]?.label ?? r.ranking_value}: ${pct(r.spend_share, 0)} del gasto`} />;
                        })}
                      </div>
                      <div className={s.stackL}>
                        {rows
                          .filter((r) => (r.spend_share ?? 0) >= 0.05)
                          .map((r) => (
                            <span key={r.ranking_value}>
                              {RANKING_PRESENTATION[r.ranking_value]?.label ?? r.ranking_value} <span className={s.num}>{pct(r.spend_share, 0)}</span>
                            </span>
                          ))}
                      </div>
                      {currencyCode === null ? (
                        <p className={s.muted} style={{ fontSize: 11.5 }}>
                          No se agrega gasto ni porcentaje porque falta la moneda de la cuenta.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------ Aprendizaje ------------------------------ */}
      <section className={s.sec} aria-labelledby="meta-learn">
        <SectionHead
          id="meta-learn"
          title="Aprendizaje"
          ai={findingFor(diagnostic, /aprendiz|learning|presupuesto|conjunto/i)?.title ?? null}
          fallback={
            failed("learning")
              ? "No se pudo cargar el estado de aprendizaje."
              : learning.length
              ? `${learning.length} conjunto(s) todavía aprendiendo. Mientras aprenden, los resultados son inestables: mejor no tocarlos.`
              : "Ningún conjunto está en fase de aprendizaje."
          }
          onAsk={() => askCopilot("¿Qué conjuntos figuran en fase de aprendizaje según Meta y qué decisión permite tomar la evidencia disponible? Cita estado y volumen de resultados; no recomiendes cambios basados solo en la etiqueta de aprendizaje.", "Aprendizaje de Meta")}
        />
        {learning.length ? (
          <div className={s.panel}>
            <ul>
              {learning.map((l) => {
                const needed = l.learning_conversions_needed ?? 50;
                const done = l.learning_conversions ?? 0;
                return (
                  <li key={l.ad_set_id} className={s.finding}>
                    <span className={cx(s.pr, l.learning_stage_status === "LEARNING_LIMITED" ? s.prHigh : undefined)} aria-hidden="true" />
                    <div>
                      <div className={s.qiM} style={{ marginTop: 0 }}>
                        <p className={s.qiT}>{l.ad_set_name}</p>
                        <span className={cx(s.chip, l.learning_stage_status === "LEARNING_LIMITED" ? s.chipWarn : s.chipAcc)}>
                          {l.learning_stage_status === "LEARNING_LIMITED" ? "Aprendizaje limitado" : "Aprendiendo"}
                        </span>
                      </div>
                      <p className={s.muted} style={{ fontSize: 12.5 }}>
                        {l.campaign_name}
                        {l.daily_budget != null ? ` · ${fmtEur(l.daily_budget)} al día` : ""}
                      </p>
                      <div className={s.track} style={{ marginTop: 10, maxWidth: 420 }}>
                        <span className={s.fill} style={{ width: `${Math.min(done / needed, 1) * 100}%`, background: "var(--store)" }} />
                      </div>
                      <p className={s.trackTxt} style={{ whiteSpace: "normal" }}>
                        {fmtNum(done)} de {fmtNum(needed)} conversiones para salir del aprendizaje
                        {l.days_since_account_activity != null && l.days_since_account_activity <= 7
                          ? ` · último cambio hace ${l.days_since_account_activity} días${l.last_account_activity_description ? ` (${l.last_account_activity_description})` : ""}`
                          : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {/* ------------------------------ Medición ------------------------------ */}
      <section className={s.sec} aria-labelledby="meta-measure">
        <SectionHead
          id="meta-measure"
          title="Medición"
          ai={findingFor(diagnostic, /p[ií]xel|medici|evento|tracking|seguimiento/i)?.title ?? null}
          fallback="Si el píxel no dispara, Meta optimiza a ciegas y las cifras de arriba se quedan cortas."
          onAsk={() => askCopilot("Según el estado de diagnóstico y los eventos recibidos, ¿hay señales verificables de fallo de medición? Cita evento, estado y última fecha; separa errores confirmados de eventos sin actividad reciente.", "Píxel de Meta")}
        />
        <div className={s.two}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Píxel</h3>
                <p className={s.sub}>Eventos recibidos en el periodo</p>
              </div>
            </div>
            {failed("pixels") ? (
              <p className={s.error}>No se pudo cargar el estado del píxel.</p>
            ) : data.pixels.length === 0 ? (
              <Empty>No hay píxel conectado a esta cuenta.</Empty>
            ) : (
              <div className={s.tblWrap} role="region" aria-label="Eventos del píxel; desliza para comparar columnas" tabIndex={0} style={{ marginTop: 0 }}>
                <table className={s.tbl} aria-label="Actividad de eventos del píxel">
                  <thead>
                    <tr>
                      <th scope="col">Píxel / evento</th>
                      <th scope="col">Eventos</th>
                      <th scope="col">Días sin datos</th>
                      <th scope="col">Último disparo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pixels.map((p, i) => {
                      const stale = p.is_unavailable || (p.hours_since_last_fire ?? 0) > 48;
                      return (
                        <tr key={`${p.pixel_id}-${p.event_name ?? i}`}>
                          <td>
                            {p.pixel_name ?? "Píxel"}
                            {p.event_name ? <span className={s.muted}> · {p.event_name}</span> : null}
                          </td>
                          <td className={s.tdN}>{fmtNum(p.events_total)}</td>
                          <td className={s.tdN} style={{ color: p.days_missing > 0 ? "var(--warn)" : undefined }}>
                            {p.days_missing} de {p.days_in_period}
                          </td>
                          <td>
                            <span className={cx(s.chip, stale ? s.chipWarn : s.chipGood)}>
                              {p.is_unavailable ? "No disponible" : p.hours_since_last_fire != null ? `hace ${fmtNum(p.hours_since_last_fire)} h` : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Públicos</h3>
                <p className={s.sub}>Audiencias personalizadas y similares</p>
              </div>
            </div>
            {failed("audiences") ? (
              <p className={s.error}>No se pudieron cargar los públicos.</p>
            ) : data.audiences.length === 0 ? (
              <Empty>No hay públicos personalizados en la cuenta.</Empty>
            ) : (
              <div className={s.tblWrap} role="region" aria-label="Públicos de Meta; desliza para comparar columnas" tabIndex={0} style={{ marginTop: 0 }}>
                <table className={s.tbl} aria-label="Audiencias de Meta Ads">
                  <thead>
                    <tr>
                      <th scope="col">Público</th>
                      <th scope="col">Tamaño</th>
                      <th scope="col">En uso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audiences.slice(0, 8).map((a) => (
                      <tr key={a.audience_id}>
                        <td>
                          {a.audience_name ?? "Sin nombre"}
                          <span className={s.muted} style={{ display: "block", fontSize: 11.5 }}>
                            {a.is_lookalike
                              ? `Similar ${a.lookalike_ratio != null ? `${fmtNum(a.lookalike_ratio * 100)} %` : ""}${a.lookalike_country ? ` · ${a.lookalike_country}` : ""}${a.origin_name ? ` · de ${a.origin_name}` : ""}`
                              : `${a.subtype ?? "Personalizado"}${a.retention_days ? ` · ${a.retention_days} días` : ""}`}
                          </span>
                        </td>
                        <td className={s.tdN}>
                          {a.approximate_count_lower != null
                            ? `${fmtNum(a.approximate_count_lower)}${a.approximate_count_upper ? `–${fmtNum(a.approximate_count_upper)}` : ""}`
                            : "—"}
                        </td>
                        <td>
                          {a.ad_sets_using > 0 ? (
                            <span className={cx(s.chip, s.chipGood)}>{a.ad_sets_using} conjunto(s)</span>
                          ) : (
                            <span className={s.chip}>Sin usar</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------ Cambios ------------------------------ */}
      <section className={s.sec} aria-labelledby="meta-changes">
        <SectionHead
          id="meta-changes"
          title="Cambios y su efecto"
          ai={null}
          fallback={`Qué pasó ${data.change_window_days} días antes y después de cada cambio en la cuenta.`}
          onAsk={() => askCopilot("Compara los resultados observados antes y después de cada cambio de Meta en la misma entidad y ventana. ¿Qué cambios muestran una variación consistente? Cita fechas, métricas y límites de atribución; no presentes correlación como causa.", "Cambios en Meta")}
        />
        <div className={s.panel}>
          {failed("changes") ? (
            <p className={s.error}>No se pudo cargar el historial de cambios.</p>
          ) : data.changes.length === 0 ? (
            <Empty>No hay cambios con gasto suficiente para comparar en este periodo.</Empty>
          ) : (
            <ol className={s.tl}>
              {data.changes
                .slice()
                .sort((a, b) => Date.parse(b.event_time) - Date.parse(a.event_time))
                .slice(0, 10)
                .map((c, i) => {
                  const shift = c.roas_delta_pct;
                  const significant = shift != null && Math.abs(shift) >= ROAS_SHIFT_PCT;
                  const tone = !significant ? undefined : shift! < 0 ? s.chipBad : s.chipGood;
                  const dot = !significant ? "var(--ink-3)" : shift! < 0 ? "var(--bad)" : "var(--good)";
                  return (
                    <li key={`${c.event_time}-${i}`} className={s.tlR}>
                      <span className={s.tlD}>{dayLabel(c.event_time, true)}</span>
                      <span className={s.tlDot} aria-hidden="true">
                        <i style={{ background: dot }} />
                      </span>
                      <div>
                        <p style={{ fontWeight: 600 }}>
                          {c.translated_event_type ?? c.event_type}
                          {c.object_name ? <span className={s.chip} style={{ marginLeft: 6 }}>{c.object_name}</span> : null}
                        </p>
                        <p className={s.sub}>
                          {ENTITY_LABEL[c.entity_level] ?? c.entity_level} · gasto {fmtEur(c.spend_before)} → {fmtEur(c.spend_after)}
                          {c.cpa_before != null || c.cpa_after != null ? ` · CPA ${c.cpa_before != null ? fmtEur(c.cpa_before, 2) : "—"} → ${c.cpa_after != null ? fmtEur(c.cpa_after, 2) : "—"}` : ""}
                        </p>
                      </div>
                      <div className={s.tlBa}>
                        <span>
                          ROAS {roasText(c.roas_before)} → {roasText(c.roas_after)}
                        </span>
                        {shift != null ? (
                          <span className={cx(s.chip, tone)}>
                            {shift > 0 ? "+" : ""}
                            {fmtNum(shift)} %
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}

/** ROAS comparable por anuncio; gasto y compras quedan escritos junto al nombre. */
function SpendRoasRanking({ creatives, floor, floorLabel, kind }: {
  creatives: Creative[];
  floor: number;
  floorLabel: string;
  kind: (c: Creative) => "good" | "bad" | "low";
}) {
  const shown = creatives.slice().sort((a, b) => b.spend - a.spend).slice(0, 8);
  const scale = Math.max(2, floor * 1.15, ...shown.map((c) => c.roas ?? 0));
  const status = {
    good: { label: "Sobre equilibrio", className: s.adGood, textClassName: s.adTextGood },
    bad: { label: "Bajo equilibrio", className: s.adBad, textClassName: s.adTextBad },
    low: { label: "Poco volumen", className: s.adLow, textClassName: s.adTextLow },
  } as const;
  const floorPosition = `${Math.min((floor / scale) * 100, 100)}%`;
  return (
    <div className={s.adChart}>
      <div className={s.adAxis} aria-hidden="true">
        <span>0×</span>
        <span>{roasText(scale)}</span>
      </div>
      <p className={s.adBenchmark}>
        <i className={s.adBenchmarkLine} /> {floorLabel} {roasText(floor)}
      </p>
      <ol className={s.adRows} aria-label="Anuncios ordenados por gasto">
        {shown.map((creative) => {
          const result = status[kind(creative)];
          const width = creative.roas == null ? 0 : Math.max(0, Math.min((creative.roas / scale) * 100, 100));
          return (
            <li className={s.adRow} key={creative.ad_id}>
              <div className={s.adIdentity}>
                <strong title={creative.ad_name}>{creative.ad_name || "Anuncio sin nombre"}</strong>
                <span title={creative.campaign_name}>{creative.campaign_name || "Campaña sin nombre"}</span>
              </div>
              <div className={s.adMeasure}>
                <div
                  className={s.adTrack}
                  role="img"
                  aria-label={`ROAS ${roasText(creative.roas)}; ${result.label}; referencia ${floorLabel} ${roasText(floor)}`}
                >
                  <span className={s.adFloor} style={{ left: floorPosition }} />
                  <span className={cx(s.adFill, result.className)} style={{ width: `${width}%` }} />
                </div>
                <div className={s.adDetails}>
                  <span>{formatMetaAmount(creative.spend, creative.spend_currency)} gastados</span>
                  <span>{fmtNum(creative.purchases)} compras</span>
                  <span className={cx(s.adStatus, result.textClassName)}>{result.label}</span>
                </div>
              </div>
              <div className={s.adReturn}>
                <strong>{roasText(creative.roas)}</strong>
                <span>ROAS</span>
              </div>
            </li>
          );
        })}
      </ol>
      {creatives.length > shown.length ? (
        <p className={s.adChartNote}>Mostrando los {shown.length} anuncios con más gasto de {creatives.length}.</p>
      ) : null}
    </div>
  );
}
