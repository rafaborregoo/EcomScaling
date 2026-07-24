"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { Heading, Button, EmptyState, ErrorBlock, Link, LoadingBlock, Tabs } from "@/components/ui";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";

type DashboardTab = "todo" | "shopify" | "meta" | "klaviyo";

// Shopify y Meta ya usan los SVG en apps/web/public/ (shopify-svgrepo-com.svg,
// meta-logo-facebook-svgrepo-com.svg). Klaviyo sigue apuntando a public/logos/klaviyo.svg,
// que todavia no existe -- mientras no este, el icono simplemente no se muestra (sin roto ni placeholder).
function PlatformIcon({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return null;
  }
  // eslint-disable-next-line @next/next/no-img-element -- logo pequeno, sin necesidad de optimizacion de next/image
  return <img src={src} alt={alt} className="h-4 w-4" onError={() => setFailed(true)} />;
}

type ShopifyConnection = {
  id: string;
  provider_account_name: string | null;
  provider_account_id: string | null;
  status: string;
};

type ShopifyMetrics = {
  period: { days: number | "all"; start: string | null; end: string };
  sales: {
    orders_count: number;
    gross_sales: number;
    net_sales: number;
    discounts: number;
    refunds: number;
    units_sold: number;
    aov: number;
  };
  financial: {
    net_sales: number;
    orders_count: number;
    cogs: number;
    gross_margin: number;
    payment_fees: number;
    shipping_costs: number;
    fixed_costs: number;
    net_profit: number;
    net_margin_pct: number;
    monthly_fixed_costs: number;
    break_even_monthly_revenue: number | null;
    has_settings: boolean;
    fixed_expenses_count: number;
    items_without_cost: number;
  };
};

type MetaMetrics = {
  period: { days: number | "all"; start: string | null; end: string };
  acquisition: {
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    purchase_value: number;
    roas: number | null;
    cac: number | null;
    days_with_data: number;
  };
};

type StoreMetricsSummary = {
  net_sales: number;
  orders_count: number;
  net_profit: number;
} | null;

const PERIOD_OPTIONS = ["7", "30", "90", "all"] as const;

function PeriodSelector({
  periodDays,
  onPeriodChange,
}: {
  periodDays: "7" | "30" | "90" | "all";
  onPeriodChange: (value: "7" | "30" | "90" | "all") => void;
}) {
  return (
    <div className="flex gap-5">
      {PERIOD_OPTIONS.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={periodDays === option ? "primary" : "secondary"}
          onClick={() => onPeriodChange(option)}
        >
          {option === "all" ? "Todo" : `${option}d`}
        </Button>
      ))}
    </div>
  );
}

