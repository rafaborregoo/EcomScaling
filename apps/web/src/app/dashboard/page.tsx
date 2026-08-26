"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { mapWithConcurrency } from "@/lib/async-concurrency";
import {
  Badge,
  Heading,
  Button,
  EmptyState,
  ErrorBlock,
  Link,
  LoadingBlock,
  Table,
  Tabs,
  type TableColumnDef,
} from "@/components/ui";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

type DashboardTab = "todo" | "shopify" | "meta" | "klaviyo";

// Un recurso de marca ausente no debe dejar un icono roto ni eliminar la señal visual de la pestaña.
function PlatformIcon({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className="inline-flex h-4 w-4 items-center justify-center border border-ink/30 font-mono text-[0.6rem] font-semibold text-ink"
      >
        {fallback}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={16}
      height={16}
      className="h-4 w-4"
      onError={() => setFailed(true)}
    />
  );
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
  previous_period: {
    period: { start: string; end: string };
    sales: { orders_count: number; net_sales: number; aov: number };
    financial: { net_profit: number };
  } | null;
};

// FE-02: "+12,3%" / "-5,1%" vs el periodo anterior (mismo numero de dias,
// inmediatamente antes). `null` cuando no hay base valida para comparar
// (periodo "Todo", sin datos previos, o el valor anterior era 0 -- una
// division por cero no es un "-100%" util para el consultor).
function periodDeltaPct(
  current: number,
  previous: number | undefined | null,
): number | null {
  if (previous === undefined || previous === null || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function PeriodDeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number | undefined | null;
}) {
  const deltaPct = periodDeltaPct(current, previous);
  if (deltaPct === null) {
    return null;
  }
  const tone = deltaPct > 0 ? "success" : deltaPct < 0 ? "danger" : "neutral";
  const sign = deltaPct > 0 ? "+" : "";
  return (
    <Badge
      tone={tone}
      className="mt-1"
      title="vs. el periodo anterior (mismo numero de dias)"
    >
      {sign}
      {deltaPct.toFixed(1)}%
    </Badge>
  );
}

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

type DashboardOperations = {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_at: string | null;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
  }>;
};

type FocusItem = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  tone: "danger" | "warn" | "neutral";
};

function buildFocusItems({
  operations,
  connections,
  metrics,
  metaMetrics,
}: {
  operations: DashboardOperations | null;
  connections: ShopifyConnection[];
  metrics: ShopifyMetrics | null;
  metaMetrics: MetaMetrics | null;
}): FocusItem[] {
  const items: FocusItem[] = [];
  const openAlerts = (operations?.alerts ?? []).filter(
    (alert) => !["resolved", "ignored"].includes(alert.status),
  );
  const openTasks = (operations?.tasks ?? []).filter((task) =>
    ["pending", "in_progress"].includes(task.status),
  );
  const now = Date.now();

  openAlerts
    .filter((alert) => ["critical", "high"].includes(alert.severity))
    .sort((left, right) =>
      left.severity === right.severity
        ? 0
        : left.severity === "critical"
          ? -1
          : 1,
    )
    .slice(0, 2)
    .forEach((alert) => {
      items.push({
        id: `alert:${alert.id}`,
        eyebrow: "Alerta prioritaria",
        title: alert.title,
        detail: "Revisa el diagnóstico y decide la siguiente acción.",
        href: "/tareas",
        tone: alert.severity === "critical" ? "danger" : "warn",
      });
    });

  openTasks
    .filter((task) => task.due_at && Date.parse(task.due_at) < now)
    .slice(0, 2)
    .forEach((task) => {
      items.push({
        id: `overdue:${task.id}`,
        eyebrow: "Tarea vencida",
        title: task.title,
        detail: "Está abierta y ha superado su fecha prevista.",
        href: "/tareas",
        tone: "danger",
      });
    });

  openTasks
    .filter((task) => ["urgent", "high"].includes(task.priority))
    .slice(0, 2)
    .forEach((task) => {
      if (items.some((item) => item.id.endsWith(task.id))) return;
      items.push({
        id: `task:${task.id}`,
        eyebrow: "Siguiente tarea",
        title: task.title,
        detail: "Prioridad alta definida en el backlog del negocio.",
        href: "/tareas",
        tone: task.priority === "urgent" ? "danger" : "warn",
      });
    });

  if (connections.length === 0) {
    items.push({
      id: "shopify:missing",
      eyebrow: "Conector principal",
      title: "Conecta Shopify para activar el análisis",
      detail:
        "Sin una tienda conectada no se calculan ventas, margen ni stock.",
      href: "/integraciones",
      tone: "warn",
    });
  }

  if (!metaMetrics || metaMetrics.acquisition.days_with_data === 0) {
    items.push({
      id: "meta:missing",
      eyebrow: "Conector preparado",
      title: "Meta Ads aún no está conectado",
      detail:
        "No se muestran inversión ni ROAS hasta autorizar una cuenta real.",
      href: "/integraciones",
      tone: "neutral",
    });
  }

  if (metrics && Number(metrics.financial.net_profit) < 0) {
    items.push({
      id: "metric:profit",
      eyebrow: "Indicador financiero",
      title: "El beneficio neto del periodo es negativo",
      detail:
        "Comprueba costes, margen y las acciones abiertas antes de escalar inversión.",
      href: "/dashboard?tab=shopify",
      tone: "danger",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "all:healthy",
      eyebrow: "Prioridad actual",
      title: "No hay bloqueos operativos prioritarios",
      detail:
        "Puedes revisar los KPIs del periodo o avanzar el plan estratégico.",
      href: "/camino",
      tone: "neutral",
    });
  }

  return items.slice(0, 4);
}

