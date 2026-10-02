"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import { pivotCohorts, retentionRate, type CohortRow } from "./cohort-pivot";
import {
  AreaChart,
  BarChart,
  Badge,
  Banner,
  Card,
  EmptyState,
  ErrorBlock,
  Heading,
  Link,
  LoadingBlock,
  Metric,
  Table,
  type TableColumnDef,
} from "@/components/ui";

export type ShopifyInsights = {
  period: { days: number | "all"; start: string | null; end: string };
  recurrence: {
    new_orders: number;
    returning_orders: number;
    unknown_orders: number;
    new_revenue: number;
    returning_revenue: number;
    repeat_order_rate: number | null;
  } | null;
  customer_value: {
    customers: number;
    orders_with_customer: number;
    guest_orders: number;
    avg_orders_per_customer: number | null;
    avg_revenue_per_customer: number | null;
    median_revenue_per_customer: number | null;
    p90_revenue_per_customer: number | null;
  } | null;
  cohorts: Array<{
    cohort_month: string;
    cohort_customers: number;
    month_offset: number;
    customers: number;
    orders: number;
    revenue: number;
  }>;
  attribution: Array<{
    source_type: string | null;
    source: string | null;
    utm_campaign: string | null;
    orders: number;
    revenue: number;
    new_customers: number;
    avg_days_to_conversion: number | null;
  }>;
  returns: Array<{
    product_id: string;
    title: string;
    units_sold: number;
    units_returned: number;
    return_rate: number | null;
    revenue: number;
    refunded_amount: number;
    top_return_reason: string | null;
    lines_with_exact_metrics: number;
    lines_with_estimated_metrics: number;
    lines_without_metrics: number;
  }>;
  delivery: {
    fulfillments: number;
    delivered: number;
    in_transit: number;
    avg_hours_to_ship: number | null;
    avg_days_to_deliver: number | null;
    with_estimate: number;
    late_deliveries: number;
    avg_delay_days: number | null;
  } | null;
  delivery_exceptions?: Array<{
    id: string;
    order_name: string | null;
    tracking_company: string | null;
    exception_type: string;
    reason_confidence: number;
    likely_area: string;
    next_action_code: string;
    episode_started_at: string;
    age_hours: number;
    last_observed_at: string;
    latest_event_at: string | null;
    latest_event_status: string | null;
  }> | null;
  checkout_recovery: {
    checkouts: number;
    recovered: number;
    recovery_rate: number | null;
    lost_value: number;
    recovered_value: number;
    avg_checkout_value: number | null;
    avg_hours_to_recover: number | null;
  } | null;
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
  lifetime?: {
    curve: LifetimeMilestone[];
    ltv: LifetimeMilestone | null;
    payback:
      | { status: "PAID_BACK"; days: number }
      | { status: "NOT_WITHIN_HORIZON" }
      | { status: "UNKNOWN"; reason: string };
  } | null;
  churn?: {
    churn_days: number;
    base_customers: number;
    churned_customers: number;
    churn_rate: number | string | null;
  } | null;
  unavailable: string[];
};

type LifetimeMilestone = {
  milestone_days: number;
  cohort_customers: number;
  avg_revenue: number | null;
  avg_contribution: number | null;
  items_without_cost: number;
  cohort_cac: number | null;
  lines_with_exact_metrics?: number;
  lines_with_estimated_metrics?: number;
  lines_without_metrics?: number;
  net_metrics_coverage_available?: boolean;
};

const PAYBACK_UNKNOWN: Record<string, string> = {
  sin_cohorte: "sin clientes con historia suficiente",
  cohorte_inmadura: "aún sin un año de historia",
  sin_coste: "falta el coste de producto",
  sin_cobertura: "faltan importes netos de líneas históricas",
  sin_cac: "sin gasto publicitario en la ventana",
};

/**
 * LTV sobre margen de contribucion a 365 dias, o el hito mas largo que ya
 * tenga cohorte madura. Si falta el coste de alguna linea, se dice: nunca se
 * cambia el margen por el ingreso sin avisar.
 */
