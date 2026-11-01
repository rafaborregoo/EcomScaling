"use client";

import { buttonVariants } from "@/components/ui/button";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery, useKeepPrevious } from "@/lib/use-cached-query";
import { MetricVerdict, useMetricAnalysis } from "@/components/metric-verdict";
import { useCopilotAsk } from "@/components/copilot-ask";
import type { AssignedConsultant } from "@/hooks/use-assigned-consultant";
import { Button, Skeleton, ToggleGroup, ToggleGroupItem, toast, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown } from "@/components/ui";
import { ENTITY_LABEL } from "../meta/insights-sections";
import { fmtEur, fmtNum } from "./client-pulse-model";
import {
  cx,
  a02FindingText,
  Empty,
  findingFor,
  Kpi,
  A02MetricNotice,
  SalesChart,
  SectionHead,
  DiagnosticScopeNote,
  TargetBar,
  WorkQueue,
  dayLabel,
  type Diagnostic,
  DiagnosticReading,
  type Operations,
  type Pin,
} from "./client-pulse";
import s from "./client-pulse.module.css";
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
    entity_level: string | null;
    comparison_status?: string;
    spend_before: number | null;
    spend_after: number | null;
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

const roasText = (v: number | null | undefined) => (v == null ? "—" : `${fmtNum(v, 2)}×`);

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
  const [activePin, setActivePin] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const ask = useCopilotAsk();
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const verdictOf = useMetricAnalysis(organizationId, days, connectionId);

  const insights = useCachedQuery<MetaInsights>(`${base}/meta/insights?days=${days}${scope}`);
  const metrics = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=${days}${scope}`);
  const shop = useCachedQuery<ShopifyFinance>(`${base}/shopify/metrics?days=${days}${scope}`);
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30&view=meta${scope}`);
  const operativaMeta = useCachedQuery<Diagnostic & { source_coverage?: Record<string, unknown>; pending_outputs?: Diagnostic[] }>(`${base}/ai/operativa-meta?days=30${scope}`);
  const operations = useCachedQuery<Operations>(`${base}/operations${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`);
  const metaRunRequestKey = useRef<string | null>(null);

  // Al cambiar de periodo se quedan los datos anteriores (atenuados) en vez de vaciar la página.
  const data = useKeepPrevious(insights.data, `${organizationId}|${connectionId}`);
  const askCopilot = (question: string, focusLabel: string) => ask({ question: `${question} (Meta Ads, ${periodPhrase(days)})`, focusLabel, reference: { period_label: periodPhrase(days), filters: { days: String(days), ...(connectionId ? { connection_id: connectionId } : {}) } } });
  const proposals = operativaMeta.data?.pending_outputs ?? [];

  async function runOperativaMeta() {
    setRunning(true);
    try {
      metaRunRequestKey.current ??= crypto.randomUUID();
      const response = await apiFetch(`${base}/ai/operativa-meta-run?days=30${scope}`, { method: "POST", headers: { "Idempotency-Key": metaRunRequestKey.current } });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Operativa de Meta Ads actualizada.");
      metaRunRequestKey.current = null;
      operativaMeta.reload();
    } catch {
      toast.danger("No se pudo lanzar el análisis por un error de red.");
    } finally {
      setRunning(false);
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
        source: ENTITY_LABEL[change.entity_level ?? ""] ?? change.entity_level ?? "Cambio",
        title: `${change.translated_event_type ?? change.event_type}${change.object_name ? ` · ${change.object_name}` : ""}`,
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
              ? (insights.error && !data ? "No se han podido leer los datos de Meta ahora mismo. Reintenta en unos segundos." : "Este cliente todavía no tiene datos de Meta Ads en el periodo elegido.")
              : "Conecta tu cuenta publicitaria para ver inversión, ROAS y compras atribuidas. Si ya la conectaste, la primera sincronización puede tardar unos minutos."}
          </p>
          {!asConsultant ? (
            <div className={s.heroActions}>
              <a className={buttonVariants()} href="/integraciones/meta">
                {insights.error ? "Revisar conexión de Meta Ads" : "Conectar Meta Ads"}
              </a>
            </div>
          ) : null}
          {insights.error ? <div className={s.heroActions}><button type="button" className={buttonVariants({ variant: "secondary" })} onClick={insights.reload}>Reintentar la carga</button></div> : null}
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
  const attributionWindow = metaAttributionLabel(data.creatives.map((creative) => creative.purchase_attribution_window));
  const avgSpend = points.length ? summary.spend / points.length : null;
  // Sin ROAS de equilibrio (faltan costes), la referencia es recuperar lo
  // gastado: ROAS 1.
  const roasFloor = breakeven ?? 1;
  const floorLabel = breakeven ? "Tu mínimo" : "Recuperar lo invertido";
  const adKind = (c: Creative): "good" | "bad" | "low" => (!c.enough_volume ? "low" : c.roas != null && c.roas >= roasFloor ? "good" : "bad");
  const allCreatives = data.creatives.slice().sort((a, b) => b.spend - a.spend);
  const roasScale = Math.max(5, breakeven ?? 0, ...allCreatives.map((c) => c.roas ?? 0));
  const campaigns = (metrics.data?.campaigns ?? [])
    .map((c) => ({ id: c.campaign_id, name: c.campaign_name ?? "Sin nombre", spend: Number(c.spend) || 0, purchases: Number(c.purchases) || 0, roas: c.roas == null ? null : Number(c.roas) }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);
  const failed = (block: string) => data.unavailable.includes(block);

  return (
    <div className={s.root} aria-busy={insights.data === undefined} style={insights.data === undefined ? { opacity: 0.55, transition: "opacity 0.2s" } : undefined}>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.hero} aria-labelledby="meta-headline">
        <div className={s.heroTop} style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
          <div>
            <div className={s.heroMeta} style={{ alignItems: "center" }}>
              <ToggleGroup aria-label="Periodo" value={days} onValueChange={(p) => { setDays(p); setActivePin(null); }}>
                {periods.map((p) => (
                  <ToggleGroupItem key={p} value={p}>
                    {periodButton(p)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <h1 id="meta-headline" className={s.headline}>
              Por cada 1 € en anuncios, Meta dice que vuelven {summary.roas != null ? `${fmtNum(summary.roas, 2)} €` : "—"}
            </h1>
            <p className={s.headlineDetail}>
              Has invertido {fmtEur(summary.spend)} en {periodPhrase(days)}. Meta se atribuye {fmtEur(summary.purchase_value)} en ventas{attributionWindow ? ` (${attributionWindow})` : ""}: es su cuenta, no la de tu tienda.
            </p>
            {metaAi ? <p className={s.headlineDetail}><span className={s.ia}>A02</span>{metaAi.title}</p> : null}
            <DiagnosticScopeNote diagnostic={diagnostic} />
            <div className={s.heroActions}>
              <button type="button" className={buttonVariants()} onClick={() => askCopilot("En el periodo analizado, ¿qué resultado de Meta Ads merece atención primero y qué cambio probarías? Cita campaña, métrica y gasto; señala las limitaciones de atribución.", "Meta Ads")}>
                <span className={s.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>
                  IA
                </span>
                Preguntar qué haría
              </button>
              {hideFullLink ? null : (
                <a className={buttonVariants({ variant: "secondary" })} href="/meta">
                  Analítica completa
                </a>
              )}
            </div>
          </div>
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

      {/* ------------------------------ Cifras ------------------------------ */}
      <div className={cx(s.kpis, s.kpis4)} aria-label="Cifras de Meta Ads">
        <Kpi label="Inversión" aiNotice={<A02MetricNotice diagnostic={diagnostic} metricLabel="Inversión en Meta" metricKey="meta_spend" pattern={/inversi|gasto|spend|presupuesto/i} audience={asConsultant ? "consultor" : "cliente"} />} value={fmtEur(summary.spend)} slot={<p className={s.trackTxt}>{avgSpend !== null ? `${fmtEur(avgSpend)} al día de media` : " "}</p>} />
        <Kpi label="Ventas según Meta" aiNotice={<A02MetricNotice diagnostic={diagnostic} metricLabel="Ventas según Meta" metricKey="meta_attributed_sales" pattern={/ventas atribuid|ingresos atribuid|purchase value/i} audience={asConsultant ? "consultor" : "cliente"} />} value={fmtEur(summary.purchase_value)} slot={<p className={s.trackTxt}>Según Meta</p>} />
        <Kpi
          aiNotice={<A02MetricNotice diagnostic={diagnostic} metricLabel="ROAS de Meta" metricKey="meta_roas" pattern={/roas|retorno.*anunc|rentabilidad.*anunc/i} audience={asConsultant ? "consultor" : "cliente"} />}
          verdict={<MetricVerdict analysis={verdictOf("meta_roas")} />}
          anchorId="insight-metric-meta_roas"
          label="ROAS"
          value={roasText(summary.roas)}
          slot={
            breakeven && summary.roas != null ? (
              <TargetBar value={summary.roas} target={breakeven} max={Math.max(breakeven * 2, summary.roas * 1.2)} text={`Tu mínimo ${roasText(breakeven)}`} />
            ) : (
              <p className={s.trackTxt}>{breakeven ? "" : "Con los costes completos verás tu mínimo para no perder"}</p>
            )
          }
        />
        <Kpi
          aiNotice={<A02MetricNotice diagnostic={diagnostic} metricLabel="Coste por compra" metricKey="meta_cost_per_purchase" pattern={/coste por compra|cac|adquisición|cost per purchase/i} audience={asConsultant ? "consultor" : "cliente"} />}
          label="Coste por compra"
          value={summary.cac != null ? fmtEur(summary.cac, 2) : "—"}
          slot={
            mbee && summary.cac != null ? (
              <TargetBar value={summary.cac} target={mbee} max={Math.max(mbee * 1.6, summary.cac * 1.2)} lowerIsBetter text={`Máximo por compra ${fmtEur(mbee, 2)}`} />
            ) : (
              <p className={s.trackTxt}>{fmtNum(summary.purchases)} compras según Meta</p>
            )
          }
        />
      </div>

      {afterHero}

      {/* ------------------------------ Pendiente ------------------------------ */}
      {asConsultant ? (
      <section className={s.sec} id="meta-pendiente" aria-label="Qué hacer en Meta Ads">
        {operativaMeta.data?.output || operativaMeta.data?.source_coverage ? (
          <Collapsible className={s.panel} aria-label="Diagnóstico de operativa Meta">
            <div className={s.panelH}>
              <div>
                <h3>Análisis de la cuenta</h3>
                <p className={s.sub}>
                  {operativaMeta.data.output ? (operativaMeta.data.stale ? "Datos que requieren actualización" : "Análisis más reciente") : "Estado de disponibilidad"}
                  {operativaMeta.data.generated_at ? ` · ${new Date(operativaMeta.data.generated_at).toLocaleString("es-ES")}` : ""}
                  {operativaMeta.data.envelope?.quality?.dataCompleteness ? ` · cobertura ${operativaMeta.data.envelope.quality.dataCompleteness}` : ""}
                </p>
              </div>
              <CollapsibleTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ver el análisis de la cuenta" />}>
                <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
            {operativaMeta.data.output ? <DiagnosticReading tag="A14" diagnostic={operativaMeta.data} audience="consultor" /> : null}
            {operativaMeta.data.source_coverage ? (
              <p className={s.sub}>
                Meta: {String(operativaMeta.data.source_coverage.status ?? "sin confirmar")}
                {operativaMeta.data.source_coverage.measurement_verdict ? ` · Medición A24: ${String(operativaMeta.data.source_coverage.measurement_verdict)}` : ""}
                {operativaMeta.data.source_coverage.currency_status ? ` · Moneda: ${String(operativaMeta.data.source_coverage.currency_status)}` : ""}
                {operativaMeta.data.source_coverage.financial_comparable === false ? " · Rentabilidad incompleta" : ""}
              </p>
            ) : null}
          </CollapsibleContent>
          </Collapsible>
        ) : null}
        {asConsultant ? (
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
        {asConsultant ? (
          <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} disabled={running} onClick={() => void runOperativaMeta()}>
            {running ? "Revisando la operativa…" : "Actualizar análisis de la cuenta"}
          </button>
        ) : null}
      </section>
      ) : null}

      {/* ------------------------------ Anuncios ------------------------------ */}
      <section className={s.sec} aria-labelledby="meta-ads">
        <SectionHead
          id="meta-ads"
          title="Anuncios"
          ai={a02FindingText(diagnostic, /creativ|anuncio|fatiga|frecuen|hook|v[ií]deo/i)}
          fallback="Cuánto vuelve por cada euro en cada anuncio."
        />
        {failed("creatives") ? (
          <div className={s.panel}>
            <p className={s.error}>No se pudieron cargar los anuncios. No significa que no haya.</p>
          </div>
        ) : allCreatives.length ? (
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Retorno por anuncio</h3>
                <p className={s.sub}>Barra más larga, más retorno. La raya marca {breakeven ? "tu mínimo para no perder dinero" : "recuperar lo invertido (1 €)"}.</p>
              </div>
            </div>
            <SpendRoasRanking creatives={allCreatives} floor={roasFloor} floorLabel={floorLabel} kind={adKind} />
          </div>
        ) : null}
        {campaigns.length !== allCreatives.length ? (
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
        ) : null}
      </section>

      {/* ------------------------------ Medición ------------------------------ */}
      {data.pixels.length || failed("pixels") ? (
      <section className={s.sec} aria-labelledby="meta-measure">
        <SectionHead
          id="meta-measure"
          title="Píxel"
          ai={a02FindingText(diagnostic, /p[ií]xel|medici|evento|tracking|seguimiento/i)}
          fallback="Si el píxel no envía eventos, Meta optimiza a ciegas."
        />
        <div className={s.panel}>
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
      </section>
      ) : null}
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
    good: { label: "Por encima", className: s.adGood, textClassName: s.adTextGood },
    bad: { label: "Por debajo", className: s.adBad, textClassName: s.adTextBad },
    low: { label: "Pocos datos", className: s.adLow, textClassName: s.adTextLow },
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
