"use client";
import { A02Reading } from "@/components/a02-reading";

import { buttonVariants } from "@/components/ui/button";
import { useState, type ReactNode } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery, useKeepPrevious } from "@/lib/use-cached-query";
import { useCopilotAsk } from "@/components/copilot-ask";
import { MetricVerdict, useMetricAnalysis } from "@/components/metric-verdict";
import { Banner, Skeleton, ToggleGroup, ToggleGroupItem, toast, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown } from "@/components/ui";
import { BarRows } from "@/components/data-bars";
import type { AssignedConsultant } from "@/hooks/use-assigned-consultant";
import { canShowProfit, financialComparabilityMessage, salesChangePct, storePulse } from "./store-pulse";
import { fmtCurrency, fmtNum } from "./client-pulse-model";
import {
  cx,
  Delta,
  Empty,
  Kpi,
  A02MetricNotice,
  SalesChart,
  SectionHead,
  Spark,
  usePins,
  WorkQueue,
  type Diagnostic,
  type Metrics,
  DiagnosticReading,
  type Operations,
} from "./client-pulse";
import s from "./client-pulse.module.css";

/**
 * Pestaña Shopify del panel del cliente.
 *
 * La portada ("Pulso") mezcla canales para decidir; esta mira solo la tienda y
 * responde solo lo esencial: cuánto vende, qué hay que hacer, dónde se pierden
 * visitas, qué productos tiran (y su stock) y si los clientes repiten. El
 * detalle (devoluciones, promociones, inventario) vive en sus subpáginas.
 */

type Period = number | "all";
const PERIODS: Period[] = [7, 30, 90];

const periodButton = (p: Period) => (p === "all" ? "Todo" : p === 180 ? "6 meses" : p === 365 ? "1 año" : `${p} días`);
const periodPhrase = (p: Period) => (p === "all" ? "todo el histórico" : `los últimos ${p} días`);

type ShopifyMetrics = Metrics & {
  currency_code: string | null;
  financial_currency_coverage: {
    status: "compatible" | "incompatible" | "unknown";
    currency_code: string | null;
    mismatched_sources: Array<{ source: string; currencies: string[] }>;
    unknown_sources: string[];
    klaviyo_status: "compatible" | "incompatible" | "unknown";
    klaviyo_currency_code: string | null;
    klaviyo_unknown: boolean;
  };
  sales: Metrics["sales"] & { gross_sales: number; discounts: number; refunds: number; units_sold: number };
  margin: { revenue: number; cogs: number; gross_margin: number; margin_pct: number; items_without_cost: number; items_with_estimated_cost: number; lines_with_exact_metrics: number; lines_with_estimated_metrics: number; lines_without_metrics: number };
  previous_period: (NonNullable<Metrics["previous_period"]> & {
    sales: NonNullable<Metrics["previous_period"]>["sales"] & { gross_sales: number; discounts: number; refunds: number; units_sold: number };
  }) | null;
  previous_year: { net_revenue_ex_tax: number; orders_count: number } | null;
  funnel_daily: Array<{ date: string; sessions: number; orders_count: number; conversion_rate_own: number | null }>;
};

// fmtCurrency agrupa siempre los miles: Intl en es-ES dejaba "9105 €" junto a "19.561 €".
const formatShopifyMoney = fmtCurrency;

