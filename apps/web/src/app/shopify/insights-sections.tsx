"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import { pivotCohorts, retentionRate, type CohortRow } from "./cohort-pivot";
import {
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
};

const PAYBACK_UNKNOWN: Record<string, string> = {
  sin_cohorte: "sin clientes con historia suficiente",
  cohorte_inmadura: "aún sin un año de historia",
  sin_coste: "falta el coste de producto",
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
  currency: string;
}) {
  const lifetime = insights.lifetime;
  const churn = insights.churn;
  if (!lifetime && !churn) return null;
  const ltv = lifetime?.ltv ?? null;
  const horizon = ltv ? `a ${ltv.milestone_days} días` : "";
  const payback = lifetime?.payback;
  const churnRate = churn?.churn_rate == null ? null : Number(churn.churn_rate);

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              ? `sin coste en ${count(ltv.items_without_cost)} líneas`
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
  currency: string;
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
        Las cifras de cliente cubren todo el histórico, no el periodo
        seleccionado.
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
  currency: string;
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
  newCustomers: number;
  shared: number;
  share: number | null;
};

function DiscountsSection({
  insights,
  currency,
}: {
  insights: ShopifyInsights;
  currency: string;
}) {
  const rows: DiscountRow[] = insights.discounts.map((row) => ({
    id: row.code,
    code: row.code,
    orders: row.orders,
    revenue: row.order_revenue,
    discount: row.order_discount_total,
    newCustomers: row.new_customers,
    shared: row.orders_with_multiple_codes,
    share: row.discount_share,
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
      label: "Descuento del pedido",
      render: (row) => formatMoney(row.discount, currency),
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
};

function OperationsSection({
  insights,
  currency,
}: {
  insights: ShopifyInsights;
  currency: string;
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
  }));

  const anyReturn = returnRows.some((row) => row.returned > 0);

  const columns: TableColumnDef<ReturnRow>[] = [
    { key: "title", label: "Producto", render: (row) => row.title },
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
  currency: string;
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

export function ShopifyInsightsSections({
  organizationId,
  connectionId,
  periodDays,
  currency,
}: {
  organizationId: string;
  connectionId: string | null;
  periodDays: number | "all";
  currency: string;
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
      <DiscountsSection insights={insights} currency={currency} />
      <OperationsSection insights={insights} currency={currency} />
    </>
  );
}