function LifetimeMetrics({
  insights,
  currency,
}: {
  insights: ShopifyInsights;
  currency: string | null;
}) {
  const lifetime = insights.lifetime;
  const churn = insights.churn;
  if (!lifetime && !churn) return null;
  const ltv = lifetime?.ltv ?? null;
  const horizon = ltv ? `a ${ltv.milestone_days} días` : "";
  const payback = lifetime?.payback;
  const churnRate = churn?.churn_rate == null ? null : Number(churn.churn_rate);
  const hasCompleteContribution = Boolean(
    lifetime?.curve.length &&
      lifetime.curve.every((milestone) => milestone.avg_contribution != null),
  );
  const lifetimeChartData = (lifetime?.curve ?? [])
    .filter((milestone) => milestone.avg_revenue != null)
    .map((milestone) => ({
      hito: `${milestone.milestone_days} días`,
      Ingresos: Number(milestone.avg_revenue),
      ...(hasCompleteContribution
        ? { Margen: Number(milestone.avg_contribution) }
        : {}),
    }));

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        card
        label={`LTV (margen) ${horizon}`.trim()}
        value={
          ltv?.avg_contribution == null
            ? "—"
            : formatMoney(ltv.avg_contribution, currency)
        }
        hint={
          !ltv
            ? "sin clientes con historia suficiente"
            : ltv.avg_contribution == null
                ? ltv.net_metrics_coverage_available === false
                  ? "cobertura neta pendiente de reconciliación"
                  : (ltv.lines_without_metrics ?? 0) > 0
                ? `sin cobertura neta en ${count(ltv.lines_without_metrics ?? 0)} líneas; coste ausente en ${count(ltv.items_without_cost)} líneas`
                : `sin coste en ${count(ltv.items_without_cost)} líneas`
              : `${count(ltv.cohort_customers)} clientes en la cohorte`
        }
      />
      <Metric
        card
        label={`Ingreso por cliente ${horizon}`.trim()}
        value={
          ltv?.avg_revenue == null ? "—" : formatMoney(ltv.avg_revenue, currency)
        }
        hint="sin impuestos ni devoluciones"
      />
      <Metric
        card
        label="Payback del CAC"
        value={
          payback?.status === "PAID_BACK"
            ? `${payback.days} días`
            : payback?.status === "NOT_WITHIN_HORIZON"
              ? "> 1 año"
              : "—"
        }
        tone={payback?.status === "NOT_WITHIN_HORIZON" ? "warn" : "default"}
        hint={
          payback?.status === "UNKNOWN"
            ? PAYBACK_UNKNOWN[payback.reason]
            : payback?.status === "NOT_WITHIN_HORIZON"
              ? "el margen de un año no cubre lo que costó captarlos"
              : undefined
        }
      />
      <Metric
        card
        label={`Churn a ${churn?.churn_days ?? 180} días`}
        value={percent(churnRate)}
        hint={
          churn && churn.base_customers > 0
            ? `${count(Number(churn.churned_customers))} de ${count(Number(churn.base_customers))} no han vuelto`
          : "sin clientes en la base"
        }
      />
      </div>
      {lifetimeChartData.length > 1 ? (
        <div className="border-t border-edge pt-4">
          <div className="mb-2">
            <p className="text-sm font-medium text-foreground">
              Evolución del valor por cliente
            </p>
            <p className="text-xs text-muted">
              Ingresos medios acumulados desde la primera compra.
              {hasCompleteContribution
                ? " También se muestra el margen cuando todos los costes están disponibles."
                : " El margen no aparece porque faltan costes en alguno de los hitos."}
            </p>
          </div>
          <AreaChart
            data={lifetimeChartData}
            xKey="hito"
            series={[
              { key: "Ingresos", label: "Ingresos", color: "#2563eb" },
              ...(hasCompleteContribution
                ? [{ key: "Margen", label: "Margen", color: "#15805d" }]
                : []),
            ]}
            height={220}
            valueFormatter={(amount) => formatMoney(amount, currency)}
          />
        </div>
      ) : null}
    </div>
  );
}

// Las cohortes mas alla del medio año hacen la tabla ilegible en pantalla y
// nadie decide nada con ellas: el dato sigue en la funcion SQL para quien lo
// pida por otra via.
const MAX_COHORT_OFFSET = 6;