type Insights = {
  recurrence: { new_orders: number; returning_orders: number; unknown_orders: number; new_revenue: number; returning_revenue: number; repeat_order_rate: number | null } | null;
  customer_value: { customers: number; guest_orders: number; avg_orders_per_customer: number | null; avg_revenue_per_customer: number | null; median_revenue_per_customer: number | null; p90_revenue_per_customer: number | null } | null;
  cohorts: Array<{ cohort_month: string; cohort_customers: number; month_offset: number; customers: number }>;
  attribution: Array<{ source_type: string | null; source: string | null; utm_campaign: string | null; orders: number; revenue: number; new_customers: number; avg_days_to_conversion: number | null }>;
  returns: Array<{ product_id: string; title: string; units_sold: number; units_returned: number; return_rate: number | null; refunded_amount: number; top_return_reason: string | null; lines_with_exact_metrics: number; lines_with_estimated_metrics: number; lines_without_metrics: number }>;
  delivery: { fulfillments: number; delivered: number; in_transit: number; avg_hours_to_ship: number | null; avg_days_to_deliver: number | null; with_estimate: number; late_deliveries: number; avg_delay_days: number | null } | null;
  delivery_exceptions: Array<{ id: string; order_name: string | null; tracking_company: string | null; exception_type: string; likely_area: string; next_action_code: string; age_hours: number }> | null;
  checkout_recovery: { checkouts: number; recovered: number; recovery_rate: number | null; lost_value: number; recovered_value: number; avg_hours_to_recover: number | null } | null;
  discounts: Array<{
    code: string;
    orders: number;
    order_revenue: number;
    order_discount_total: number;
    attributed_discount_total: number | null;
    attribution_coverage: "complete" | "partial" | "unavailable" | "migration_pending";
    new_customers: number;
    orders_with_multiple_codes: number;
    discount_share: number | null;
  }>;
  unavailable: string[];
  lifetime: {
    curve: Array<{ milestone_days: number; cohort_customers: number; avg_revenue: number | null; avg_contribution: number | null; cohort_cac: number | null }>;
    ltv: { milestone_days: number; avg_revenue: number | null; avg_contribution: number | null } | null;
    payback: { status: "PAID_BACK"; days: number } | { status: "NOT_WITHIN_HORIZON" } | { status: "UNKNOWN"; reason: string };
  } | null;
  churn: { churn_days: number; base_customers: number; churned_customers: number; churn_rate: number | string | null } | null;
};

const pct = (ratio: number | null | undefined, digits = 1) => (ratio == null ? "—" : `${fmtNum(ratio * 100, digits)} %`);

