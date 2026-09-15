"use client";

import { useMemo, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { useCachedQuery } from "@/lib/use-cached-query";
import { formatMoney } from "@/lib/money";
import {
  AsyncState,
  Badge,
  Banner,
  BarChart,
  Card,
  EmptyState,
  EYEBROW,
  Link,
  Metric,
  Select,
} from "@/components/ui";
import {
  costBreakdown,
  deltaPct,
  monthlyChartRows,
  targetStatus,
  targetsByKey,
  totalCosts,
  funnelSteps,
  type FunnelStep,
  type PanelFunnel,
  type MetricTarget,
  type MonthlyRow,
  type PanelFinancial,
} from "./panel-view-model";

/**
 * El panel del manager. Ver docs/PLAN_PANEL_MANAGER.md.
 *
 * Es la pantalla del CONSULTOR, no del cliente (decision de Rafa, 2026-09-15).
 * Dice cosas que hay que saber interpretar -- un CAC de break-even, un margen
 * de contribucion por pedido -- y en manos de un cliente sin contexto asustan o
 * se malinterpretan. El cliente sigue con su dashboard.
 *
 * El orden de las bandas no es decorativo: primero cuanto ganas, luego que te
 * cuesta cada pedido, luego los ratios y al final la publicidad. Es el orden en
 * el que se diagnostica una tienda, y es el de la hoja que el consultor ya
 * usaba a mano.
 */

type PanelMetrics = {
  period: { days: number | "all"; start: string | null; end: string };
  sales: { orders_count: number; net_sales: number; aov: number };
  margin: { items_without_cost: number; items_with_estimated_cost: number };
  financial: PanelFinancial & {
    has_settings: boolean;
    fixed_expenses_count: number;
    items_without_cost: number;
    tax_collected: number;
    uses_shipping_rules: boolean;
    ads_days_with_data: number;
  };
  financial_monthly: MonthlyRow[];
  metric_targets: MetricTarget[];
  previous_period: {
    sales: { orders_count: number; net_sales: number };
    financial: { net_profit: number; net_margin_pct: number };
  } | null;
  funnel:
    | (PanelFunnel & {
        conversion_rate_own: number | null;
        revenue_per_session: number | null;
      })
    | null;
};

/**
 * Embudo en barras horizontales: cada paso con su caida respecto al anterior.
 *
 * El ancho de la barra es el peso sobre las sesiones, para que la fuga se vea
 * de un vistazo sin leer numeros. Un paso que no medimos no aparece -- ver
 * `funnelSteps`.
 */
function Funnel({ steps }: { steps: FunnelStep[] }) {
  return (
    <ul className="space-y-3">
      {steps.map((step) => (
        <li key={step.paso} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{step.paso}</span>
            <span className="font-mono">
              {step.valor.toLocaleString("es-ES")}
              {step.pct_del_anterior !== null ? (
                <span className="ml-2 text-xs text-muted">
                  {step.pct_del_anterior.toFixed(2)} % del paso anterior
                </span>
              ) : null}
            </span>
          </div>
          <div
            className="h-2 rounded-full bg-surface"
            role="presentation"
          >
            <div
              className="h-2 rounded-full bg-accent"
              style={{
                width: `${Math.max(step.pct_del_total ?? 0, 1).toFixed(2)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

type MetaMetrics = {
  acquisition: { spend: number; roas: number | null; days_with_data: number };
};

const PERIOD_OPTIONS = [
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "365", label: "1 año" },
];

function formatPct(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "n/a";
  return `${value.toFixed(digits)} %`;
}

function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number | null | undefined;
}) {
  const delta = deltaPct(current, previous);

  if (delta === null) return null;

  return (
    <Badge tone={delta >= 0 ? "success" : "danger"}>
      {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} % vs periodo anterior
    </Badge>
  );
}

function TargetBadge({
  value,
  target,
  direction,
  format,
}: {
  value: number | null | undefined;
  target: number | undefined;
  direction: "arriba" | "abajo";
  format: (value: number) => string;
}) {
  const status = targetStatus(value, target, direction);

  if (status === null || target === undefined) return null;

  return (
    <Badge tone={status === "cumple" ? "success" : "warn"}>
      objetivo {format(target)}
    </Badge>
  );
}

function PanelContent() {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [periodDays, setPeriodDays] = useState("30");

  const connectionParam = connectionId ? `&connectionId=${connectionId}` : "";
  const metricsKey = organizationId
    ? `/v1/organizations/${organizationId}/shopify/metrics?days=${periodDays}${connectionParam}`
    : null;
  const metaKey = organizationId
    ? `/v1/organizations/${organizationId}/meta/metrics?days=${periodDays}`
    : null;

  const { data: metrics, error, isLoading } = useCachedQuery<PanelMetrics>(metricsKey);
  // Meta es un añadido: su ROAS acompaña al ROAS de break-even, pero si falla,
  // el panel entero sigue teniendo sentido.
  const { data: meta } = useCachedQuery<MetaMetrics>(metaKey);

  const financial = metrics?.financial;
  const targets = useMemo(
    () => targetsByKey(metrics?.metric_targets ?? []),
    [metrics?.metric_targets],
  );
  const costs = useMemo(
    () => (financial ? costBreakdown(financial) : []),
    [financial],
  );
  const monthly = useMemo(
    () => monthlyChartRows(metrics?.financial_monthly ?? []),
    [metrics?.financial_monthly],
  );
  const steps = useMemo(
    () => funnelSteps(metrics?.funnel ?? null),
    [metrics?.funnel],
  );

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Calculando el panel..." />;
  }

  if (error) {
    return <AsyncState status="error" error={error} />;
  }

  if (!metrics || !financial) {
    return (
      <EmptyState
        title="Sin datos de la tienda"
        hint="Conecta Shopify en Integraciones para ver el panel."
      />
    );
  }

  const totalCost = totalCosts(financial);
  const hasAds = financial.ads_spend > 0;

  // Lo que invalida el panel entero va ARRIBA, no en una nota al pie: sin
  // costes de producto el beneficio y todo lo que cuelga de el son ficcion.
  const blockers: string[] = [];
  if (financial.cogs === 0) {
    blockers.push(
      "No hay ningún coste de producto cargado: el beneficio y el margen de abajo cuentan el producto como si fuera gratis.",
    );
  }
  if (financial.fixed_expenses_count === 0) {
    blockers.push(
      "No hay gastos fijos configurados: el beneficio está por encima del real y el break-even no significa nada.",
    );
  }
  if (!financial.has_settings) {
    blockers.push(
      "Faltan las comisiones de pago y el envío medio por pedido.",
    );
  }

  return (
    <div className="portal-page space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={EYEBROW}>Panel del manager</p>
          <p className="text-sm text-muted">
            Todas las cifras sin IVA. El beneficio ya descuenta producto,
            envíos, comisiones, gastos fijos y publicidad.
          </p>
        </div>
        <Select
          aria-label="Periodo"
          value={periodDays}
          onChange={(value) => setPeriodDays(value)}
          options={PERIOD_OPTIONS}
        />
      </div>

      {blockers.length > 0 ? (
        <Banner tone="warn">
          <p className="font-medium">Estas cifras todavía no son reales.</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            <Link href="/configuracion">Configurar costes y gastos fijos</Link>
            {" · "}
            <Link href="/shopify#shopify-costes">Cargar costes de producto</Link>
          </p>
        </Banner>
      ) : null}

      {/* Banda 1: cuánto ganas */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          card
          label="Beneficio neto"
          value={formatMoney(financial.net_profit)}
          tone={financial.net_profit >= 0 ? "success" : "danger"}
          hint={`${formatPct(financial.net_margin_pct)} de margen`}
          delta={
            <DeltaBadge
              current={financial.net_profit}
              previous={metrics.previous_period?.financial.net_profit}
            />
          }
        />
        <Metric
          card
          label="Ingresos (sin IVA)"
          value={formatMoney(financial.net_revenue_ex_tax)}
          hint={`${formatMoney(financial.tax_collected)} de IVA aparte`}
          delta={
            <TargetBadge
              value={financial.net_revenue_ex_tax}
              target={targets.net_revenue_ex_tax}
              direction="arriba"
              format={formatMoney}
            />
          }
        />
        <Metric
          card
          label="Pedidos"
          value={financial.orders_count}
          hint={`${financial.new_customers} clientes nuevos`}
          delta={
            <DeltaBadge
              current={financial.orders_count}
              previous={metrics.previous_period?.sales.orders_count}
            />
          }
        />
        <Metric
          card
          label="Costes totales"
          value={formatMoney(totalCost)}
          tone="danger"
          hint={
            costs.length > 0
              ? costs
                  .map(
                    (slice) =>
                      `${slice.concepto.toLowerCase()} ${formatMoney(slice.importe)}`,
                  )
                  .join(" · ")
              : "Sin costes cargados"
          }
        />
      </div>

      {/* Banda 2: qué cuesta cada pedido */}
      <Card
        title="Cada pedido"
        description="Lo que entra y lo que se va, pedido a pedido. Aquí se ve si el negocio aguanta pagar tráfico."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            size="sm"
            label="Ticket medio"
            value={formatMoney(financial.aov_ex_tax)}
            delta={
              <TargetBadge
                value={financial.aov_ex_tax}
                target={targets.aov_ex_tax}
                direction="arriba"
                format={formatMoney}
              />
            }
          />
          <Metric
            size="sm"
            label="Producto"
            value={formatMoney(financial.cogs_per_order)}
          />
          <Metric
            size="sm"
            label="Envío"
            value={formatMoney(financial.shipping_per_order)}
          />
          <Metric
            size="sm"
            label="Gastos fijos"
            value={formatMoney(financial.fixed_per_order)}
            hint={`${formatPct(financial.fixed_pct_revenue)} de la facturación`}
          />
          <Metric
            size="sm"
            label="Deja, tras captarlo"
            value={formatMoney(financial.contribution_per_order)}
            tone={financial.contribution_per_order >= 0 ? "success" : "danger"}
            hint="ticket − producto − envío − publicidad"
          />
        </div>
      </Card>

      {/* Banda 3: publicidad */}
      <Card
        title="Publicidad"
        description="Cuánto puedes pagar por un pedido sin perder dinero, y cuánto estás pagando."
      >
        {!hasAds ? (
          <EmptyState
            title="Sin inversión publicitaria en el periodo"
            hint="Conecta Meta Ads en Integraciones para que entre en el beneficio."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              size="sm"
              label="Inversión"
              value={formatMoney(financial.ads_spend)}
              hint={Object.entries(financial.ads_by_platform)
                .map(([platform, amount]) => `${platform} ${formatMoney(amount)}`)
                .join(" · ")}
            />
            <Metric
              size="sm"
              label="CAC real"
              value={
                financial.cac_blended === null
                  ? "n/a"
                  : formatMoney(financial.cac_blended)
              }
              hint={`${formatMoney(financial.breakeven_cac_per_order)} es tu techo`}
              tone={
                financial.cac_blended !== null &&
                financial.cac_blended > financial.breakeven_cac_per_order
                  ? "danger"
                  : "success"
              }
              delta={
                <TargetBadge
                  value={financial.cac_blended}
                  target={targets.cac_blended}
                  direction="abajo"
                  format={formatMoney}
                />
              }
            />
            <Metric
              size="sm"
              label="Margen tras CAC"
              value={formatMoney(financial.mbee)}
              tone={financial.mbee >= 0 ? "success" : "danger"}
              hint="lo que sobra de cada pedido captado"
            />
            <Metric
              size="sm"
              label="ROAS"
              value={
                meta?.acquisition.roas != null
                  ? `${meta.acquisition.roas.toFixed(2)}x`
                  : "n/a"
              }
              hint={
                financial.breakeven_roas !== null
                  ? `hay que batir ${financial.breakeven_roas.toFixed(2)}x`
                  : "sin margen positivo no hay ROAS que valga"
              }
              tone={
                meta?.acquisition.roas != null &&
                financial.breakeven_roas !== null
                  ? meta.acquisition.roas >= financial.breakeven_roas
                    ? "success"
                    : "danger"
                  : "default"
              }
            />
          </div>
        )}
      </Card>

      {/* Banda 4: lo que no es dinero directo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          card
          size="sm"
          label="Conversión"
          value={
            metrics.funnel?.conversion_rate_own != null
              ? formatPct(metrics.funnel.conversion_rate_own * 100, 2)
              : "n/a"
          }
          hint={
            metrics.funnel?.has_sessions
              ? `${metrics.funnel.sessions.toLocaleString("es-ES")} sesiones`
              : "sin sesiones: falta el permiso de informes"
          }
          delta={
            <TargetBadge
              value={
                metrics.funnel?.conversion_rate_own != null
                  ? metrics.funnel.conversion_rate_own * 100
                  : null
              }
              target={targets.conversion_rate}
              direction="arriba"
              format={(value) => formatPct(value, 2)}
            />
          }
        />
        <Metric
          card
          size="sm"
          label="Envíos, neto"
          value={formatMoney(financial.shipping_net)}
          tone={financial.shipping_net >= 0 ? "success" : "danger"}
          hint={`cobras ${formatMoney(financial.shipping_charged)} · pagas ${formatMoney(financial.shipping_costs)}`}
        />
        <Metric
          card
          size="sm"
          label="Margen neto"
          value={formatPct(financial.net_margin_pct)}
          tone={financial.net_margin_pct >= 0 ? "success" : "danger"}
          delta={
            <TargetBadge
              value={financial.net_margin_pct}
              target={targets.net_margin_pct}
              direction="arriba"
              format={(value) => formatPct(value)}
            />
          }
        />
      </div>

      <Card
        title="Embudo"
        description="De la visita a la compra. El porcentaje es la caída respecto al paso anterior: ahí está la fuga."
      >
        {steps.length === 0 ? (
          <EmptyState
            title="Sin sesiones en el periodo"
            hint="Las sesiones vienen de los informes de Shopify y necesitan ese permiso en la conexión."
          />
        ) : (
          <>
            <Funnel steps={steps} />
            {!metrics.funnel?.has_checkout_data ? (
              <p className="mt-3 text-xs text-muted">
                El paso de pago iniciado no se muestra: en este periodo todavía
                no sincronizábamos los checkouts. No significa que nadie llegara
                a pagar.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted">
              Falta el paso de añadir al carrito: todavía no lo medimos.
            </p>
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Ingresos y beneficio por mes"
          description="Doce meses. Los meses a cero son meses sin ventas, no huecos."
        >
          {monthly.length === 0 ? (
            <EmptyState title="Sin serie mensual" />
          ) : (
            <BarChart
              data={monthly}
              xKey="mes"
              series={[{ key: "Ingresos" }, { key: "Beneficio" }]}
              valueFormatter={(value) => formatMoney(value)}
              height={260}
            />
          )}
        </Card>

        <Card
          title="A dónde va el dinero"
          description="Reparto del coste total del periodo, de mayor a menor."
        >
          {costs.length === 0 ? (
            <EmptyState
              title="Sin costes cargados"
              hint="Sin esto, el beneficio de arriba es el ingreso entero."
            />
          ) : (
            <BarChart
              data={costs}
              xKey="concepto"
              series={[{ key: "importe", label: "Coste" }]}
              valueFormatter={(value) => formatMoney(value)}
              horizontal
              height={220}
            />
          )}
        </Card>
      </div>

      {metrics.margin.items_with_estimated_cost > 0 ? (
        <p className="text-xs text-muted">
          {metrics.margin.items_with_estimated_cost.toLocaleString("es-ES")}{" "}
          líneas de pedido se valoran con el coste que Shopify reporta hoy,
          porque no hay coste cargado para la fecha de su pedido.
        </p>
      ) : null}
    </div>
  );
}

export default function PanelPage() {
  return (
    <PortalShell title="Panel">
      {(bootstrap: BootstrapResponse) =>
        ["platform_admin", "consultant"].includes(
          bootstrap.profile.platform_role,
        ) ? (
          <PanelContent />
        ) : (
          <div className="portal-page">
            <EmptyState
              title="Esta pantalla es del consultor"
              hint="Las cifras de tu tienda están en «Dashboard»."
            />
          </div>
        )
      }
    </PortalShell>
  );
}