const RETURN_REASON_LABEL: Record<string, string> = {
  SIZE_TOO_SMALL: "talla pequeña",
  SIZE_TOO_LARGE: "talla grande",
  UNWANTED: "no lo quería",
  NOT_AS_DESCRIBED: "no era lo descrito",
  WRONG_ITEM: "artículo equivocado",
  DEFECTIVE: "defectuoso",
  STYLE: "estilo",
  COLOR: "color",
  OTHER: "otro",
  UNKNOWN: "sin motivo",
};

function percent(value: number | null | undefined, digits = 1) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function count(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("es-ES");
}

function decimal(value: number | null | undefined, suffix: string) {
  if (value == null) return "—";
  return `${Number(value).toLocaleString("es-ES", {
    maximumFractionDigits: 1,
  })} ${suffix}`;
}

function monthLabel(value: string) {
  return new Date(value).toLocaleDateString("es-ES", {
    month: "short",
    year: "2-digit",
  });
}

/**
 * El texto que aparece cuando un bloque no tiene datos. Se separa "todavia no
 * se ha traido" de "se trajo y no hay nada": son dos situaciones distintas y
 * confundirlas hace que alguien celebre cero devoluciones cuando en realidad
 * nunca se han sincronizado.
 */
function PendingSync({ what }: { what: string }) {
  return (
    <EmptyState
      title={`Todavía no hemos traído ${what}`}
      hint="Llega con el próximo sincronizado de la tienda."
    />
  );
}

function CustomersSection({
  insights,
  currency,
}: {
  insights: ShopifyInsights;
  currency: string | null;
}) {
  const recurrence = insights.recurrence;
  const value = insights.customer_value;

  const known = recurrence
    ? recurrence.new_orders + recurrence.returning_orders
    : 0;
  const unknown = recurrence?.unknown_orders ?? 0;
  const allUnknown = unknown > 0 && known === 0;

  return (
    <Card
      id="shopify-clientes"
      title="Clientes"
      description="Cuántos vuelven y cuánto vale cada uno."
    >
      {allUnknown ? (
        <Banner tone="warn" className="text-sm">
          <p className="font-medium">
            No sabemos cuáles de los {count(unknown)} pedidos son de clientes
            que repiten.
          </p>
          <p className="text-muted">
            Shopify marca en cada pedido qué número de compra es para ese
            cliente, y ese campo no se ha sincronizado nunca. Vuelve a conectar
            la tienda en <Link href="/integraciones">Integraciones</Link> y
            lanza un sincronizado para tenerlo.
          </p>
        </Banner>
      ) : recurrence ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            card
            label="Pedidos de clientes que repiten"
            value={count(recurrence.returning_orders)}
            hint={formatMoney(recurrence.returning_revenue, currency)}
          />
          <Metric
            card
            label="Pedidos de clientes nuevos"
            value={count(recurrence.new_orders)}
            hint={formatMoney(recurrence.new_revenue, currency)}
          />
          <Metric
            card
            label="Tasa de recompra"
            value={percent(recurrence.repeat_order_rate)}
            tone={
              recurrence.repeat_order_rate == null
                ? "default"
                : recurrence.repeat_order_rate < 0.15
                  ? "warn"
                  : "success"
            }
          />
          <Metric
            card
            label="Sin clasificar"
            value={count(unknown)}
            tone={unknown > 0 ? "warn" : "default"}
            hint={unknown > 0 ? "pedidos sin el dato de Shopify" : undefined}
          />
        </div>
      ) : null}

      {value ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            card
            label="Clientes"
            value={count(value.customers)}
            hint={
              value.guest_orders > 0
                ? `${count(value.guest_orders)} pedidos sin cliente`
                : undefined
            }
          />
          <Metric
            card
            label="Pedidos por cliente"
            value={
              value.avg_orders_per_customer == null
                ? "—"
                : Number(value.avg_orders_per_customer).toLocaleString(
                    "es-ES",
                    { maximumFractionDigits: 2 },
                  )
            }
          />
          <Metric
            card
            label="Gasto medio por cliente"
            value={
              value.avg_revenue_per_customer == null
                ? "—"
                : formatMoney(value.avg_revenue_per_customer, currency)
            }
            hint={
              value.median_revenue_per_customer == null
                ? undefined
                : `mediana ${formatMoney(value.median_revenue_per_customer, currency)}`
            }
          />
          <Metric
            card
            label="El 10% que más gasta"
            value={
              value.p90_revenue_per_customer == null
                ? "—"
                : `desde ${formatMoney(value.p90_revenue_per_customer, currency)}`
            }
          />
        </div>
      ) : null}

      <LifetimeMetrics insights={insights} currency={currency} />

      {/* El valor por cliente no se recorta al periodo: un LTV de 30 dias es
          un numero mas pequeño que no significa nada. */}
      <p className="mt-3 text-xs text-muted">
        Las cifras de cliente usan los pedidos disponibles en la tienda y no el
        periodo seleccionado. El alcance histórico depende de los permisos y de
        la sincronización completada.
      </p>
    </Card>
  );
}