function Mini({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className={s.mini}>
      <span className={s.lbl}>{label}</span>
      <span className={s.num}>{value}</span>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function Unavailable({ what }: { what: string }) {
  return <p className={s.error}>No se pudo cargar {what}. No significa que no haya datos: reintenta en un rato.</p>;
}

export function ClientShopify({ organizationId, organizationName, connectionId, userId, asConsultant = false, consultant = null, days: daysProp, onDaysChange, periods = PERIODS, afterHero, hideFullLink = false }: {
  organizationId: string;
  organizationName: string;
  connectionId: string | null;
  userId: string;
  asConsultant?: boolean;
  consultant?: AssignedConsultant;
  /** Periodo controlado desde fuera (/shopify lo comparte con otros bloques). */
  days?: Period;
  onDaysChange?: (days: Period) => void;
  periods?: Period[];
  /** Bloque entre el hero y las cifras (en /shopify: fiabilidad de los datos y navegación). */
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
  const [running, setRunning] = useState<string | null>(null);
  const ask = useCopilotAsk();
  const base = `/v1/organizations/${organizationId}`;
  const scope = connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : "";
  const verdictOf = useMetricAnalysis(organizationId, days, connectionId);

  const metrics = useCachedQuery<ShopifyMetrics>(`${base}/shopify/metrics?days=${days}${scope}`);
  const insights = useCachedQuery<Insights>(`${base}/shopify/insights?days=${days}${scope}`);
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30&view=shopify${scope}`);
  const stockAi = useCachedQuery<Diagnostic>(`${base}/ai/stock-planner?days=30${scope}`);
  const operativaShopify = useCachedQuery<Diagnostic>(`${base}/ai/operativa-shopify?days=30${scope}`);
  const operationsScope = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
  const operations = useCachedQuery<Operations>(`${base}/operations${operationsScope}`);

  // Al cambiar de periodo se quedan los datos anteriores (atenuados) en vez de vaciar la página.
  const data = useKeepPrevious(metrics.data, `${organizationId}|${connectionId}`);
  const fmtEur = (value: number | null | undefined, decimals = 0) =>
    formatShopifyMoney(value, data?.currency_code ?? null, decimals);
  const financialCurrencyComparable = (data?.financial_comparability?.currency_status ?? data?.financial_currency_coverage.status) === "compatible";
  const productCostCurrencyComparable = data
    ? !data.financial_currency_coverage.unknown_sources.includes("costes de producto")
      && !data.financial_currency_coverage.mismatched_sources.some((item) => item.source === "costes de producto")
    : false;
  const lineMetricsCoverageKnown = data
    ? Number.isFinite(data.margin.lines_without_metrics)
    : false;
  const lineMetricsComplete = lineMetricsCoverageKnown && data?.margin.lines_without_metrics === 0;
  const financialCanDisplay = data?.financial_comparability?.status === "comparable" || data?.financial_comparability?.status === "estimated";
  const profitCoverageComplete = data && data.financial_comparability?.can_use_financial_model === true
    ? canShowProfit({
        hasFinancialSettings: data.financial.has_settings,
        itemsWithoutCost: data.financial.items_without_cost,
        linesWithoutNetMetrics: data.margin.lines_without_metrics,
      })
    : false;
  const pins = usePins(data?.daily, operations.data?.alerts);

  const askCopilot = (question: string, focusLabel: string) => ask({ question: `${question} (Shopify, ${periodPhrase(days)})`, focusLabel, reference: { period_label: periodPhrase(days), filters: { days: String(days) } } });

  function reloadAll() {
    invalidateApiGetCache();
    invalidateCachedQueries(base);
    operations.reload();
    stockAi.reload();
    operativaShopify.reload();
  }

  async function runAgent(path: string, label: string, reload: () => void, view?: string) {
    setRunning(path);
    try {
      const viewQuery = view ? `&view=${encodeURIComponent(view)}` : "";
      const response = await apiFetch(`${base}${path}?days=30${scope}${viewQuery}`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
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
  const runStockPlanner = () => runAgent("/ai/stock-planner-run", "Análisis de stock", stockAi.reload);
  const runOperativaShopify = () => runAgent("/ai/operativa-shopify-run", "Operativa de Shopify", operativaShopify.reload);
  // Older cached diagnostics may contain financial claims created before the
  // live currency-coverage guard existed. Keep stock advice, suppress finance.
  const proposals = [stockAi.data, operativaShopify.data]
    .filter((d): d is Diagnostic => Boolean(d));

  if (metrics.isLoading && !data) {
    return (
      <div className={s.root}>
        <div className={s.hero} role="status" aria-busy="true">
          <p className={s.heroMeta}>{organizationName} · Shopify</p>
          <p className={s.headline}>Cargando tu tienda…</p>
          <Skeleton className="h-32 w-full" aria-hidden="true" />
        </div>
      </div>
    );
  }

  const storeSelectionRequired = metrics.errorCode === "shopify_store_selection_required"
    || insights.errorCode === "shopify_store_selection_required";
  const currencyUnavailable = metrics.errorCode === "shopify_currency_unavailable"
    || insights.errorCode === "shopify_currency_unavailable";

  if (storeSelectionRequired || currencyUnavailable) {
    return (
      <div className={s.root}>
        <section className={s.hero} role="status">
          <p className={s.heroMeta}>{organizationName} · Shopify</p>
          <h1 className={s.headline}>{storeSelectionRequired ? "Elige una tienda para continuar" : "Falta confirmar la moneda de la tienda"}</h1>
          <p className={s.headlineDetail}>
            {storeSelectionRequired
              ? "Hay varias tiendas conectadas. Selecciona una tienda en el selector de la cabecera para consultar ventas, descuentos, devoluciones y rentabilidad sin mezclar monedas."
              : "Shopify todavía no ha confirmado la moneda de esta tienda. Completa o reintenta la sincronización antes de mostrar importes."}
          </p>
          {!storeSelectionRequired && !asConsultant ? (
            <div className={s.heroActions}>
              <a className={buttonVariants()} href="/integraciones/shopify">Revisar integración</a>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={s.root}>
        <div className={s.hero}>
          <p className={s.heroMeta}>{organizationName} · Shopify</p>
          <h1 className={s.headline}>No hemos podido cargar los datos de tu tienda</h1>
          <p className={s.headlineDetail}>
            {asConsultant
              ? "Las integraciones de este cliente no están disponibles desde el portal consultor."
              : "Revisa que Shopify esté conectado. Si acabas de conectarlo, la primera sincronización puede tardar unos minutos."}
          </p>
          {!asConsultant ? (
            <div className={s.heroActions}>
              <a className={buttonVariants()} href="/integraciones/shopify">
                Ir a Integraciones
              </a>
            </div>
          ) : null}
          <div className={s.heroActions}><button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => { metrics.reload(); insights.reload(); }}>Reintentar la carga</button></div>
        </div>
      </div>
    );
  }

  // ---- derivados ----
  const { sales } = data;
  const previous = data.previous_period;
  const diagnostic = monitor.data;
  const ins = insights.data;
  const daily = data.daily;
  const previousAverage = previous && daily.length ? previous.sales.net_sales / daily.length : null;
  const pulse = storePulse({
    netSales: sales.net_sales,
    netProfit: financialCurrencyComparable && profitCoverageComplete ? data.financial.net_profit : null,
    hasFinancialSettings: financialCurrencyComparable && profitCoverageComplete && data.financial.has_settings,
    previousNetSales: previous?.sales.net_sales ?? null,
  });
  const headline = pulse.headline;
  const yoy = data.previous_year ? salesChangePct(data.financial.net_revenue_ex_tax, data.previous_year.net_revenue_ex_tax) : null;
  const funnel = data.funnel;
  const recovery = ins?.checkout_recovery ?? null;
  const top = data.top_products.slice(0, 8);
  const topMax = Math.max(...top.map((p) => p.revenue), 1);

  return (
    <div className={s.root} aria-busy={metrics.data === undefined} style={metrics.data === undefined ? { opacity: 0.55, transition: "opacity 0.2s" } : undefined}>
      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.hero} aria-labelledby="shop-headline">
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
            <h1 id="shop-headline" className={s.headline}>
              Has vendido {fmtEur(sales.net_sales)}
            </h1>
            <p className={s.headlineDetail}>
              en {periodPhrase(days)}
              {/* En "Todo" no hay periodo anterior: "vs periodo anterior" sin cifra confundía. */}
              {salesChangePct(sales.net_sales, previous?.sales.net_sales ?? null) !== null ? <>{" "}<Delta change={salesChangePct(sales.net_sales, previous?.sales.net_sales ?? null)} /> vs periodo anterior</> : null}
              {yoy !== null ? <> · <Delta change={yoy} /> vs año pasado</> : null}
            </p>
            <A02MetricNotice diagnostic={diagnostic} metricLabel="Ventas netas" metricKey="sales_net_sales" pattern={/ventas|ingresos|factur/i} audience={asConsultant ? "consultor" : "cliente"} />
            <A02Reading spot="shopify" diagnostic={diagnostic} loading={monitor.isLoading} error={monitor.error} errorCode={monitor.errorCode} organizationId={organizationId} connectionId={connectionId} viewDays={days} onRetry={monitor.reload} />
            <div className={s.heroActions}>
              <button type="button" className={buttonVariants()} onClick={() => askCopilot(`Explícame cómo va mi tienda: «${headline}». ¿Qué haría primero?`, "Tu tienda en Shopify")}>
                <span className={s.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>
                  IA
                </span>
                Preguntar por qué
              </button>
              {hideFullLink ? null : (
                <a className={buttonVariants({ variant: "secondary" })} href="/shopify">
                  Analítica completa
                </a>
              )}
            </div>
          </div>
        </div>
        {daily.length > 1 ? (
          <>
            <SalesChart
              daily={daily.map((d) => ({ date: d.date, value: d.net_sales, detail: `${fmtNum(d.orders_count)} pedidos` }))}
              previousAverage={previousAverage}
              currencyCode={data.currency_code}
              pins={pins}
              active={activePin}
              onPin={(k) => setActivePin((c) => (c === k ? null : k))}
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
                  Alertas detectadas
                </span>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      {!financialCurrencyComparable ? (
        <Banner tone="warn" className="mt-4" title="La rentabilidad espera a que cuadren las monedas">
            {data.financial_comparability ? financialComparabilityMessage(data.financial_comparability) : data.financial_currency_coverage.status === "incompatible"
              ? `Hay datos en monedas distintas a ${data.currency_code ?? "la de la tienda"}: ${data.financial_currency_coverage.mismatched_sources.map((item) => `${item.source} (${item.currencies.join(", ")})`).join("; ")}.`
              : `No se ha podido confirmar la moneda de ${data.financial_currency_coverage.unknown_sources.length ? data.financial_currency_coverage.unknown_sources.join(", ") : "todos los datos de costes"}.`}
            {" "}Las ventas de Shopify se ven igual; la rentabilidad se oculta hasta que todo esté en la misma moneda.
        </Banner>
      ) : null}
      {financialCurrencyComparable && !data.financial_comparability?.can_use_financial_model ? (
        <Banner tone="warn" className="mt-4" title={data.financial_comparability?.status === "estimated" ? "Rentabilidad estimada" : "Rentabilidad pendiente de verificación"}>
          {financialComparabilityMessage(data.financial_comparability)}
        </Banner>
      ) : null}

      {/* ------------------------------ Cifras ------------------------------ */}
      <div className={cx(s.kpis, s.kpis4)} aria-label="Cifras de la tienda">
        <Kpi
          label="Pedidos"
          aiNotice={<A02MetricNotice diagnostic={diagnostic} metricLabel="Pedidos" metricKey="orders_count" pattern={/pedidos|órdenes|orders/i} audience={asConsultant ? "consultor" : "cliente"} />}
          value={fmtNum(sales.orders_count)}
          delta={<Delta change={salesChangePct(sales.orders_count, previous?.sales.orders_count ?? null)} />}
          vs={previous ? fmtNum(previous.sales.orders_count) : null}
          slot={<Spark values={daily.map((d) => d.orders_count)} />}
        />
        <Kpi
          label="Conversión"
          verdict={<MetricVerdict analysis={verdictOf("conversion")} />}
          value={funnel?.has_sessions && funnel.conversion_rate_own != null ? pct(funnel.conversion_rate_own, 2) : "—"}
          slot={<p className={s.trackTxt}>{funnel?.has_sessions ? `${fmtNum(funnel.sessions)} visitas` : "Sin datos de visitas"}</p>}
        />
        <Kpi
          label="Gasto medio por pedido"
          aiNotice={<A02MetricNotice diagnostic={diagnostic} metricLabel="Gasto medio por pedido" metricKey="average_order_value" pattern={/ticket|pedido medio|aov|gasto medio/i} audience={asConsultant ? "consultor" : "cliente"} />}
          value={fmtEur(sales.aov, 2)}
          delta={<Delta change={salesChangePct(sales.aov, previous?.sales.aov ?? null)} />}
          vs={previous ? fmtEur(previous.sales.aov, 2) : null}
          slot={<Spark values={daily.filter((d) => d.orders_count > 0).map((d) => d.net_sales / d.orders_count)} />}
        />
        <Kpi
          label={data.financial_comparability?.status === "estimated" ? "Margen bruto estimado" : "Margen bruto"}
          aiNotice={<A02MetricNotice diagnostic={diagnostic} metricLabel="Margen bruto" metricKey="gross_margin" pattern={/margen|coste|beneficio|rentab/i} audience={asConsultant ? "consultor" : "cliente"} />}
          tag={!lineMetricsComplete || data.margin.items_without_cost > 0 ? "incompleto" : data.margin.lines_with_estimated_metrics > 0 || data.margin.items_with_estimated_cost > 0 ? "estimado" : undefined}
          value={!financialCanDisplay || !productCostCurrencyComparable || !lineMetricsComplete || (data.margin.items_without_cost > 0 && data.margin.cogs === 0) ? "—" : `${fmtNum(data.margin.margin_pct, 1)} %`}
          slot={
            <p className={s.trackTxt}>
              {!financialCanDisplay
                ? financialComparabilityMessage(data.financial_comparability)
                : !productCostCurrencyComparable
                ? "No se muestra: la moneda de los costes de producto no está verificada"
                : !lineMetricsCoverageKnown
                ? "No se muestra: falta confirmar la cobertura neta de las líneas del periodo"
                : !lineMetricsComplete
                ? `${data.margin.lines_without_metrics} líneas sin importe neto verificado; sincronízalas para completar la cobertura`
                : data.margin.items_without_cost > 0
                ? `Faltan costes en ${data.margin.items_without_cost} línea(s) vendida(s)`
                : `${fmtEur(data.margin.gross_margin)} tras coste de producto`}
            </p>
          }
        />
      </div>

      {afterHero}

      {/* ------------------------------ Pendiente ------------------------------ */}
      <section className={s.sec} id="shop-pendiente" aria-label="Qué hacer">
        {operativaShopify.data ? (
          <Collapsible className={s.panel} defaultOpen>
            <CollapsibleTrigger>
              <strong>A13 · Operativa de Shopify</strong>{" "}
              <span className={s.sub}>{operativaShopify.data.stale ? "desactualizado" : "vigente"} · {new Date(operativaShopify.data.generated_at).toLocaleDateString("es-ES")}</span>
              <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
            </CollapsibleTrigger>
            <CollapsibleContent>
            <DiagnosticReading tag="A13" diagnostic={operativaShopify.data} audience={asConsultant ? "consultor" : "cliente"} />
            {asConsultant ? <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} disabled={running !== null} onClick={() => void runOperativaShopify()}>
              {running === "/ai/operativa-shopify-run" ? "Analizando…" : "Actualizar análisis"}
            </button> : null}
          </CollapsibleContent>
          </Collapsible>
        ) : null}
        <WorkQueue
          base={base}
          userId={userId}
          consultant={consultant}
          asConsultant={asConsultant}
          proposals={proposals}
          operations={operations.data}
          reloadAll={reloadAll}
          onComment={() => toast.success("Coméntalo desde el chat en la pestaña Pulso.")}
        />
      </section>

      {/* ------------------------------ Conversión ------------------------------ */}
      <section className={s.sec} aria-labelledby="shop-conv">
        <SectionHead
          id="shop-conv"
          title="Conversión"
          ai={null}
          fallback={funnel?.has_sessions && funnel.conversion_rate_own != null ? `De cada 100 visitas compran ${fmtNum(funnel.conversion_rate_own * 100, 1)}.` : null}
        />
        <div className={recovery?.checkouts ? s.two : undefined}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Del escaparate a la compra</h3>
                <p className={s.sub}>Cuántas visitas acaban comprando</p>
              </div>
            </div>
            {funnel?.has_sessions ? (
              <>
                {(() => {
                  const steps = [
                    { label: "Visitas", value: funnel.sessions, pct: 1, hint: "a la tienda online" },
                    ...(funnel.has_funnel_steps
                      ? [
                          { label: "Añaden al carrito", value: funnel.cart_additions, pct: funnel.cart_additions / (funnel.sessions || 1), hint: "de las visitas" },
                          { label: "Llegan al pago", value: funnel.checkouts_reached, pct: funnel.checkouts_reached / (funnel.cart_additions || 1), hint: "de los que añaden al carrito" },
                          { label: "Compran", value: funnel.purchases, pct: funnel.purchases / (funnel.checkouts_reached || 1), hint: "de los que llegan al pago" },
                        ]
                      : [{ label: "Pedidos", value: funnel.orders_count, pct: funnel.conversion_rate_own ?? 0, hint: "de las visitas" }]),
                  ];
                  const sessions = Math.max(steps[0]?.value ?? 0, 1);
                  return (
                    <BarRows
                      variant="stack"
                      ariaLabel="Embudo de la tienda online"
                      max={sessions}
                      rows={steps.map((step, i) => ({
                        key: step.label,
                        label: step.label,
                        value: Math.max(step.value, sessions * 0.01),
                        display: fmtNum(step.value),
                        sub: i === 0 ? step.hint : `${pct(step.pct)} ${step.hint}`,
                      }))}
                    />
                  );
                })()}
              </>
            ) : (
              <Empty>Todavía no tenemos datos de sesiones. Llegan con la sincronización de analítica de Shopify.</Empty>
            )}
          </div>
          {recovery?.checkouts ? (
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Carritos abandonados</h3>
              </div>
            </div>
            {(
              <>
                <div className={s.kv}>
                  <span className={s.num} style={{ color: "var(--bad)" }}>{fmtEur(recovery.lost_value)}</span>
                  <span className={s.muted}>se quedaron en el carrito</span>
                </div>
                <div className={s.stack} aria-hidden="true">
                  <i style={{ width: `${(recovery.recovered / recovery.checkouts) * 100}%`, background: "var(--good)" }} />
                  <i style={{ flex: 1, background: "var(--bad-soft)" }} />
                </div>
                <div className={s.stackL}>
                  <span>
                    <i className={s.sw} style={{ background: "var(--good)" }} />
                    Recuperados {fmtNum(recovery.recovered)} de {fmtNum(recovery.checkouts)} ({pct(recovery.recovery_rate)})
                  </span>
                  <span className={s.num}>{fmtEur(recovery.recovered_value)} recuperados</span>
                </div>
                <div className={s.minis} style={{ marginTop: 18 }}>
                  <Mini label="Tasa de recuperación" value={pct(recovery.recovery_rate)} />
                  <Mini
                    label="Tardan en volver"
                    value={recovery.avg_hours_to_recover != null ? `${fmtNum(recovery.avg_hours_to_recover, 1)} h` : "—"}
                    hint="de media, los que vuelven"
                  />
                </div>
              </>
            )}
          </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------ Productos ------------------------------ */}
      <section className={s.sec} aria-labelledby="shop-prod">
        <SectionHead
          id="shop-prod"
          title="Productos"
          ai={stockAi.data?.output.headline ?? null}
        />
        <div className={s.two}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Los más vendidos</h3>
                <p className={s.sub}>Por ventas en el periodo</p>
              </div>
            </div>
            {top.length ? (
              <div className={s.tblWrap} role="region" aria-label="Productos más vendidos; desliza para comparar columnas" tabIndex={0} style={{ marginTop: 0 }}>
                <table className={s.tbl} aria-label="Ventas netas por producto">
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col">Unidades</th>
                      <th scope="col" title="Ventas netas de este producto en el periodo seleccionado">Ventas netas</th>
                      <th scope="col">% del total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((product) => (
                      <tr key={product.product_id}>
                        <td>
                          <a
                            className="font-medium underline decoration-dotted underline-offset-4"
                            href={`/shopify/productos/${encodeURIComponent(product.product_id)}?${new URLSearchParams({ organizationId, ...(connectionId ? { connectionId } : {}) }).toString()}`}
                            aria-label={`Abrir ficha de ${product.title}`}
                          >
                    {product.title}
                        </a>
                        {product.lines_without_metrics > 0 ? (
                          <small className={s.muted}>
                            {product.lines_without_metrics} líneas pendientes de sincronizar
                          </small>
                        ) : product.lines_with_estimated_metrics > 0 ? (
                          <small className={s.muted}>
                            {product.lines_with_estimated_metrics} líneas con importe estimado
                          </small>
                        ) : null}
                      </td>
                        <td className={s.tdN}>{fmtNum(product.quantity_sold)}</td>
                        <td className={s.tdN}>
                          {fmtEur(product.revenue)}
                          <span className={s.shareBar}>
                            <i style={{ width: `${(product.revenue / topMax) * 100}%` }} />
                          </span>
                        </td>
                        <td className={s.tdN}>{pct(product.revenue / (sales.net_sales || 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>Sin ventas de productos en este periodo.</Empty>
            )}
          </div>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Stock</h3>
                <p className={s.sub}>Estado actual del inventario</p>
              </div>
              <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} disabled={running !== null} onClick={() => void runStockPlanner()}>
                {running === "/ai/stock-planner-run" ? "Actualizando…" : "Actualizar previsión"}
              </button>
            </div>
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
                <span className={s.lbl}>Con stock vigilado</span>
                <span className={s.num}>{fmtNum(data.stock.tracked_items)}</span>
              </div>
            </div>
            {stockAi.data ? (
              <div style={{ marginTop: 16 }}>
                <DiagnosticReading tag="A06" diagnostic={stockAi.data} audience={asConsultant ? "consultor" : "cliente"} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ------------------------------ Clientes ------------------------------ */}
      <section className={s.sec} aria-labelledby="shop-cli">
        <SectionHead
          id="shop-cli"
          title="Clientes"
          ai={null}
        />
        {!ins ? (
          <div className={s.panel}>{insights.isLoading ? <p className={s.empty}>Cargando…</p> : <Unavailable what="los datos de clientes" />}</div>
        ) : (
          <div className={s.panel}>
            {ins.recurrence ? (
              <RecurrenceBlock recurrence={ins.recurrence} currencyCode={data.currency_code} />
            ) : (
              <Unavailable what="la recurrencia" />
            )}
            {ins.customer_value ? (
              <div className={s.minis} style={{ marginTop: 20, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <Mini label="Clientes" value={fmtNum(ins.customer_value.customers)} />
                <Mini
                  label="Pedidos por cliente"
                  value={ins.customer_value.avg_orders_per_customer != null ? fmtNum(ins.customer_value.avg_orders_per_customer, 2) : "—"}
                />
                <Mini
                  label="Gasto medio por cliente"
                  value={ins.customer_value.avg_revenue_per_customer != null ? fmtEur(ins.customer_value.avg_revenue_per_customer, 2) : "—"}
                />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function RecurrenceBlock({ recurrence, currencyCode }: { recurrence: NonNullable<Insights["recurrence"]>; currencyCode: string | null }) {
  const orders = recurrence.new_orders + recurrence.returning_orders + recurrence.unknown_orders || 1;
  const revenue = recurrence.new_revenue + recurrence.returning_revenue || 1;
  return (
    <div style={{ ["--new-c" as string]: "color-mix(in srgb, var(--accent) 30%, white)" }}>
      <div className={s.kv}>
        <span className={s.num}>{pct(recurrence.repeat_order_rate)}</span>
        <span className={s.muted}>de los pedidos son de clientes que repiten</span>
      </div>
      <p className={s.lbl} style={{ marginTop: 18 }}>
        Pedidos
      </p>
      <div className={s.stack} aria-hidden="true">
        <i style={{ width: `${(recurrence.new_orders / orders) * 100}%`, background: "var(--new-c)" }} />
        <i style={{ width: `${(recurrence.returning_orders / orders) * 100}%`, background: "var(--accent)" }} />
        <i style={{ flex: 1, background: "var(--sunken)" }} />
      </div>
      <div className={s.stackL}>
        <span>
          <i className={s.sw} style={{ background: "var(--new-c)" }} />
          Nuevos {fmtNum(recurrence.new_orders)}
        </span>
        <span>
          <i className={s.sw} style={{ background: "var(--accent)" }} />
          Repiten {fmtNum(recurrence.returning_orders)}
        </span>
        {recurrence.unknown_orders ? (
          <span>
            <i className={s.sw} style={{ background: "var(--sunken)" }} />
            Sin cliente {fmtNum(recurrence.unknown_orders)}
          </span>
        ) : null}
      </div>
      <p className={s.lbl} style={{ marginTop: 16 }}>
        Ventas
      </p>
      <div className={s.stack} aria-hidden="true">
        <i style={{ width: `${(recurrence.new_revenue / revenue) * 100}%`, background: "var(--new-c)" }} />
        <i style={{ flex: 1, background: "var(--accent)" }} />
      </div>
      <div className={s.stackL}>
        <span className={s.num}>{formatShopifyMoney(recurrence.new_revenue, currencyCode)} de nuevos</span>
        <span className={s.num}>{formatShopifyMoney(recurrence.returning_revenue, currencyCode)} de los que repiten</span>
      </div>
    </div>
  );
}
