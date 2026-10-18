"use client";

import { useState, type ReactNode } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { useCopilotAsk } from "@/components/copilot-ask";
import { Skeleton, toast } from "@/components/ui";
import { BarRows } from "@/components/data-bars";
import type { AssignedConsultant } from "@/hooks/use-assigned-consultant";
import { DELIVERY_AREAS, DELIVERY_EXCEPTION_LABELS, DELIVERY_NEXT_ACTIONS } from "../shopify/insights-sections";
import { canShowProfit, salesChangePct, storePulse } from "./store-pulse";
import { fmtNum } from "./client-pulse-model";
import {
  cx,
  Delta,
  Empty,
  findingFor,
  Kpi,
  MONTHS,
  prioClass,
  SalesChart,
  SectionHead,
  Spark,
  usePins,
  WorkQueue,
  type Diagnostic,
  type Metrics,
  type Operations,
} from "./client-pulse";
import s from "./client-pulse.module.css";
import { DashboardSections } from "./dashboard-sections";

/**
 * Pestaña Shopify del panel del cliente.
 *
 * La portada ("Pulso") mezcla canales para decidir; esta mira solo la tienda y
 * responde a lo que un e-commerce se pregunta de ella: cuánto entra de verdad
 * (bruto -> descuentos -> devoluciones), dónde se pierden visitas, qué
 * productos tiran y cuáles vuelven, si los clientes repiten y cuánto valen,
 * de dónde llegan las ventas según la propia tienda y cómo van los envíos.
 *
 * El origen de las ventas es first-party (datos de Shopify): a diferencia de
 * lo que se atribuyen Meta o Klaviyo, aquí un pedido cuenta una sola vez.
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

function formatShopifyMoney(value: number | null | undefined, currencyCode: string | null, decimals = 0): string {
  if (value == null || !currencyCode) return "—";
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: decimals }).format(value)} ${currencyCode}`;
  }
}

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

const PAYBACK_REASON: Record<string, string> = {
  sin_cohorte: "todavía no hay clientes con antigüedad suficiente",
  sin_coste: "faltan costes de producto",
  sin_cac: "no hay gasto en publicidad con el que comparar",
  cohorte_inmadura: "los clientes aún son recientes",
  currency_incompatible: "las fuentes financieras usan monedas distintas",
  currency_unknown: "no se pudo verificar la moneda de todas las fuentes financieras",
};

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

  const metrics = useCachedQuery<ShopifyMetrics>(`${base}/shopify/metrics?days=${days}${scope}`);
  const insights = useCachedQuery<Insights>(`${base}/shopify/insights?days=${days}${scope}`);
  const monitor = useCachedQuery<Diagnostic>(`${base}/ai/monitor?days=30&view=shopify${scope}`);
  const stockAi = useCachedQuery<Diagnostic>(`${base}/ai/stock-planner?days=30${scope}`);
  // "Operativa de Shopify" es consultantOnly (ver dashboard-ai-agents.ts): el
  // cliente no la pide, por eso la key es null cuando no hay consultor mirando.
  const operativaShopify = useCachedQuery<Diagnostic>(asConsultant ? `${base}/ai/operativa-shopify?days=30${scope}` : null);
  const operations = useCachedQuery<Operations>(`${base}/operations`);

  const data = metrics.data;
  const fmtEur = (value: number | null | undefined, decimals = 0) =>
    formatShopifyMoney(value, data?.currency_code ?? null, decimals);
  const financialCurrencyComparable = data?.financial_currency_coverage.status === "compatible";
  const productCostCurrencyComparable = data
    ? !data.financial_currency_coverage.unknown_sources.includes("costes de producto")
      && !data.financial_currency_coverage.mismatched_sources.some((item) => item.source === "costes de producto")
    : false;
  const lineMetricsCoverageKnown = data
    ? Number.isFinite(data.margin.lines_without_metrics)
    : false;
  const lineMetricsComplete = lineMetricsCoverageKnown && data?.margin.lines_without_metrics === 0;
  const profitCoverageComplete = data
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
  const proposals = [stockAi.data, financialCurrencyComparable ? operativaShopify.data : undefined]
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

  const storeSelectionRequired = metrics.error?.includes("shopify_store_selection_required")
    || insights.error?.includes("shopify_store_selection_required");
  const currencyUnavailable = metrics.error?.includes("shopify_currency_unavailable")
    || insights.error?.includes("shopify_currency_unavailable");

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
              <a className={cx(s.btn, s.acc)} href="/integraciones/shopify">Revisar integración</a>
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
              <a className={cx(s.btn, s.acc)} href="/integraciones/shopify">
                Ir a Integraciones
              </a>
            </div>
          ) : null}
          <div className={s.heroActions}><button type="button" className={cx(s.btn, s.ghost)} onClick={() => { metrics.reload(); insights.reload(); }}>Reintentar la carga</button></div>
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
  const salesAi = findingFor(diagnostic, /ventas|tienda|shopify|pedidos|ingres/i);
  const headline = salesAi?.title ?? pulse.headline;
  const yoy = data.previous_year ? salesChangePct(data.financial.net_revenue_ex_tax, data.previous_year.net_revenue_ex_tax) : null;
  const gross = sales.gross_sales || 1;
  const funnel = data.funnel;
  const recovery = ins?.checkout_recovery ?? null;
  const top = data.top_products.slice(0, 8);
  const topMax = Math.max(...top.map((p) => p.revenue), 1);
  const stockRecommendations = (stockAi.data?.output.proposed_writes ?? []).flatMap((write, index) => {
    const decision = stockAi.data?.output.proposal_decisions?.find((item) => item.index === index);
    const productId = write.related_product_id?.toLowerCase();
    if (!productId) return [{ write, product: { product_id: "", title: write.title }, decision }];
    const matchedProduct = top.find((item) => item.product_id.toLowerCase() === productId);
    const product = matchedProduct ?? { product_id: productId, title: write.title };
    return [{ write, product, decision }];
  });
  const stockAssessmentMessage = stockAi.data?.stale
    ? "Este análisis está desactualizado; actualiza la previsión antes de decidir."
    : stockAi.data?.output.weekly_demand_coverage === "unavailable"
      ? "No se pudo cargar el histórico semanal. El análisis no usa semanas ausentes como ventas cero."
      : stockAi.data?.output.weekly_demand_coverage === "incomplete"
        ? "El histórico semanal no cubre todas las semanas; las semanas ausentes se consideran desconocidas."
        : stockAi.data?.output.product_count === 0
          ? "No hay productos activos con ventas observadas en el periodo."
          : "El análisis actual no propone reponer ninguno de estos productos. Consulta el panel de stock para ver otros riesgos.";

  return (
    <div className={s.root}>
      <DashboardSections items={[{"id":"shop-headline","label":"Resumen"},{"id":"shop-pendiente","label":"Qué hacer"},{"id":"shop-conv","label":"Conversión"},{"id":"shop-prod","label":"Productos"},{"id":"shop-cli","label":"Clientes"},{"id":"shop-orig","label":"Origen"},{"id":"shop-env","label":"Envíos"}]} />
      {/* ------------------------------ Hero ------------------------------ */}
      <section className={s.hero} aria-labelledby="shop-headline">
        <div className={s.heroTop}>
          <div>
            <div className={s.heroMeta} style={{ alignItems: "center" }}>
              <span>{organizationName} · Shopify</span>
              <div className={cx(s.seg, s.heroSeg)} role="group" aria-label="Periodo">
                {periods.map((p) => (
                  <button key={p} type="button" aria-pressed={p === days} onClick={() => { setDays(p); setActivePin(null); }}>
                    {periodButton(p)}
                  </button>
                ))}
              </div>
            </div>
            <h1 id="shop-headline" className={s.headline}>
              Shopify: ventas y operación
            </h1>
            <p className={s.headlineDetail}>{salesAi ? <span className={s.ia}>A02</span> : null}{headline}</p>
            <p className={s.headlineDetail}>
              {fmtNum(sales.orders_count)} pedidos · {fmtNum(sales.units_sold)} unidades · ticket medio {fmtEur(sales.aov, 2)} en {periodPhrase(days)}.
            </p>
            <div className={s.heroActions}>
              <button type="button" className={cx(s.btn, s.acc)} onClick={() => askCopilot(`Explícame cómo va mi tienda: «${headline}». ¿Qué haría primero?`, "Tu tienda en Shopify")}>
                <span className={s.ia} style={{ background: "var(--on-accent)", color: "var(--accent)" }}>
                  IA
                </span>
                Preguntar por qué
              </button>
              {hideFullLink ? null : (
                <a className={cx(s.btn, s.ghost)} href="/shopify">
                  Analítica completa
                </a>
              )}
            </div>
          </div>
          <aside className={s.heroSide} aria-label="Comparativas">
            <p>
              <strong>Ventas netas</strong>
            </p>
            <div className={s.compare}>
              <div>
                <span>Este periodo</span>
                <span className={s.num}>{fmtEur(sales.net_sales)}</span>
              </div>
              <div>
                <span>Periodo anterior</span>
                <span className={s.num}>{previous ? fmtEur(previous.sales.net_sales) : "—"}</span>
              </div>
              <div>
                <span>Cambio</span>
                <Delta change={salesChangePct(sales.net_sales, previous?.sales.net_sales ?? null)} />
              </div>
              <div>
                <span>Frente al año pasado</span>
                {yoy !== null ? <Delta change={yoy} /> : <span className={s.num}>—</span>}
              </div>
            </div>
            {yoy !== null ? <p>Comparado sin IVA con las mismas fechas del año pasado.</p> : null}
          </aside>
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

      <section className={s.sec} aria-label="Lectura ejecutiva de Shopify">
        <div className={s.panel}>
          <h2 className={s.readingTitle}><span className={s.ia}>A02</span> Lectura de Shopify</h2>
          <p className={s.headlineDetail}>
            {monitor.data?.output.headline ?? "El análisis específico de Shopify aparecerá aquí cuando termine su primera ejecución."}
          </p>
        </div>
      </section>

      {!financialCurrencyComparable ? (
        <div className={s.panel} role="status" style={{ marginTop: 16 }}>
          <strong>Rentabilidad pendiente de validar por moneda</strong>
          <p className={s.trackTxt}>
            {data.financial_currency_coverage.status === "incompatible"
              ? `Hay fuentes en monedas distintas a ${data.currency_code ?? "la tienda"}: ${data.financial_currency_coverage.mismatched_sources.map((item) => `${item.source} (${item.currencies.join(", ")})`).join("; ")}.`
              : `No se pudo confirmar la moneda de todas las fuentes financieras${data.financial_currency_coverage.unknown_sources.length ? `: ${data.financial_currency_coverage.unknown_sources.join(", ")}` : ""}.`}
            {" "}Se mantienen las ventas de Shopify, pero se ocultan las conclusiones de rentabilidad hasta tener una base comparable. No se convierte moneda automáticamente.
          </p>
        </div>
      ) : null}

      {afterHero}

      {/* ------------------------------ Cifras ------------------------------ */}
      <div className={cx(s.kpis, s.kpis4)} aria-label="Cifras de la tienda">
        <Kpi
          label="Ventas brutas"
          value={fmtEur(sales.gross_sales)}
          delta={<Delta change={salesChangePct(sales.gross_sales, previous?.sales.gross_sales ?? null)} />}
          vs={previous ? fmtEur(previous.sales.gross_sales) : null}
          slot={<p className={s.trackTxt}>Antes de descuentos y devoluciones</p>}
        />
        <Kpi
          label="Descuentos"
          value={fmtEur(-sales.discounts)}
          delta={<Delta change={salesChangePct(sales.discounts, previous?.sales.discounts ?? null)} invert />}
          vs={previous ? fmtEur(-previous.sales.discounts) : null}
          slot={<p className={s.trackTxt}>{pct(sales.discounts / gross)} de las ventas brutas</p>}
        />
        <Kpi
          label="Devoluciones"
          value={fmtEur(-sales.refunds)}
          delta={<Delta change={salesChangePct(sales.refunds, previous?.sales.refunds ?? null)} invert />}
          vs={previous ? fmtEur(-previous.sales.refunds) : null}
          slot={<p className={s.trackTxt}>{pct(sales.refunds / gross)} de las ventas brutas</p>}
        />
        <Kpi
          label="Ventas netas"
          value={fmtEur(sales.net_sales)}
          delta={<Delta change={salesChangePct(sales.net_sales, previous?.sales.net_sales ?? null)} />}
          vs={previous ? fmtEur(previous.sales.net_sales) : null}
          slot={<Spark values={daily.map((d) => d.net_sales)} />}
        />
        <Kpi
          label="Pedidos"
          value={fmtNum(sales.orders_count)}
          delta={<Delta change={salesChangePct(sales.orders_count, previous?.sales.orders_count ?? null)} />}
          vs={previous ? fmtNum(previous.sales.orders_count) : null}
          slot={<Spark values={daily.map((d) => d.orders_count)} />}
        />
        <Kpi
          label="Unidades vendidas"
          value={fmtNum(sales.units_sold)}
          delta={<Delta change={salesChangePct(sales.units_sold, previous?.sales.units_sold ?? null)} />}
          vs={previous ? fmtNum(previous.sales.units_sold) : null}
          slot={<p className={s.trackTxt}>{sales.orders_count ? `${fmtNum(sales.units_sold / sales.orders_count, 1)} por pedido` : " "}</p>}
        />
        <Kpi
          label="Ticket medio"
          value={fmtEur(sales.aov, 2)}
          delta={<Delta change={salesChangePct(sales.aov, previous?.sales.aov ?? null)} />}
          vs={previous ? fmtEur(previous.sales.aov, 2) : null}
          slot={<Spark values={daily.filter((d) => d.orders_count > 0).map((d) => d.net_sales / d.orders_count)} />}
        />
        <Kpi
          label="Margen bruto"
          tag={!lineMetricsComplete || data.margin.items_without_cost > 0 ? "incompleto" : data.margin.lines_with_estimated_metrics > 0 || data.margin.items_with_estimated_cost > 0 ? "estimado" : undefined}
          value={!productCostCurrencyComparable || !lineMetricsComplete || (data.margin.items_without_cost > 0 && data.margin.cogs === 0) ? "—" : `${fmtNum(data.margin.margin_pct, 1)} %`}
          slot={
            <p className={s.trackTxt}>
              {!productCostCurrencyComparable
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

      {/* ------------------------------ Pendiente ------------------------------ */}
      <section className={s.sec} aria-labelledby="shop-pendiente">
        <SectionHead
          id="shop-pendiente"
          title="Pendiente en esta tienda"
          ai={null}
          fallback="Propuestas de reposición de stock y, si tienes consultor, de su operativa en Shopify."
          onAsk={() => askCopilot("Con las señales de Shopify y las tareas abiertas, ¿qué única prioridad debería iniciar esta semana? Cita la métrica, fuente y periodo; señala si falta evidencia.", "Pendiente en Shopify")}
        />
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
        {asConsultant && !operativaShopify.data ? (
          <button
            type="button"
            className={cx(s.btn, s.ghost, s.sm)}
            disabled={running !== null}
            onClick={() => void runOperativaShopify()}
          >
            {running === "/ai/operativa-shopify-run" ? "Revisando la operativa…" : "Lanzar operativa de Shopify"}
          </button>
        ) : null}
      </section>

      {/* ------------------------------ Conversión ------------------------------ */}
      <section className={s.sec} aria-labelledby="shop-conv">
        <SectionHead
          id="shop-conv"
          title="Conversión"
          ai={findingFor(diagnostic, /conver|embudo|carrito|checkout|cro|web/i)?.title ?? null}
          fallback={funnel?.has_sessions && funnel.conversion_rate_own != null ? `De cada 100 visitas compran ${fmtNum(funnel.conversion_rate_own * 100, 1)}.` : null}
          onAsk={() => askCopilot("¿En qué etapa medible del embudo cae más la conversión y qué cambio probarías primero? Cita sesiones, eventos y periodo; si no hay cobertura, indícalo.", "Conversión")}
        />
        <div className={s.two}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Del escaparate a la compra</h3>
                <p className={s.sub}>Sesiones de la tienda online y pedidos</p>
              </div>
            </div>
            {funnel?.has_sessions ? (
              <>
                {(() => {
                  const steps = [
                    { label: "Sesiones", value: funnel.sessions, pct: 1, hint: "Visitas a la tienda online" },
                    ...(funnel.has_funnel_steps
                      ? [
                          { label: "Añaden al carrito", value: funnel.cart_additions, pct: funnel.cart_additions / (funnel.sessions || 1), hint: "de las sesiones" },
                          { label: "Llegan al pago", value: funnel.checkouts_reached, pct: funnel.checkouts_reached / (funnel.cart_additions || 1), hint: "de los que añaden al carrito" },
                          { label: "Compran", value: funnel.purchases, pct: funnel.purchases / (funnel.checkouts_reached || 1), hint: "de los que llegan al pago" },
                        ]
                      : [{ label: "Pedidos", value: funnel.orders_count, pct: funnel.conversion_rate_own ?? 0, hint: "de las sesiones" }]),
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
                {data.funnel_daily.length > 1 ? (
                  <div className={s.headroom}>
                    <p className={s.lbl}>Conversión por día</p>
                    <div style={{ marginTop: 12 }}>
                      <Spark values={data.funnel_daily.map((d) => (d.conversion_rate_own ?? 0) * 100)} />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <Empty>Todavía no tenemos datos de sesiones. Llegan con la sincronización de analítica de Shopify.</Empty>
            )}
          </div>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Carritos abandonados</h3>
                <p className={s.sub}>Checkouts que no terminaron en pedido</p>
              </div>
            </div>
            {insights.isLoading && !ins ? (
              <p className={s.empty}>Cargando…</p>
            ) : !recovery ? (
              <Unavailable what="la recuperación de carritos" />
            ) : recovery.checkouts === 0 ? (
              <Empty>No hay checkouts abandonados en este periodo.</Empty>
            ) : (
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
        </div>
      </section>

      {/* ------------------------------ Productos ------------------------------ */}
      <section className={s.sec} aria-labelledby="shop-prod">
        <SectionHead
          id="shop-prod"
          title="Productos"
          ai={stockAi.data?.output.headline ?? findingFor(diagnostic, /producto|stock|invent|devol/i)?.title ?? null}
        />
        <div className={s.two}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Los que más venden y su reposición</h3>
                <p className={s.sub}>Por ventas en el periodo</p>
              </div>
            </div>
            {top.length ? (
              <div className={s.tblWrap} role="region" aria-label="Productos más vendidos; desliza para comparar columnas" tabIndex={0} style={{ marginTop: 0 }}>
                <table className={s.tbl} aria-label="Ventas netas por producto">
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col">Uds.</th>
                      <th scope="col" title="Ventas netas de este producto en el periodo seleccionado">Ventas netas</th>
                      <th scope="col">Peso</th>
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
            <div className={s.restockBlock}>
              <div className={s.restockHeading}>
                <p className={s.lbl}>Propuestas de reposición</p>
                <button
                  type="button"
                  className={cx(s.btn, s.ghost, s.sm)}
                  disabled={running !== null}
                  onClick={() => void runStockPlanner()}
                >
                  {running === "/ai/stock-planner-run" ? "Actualizando…" : "Actualizar previsión"}
                </button>
              </div>
              {stockAi.data?.stale ? <p className={s.muted}>Este análisis está desactualizado; verifica el inventario actual antes de aprobar una reposición.</p> : null}
              {stockRecommendations.length ? (
                <ul className={s.restockList}>
                {stockRecommendations.map(({ write, product, decision }) => (
                    <li className={s.restockItem} key={`${product.product_id}:${write.title}`}>
                      <div>
                        {product.product_id ? (
                          <a
                            className={s.restockProduct}
                            href={`/shopify/productos/${encodeURIComponent(product.product_id)}?${new URLSearchParams({ organizationId, ...(connectionId ? { connectionId } : {}) }).toString()}`}
                          >{product.title}</a>
                        ) : <span className={s.restockProduct}>{product.title}</span>}
                        <p className={s.restockStatus}>
                          {decision?.status === "created" || decision?.status === "link_failed" ? <><a href={decision.task_id ? `/tareas?taskId=${encodeURIComponent(decision.task_id)}` : "/tareas"}>Tarea creada</a> · aprobada</>
                            : decision?.status === "skipped" ? "No se creó una tarea: ya hay una reposición abierta o falta vincular el producto."
                              : decision?.status === "failed" ? "No se pudo crear la tarea; la propuesta sigue pendiente de revisión."
                                : stockAi.data?.output_status === "pending_approval" ? "Propuesto para reponer · pendiente de aprobación" : "Propuesta anterior; revisa su estado en Tareas"}
                        </p>
                      </div>
                      <details className={s.restockWhy}>
                        <summary aria-label={`Por qué se propone reponer ${product.title}`} title="Por qué se propone">
                          ?
                        </summary>
                        <div className={s.restockReason}>
                          <strong>Por qué se propone</strong>
                          <p>{write.rationale || write.description}</p>
                          {write.evidence?.length ? (
                            <ul>{write.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
                          ) : null}
                          {write.due_hint ? <p>Horizonte sugerido: {write.due_hint}</p> : null}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : stockAi.data ? (
                <p className={s.muted}>
                  {stockAssessmentMessage}
                </p>
              ) : (
                <p className={s.muted}>Aún no hay una previsión disponible. Actualiza el análisis para ver productos priorizados.</p>
              )}
              <p className={s.restockFootnote}>Son propuestas para revisar; no se envía ningún pedido automáticamente.</p>
            </div>
          </div>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Stock</h3>
                <p className={s.sub}>Estado actual del inventario</p>
              </div>
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
                <span className={s.lbl}>Controlados</span>
                <span className={s.num}>{fmtNum(data.stock.tracked_items)}</span>
              </div>
            </div>
            {stockAi.data ? (
              <ul className={s.findings}>
                {stockAi.data.output.findings.slice(0, 4).map((finding, i) => (
                  <li key={i} className={s.finding}>
                    <span className={cx(s.pr, prioClass(finding.severity))} aria-hidden="true" />
                    <div>
                      <p className={s.qiT}>{finding.title}</p>
                      <p className={s.findingE}>{finding.evidence}</p>
                    </div>
                  </li>
                ))}
                {stockAi.data.output_status === "pending_approval" && stockAi.data.output.proposed_writes.length ? (
                  <li className={s.finding}>
                    <span />
                    <p className={s.muted}>
                      La IA propone {stockAi.data.output.proposed_writes.length} tarea(s) de reposición. Decídelas en <a href="#shop-pendiente">Pendiente</a>, más abajo.
                    </p>
                  </li>
                ) : null}
              </ul>
            ) : (
              <div className={s.qfB} style={{ marginTop: 16 }}>
                <button type="button" className={cx(s.btn, s.ghost, s.sm)} disabled={running !== null} onClick={() => void runStockPlanner()}>
                  {running === "/ai/stock-planner-run" ? "Actualizando previsión…" : "Actualizar previsión"}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className={s.two}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Los que más se devuelven</h3>
                <p className={s.sub}>Unidades devueltas sobre vendidas</p>
              </div>
            </div>
            {!ins ? (
              insights.isLoading ? <p className={s.empty}>Cargando…</p> : <Unavailable what="las devoluciones" />
            ) : ins.returns.length === 0 ? (
              <Empty>No hay devoluciones en este periodo.</Empty>
            ) : (
              <div className={s.tblWrap} role="region" aria-label="Devoluciones; desliza para comparar productos" tabIndex={0} style={{ marginTop: 0 }}>
                <table className={s.tbl} aria-label="Devoluciones por producto">
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col">Devueltas</th>
                      <th scope="col">Tasa</th>
                      <th scope="col">Motivo principal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ins.returns.slice(0, 6).map((row) => (
                      <tr key={row.product_id}>
                        <td>
                          <a
                            className="font-medium underline decoration-dotted underline-offset-4"
                            href={`/shopify/productos/${encodeURIComponent(row.product_id)}?${new URLSearchParams({ organizationId, ...(connectionId ? { connectionId } : {}) }).toString()}`}
                            aria-label={`Abrir ficha de ${row.title}`}
                          >
                            {row.title}
                          </a>
                        </td>
                        <td className={s.tdN}>
                          {fmtNum(row.units_returned)}/{fmtNum(row.units_sold)}
                        </td>
                        <td className={s.tdN} style={{ color: (row.return_rate ?? 0) >= 0.1 ? "var(--bad)" : undefined }}>
                          {pct(row.return_rate)}
                        </td>
                        <td>{row.top_return_reason ?? <span className={s.muted}>Sin motivo</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Códigos de descuento</h3>
                <p className={s.sub}>Qué se vende con descuento y cuánto cuesta</p>
              </div>
            </div>
            {!ins ? (
              insights.isLoading ? <p className={s.empty}>Cargando…</p> : <Unavailable what="los descuentos" />
            ) : ins.unavailable.includes("discounts") ? (
              <Unavailable what="los descuentos" />
            ) : ins.discounts.length === 0 ? (
              <Empty>No se han usado códigos de descuento en este periodo.</Empty>
            ) : (
              <div className={s.tblWrap} role="region" aria-label="Descuentos; desliza para comparar códigos" tabIndex={0} style={{ marginTop: 0 }}>
                <table className={s.tbl} aria-label="Ventas y coste de códigos de descuento">
                  <thead>
                    <tr>
                      <th scope="col">Código</th>
                      <th scope="col">Pedidos</th>
                      <th scope="col">Ventas</th>
                      <th scope="col" title="Importe atribuido al código solo con asignaciones completas de Shopify">Descontado</th>
                      <th scope="col">Nuevos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ins.discounts.slice(0, 6).map((row) => (
                      <tr key={row.code}>
                        <td>
                          <a
                            className={s.chip}
                            href={`/shopify/promociones?${new URLSearchParams({ organizationId, q: row.code, ...(connectionId ? { connectionId } : {}) }).toString()}`}
                            aria-label={`Buscar la ficha de promoción para el código ${row.code}`}
                          >
                            {row.code}
                          </a>
                        </td>
                        <td className={s.tdN}>{fmtNum(row.orders)}</td>
                        <td className={s.tdN}>
                          {fmtEur(row.order_revenue)}
                          {row.orders_with_multiple_codes > 0
                            ? <small className={s.muted}> · {fmtNum(row.orders_with_multiple_codes)} pedidos comparten codigo</small>
                            : null}
                        </td>
                        <td className={s.tdN}>
                          {row.attribution_coverage === "complete" && row.attributed_discount_total != null
                            ? fmtEur(row.attributed_discount_total)
                            : <span className={s.muted}>Sin cobertura exacta</span>}
                          {row.attribution_coverage === "complete" && row.discount_share != null
                            ? <small className={s.muted}> · {pct(row.discount_share)}</small>
                            : null}
                        </td>
                        <td className={s.tdN}>{fmtNum(row.new_customers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------ Clientes ------------------------------ */}
      <section className={s.sec} aria-labelledby="shop-cli">
        <SectionHead
          id="shop-cli"
          title="Clientes"
          ai={findingFor(diagnostic, /client|recurren|repet|fideli|retenc|ltv|churn/i)?.title ?? null}
          fallback={ins?.recurrence?.repeat_order_rate != null ? `${pct(ins.recurrence.repeat_order_rate)} de tus pedidos son de clientes que repiten.` : null}
          onAsk={() => askCopilot("¿Qué muestran la repetición de compra y el valor observado por cliente? Recomienda una acción de retención respaldada por esos datos y el periodo; no estimes un LTV si no hay antigüedad suficiente.", "Clientes")}
        />
        {!ins ? (
          <div className={s.panel}>{insights.isLoading ? <p className={s.empty}>Cargando…</p> : <Unavailable what="los datos de clientes" />}</div>
        ) : (
          <>
            <div className={s.two}>
              <div className={s.panel}>
                <div className={s.panelH}>
                  <div>
                    <h3>Nuevos frente a los que repiten</h3>
                    <p className={s.sub}>Pedidos y ventas del periodo</p>
                  </div>
                </div>
                {ins.recurrence ? (
                  <RecurrenceBlock recurrence={ins.recurrence} currencyCode={data.currency_code} />
                ) : (
                  <Unavailable what="la recurrencia" />
                )}
                {ins.customer_value ? (
                  <div className={s.minis} style={{ marginTop: 20 }}>
                    <Mini label="Clientes" value={fmtNum(ins.customer_value.customers)} hint={`${fmtNum(ins.customer_value.guest_orders)} pedidos sin cuenta`} />
                    <Mini
                      label="Pedidos por cliente"
                      value={ins.customer_value.avg_orders_per_customer != null ? fmtNum(ins.customer_value.avg_orders_per_customer, 2) : "—"}
                    />
                    <Mini
                      label="Gasto medio por cliente"
                      value={ins.customer_value.avg_revenue_per_customer != null ? fmtEur(ins.customer_value.avg_revenue_per_customer, 2) : "—"}
                      hint={ins.customer_value.median_revenue_per_customer != null ? `mediana ${fmtEur(ins.customer_value.median_revenue_per_customer, 2)}` : undefined}
                    />
                    <Mini
                      label="El 10 % que más gasta"
                      value={ins.customer_value.p90_revenue_per_customer != null ? `≥ ${fmtEur(ins.customer_value.p90_revenue_per_customer, 2)}` : "—"}
                    />
                  </div>
                ) : null}
              </div>
              <div className={s.panel}>
                <div className={s.panelH}>
                  <div>
                    <h3>Lo que vale un cliente con el tiempo</h3>
                    <p className={s.sub}>Gasto medio acumulado de clientes con antigüedad suficiente</p>
                  </div>
                </div>
                {ins.lifetime && ins.lifetime.curve.some((m) => m.avg_revenue != null) ? (
                  <LifetimeBlock lifetime={ins.lifetime} churn={ins.churn} currencyCode={data.currency_code} financialComparable={financialCurrencyComparable} />
                ) : (
                  <Empty>Aún no hay clientes con antigüedad suficiente para calcularlo.</Empty>
                )}
              </div>
            </div>
            {ins.cohorts.length ? <CohortPanel cohorts={ins.cohorts} /> : null}
          </>
        )}
      </section>

      {/* ------------------------------ Origen ------------------------------ */}
      <section className={s.sec} aria-labelledby="shop-orig">
        <SectionHead
          id="shop-orig"
          title="Origen de las ventas"
          ai={null}
          fallback="Según tu propia tienda: cada pedido cuenta una sola vez, a diferencia de lo que se atribuyen Meta o Klaviyo."
          onAsk={() => askCopilot("Según los pedidos de Shopify con origen registrado, ¿qué canal aporta más ventas y clientes nuevos? Cita cobertura, cifra y periodo; no completes los orígenes desconocidos.", "Origen de las ventas")}
        />
        <div className={s.panel}>
          {!ins ? (
            insights.isLoading ? <p className={s.empty}>Cargando…</p> : <Unavailable what="el origen de las ventas" />
          ) : ins.attribution.length === 0 ? (
            <Empty>No hay pedidos con origen registrado en este periodo.</Empty>
          ) : (
            <AttributionTable rows={ins.attribution} currencyCode={data.currency_code} />
          )}
        </div>
      </section>

      {/* ------------------------------ Envíos ------------------------------ */}
      <section className={s.sec} aria-labelledby="shop-env">
        <SectionHead
          id="shop-env"
          title="Envíos"
          ai={findingFor(diagnostic, /env[ií]o|entrega|log[ií]stic|fulfil|transport/i)?.title ?? null}
          onAsk={() => askCopilot("¿Qué incidencias de envío están respaldadas por pedidos o eventos de Shopify y cuál debería revisar primero? Cita cantidad, estado y periodo; diferencia retrasos confirmados de datos incompletos.", "Envíos")}
        />
        <div className={s.two}>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Preparación y entrega</h3>
                <p className={s.sub}>Envíos del periodo</p>
              </div>
            </div>
            {!ins ? (
              insights.isLoading ? <p className={s.empty}>Cargando…</p> : <Unavailable what="los envíos" />
            ) : !ins.delivery ? (
              <Unavailable what="los envíos" />
            ) : ins.delivery.fulfillments === 0 ? (
              <Empty>No hay envíos en este periodo.</Empty>
            ) : (
              <div className={s.minis}>
                <Mini label="Envíos" value={fmtNum(ins.delivery.fulfillments)} hint={`${fmtNum(ins.delivery.delivered)} entregados · ${fmtNum(ins.delivery.in_transit)} en camino`} />
                <Mini label="Tardas en enviar" value={ins.delivery.avg_hours_to_ship != null ? `${fmtNum(ins.delivery.avg_hours_to_ship, 1)} h` : "—"} hint="desde el pedido" />
                <Mini label="Tarda en llegar" value={ins.delivery.avg_days_to_deliver != null ? `${fmtNum(ins.delivery.avg_days_to_deliver, 1)} días` : "—"} hint="desde que sale" />
                <Mini
                  label="Llegan tarde"
                  value={ins.delivery.with_estimate ? pct(ins.delivery.late_deliveries / ins.delivery.with_estimate) : "—"}
                  hint={ins.delivery.with_estimate ? `${fmtNum(ins.delivery.late_deliveries)} de ${fmtNum(ins.delivery.with_estimate)} con fecha estimada${ins.delivery.avg_delay_days != null ? ` · ${fmtNum(ins.delivery.avg_delay_days, 1)} días de retraso medio` : ""}` : "sin fechas estimadas"}
                />
              </div>
            )}
          </div>
          <div className={s.panel}>
            <div className={s.panelH}>
              <div>
                <h3>Incidencias abiertas</h3>
                <p className={s.sub}>Envíos que necesitan revisión</p>
              </div>
              {ins?.delivery_exceptions?.length ? <span className={cx(s.chip, s.chipWarn)}>{ins.delivery_exceptions.length}</span> : null}
            </div>
            {!ins ? (
              insights.isLoading ? <p className={s.empty}>Cargando…</p> : <Unavailable what="las incidencias" />
            ) : ins.delivery_exceptions == null ? (
              <Unavailable what="las incidencias" />
            ) : ins.delivery_exceptions.length === 0 ? (
              <Empty>No hay incidencias abiertas en los envíos sincronizados.</Empty>
            ) : (
              <ul>
                {ins.delivery_exceptions.slice(0, 6).map((item) => (
                  <li key={item.id} className={s.exc}>
                    <div className={s.qiM} style={{ marginTop: 0 }}>
                      <span className={cx(s.chip, s.chipWarn)}>{DELIVERY_EXCEPTION_LABELS[item.exception_type] ?? "Incidencia de entrega"}</span>
                      {item.order_name ? <span className={s.num}>{item.order_name}</span> : null}
                      <span className={s.muted}>hace {fmtNum(item.age_hours / 24, 0)} días</span>
                    </div>
                    <p>{DELIVERY_NEXT_ACTIONS[item.next_action_code] ?? "Revisar el seguimiento del envío."}</p>
                    <p className={s.muted}>
                      {item.tracking_company || "Transportista no identificado"} · {DELIVERY_AREAS[item.likely_area] ?? DELIVERY_AREAS.unknown}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function RecurrenceBlock({ recurrence, currencyCode }: { recurrence: NonNullable<Insights["recurrence"]>; currencyCode: string | null }) {
  const orders = recurrence.new_orders + recurrence.returning_orders + recurrence.unknown_orders || 1;
  const revenue = recurrence.new_revenue + recurrence.returning_revenue || 1;
  return (
    <>
      <div className={s.kv}>
        <span className={s.num}>{pct(recurrence.repeat_order_rate)}</span>
        <span className={s.muted}>de los pedidos son de clientes que repiten</span>
      </div>
      <p className={s.lbl} style={{ marginTop: 18 }}>
        Pedidos
      </p>
      <div className={s.stack} aria-hidden="true">
        <i style={{ width: `${(recurrence.new_orders / orders) * 100}%`, background: "var(--store)" }} />
        <i style={{ width: `${(recurrence.returning_orders / orders) * 100}%`, background: "var(--accent)" }} />
        <i style={{ flex: 1, background: "var(--sunken)" }} />
      </div>
      <div className={s.stackL}>
        <span>
          <i className={s.sw} style={{ background: "var(--store)" }} />
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
        <i style={{ width: `${(recurrence.new_revenue / revenue) * 100}%`, background: "var(--store)" }} />
        <i style={{ flex: 1, background: "var(--accent)" }} />
      </div>
      <div className={s.stackL}>
        <span className={s.num}>{formatShopifyMoney(recurrence.new_revenue, currencyCode)} de nuevos</span>
        <span className={s.num}>{formatShopifyMoney(recurrence.returning_revenue, currencyCode)} de los que repiten</span>
      </div>
    </>
  );
}

function LifetimeBlock({ lifetime, churn, currencyCode, financialComparable }: { lifetime: NonNullable<Insights["lifetime"]>; churn: Insights["churn"]; currencyCode: string | null; financialComparable: boolean }) {
  const curve = lifetime.curve.filter((m) => m.avg_revenue != null);
  const cac = financialComparable ? curve.find((m) => m.cohort_cac != null)?.cohort_cac ?? null : null;
  const max = Math.max(...curve.map((m) => m.avg_revenue ?? 0), cac ?? 0, 1) * 1.15;
  const payback = lifetime.payback;
  const churnRate = churn?.churn_rate == null ? null : Number(churn.churn_rate);
  return (
    <>
      {lifetime.ltv?.avg_revenue != null ? (
        <div className={s.kv}>
          <span className={s.num}>{formatShopifyMoney(lifetime.ltv.avg_revenue, currencyCode, 2)}</span>
          <span className={s.muted}>gasta de media un cliente en {lifetime.ltv.milestone_days} días</span>
        </div>
      ) : null}
      <div style={{ position: "relative" }}>
        <div className={s.ltv}>
          {curve.map((m) => (
            <div key={m.milestone_days} className={s.ltvCol} title={`${m.milestone_days} días: ${formatShopifyMoney(m.avg_revenue ?? 0, currencyCode, 2)} de gasto${financialComparable && m.avg_contribution != null ? `, ${formatShopifyMoney(m.avg_contribution, currencyCode, 2)} de margen` : ""} · ${m.cohort_customers} clientes`}>
              <span style={{ bottom: `calc(${((m.avg_revenue ?? 0) / max) * 100}% + 4px)` }}>{formatShopifyMoney(m.avg_revenue ?? 0, currencyCode)}</span>
              <i style={{ height: `${((m.avg_revenue ?? 0) / max) * 100}%` }} />
              {financialComparable && m.avg_contribution != null && m.avg_contribution > 0 ? <b style={{ height: `${(m.avg_contribution / max) * 100}%` }} /> : null}
            </div>
          ))}
        </div>
        {cac !== null ? (
          <div className={s.cacLine} style={{ bottom: `${(cac / max) * 150}px` }}>
            <span>coste de captación {formatShopifyMoney(cac, currencyCode, 2)}</span>
          </div>
        ) : null}
      </div>
      <div className={s.tlab}>
        {curve.map((m) => (
          <span key={m.milestone_days}>{m.milestone_days} d</span>
        ))}
      </div>
      <div className={s.goalLeg}>
        <span>
          <i className={s.sw} style={{ background: "var(--store)" }} />
          Gasto acumulado
        </span>
        <span>
          <i className={s.sw} style={{ background: "var(--good)" }} />
          Margen acumulado
        </span>
      </div>
      {!financialComparable ? <p className={s.trackTxt} style={{ marginTop: 14 }}>El margen, el coste de captación y el plazo de recuperación no se muestran hasta validar las monedas de todas las fuentes.</p> : null}
      {financialComparable ? <div className={s.second}>
        <div className={s.secondT}>
          <span>Recuperas lo que costó captarlo</span>
          <span className={s.num}>
            {payback.status === "PAID_BACK"
              ? `en ${payback.days} días`
              : payback.status === "NOT_WITHIN_HORIZON"
                ? "no dentro de 1 año"
                : "—"}
          </span>
        </div>
        {payback.status === "UNKNOWN" ? <p className={s.trackTxt}>No se puede calcular: {PAYBACK_REASON[payback.reason] ?? payback.reason}.</p> : null}
        {churnRate !== null && churn ? (
          <div className={s.secondT}>
            <span>No vuelven a comprar en {churn.churn_days} días</span>
            <span className={s.num}>
              {pct(churnRate)} <small className={s.muted}>de {fmtNum(churn.base_customers)}</small>
            </span>
          </div>
        ) : null}
      </div> : null}
    </>
  );
}

function CohortPanel({ cohorts }: { cohorts: Insights["cohorts"] }) {
  const MAX_OFFSET = 6;
  const months = [...new Set(cohorts.map((c) => c.cohort_month))].sort().slice(-8);
  const cell = new Map(cohorts.map((c) => [`${c.cohort_month}|${c.month_offset}`, c]));
  return (
    <div className={s.panel}>
      <div className={s.panelH}>
        <div>
          <h3>¿Vuelven los clientes de cada mes?</h3>
          <p className={s.sub}>Porcentaje de clientes de cada mes que vuelven a comprar N meses después</p>
        </div>
      </div>
      <div className={s.tblWrap} role="region" aria-label="Recompra por cohorte; desliza para consultar los meses" tabIndex={0} style={{ marginTop: 0 }}>
        <table className={s.heat} aria-label="Porcentaje de recompra según el mes del primer pedido">
          <thead>
            <tr>
              <th scope="col">Primer pedido</th>
              <th scope="col">Clientes</th>
              {Array.from({ length: MAX_OFFSET }, (_, i) => (
                <th scope="col" key={i}>+{i + 1} m</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => {
              const size = cell.get(`${month}|0`)?.cohort_customers ?? cohorts.find((c) => c.cohort_month === month)?.cohort_customers ?? 0;
              return (
                <tr key={month}>
                  <th scope="row">
                    {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(2, 4)}
                  </th>
                  <td>{fmtNum(size)}</td>
                  {Array.from({ length: MAX_OFFSET }, (_, i) => {
                    const c = cell.get(`${month}|${i + 1}`);
                    if (!c || !size) return <td key={i} title="Sin datos para este mes">—</td>;
                    const rate = c.customers / size;
                    return (
                      <td
                        key={i}
                        style={{ background: `color-mix(in srgb, var(--store) ${Math.min(rate * 100, 40)}%, var(--surface-2))`, color: "var(--ink)" }}
                        title={`${c.customers} de ${size} clientes`}
                      >
                        {pct(rate, 0)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttributionTable({ rows, currencyCode }: { rows: Insights["attribution"]; currencyCode: string | null }) {
  const sorted = rows.slice().sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const total = rows.reduce((acc, r) => acc + r.revenue, 0) || 1;
  return (
    <div className={s.tblWrap} role="region" aria-label="Origen de las ventas; desliza para comparar columnas" tabIndex={0} style={{ marginTop: 0 }}>
      <table className={s.tbl} aria-label="Ventas por canal según Shopify">
        <thead>
          <tr>
            <th scope="col">Canal</th>
            <th scope="col">Campaña</th>
            <th scope="col">Pedidos</th>
            <th scope="col">Ventas</th>
            <th scope="col">Clientes nuevos</th>
            <th scope="col">Días hasta comprar</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const channel = row.source ?? row.source_type ?? "Sin atribución";
            return (
              <tr key={`${channel}-${row.utm_campaign ?? ""}-${i}`}>
                <td>{row.source || row.source_type ? channel : <span className={s.muted}>Sin atribución</span>}</td>
                <td>{row.utm_campaign ?? <span className={s.muted}>—</span>}</td>
                <td className={s.tdN}>{fmtNum(row.orders)}</td>
                <td className={s.tdN}>
                  {formatShopifyMoney(row.revenue, currencyCode)} <small className={s.muted}>{pct(row.revenue / total, 0)}</small>
                  <span className={s.shareBar}>
                    <i style={{ width: `${(row.revenue / total) * 100}%` }} />
                  </span>
                </td>
                <td className={s.tdN}>{fmtNum(row.new_customers)}</td>
                <td className={s.tdN}>{row.avg_days_to_conversion != null ? fmtNum(row.avg_days_to_conversion, 1) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