function CohortsSection({ insights }: { insights: ShopifyInsights }) {
  if (!insights.cohorts.length) {
    return (
      <Card id="shopify-cohortes" title="Cohortes" description="Quién vuelve, mes a mes.">
        <PendingSync what="suficientes pedidos con cliente" />
      </Card>
    );
  }

  const { rows, columns: maxOffset } = pivotCohorts(
    insights.cohorts,
    MAX_COHORT_OFFSET,
  );

  const columns: TableColumnDef<CohortRow>[] = [
    {
      key: "month",
      label: "Primera compra",
      render: (row) => (
        <span className="whitespace-nowrap">{monthLabel(row.month)}</span>
      ),
    },
    {
      key: "size",
      label: "Clientes",
      render: (row) => count(row.cohortCustomers),
    },
    ...Array.from({ length: maxOffset }, (_unused, index) => index + 1).map(
      (offset): TableColumnDef<CohortRow> => ({
        key: `offset-${offset}`,
        label: `+${offset} mes${offset === 1 ? "" : "es"}`,
        render: (row) => {
          const customers = row.byOffset.get(offset);
          const rate = retentionRate(row, offset);
          if (!customers || rate == null)
            return <span className="text-muted">—</span>;
          return (
            <span className="tabular-nums">
              {count(customers)}{" "}
              <span className="text-muted">({percent(rate)})</span>
            </span>
          );
        },
      }),
    ),
  ];

  return (
    <Card
      id="shopify-cohortes"
      title="Cohortes"
      description="De los clientes que compraron por primera vez cada mes, cuántos volvieron después."
    >
      <Table
        ariaLabel="Retención por cohorte mensual"
        columns={columns}
        rows={rows}
        emptyLabel="Sin cohortes en los últimos 12 meses."
      />
    </Card>
  );
}

type AttributionRow = {
  id: string;
  channel: string;
  campaign: string | null;
  orders: number;
  revenue: number;
  newCustomers: number;
  daysToConversion: number | null;
  attributed: boolean;
};