function StoresOverviewTable({
  organizationId,
  connections,
  periodDays,
  onPeriodChange,
  activeConnectionId,
  onSelectConnection,
}: {
  organizationId: string;
  connections: ShopifyConnection[];
  periodDays: "7" | "30" | "90" | "all";
  onPeriodChange: (value: "7" | "30" | "90" | "all") => void;
  activeConnectionId: string;
  onSelectConnection: (connectionId: string) => void;
}) {
  const [summaries, setSummaries] = useState<Record<string, StoreMetricsSummary>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setIsLoading(true);
      const entries = await Promise.all(
        connections.map(async (connection) => {
          const response = await apiFetch(
            `/v1/organizations/${organizationId}/shopify/metrics?days=${periodDays}&connectionId=${connection.id}`,
          );
          if (!response.ok) {
            return [connection.id, null] as const;
          }
          const data = (await response.json()) as ShopifyMetrics;
          return [
            connection.id,
            {
              net_sales: data.sales.net_sales,
              orders_count: data.sales.orders_count,
              net_profit: data.financial.net_profit,
            },
          ] as const;
        }),
      );

      if (!cancelled) {
        setSummaries(Object.fromEntries(entries));
        setIsLoading(false);
      }
    }

    if (connections.length > 0) {
      void loadAll();
    }

    return () => {
      cancelled = true;
    };
  }, [organizationId, connections, periodDays]);

  if (connections.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-ink/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <Heading size="lg">Todas las tiendas</Heading>
        <PeriodSelector periodDays={periodDays} onPeriodChange={onPeriodChange} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium uppercase text-muted">
              <th className="px-4 py-3 font-medium">Tienda</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Facturación neta</th>
              <th className="px-4 py-3 font-medium">Pedidos</th>
              <th className="px-4 py-3 font-medium">Beneficio neto</th>
              <th className="px-4 py-3 font-medium">Ir a</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {connections.map((connection) => {
              const summary = summaries[connection.id];
              const isActive = activeConnectionId === connection.id;

              return (
                <tr key={connection.id} className={isActive ? "bg-surface" : undefined}>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {connection.provider_account_id ?? connection.provider_account_name ?? "Tienda Shopify"}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs uppercase text-muted">{connection.status}</td>
                  <td className="px-4 py-3 font-mono">
                    {isLoading && summary === undefined
                      ? "..."
                      : summary
                        ? Number(summary.net_sales).toFixed(2)
                        : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {isLoading && summary === undefined ? "..." : (summary?.orders_count ?? "—")}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {isLoading && summary === undefined
                      ? "..."
                      : summary
                        ? Number(summary.net_profit).toFixed(2)
                        : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-3">
                      <Button size="sm" variant="ghost" onClick={() => onSelectConnection(connection.id)}>
                        {isActive ? "Viendo aquí" : "Ver aquí"}
                      </Button>
                      <Link href={`/shopify?organizationId=${organizationId}&connectionId=${connection.id}`}>
                        Diagnóstico
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DashboardContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const { connectionId: activeConnectionId, setConnectionId } = useActiveConnection();
  const [shopifyConnections, setShopifyConnections] = useState<ShopifyConnection[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [storesLoadError, setStoresLoadError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ShopifyMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [periodDays, setPeriodDays] = useState<"7" | "30" | "90" | "all">("30");
  const [metaMetrics, setMetaMetrics] = useState<MetaMetrics | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("todo");

  const organization =
    bootstrap.memberships.find((membership) => membership.organization_id === selectedOrganizationId)
      ?.organization ?? bootstrap.memberships[0]?.organization ?? null;
  const isConsultant = ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role);
  // Los diagnosticos IA solo admiten 7/30/90 dias (ver ai-runtime.ts); "Todo"
  // no tiene un equivalente razonable para un LLM, asi que cae al default (30).
  const aiDiagnosticDays = periodDays === "all" ? 30 : Number(periodDays);

  useEffect(() => {
    async function loadStores() {
      if (!organization) {
        return;
      }

      setIsLoadingStores(true);
      const response = await apiFetch(`/v1/organizations/${organization.id}/shopify/connections`);

      if (response.ok) {
        const payload = (await response.json()) as { connections: ShopifyConnection[] };
        setShopifyConnections(payload.connections ?? []);
        setStoresLoadError(null);
      } else {
        setShopifyConnections([]);
        setStoresLoadError(
          `No se pudo cargar el estado de Shopify (HTTP ${response.status}). Reintenta o revisa los logs de la API.`,
        );
      }

      setIsLoadingStores(false);
    }

    void loadStores();
  }, [organization?.id]);

  useEffect(() => {
    async function loadMetrics() {
      if (!organization) {
        return;
      }

      setIsLoadingMetrics(true);
      const connectionParam = activeConnectionId
        ? `&connectionId=${encodeURIComponent(activeConnectionId)}`
        : "";
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/shopify/metrics?days=${periodDays}${connectionParam}`,
      );

      if (response.ok) {
        setMetrics((await response.json()) as ShopifyMetrics);
        setMetricsError(null);
      } else {
        setMetrics(null);
        setMetricsError(`No se pudieron cargar las métricas (HTTP ${response.status}).`);
      }

      const metaResponse = await apiFetch(
        `/v1/organizations/${organization.id}/meta/metrics?days=${periodDays}`,
      );

      if (metaResponse.ok) {
        setMetaMetrics((await metaResponse.json()) as MetaMetrics);
      } else {
        setMetaMetrics(null);
      }

      setIsLoadingMetrics(false);
    }

    void loadMetrics();
  }, [organization?.id, periodDays, activeConnectionId]);

  const showStoresOverview = isConsultant && organization && shopifyConnections.length > 0;

  // FE-01 (gap confirmado 2026-07-22: "sin contrato de UX para usuario sin
  // organizacion"). Sin esto, un cliente con memberships vacio (invitado
  // pero sin asignar, o eliminado de su unica organizacion) veia un
  // dashboard vacio sin ninguna explicacion de por que no habia datos.
  if (!organization) {
    return (
      <EmptyState
        title="Sin organización asignada"
        hint="Tu cuenta todavía no está vinculada a ninguna organización. Contacta con tu consultor o con soporte para que te asignen una."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as DashboardTab)}
        items={[
          { value: "todo", label: "Todo" },
          { value: "shopify", label: "Shopify", icon: <PlatformIcon src="/shopify-svgrepo-com.svg" alt="" /> },
          { value: "meta", label: "Meta Ads", icon: <PlatformIcon src="/meta-logo-facebook-svgrepo-com.svg" alt="" /> },
          { value: "klaviyo", label: "Klaviyo", icon: <PlatformIcon src="/logos/klaviyo.svg" alt="" /> },
        ]}
      />

      {(activeTab === "todo" || activeTab === "shopify") && showStoresOverview && organization ? (
        <StoresOverviewTable
          organizationId={organization.id}
          connections={shopifyConnections}
          periodDays={periodDays}
          onPeriodChange={setPeriodDays}
          activeConnectionId={activeConnectionId}
          onSelectConnection={setConnectionId}
        />
      ) : null}

      {activeTab === "klaviyo" ? (
        <EmptyState
          title="Klaviyo no está conectado todavía"
          hint="Conecta la cuenta de Klaviyo en Integraciones para ver listas, campañas y flows en este dashboard."
          action={
            <Link className="button button--primary" href="/integraciones">
              Ir a Integraciones
            </Link>
          }
        />
      ) : null}

      {(activeTab === "todo" || activeTab === "shopify") ? (
      <section className="border-t border-ink/20 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div>
            <Heading size="lg">
              {activeConnectionId ? "Resumen de la tienda seleccionada" : "Resumen ejecutivo"}
            </Heading>
            {metrics ? (
              <p className="mt-1 font-mono text-xs text-muted">
                hasta {new Date(metrics.period.end).toLocaleString()}
              </p>
            ) : null}
          </div>
          {!showStoresOverview ? (
            <PeriodSelector periodDays={periodDays} onPeriodChange={setPeriodDays} />
          ) : null}
        </div>

        {isLoadingMetrics ? (
          <div className="p-4">
            <LoadingBlock label="Cargando métricas..." />
          </div>
        ) : metricsError ? (
          <div className="p-4">
            <ErrorBlock>{metricsError}</ErrorBlock>
          </div>
        ) : metrics ? (
          <>
            <div className="mt-3 grid gap-x-8 border-b border-line pb-2 md:grid-cols-3 xl:grid-cols-6">
              <article className="py-4 md:pr-8">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Facturación neta</p>
                <p className="mt-1.5 font-mono text-3xl tracking-tight">{Number(metrics.sales.net_sales).toFixed(2)}</p>
              </article>
              <article className="py-4 md:pr-8">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Pedidos</p>
                <p className="mt-1.5 font-mono text-3xl tracking-tight">{metrics.sales.orders_count}</p>
              </article>
              <article className="py-4 xl:pr-8">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">AOV</p>
                <p className="mt-1.5 font-mono text-3xl tracking-tight">{Number(metrics.sales.aov).toFixed(2)}</p>
              </article>
              <article className="py-4 md:pr-8">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Beneficio neto estimado</p>
                <p
                  className={[
                    "mt-1.5 font-mono text-3xl tracking-tight",
                    Number(metrics.financial.net_profit) >= 0 ? "text-success" : "text-brand",
                  ].join(" ")}
                >
                  {Number(metrics.financial.net_profit).toFixed(2)}
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  {Number(metrics.financial.net_margin_pct).toFixed(1)}% margen
                </p>
              </article>
              <article className="py-4 md:pr-8">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Break-even mensual</p>
                <p className="mt-1.5 font-mono text-3xl tracking-tight">
                  {metrics.financial.break_even_monthly_revenue != null
                    ? Number(metrics.financial.break_even_monthly_revenue).toFixed(2)
                    : "n/a"}
                </p>
              </article>
              <article className="py-4">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Gastos fijos/mes</p>
                <p className="mt-1.5 font-mono text-3xl tracking-tight">
                  {Number(metrics.financial.monthly_fixed_costs).toFixed(2)}
                </p>
              </article>
            </div>

            {!metrics.financial.has_settings || metrics.financial.fixed_expenses_count === 0 || metrics.financial.items_without_cost > 0 ? (
              <div className="space-y-2 border-b border-line bg-warn-tint px-4 py-3 text-sm">
                <p className="font-medium">Datos incompletos: el beneficio neto es una estimacion parcial.</p>
                <ul className="list-disc space-y-1 pl-5 text-muted">
                  {!metrics.financial.has_settings ? (
                    <li>
                      Faltan las comisiones de pago y el envío medio.{" "}
                      <Link href="/configuracion">
                        Configurar costes por pedido
                      </Link>
                    </li>
                  ) : null}
                  {metrics.financial.fixed_expenses_count === 0 ? (
                    <li>
                      Sin gastos fijos: el break-even no es fiable.{" "}
                      <Link href="/configuracion">
                        Añadir gastos fijos
                      </Link>
                    </li>
                  ) : null}
                  {metrics.financial.items_without_cost > 0 ? (
                    <li>
                      {metrics.financial.items_without_cost} lineas de pedido sin coste de producto: el COGS
                      esta infravalorado.{" "}
                      <Link href="/shopify">
                        Cargar costes de producto
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="p-4 text-sm text-muted">
            Conecta una tienda Shopify para ver los KPIs del negocio.
          </div>
        )}
      </section>
      ) : null}

      {(activeTab === "todo" || activeTab === "meta") ? (
        <section className="border-t border-ink/20 pt-5">
          <Heading size="lg">Meta Ads</Heading>
          <div className="mt-3 grid gap-x-8 border-b border-line pb-2 md:grid-cols-3 xl:grid-cols-6">
            <article className="py-4 md:pr-8">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Inversión Meta</p>
              <p className="mt-1.5 font-mono text-3xl tracking-tight">
                {metaMetrics && metaMetrics.acquisition.days_with_data > 0
                  ? Number(metaMetrics.acquisition.spend).toFixed(2)
                  : "—"}
              </p>
            </article>
            <article className="py-4 md:pr-8">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">ROAS</p>
              <p className="mt-1.5 font-mono text-3xl tracking-tight">
                {metaMetrics?.acquisition.roas != null ? Number(metaMetrics.acquisition.roas).toFixed(2) : "—"}
              </p>
            </article>
            <article className="py-4 xl:pr-8">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">CAC</p>
              <p className="mt-1.5 font-mono text-3xl tracking-tight">
                {metaMetrics?.acquisition.cac != null ? Number(metaMetrics.acquisition.cac).toFixed(2) : "—"}
              </p>
            </article>
            <article className="py-4 md:pr-8">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Compras atribuidas</p>
              <p className="mt-1.5 font-mono text-3xl tracking-tight">
                {metaMetrics && metaMetrics.acquisition.days_with_data > 0
                  ? Number(metaMetrics.acquisition.purchases).toFixed(0)
                  : "—"}
              </p>
            </article>
            <article className="py-4 md:col-span-2">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Adquisición</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {metaMetrics && metaMetrics.acquisition.days_with_data > 0
                  ? `Datos de ${metaMetrics.acquisition.days_with_data} días. Atribucion segun ventana por defecto de Meta; puede diferir del Ads Manager.`
                  : "Sin datos de Meta Ads. Conecta la cuenta publicitaria en Integraciones para comparar inversion y ROAS contra el break-even."}
              </p>
            </article>
          </div>
          {!metaMetrics || metaMetrics.acquisition.days_with_data === 0 ? (
            <div className="pt-4">
              <Link className="button button--primary" href="/integraciones">
                Conectar Meta Ads
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "todo" && isConsultant && organization ? (
        <>
          <AiDiagnosticSection
            organizationId={organization.id}
            title="Diagnóstico IA"
            getPath="/ai/monitor"
            runPath="/ai/monitor-run"
            loadingLabel="Analizando el negocio con IA... la primera vez puede tardar 1-2 minutos."
            tasksLabelSingular="tarea"
            days={aiDiagnosticDays}
          />
          <AiDiagnosticSection
            organizationId={organization.id}
            title="Plan de tareas IA"
            getPath="/ai/task-planner"
            runPath="/ai/task-planner-run"
            loadingLabel="Priorizando el backlog con IA..."
            tasksLabelSingular="tarea"
            days={aiDiagnosticDays}
          />
          <AiDiagnosticSection
            organizationId={organization.id}
            title="Stock IA"
            getPath="/ai/stock-planner"
            runPath="/ai/stock-planner-run"
            loadingLabel="Cruzando stock y ventas con IA..."
            tasksLabelSingular="tarea de reposición"
            days={aiDiagnosticDays}
          />
        </>
      ) : null}

      {(activeTab === "todo" || activeTab === "shopify") ? (
      <section className="border-t border-ink/20">
        <div className="border-b border-line px-4 py-3">
          <Heading size="lg">Tiendas Shopify</Heading>
        </div>
        <div className="divide-y divide-line">
          {isLoadingStores ? (
            <div className="px-4 py-3">
              <LoadingBlock label="Cargando tiendas..." />
            </div>
          ) : isConsultant && shopifyConnections.length > 0 ? null : shopifyConnections.length ? (
            shopifyConnections.map((connection) => (
              <div
                key={connection.id}
                className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_140px_120px]"
              >
                <div>
                  <p className="font-medium">
                    {connection.provider_account_id ?? connection.provider_account_name ?? "Tienda Shopify"}
                  </p>
                  <p className="font-mono text-xs text-muted">{connection.id}</p>
                </div>
                <p className="font-mono text-sm text-brand">{connection.status}</p>
                <Link
                  className="button button--primary w-fit"
                  href={`/shopify?organizationId=${selectedOrganizationId}&connectionId=${connection.id}`}
                >
                  Ver tienda
                </Link>
              </div>
            ))
          ) : storesLoadError ? (
            <div className="px-4 py-3">
              <ErrorBlock>{storesLoadError}</ErrorBlock>
            </div>
          ) : (
            <div className="px-4 py-4">
              <EmptyState
                title="Sin tiendas Shopify conectadas"
                hint="Conecta la tienda del cliente para empezar a ver ventas, margen y stock en tiempo real."
                action={
                  <Link className="button button--primary" href="/integraciones">
                    Conectar Shopify
                  </Link>
                }
              />
            </div>
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PortalShell title="Dashboard">
      {(bootstrap) => <DashboardContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