function AdaptiveFocus({
  items,
  isLoading,
  error,
}: {
  items: FocusItem[];
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <section
      className="border-t border-ink/20 pt-5"
      aria-labelledby="dashboard-focus-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
            Ordenado por impacto
          </p>
          <Heading size="lg" id="dashboard-focus-title">
            Qué requiere atención
          </Heading>
        </div>
        <Link href="/tareas">Ver operaciones</Link>
      </div>
      {isLoading ? (
        <div className="mt-3">
          <LoadingBlock label="Calculando prioridades..." />
        </div>
      ) : error ? (
        <div className="mt-3">
          <ErrorBlock>{error}</ErrorBlock>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group border border-line p-4 transition-colors hover:border-ink"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                    {item.eyebrow}
                  </p>
                  <p className="mt-1 font-medium group-hover:underline">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {item.detail}
                  </p>
                </div>
                <Badge tone={item.tone}>
                  {item.tone === "danger"
                    ? "Alta"
                    : item.tone === "warn"
                      ? "Revisar"
                      : "Info"}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

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
  const [summaries, setSummaries] = useState<
    Record<string, StoreMetricsSummary>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const connectionKey = connections.map((connection) => connection.id).join(",");

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setIsLoading(true);
      try {
        const entries = await mapWithConcurrency(
          connections,
          4,
          async (connection) => {
            try {
              const response = await apiFetch(
                `/v1/organizations/${organizationId}/shopify/metrics?days=${periodDays}&connectionId=${connection.id}`,
              );
              if (!response.ok) return [connection.id, null] as const;
              const data = (await response.json()) as ShopifyMetrics;
              return [
                connection.id,
                {
                  net_sales: data.sales.net_sales,
                  orders_count: data.sales.orders_count,
                  net_profit: data.financial.net_profit,
                },
              ] as const;
            } catch {
              return [connection.id, null] as const;
            }
          },
        );

        if (!cancelled) {
          setSummaries(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) {
          setSummaries({});
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    if (connections.length > 0) {
      void loadAll();
    } else {
      setSummaries({});
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [organizationId, connectionKey, periodDays]);

  if (connections.length === 0) {
    return null;
  }

  const columns: TableColumnDef<ShopifyConnection>[] = [
    {
      key: "name",
      label: "Tienda",
      render: (row) => (
        <p className="font-medium">
          {row.provider_account_id ??
            row.provider_account_name ??
            "Tienda Shopify"}
        </p>
      ),
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => (
        <span className="font-mono text-xs uppercase text-muted">
          {row.status}
        </span>
      ),
    },
    {
      key: "net_sales",
      label: "Facturación neta",
      render: (row) => {
        const summary = summaries[row.id];
        return (
          <span className="font-mono">
            {isLoading && summary === undefined
              ? "..."
              : summary
                ? Number(summary.net_sales).toFixed(2)
                : "—"}
          </span>
        );
      },
    },
    {
      key: "orders_count",
      label: "Pedidos",
      render: (row) => {
        const summary = summaries[row.id];
        return (
          <span className="font-mono">
            {isLoading && summary === undefined
              ? "..."
              : (summary?.orders_count ?? "—")}
          </span>
        );
      },
    },
    {
      key: "net_profit",
      label: "Beneficio neto",
      render: (row) => {
        const summary = summaries[row.id];
        return (
          <span className="font-mono">
            {isLoading && summary === undefined
              ? "..."
              : summary
                ? Number(summary.net_profit).toFixed(2)
                : "—"}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Ir a",
      render: (row) => (
        <div className="flex flex-wrap gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSelectConnection(row.id)}
          >
            {activeConnectionId === row.id ? "Viendo aquí" : "Ver aquí"}
          </Button>
          <Link
            href={`/shopify?organizationId=${organizationId}&connectionId=${row.id}`}
          >
            Diagnóstico
          </Link>
        </div>
      ),
    },
  ];

  return (
    <section className="border-t border-ink/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <Heading size="lg">Todas las tiendas</Heading>
        <PeriodSelector
          periodDays={periodDays}
          onPeriodChange={onPeriodChange}
        />
      </div>
      <Table
        ariaLabel="Todas las tiendas Shopify"
        columns={columns}
        rows={connections}
      />
    </section>
  );
}

function DashboardContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const { connectionId: activeConnectionId, setConnectionId } =
    useActiveConnection();
  const [shopifyConnections, setShopifyConnections] = useState<
    ShopifyConnection[]
  >([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [storesLoadError, setStoresLoadError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ShopifyMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [periodDays, setPeriodDays] = useState<"7" | "30" | "90" | "all">("30");
  const [metaMetrics, setMetaMetrics] = useState<MetaMetrics | null>(null);
  const [operations, setOperations] = useState<DashboardOperations | null>(
    null,
  );
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [isLoadingOperations, setIsLoadingOperations] = useState(false);
  const [hasFinancialConfig, setHasFinancialConfig] = useState(false);
  const [financialConfigError, setFinancialConfigError] = useState<
    string | null
  >(null);
  const [isLoadingFinancialConfig, setIsLoadingFinancialConfig] =
    useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("todo");

  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  // Los diagnosticos IA solo admiten 7/30/90 dias (ver ai-runtime.ts); "Todo"
  // no tiene un equivalente razonable para un LLM, asi que cae al default (30).
  const aiDiagnosticDays = periodDays === "all" ? 30 : Number(periodDays);

  useEffect(() => {
    async function loadStores() {
      if (!organization) {
        return;
      }

      setIsLoadingStores(true);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organization.id}/shopify/connections`,
        );

        if (response.ok) {
          const payload = (await response.json()) as {
            connections: ShopifyConnection[];
          };
          setShopifyConnections(payload.connections ?? []);
          setStoresLoadError(null);
        } else {
          setShopifyConnections([]);
          setStoresLoadError(
            `No se pudo cargar el estado de Shopify (HTTP ${response.status}). Reintenta o revisa los logs de la API.`,
          );
        }
      } catch {
        setShopifyConnections([]);
        setStoresLoadError(
          "No se pudo cargar el estado de Shopify por un error de red. Reintenta.",
        );
      } finally {
        setIsLoadingStores(false);
      }
    }

    void loadStores();
  }, [organization]);

  useEffect(() => {
    async function loadMetrics() {
      if (!organization) {
        return;
      }

      setIsLoadingMetrics(true);
      try {
        const connectionParam = activeConnectionId
          ? `&connectionId=${encodeURIComponent(activeConnectionId)}`
          : "";
        const [shopifyResult, metaResult] = await Promise.allSettled([
          apiFetch(
            `/v1/organizations/${organization.id}/shopify/metrics?days=${periodDays}${connectionParam}`,
          ),
          apiFetch(
            `/v1/organizations/${organization.id}/meta/metrics?days=${periodDays}`,
          ),
        ]);

        if (shopifyResult.status === "fulfilled") {
          if (shopifyResult.value.ok) {
            setMetrics((await shopifyResult.value.json()) as ShopifyMetrics);
            setMetricsError(null);
          } else {
            setMetrics(null);
            setMetricsError(
              `No se pudieron cargar las métricas (HTTP ${shopifyResult.value.status}).`,
            );
          }
        } else {
          setMetrics(null);
          setMetricsError(
            "No se pudieron cargar las métricas por un error de red. Reintenta.",
          );
        }

        if (metaResult.status === "fulfilled" && metaResult.value.ok) {
          setMetaMetrics((await metaResult.value.json()) as MetaMetrics);
        } else {
          setMetaMetrics(null);
        }
      } catch {
        setMetrics(null);
        setMetaMetrics(null);
        setMetricsError(
          "No se pudieron cargar las métricas por un error de red. Reintenta.",
        );
      } finally {
        setIsLoadingMetrics(false);
      }
    }

    void loadMetrics();
  }, [organization, periodDays, activeConnectionId]);

  useEffect(() => {
    async function loadFinancialConfig() {
      if (!organization) return;

      setIsLoadingFinancialConfig(true);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organization.id}/financial-config`,
        );
        if (response.ok) {
          const payload = (await response.json()) as {
            settings: object | null;
          };
          setHasFinancialConfig(payload.settings !== null);
          setFinancialConfigError(null);
        } else {
          setHasFinancialConfig(false);
          setFinancialConfigError(
            `No se pudo cargar la configuracion financiera (HTTP ${response.status}).`,
          );
        }
      } catch {
        setHasFinancialConfig(false);
        setFinancialConfigError(
          "No se pudo cargar la configuración financiera por un error de red. Reintenta.",
        );
      } finally {
        setIsLoadingFinancialConfig(false);
      }
    }

    void loadFinancialConfig();
  }, [organization]);

  useEffect(() => {
    async function loadOperations() {
      if (!organization) return;

      setIsLoadingOperations(true);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organization.id}/operations`,
        );
        if (response.ok) {
          setOperations((await response.json()) as DashboardOperations);
          setOperationsError(null);
        } else {
          setOperations(null);
          setOperationsError(
            `No se pudieron cargar las prioridades operativas (HTTP ${response.status}).`,
          );
        }
      } catch {
        setOperations(null);
        setOperationsError(
          "No se pudieron cargar las prioridades operativas por un error de red. Reintenta.",
        );
      } finally {
        setIsLoadingOperations(false);
      }
    }

    void loadOperations();
  }, [organization]);

  const showStoresOverview =
    isConsultant && organization && shopifyConnections.length > 0;

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

  const focusItems = buildFocusItems({
    operations,
    connections: shopifyConnections,
    metrics,
    metaMetrics,
  });

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as DashboardTab)}
        items={[
          { value: "todo", label: "Todo" },
          {
            value: "shopify",
            label: "Shopify",
            icon: (
              <PlatformIcon
                src="/shopify-svgrepo-com.svg"
                alt=""
                fallback="S"
              />
            ),
          },
          {
            value: "meta",
            label: "Meta Ads",
            icon: (
              <PlatformIcon
                src="/meta-logo-facebook-svgrepo-com.svg"
                alt=""
                fallback="M"
              />
            ),
          },
          {
            value: "klaviyo",
            label: "Klaviyo",
            icon: <PlatformIcon src="/logos/klaviyo.svg" alt="" fallback="K" />,
          },
        ]}
      />

      {activeTab === "todo" ? (
        <AdaptiveFocus
          items={focusItems}
          isLoading={isLoadingOperations}
          error={operationsError}
        />
      ) : null}

      {activeTab === "todo" ? (
        <OnboardingChecklist
          organizationStatus={organization.status}
          shopifyConnectionCount={shopifyConnections.length}
          hasShopifyMetrics={metrics !== null}
          hasFinancialConfig={hasFinancialConfig}
          isLoadingMetrics={isLoadingMetrics || isLoadingStores}
          isLoadingFinancialConfig={isLoadingFinancialConfig}
          metricsError={metricsError}
          financialConfigError={financialConfigError}
        />
      ) : null}

      {(activeTab === "todo" || activeTab === "shopify") &&
      showStoresOverview &&
      organization ? (
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
          title="Klaviyo preparado, pero no disponible"
          hint="El conector de Klaviyo está preparado en el dominio, pero aún no está habilitado para conectar cuentas reales. No se muestran métricas simuladas."
          action={
            <Link className="button button--primary" href="/integraciones">
              Ver estado del conector
            </Link>
          }
        />
      ) : null}

      {activeTab === "todo" || activeTab === "shopify" ? (
        <section className="border-t border-ink/20 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div>
              <Heading size="lg">
                {activeConnectionId
                  ? "Resumen de la tienda seleccionada"
                  : "Resumen ejecutivo"}
              </Heading>
              {metrics ? (
                <p className="mt-1 font-mono text-xs text-muted">
                  hasta {new Date(metrics.period.end).toLocaleString()}
                </p>
              ) : null}
            </div>
            {!showStoresOverview ? (
              <PeriodSelector
                periodDays={periodDays}
                onPeriodChange={setPeriodDays}
              />
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
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                    Facturación neta
                  </p>
                  <p className="mt-1.5 font-mono text-3xl tracking-tight">
                    {Number(metrics.sales.net_sales).toFixed(2)}
                  </p>
                  <PeriodDeltaBadge
                    current={metrics.sales.net_sales}
                    previous={metrics.previous_period?.sales.net_sales}
                  />
                </article>
                <article className="py-4 md:pr-8">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                    Pedidos
                  </p>
                  <p className="mt-1.5 font-mono text-3xl tracking-tight">
                    {metrics.sales.orders_count}
                  </p>
                  <PeriodDeltaBadge
                    current={metrics.sales.orders_count}
                    previous={metrics.previous_period?.sales.orders_count}
                  />
                </article>
                <article className="py-4 xl:pr-8">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                    AOV
                  </p>
                  <p className="mt-1.5 font-mono text-3xl tracking-tight">
                    {Number(metrics.sales.aov).toFixed(2)}
                  </p>
                  <PeriodDeltaBadge
                    current={metrics.sales.aov}
                    previous={metrics.previous_period?.sales.aov}
                  />
                </article>
                <article className="py-4 md:pr-8">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                    Beneficio neto estimado
                  </p>
                  <p
                    className={[
                      "mt-1.5 font-mono text-3xl tracking-tight",
                      Number(metrics.financial.net_profit) >= 0
                        ? "text-success"
                        : "text-brand",
                    ].join(" ")}
                  >
                    {Number(metrics.financial.net_profit).toFixed(2)}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {Number(metrics.financial.net_margin_pct).toFixed(1)}%
                    margen
                  </p>
                  <PeriodDeltaBadge
                    current={metrics.financial.net_profit}
                    previous={metrics.previous_period?.financial.net_profit}
                  />
                </article>
                <article className="py-4 md:pr-8">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                    Break-even mensual
                  </p>
                  <p className="mt-1.5 font-mono text-3xl tracking-tight">
                    {metrics.financial.break_even_monthly_revenue != null
                      ? Number(
                          metrics.financial.break_even_monthly_revenue,
                        ).toFixed(2)
                      : "n/a"}
                  </p>
                </article>
                <article className="py-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                    Gastos fijos/mes
                  </p>
                  <p className="mt-1.5 font-mono text-3xl tracking-tight">
                    {Number(metrics.financial.monthly_fixed_costs).toFixed(2)}
                  </p>
                </article>
              </div>

              {!metrics.financial.has_settings ||
              metrics.financial.fixed_expenses_count === 0 ||
              metrics.financial.items_without_cost > 0 ? (
                <div className="space-y-2 border-b border-line bg-warn-tint px-4 py-3 text-sm">
                  <p className="font-medium">
                    Datos incompletos: el beneficio neto es una estimacion
                    parcial.
                  </p>
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
                        <Link href="/configuracion">Añadir gastos fijos</Link>
                      </li>
                    ) : null}
                    {metrics.financial.items_without_cost > 0 ? (
                      <li>
                        {metrics.financial.items_without_cost} lineas de pedido
                        sin coste de producto: el COGS esta infravalorado.{" "}
                        <Link href="/shopify">Cargar costes de producto</Link>
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="Sin datos de Shopify"
              hint="Conecta una tienda Shopify y completa la sincronización inicial para ver los KPIs del negocio."
              action={
                <Link className="button button--primary" href="/integraciones">
                  Ir a Integraciones
                </Link>
              }
            />
          )}
        </section>
      ) : null}

      {activeTab === "todo" || activeTab === "meta" ? (
        <section className="border-t border-ink/20 pt-5">
          <Heading size="lg">Meta Ads</Heading>
          <div className="mt-3 grid gap-x-8 border-b border-line pb-2 md:grid-cols-3 xl:grid-cols-6">
            <article className="py-4 md:pr-8">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                Inversión Meta
              </p>
              <p className="mt-1.5 font-mono text-3xl tracking-tight">
                {metaMetrics && metaMetrics.acquisition.days_with_data > 0
                  ? Number(metaMetrics.acquisition.spend).toFixed(2)
                  : "—"}
              </p>
            </article>
            <article className="py-4 md:pr-8">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                ROAS
              </p>
              <p className="mt-1.5 font-mono text-3xl tracking-tight">
                {metaMetrics?.acquisition.roas != null
                  ? Number(metaMetrics.acquisition.roas).toFixed(2)
                  : "—"}
              </p>
            </article>
            <article className="py-4 xl:pr-8">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                CAC
              </p>
              <p className="mt-1.5 font-mono text-3xl tracking-tight">
                {metaMetrics?.acquisition.cac != null
                  ? Number(metaMetrics.acquisition.cac).toFixed(2)
                  : "—"}
              </p>
            </article>
            <article className="py-4 md:pr-8">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                Compras atribuidas
              </p>
              <p className="mt-1.5 font-mono text-3xl tracking-tight">
                {metaMetrics && metaMetrics.acquisition.days_with_data > 0
                  ? Number(metaMetrics.acquisition.purchases).toFixed(0)
                  : "—"}
              </p>
            </article>
            <article className="py-4 md:col-span-2">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
                Adquisición
              </p>
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
            title="Resumen ejecutivo IA"
            getPath="/ai/monitor"
            runPath="/ai/monitor-run"
            loadingLabel="Analizando el negocio con IA... la primera vez puede tardar 1-2 minutos."
            tasksLabelSingular="tarea"
            days={aiDiagnosticDays}
            variant="summary"
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

      {activeTab === "todo" || activeTab === "shopify" ? (
        <section className="border-t border-ink/20">
          <div className="border-b border-line px-4 py-3">
            <Heading size="lg">Tiendas Shopify</Heading>
          </div>
          <div className="divide-y divide-line">
            {isLoadingStores ? (
              <div className="px-4 py-3">
                <LoadingBlock label="Cargando tiendas..." />
              </div>
            ) : isConsultant &&
              shopifyConnections.length >
                0 ? null : shopifyConnections.length ? (
              shopifyConnections.map((connection) => (
                <div
                  key={connection.id}
                  className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_140px_120px]"
                >
                  <div>
                    <p className="font-medium">
                      {connection.provider_account_id ??
                        connection.provider_account_name ??
                        "Tienda Shopify"}
                    </p>
                    <p className="font-mono text-xs text-muted">
                      {connection.id}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-brand">
                    {connection.status}
                  </p>
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
                    <Link
                      className="button button--primary"
                      href="/integraciones"
                    >
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