function AttributionSection({
  insights,
  currency,
}: {
  insights: ShopifyInsights;
  currency: string | null;
}) {
  const rows: AttributionRow[] = insights.attribution.map((row, index) => ({
    id: `${row.source_type ?? "sin"}-${row.source ?? ""}-${row.utm_campaign ?? ""}-${index}`,
    channel: row.source ?? row.source_type ?? "Sin atribución",
    campaign: row.utm_campaign,
    orders: row.orders,
    revenue: row.revenue,
    newCustomers: row.new_customers,
    daysToConversion: row.avg_days_to_conversion,
    attributed: Boolean(row.source_type || row.source),
  }));

  const attributedOrders = rows
    .filter((row) => row.attributed)
    .reduce((total, row) => total + row.orders, 0);
  const totalOrders = rows.reduce((total, row) => total + row.orders, 0);
  const channelRevenue = new Map<string, number>();
  rows.forEach((row) => {
    if (row.attributed) {
      channelRevenue.set(
        row.channel,
        (channelRevenue.get(row.channel) ?? 0) + row.revenue,
      );
    }
  });
  const channelChartData = [...channelRevenue.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([channel, revenue]) => ({ channel, revenue }));

  const columns: TableColumnDef<AttributionRow>[] = [
    {
      key: "channel",
      label: "Canal",
      render: (row) =>
        row.attributed ? (
          row.channel
        ) : (
          <Badge tone="warn">Sin atribución</Badge>
        ),
    },
    {
      key: "campaign",
      label: "Campaña",
      render: (row) => row.campaign ?? <span className="text-muted">—</span>,
    },
    { key: "orders", label: "Pedidos", render: (row) => count(row.orders) },
    {
      key: "revenue",
      label: "Ingresos atribuidos",
      render: (row) => formatMoney(row.revenue, currency),
    },
    {
      key: "new",
      label: "Clientes nuevos",
      render: (row) => count(row.newCustomers),
    },
    {
      key: "days",
      label: "Días hasta comprar",
      render: (row) => decimal(row.daysToConversion, "d"),
    },
  ];

  return (
    <Card
      id="shopify-origen"
      title="De dónde vienen"
      description="Primera visita del comprador, según Shopify."
    >
      {totalOrders > 0 && attributedOrders === 0 ? (
        <Banner tone="warn" className="text-sm">
          <p className="font-medium">
            Ninguno de los {count(totalOrders)} pedidos trae de dónde vino el
            cliente.
          </p>
          <p className="text-muted">
            El recorrido del comprador se pide en el mismo sincronizado que el
            número de compra. Vuelve a conectar la tienda en{" "}
            <Link href="/integraciones">Integraciones</Link> y lanza un
            sincronizado.
          </p>
        </Banner>
      ) : (
        <>
          {channelChartData.length ? (
            <div className="mb-4 border-t border-edge pt-4">
              <div className="mb-2">
                <p className="text-sm font-medium text-foreground">
                  Ingresos atribuidos por canal
                </p>
                <p className="text-xs text-muted">
                  Canales con más ingresos según la primera visita registrada por Shopify.
                </p>
              </div>
              <BarChart
                data={channelChartData}
                xKey="channel"
                series={[
                  { key: "revenue", label: "Ingresos", color: "#2563eb" },
                ]}
                horizontal
                height={Math.max(180, channelChartData.length * 42)}
                valueFormatter={(amount) => formatMoney(amount, currency)}
              />
            </div>
          ) : null}
          <Table
            ariaLabel="Pedidos por canal de primera visita"
            columns={columns}
            rows={rows}
            emptyLabel="Sin pedidos en el periodo seleccionado."
          />
          {/* ADR-0021: cada plataforma mide su propia atribucion con su propia
              ventana. Sumarlas cuenta el mismo pedido varias veces. */}
          <p className="mt-3 text-xs text-muted">
            Medido por Shopify sobre la sesión del comprador. No se suma con lo
            que atribuyen Meta o Klaviyo, que miden otra cosa.
          </p>
        </>
      )}
    </Card>
  );
}

type DiscountRow = {
  id: string;
  code: string;
  orders: number;
  revenue: number;
  discount: number;
  attributionCoverage: "complete" | "partial" | "unavailable" | "migration_pending";
  newCustomers: number;
  shared: number;
  share: number | null;
};

function DiscountsSection({
  insights,
  currency,
}: {
  insights: ShopifyInsights;
  currency: string | null;
}) {
  const rows: DiscountRow[] = insights.discounts.map((row) => ({
    id: row.code,
    code: row.code,
    orders: row.orders,
    revenue: row.order_revenue,
    discount: row.attributed_discount_total ?? 0,
    attributionCoverage: row.attribution_coverage,
    newCustomers: row.new_customers,
    shared: row.orders_with_multiple_codes,
    share: row.attribution_coverage === "complete" ? row.discount_share : null,
  }));

  const anyShared = rows.some((row) => row.shared > 0);

  const columns: TableColumnDef<DiscountRow>[] = [
    { key: "code", label: "Código", render: (row) => row.code },
    { key: "orders", label: "Pedidos", render: (row) => count(row.orders) },
    {
      key: "revenue",
      label: "Ingresos",
      render: (row) => formatMoney(row.revenue, currency),
    },
    {
      key: "discount",
      label: "Descuento atribuido",
      render: (row) => row.attributionCoverage === "complete"
        ? formatMoney(row.discount, currency)
        : "Sin cobertura exacta",
    },
    {
      key: "share",
      label: "% sobre el bruto",
      render: (row) => percent(row.share),
    },
    {
      key: "new",
      label: "Clientes nuevos",
      render: (row) =>
        row.newCustomers === 0 && row.orders > 0 ? (
          <Badge tone="warn">ninguno</Badge>
        ) : (
          count(row.newCustomers)
        ),
    },
  ];

  return (
    <Card
      id="shopify-promociones"
      title="Promociones"
      description="Qué código se usó y qué trajo a cambio."
    >
      {rows.length === 0 ? (
        <PendingSync what="los descuentos aplicados en los pedidos" />
      ) : (
        <>
          <Table
            ariaLabel="Uso y coste de los códigos de descuento"
            columns={columns}
            rows={rows}
            emptyLabel="Sin códigos usados en el periodo."
          />
          {anyShared ? (
            <p className="mt-3 text-xs text-muted">
              Algunos pedidos llevan más de un código, así que el mismo
              descuento aparece en varias filas y el total suma de más.
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted">
              El descuento es el del pedido completo, no solo el de este código.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

type ReturnRow = {
  id: string;
  title: string;
  sold: number;
  returned: number;
  rate: number | null;
  reason: string | null;
  refunded: number;
  exactMetrics: number;
  estimatedMetrics: number;
  missingMetrics: number;
};

function OperationsSection({
  insights,
  currency,
}: {
  insights: ShopifyInsights;
  currency: string | null;
}) {
  const delivery = insights.delivery;
  const returnRows: ReturnRow[] = insights.returns.map((row) => ({
    id: row.product_id,
    title: row.title,
    sold: row.units_sold,
    returned: row.units_returned,
    rate: row.return_rate,
    reason: row.top_return_reason,
    refunded: row.refunded_amount,
    exactMetrics: row.lines_with_exact_metrics,
    estimatedMetrics: row.lines_with_estimated_metrics,
    missingMetrics: row.lines_without_metrics,
  }));

  const anyReturn = returnRows.some((row) => row.returned > 0);

  const columns: TableColumnDef<ReturnRow>[] = [
    {
      key: "title",
      label: "Producto",
      render: (row) => (
        <span>
          {row.title}
          {row.missingMetrics > 0 ? (
            <small style={{ display: "block", color: "var(--muted)" }}>
              {row.missingMetrics} líneas de ingreso pendientes de resincronizar
            </small>
          ) : row.estimatedMetrics > 0 ? (
            <small style={{ display: "block", color: "var(--muted)" }}>
              {row.estimatedMetrics} líneas con ingreso estimado
            </small>
          ) : null}
        </span>
      ),
    },
    { key: "sold", label: "Vendidas", render: (row) => count(row.sold) },
    {
      key: "returned",
      label: "Devueltas",
      render: (row) => count(row.returned),
    },
    {
      key: "rate",
      label: "% devolución",
      render: (row) =>
        row.rate != null && row.rate >= 0.1 ? (
          <Badge tone="danger">{percent(row.rate)}</Badge>
        ) : (
          percent(row.rate)
        ),
    },
    {
      key: "reason",
      label: "Motivo más común",
      render: (row) =>
        row.reason ? (
          (RETURN_REASON_LABEL[row.reason] ?? row.reason.toLowerCase())
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "refunded",
      label: "Reembolsado",
      render: (row) => formatMoney(row.refunded, currency),
    },
  ];

  return (
    <Card
      id="shopify-operativa"
      title="Operativa"
      description="Cuánto se tarda en entregar y qué vuelve."
    >
      {delivery && delivery.fulfillments > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            card
            label="Hasta salir del almacén"
            value={decimal(delivery.avg_hours_to_ship, "h")}
            hint={`${count(delivery.fulfillments)} envíos`}
          />
          <Metric
            card
            label="Hasta llegar al cliente"
            value={decimal(delivery.avg_days_to_deliver, "días")}
            hint={`${count(delivery.delivered)} entregados`}
          />
          <Metric
            card
            label="En tránsito"
            value={count(delivery.in_transit)}
          />
          {/* Sin fecha estimada no hay con que comparar: decir "0 tarde" ahi
              seria afirmar algo que no sabemos. */}
          <Metric
            card
            label="Entregados tarde"
            value={
              delivery.with_estimate === 0
                ? "Sin fecha prometida"
                : count(delivery.late_deliveries)
            }
            tone={
              delivery.with_estimate === 0
                ? "default"
                : delivery.late_deliveries > 0
                  ? "warn"
                  : "success"
            }
            hint={
              delivery.with_estimate === 0
                ? "Shopify no da fecha estimada en estos envíos"
                : delivery.avg_delay_days != null
                  ? `${decimal(delivery.avg_delay_days, "días")} de retraso medio`
                  : undefined
            }
          />
        </div>
      ) : (
        <PendingSync what="los envíos" />
      )}

      <div className="mt-5">
        <Heading level={3} size="md">
          Devoluciones por producto
        </Heading>
        <div className="mt-3">
          {returnRows.length === 0 ? (
            <PendingSync what="las devoluciones" />
          ) : (
            <>
              <Table
                ariaLabel="Devoluciones por producto"
                columns={columns}
                rows={returnRows}
                emptyLabel="Sin ventas en el periodo seleccionado."
              />
              {!anyReturn ? (
                <p className="mt-3 text-xs text-muted">
                  Ninguna devolución registrada sobre lo vendido en este
                  periodo.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function RecoverySection({
  insights,
  currency,
}: {
  insights: ShopifyInsights;
  currency: string | null;
}) {
  const recovery = insights.checkout_recovery;

  return (
    <Card
      id="shopify-carritos"
      title="Carritos abandonados"
      description="Gente que llegó al pago y se fue."
    >
      {!recovery || recovery.checkouts === 0 ? (
        <PendingSync what="los carritos abandonados" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            card
            label="Carritos"
            value={count(recovery.checkouts)}
            hint={
              recovery.avg_checkout_value == null
                ? undefined
                : `${formatMoney(recovery.avg_checkout_value, currency)} de media`
            }
          />
          <Metric
            card
            label="Recuperados"
            value={count(recovery.recovered)}
            hint={formatMoney(recovery.recovered_value, currency)}
            tone="success"
          />
          <Metric
            card
            label="Tasa de recuperación"
            value={percent(recovery.recovery_rate)}
            tone={
              recovery.recovery_rate == null
                ? "default"
                : recovery.recovery_rate < 0.05
                  ? "warn"
                  : "success"
            }
            hint={
              recovery.avg_hours_to_recover == null
                ? undefined
                : `${decimal(recovery.avg_hours_to_recover, "h")} hasta volver`
            }
          />
          <Metric
            card
            label="Sin recuperar"
            value={formatMoney(recovery.lost_value, currency)}
            tone={recovery.lost_value > 0 ? "warn" : "default"}
          />
        </div>
      )}
    </Card>
  );
}

export const DELIVERY_EXCEPTION_LABELS: Record<string, string> = {
  eta_overdue: "ETA vencida",
  customs_hold: "Retención aduanera informada",
  address_issue: "Problema de dirección informado",
  delivery_attempt: "Intento de entrega informado",
  carrier_delay: "Retraso informado por el transportista",
  carrier_failure: "Incidencia del transportista",
};

export const DELIVERY_NEXT_ACTIONS: Record<string, string> = {
  investigate_overdue_shipment: "Comprobar el seguimiento y la fecha prometida.",
  verify_customs_documentation: "Revisar si falta documentación aduanera.",
  verify_address_with_customer: "Verificar la dirección antes de un nuevo intento.",
  confirm_delivery_attempt: "Confirmar el resultado del intento de entrega.",
  review_carrier_eta: "Contrastar la nueva fecha estimada con el transportista.",
  escalate_carrier: "Solicitar al transportista el estado actualizado.",
};

export const DELIVERY_AREAS: Record<string, string> = {
  carrier_or_customs: "Área a investigar: transportista o aduanas",
  merchant_fulfillment: "Área a investigar: preparación del pedido",
  unknown: "Área a investigar: aún sin determinar",
};

function DeliveryExceptionsSection({ insights }: { insights: ShopifyInsights }) {
  const exceptions = insights.delivery_exceptions;

  return (
    <Card
      id="shopify-incidencias-entrega"
      title="Incidencias de entrega"
      description="Seguimiento de envíos que requieren revisión; una señal no determina por sí sola quién es responsable."
    >
      {exceptions == null ? (
        <Banner tone="warn" className="text-sm">
          No se pudo cargar la cola de incidencias. No equivale a que no haya envíos afectados.
        </Banner>
      ) : exceptions.length === 0 ? (
        <EmptyState title="No hay incidencias abiertas en los envíos sincronizados" hint="Esto no confirma que todos los pedidos estén ya sincronizados; las señales aparecerán cuando Shopify comunique un problema o venza la fecha estimada." />
      ) : (
        <ul className="divide-y divide-edge">
          {exceptions.map((item) => (
            <li key={item.id} className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">
                    {item.order_name ? `Pedido ${item.order_name}` : "Pedido sin número disponible"}
                  </span>
                  <Badge tone="warn">{DELIVERY_EXCEPTION_LABELS[item.exception_type] ?? "Incidencia de entrega"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {DELIVERY_NEXT_ACTIONS[item.next_action_code] ?? "Revisar el seguimiento del envío."}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {item.tracking_company || "Transportista no identificado"} · {DELIVERY_AREAS[item.likely_area] ?? DELIVERY_AREAS.unknown}
                  {item.latest_event_status ? ` · Último estado: ${item.latest_event_status}` : ""}
                </p>
              </div>
              <div className="text-xs text-muted sm:text-right">
                <div>Abierta hace {decimal(item.age_hours, " h")}</div>
                <div>Fiabilidad de la señal: {Math.round(item.reason_confidence * 100)}%</div>
                <div className="mt-1">Última observación: {new Date(item.last_observed_at).toLocaleDateString("es-ES")}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ShopifyInsightsSections({
  organizationId,
  connectionId,
  periodDays,
  currency,
}: {
  organizationId: string;
  connectionId: string | null;
  periodDays: number | "all";
  currency: string | null;
}) {
  const [insights, setInsights] = useState<ShopifyInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isCurrent: () => boolean) => {
      const params = new URLSearchParams({ days: String(periodDays) });
      if (connectionId) {
        params.set("connectionId", connectionId);
      }

      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/shopify/insights?${params.toString()}`,
        );

        // El selector de periodo dispara una carga por pulsacion. Sin este
        // corte, una respuesta lenta de "90 dias" puede aterrizar despues de
        // la de "7 dias" y dejar en pantalla cifras de otro periodo.
        if (!isCurrent()) return;

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          setError(
            [body?.error ?? `HTTP ${response.status}`, body?.message]
              .filter(Boolean)
              .join(" - "),
          );
          return;
        }

        setInsights((await response.json()) as ShopifyInsights);
        setError(null);
      } catch {
        if (!isCurrent()) return;
        setError(
          "No se pudieron cargar estas métricas. Revisa la conexión e inténtalo de nuevo.",
        );
      }
    },
    [connectionId, organizationId, periodDays],
  );

  useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, [load]);

  if (error) {
    return (
      <Card>
        <ErrorBlock>{error}</ErrorBlock>
      </Card>
    );
  }

  if (!insights) {
    return (
      <Card>
        <LoadingBlock label="Cargando clientes, canales y operativa..." />
      </Card>
    );
  }

  return (
    <>
      {insights.unavailable.length ? (
        <Banner tone="danger" className="text-sm">
          No se pudieron calcular: {insights.unavailable.join(", ")}.
        </Banner>
      ) : null}
      <CustomersSection insights={insights} currency={currency} />
      <CohortsSection insights={insights} />
      <AttributionSection insights={insights} currency={currency} />
      <RecoverySection insights={insights} currency={currency} />
      <DeliveryExceptionsSection insights={insights} />
      <DiscountsSection insights={insights} currency={currency} />
      <OperationsSection insights={insights} currency={currency} />
    </>
  );
}
