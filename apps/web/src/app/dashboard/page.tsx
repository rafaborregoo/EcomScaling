"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { mapWithConcurrency } from "@/lib/async-concurrency";
import { formatMoney } from "@/lib/money";
import { displayValue } from "@/lib/display-labels";
import {
  Badge,
  Banner,
  BarChart,
  ButtonLink,
  Card,
  Heading,
  Button,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Link,
  List,
  LoadingBlock,
  Metric,
  Table,
  Tabs,
  type TableColumnDef,
  type Tone,
} from "@/components/ui";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import { KlaviyoEmailPanel } from "@/components/klaviyo-email-panel";
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
  // Ya venia en la respuesta de /shopify/metrics (ver shopify-metrics.ts) pero
  // el Dashboard lo ignoraba por completo: un cliente podia tener productos
  // agotados sin ninguna senal en su vista principal, solo visible via el
  // panel Stock IA (ahora ademas restringido a consultor/admin).
  stock: {
    tracked_items: number;
    total_available: number;
    low_stock_items: number;
    out_of_stock_items: number;
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
  daily?: Array<{ date: string; net_sales: number; orders_count: number }>;
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

// Color del sparkline según la dirección del cambio vs. periodo anterior.
function trendToneFor(
  current: number,
  previous: number | undefined | null,
): "brand" | "success" | "danger" {
  const delta = periodDeltaPct(current, previous);
  if (delta === null || delta === 0) return "brand";
  return delta > 0 ? "success" : "danger";
}

function PeriodDeltaBadge({
  current,
  previous,
  label,
}: {
  current: number;
  previous: number | undefined | null;
  label?: string;
}) {
  const deltaPct = periodDeltaPct(current, previous);
  if (deltaPct === null) {
    return null;
  }
  const up = deltaPct > 0;
  const flat = deltaPct === 0;
  const color = flat ? "text-muted" : up ? "text-success" : "text-danger";
  return (
    <p
      className={`text-xs ${color}`}
      title="vs. el periodo anterior (mismo numero de dias)"
    >
      <span aria-hidden="true">{flat ? "→" : up ? "↑" : "↓"}</span>{" "}
      {Math.abs(deltaPct).toFixed(1)}%
      {label ? <span className="text-muted"> {label}</span> : null}
    </p>
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
  daily?: Array<{ date: string; spend: number }>;
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
  // Estados de alerta reales: open/acknowledged/resolved/dismissed (ver
  // operations.ts). "ignored" es un estado de tarea, no de alerta -- una
  // alerta descartada quedaba "activa" para siempre en este panel.
  const openAlerts = (operations?.alerts ?? []).filter(
    (alert) => !["resolved", "dismissed"].includes(alert.status),
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

  // Regla determinista, no IA: un producto agotado deja de vender ahora
  // mismo, no es una prediccion. No tiene sentido que esto solo se supiera
  // via el panel Stock IA (consultor/admin).
  if (metrics && metrics.stock.out_of_stock_items > 0) {
    items.push({
      id: "stock:out",
      eyebrow: "Stock",
      title: `${metrics.stock.out_of_stock_items} producto(s) agotado(s)`,
      detail: "Sin unidades disponibles: revisa reposición antes de perder más ventas.",
      href: "/shopify",
      tone: "danger",
    });
  } else if (metrics && metrics.stock.low_stock_items > 0) {
    items.push({
      id: "stock:low",
      eyebrow: "Stock",
      title: `${metrics.stock.low_stock_items} producto(s) con poco stock`,
      detail: "Revisa reposición antes de que se agoten.",
      href: "/shopify",
      tone: "warn",
    });
  }

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
    <Card
      title={
        <div>
          <p className={EYEBROW}>
            Ordenado por impacto
          </p>
          <Heading size="lg">Qué requiere atención</Heading>
        </div>
      }
      actions={<Link href="/tareas">Ver operaciones</Link>}
    >
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
              className="group rounded-md border border-edge p-4 transition-colors hover:border-ink"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={EYEBROW}>
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
    </Card>
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
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label="Periodo de métricas"
    >
      {PERIOD_OPTIONS.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={periodDays === option ? "primary" : "ghost"}
          onClick={() => onPeriodChange(option)}
        >
          {option === "all" ? "Todo" : `${option}d`}
        </Button>
      ))}
    </div>
  );
}

// --- Estado "vista general" del Dashboard (consultor sin cliente activo) ---
// Cuatro pestañas: Hoy (por donde empezar), Negocio (KPIs agregados), Salud
// (semaforo por cliente), Tareas (backlog de la cartera).

type PortfolioClient = {
  organization_id: string;
  display_name: string;
  store_count: number;
  plan_status: string | null;
  score: number;
  tier: "urgente" | "revisar" | "vigilar" | "al_dia";
  open_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  oldest_alert_days: number;
  open_tasks: number;
  overdue_tasks: number;
  data_issues: string[];
};

type PortfolioTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  is_overdue: boolean;
  organization_id: string;
  organization_name: string;
};

type ConsultantOverview = {
  window_days: number;
  clients: number;
  stores: number;
  plan_mix: Record<string, number>;
  business: {
    net_sales: number;
    orders: number;
    meta_spend: number;
    meta_purchase_value: number;
    roas: number | null;
    prev_net_sales: number;
    prev_orders: number;
    prev_meta_spend: number;
  };
  portfolio: PortfolioClient[];
  tasks: PortfolioTask[];
};

type GeneralTab = "hoy" | "negocio" | "salud" | "tareas";

const TIER_META: Record<
  PortfolioClient["tier"],
  { label: string; tone: Tone }
> = {
  urgente: { label: "Urgente", tone: "danger" },
  revisar: { label: "Revisar", tone: "warn" },
  vigilar: { label: "Vigilar", tone: "neutral" },
  al_dia: { label: "Al día", tone: "success" },
};

function clientReason(client: PortfolioClient): string {
  const parts: string[] = [];
  if (client.critical_alerts > 0) parts.push(`${client.critical_alerts} críticas`);
  if (client.high_alerts > 0) parts.push(`${client.high_alerts} altas`);
  if (client.oldest_alert_days >= 7)
    parts.push(`la más antigua: ${client.oldest_alert_days}d`);
  if (client.overdue_tasks > 0)
    parts.push(`${client.overdue_tasks} tareas vencidas`);
  return parts.length > 0 ? parts.join(" · ") : "Revisión pendiente";
}

function GeneralOverview({
  onSelectClient,
}: {
  onSelectClient: (organizationId: string) => void;
}) {
  const [tab, setTab] = useState<GeneralTab>("hoy");
  const [periodDays, setPeriodDays] = useState<"7" | "30" | "90" | "all">("30");
  const [data, setData] = useState<ConsultantOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // El overview agrega ventas/gasto por ventana movil; "Todo" no aplica.
  const days = periodDays === "all" ? "90" : periodDays;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch(`/v1/consultant/overview?days=${days}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(`No se pudo cargar la vista general (HTTP ${response.status}).`);
          setData(null);
          return;
        }
        setData((await response.json()) as ConsultantOverview);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo cargar la vista general por un error de red.");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando cartera..." />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="portal-page">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const ranked = [...data.portfolio].sort((a, b) => b.score - a.score);
  const needAttention = ranked.filter((client) => client.tier !== "al_dia");
  const totalCritical = data.portfolio.reduce(
    (sum, client) => sum + client.critical_alerts,
    0,
  );
  const totalOverdue = data.tasks.filter((task) => task.is_overdue).length;
  const withDataIssues = data.portfolio.filter(
    (client) => client.data_issues.length > 0,
  );

  return (
    <div className="portal-page space-y-6">
      <div>
        <p className={EYEBROW}>
          Vista general
        </p>
        <Heading size="lg">
          {data.clients} clientes · {data.stores} tiendas
        </Heading>
      </div>

      <Tabs
        value={tab}
        onChange={(value) => setTab(value as GeneralTab)}
        items={[
          { value: "hoy", label: "Hoy" },
          { value: "negocio", label: "Negocio" },
          { value: "salud", label: "Salud" },
          { value: "tareas", label: `Tareas (${data.tasks.length})` },
        ]}
      />

      {tab === "hoy" ? (
        <Card
          title="Por dónde empezar"
          description={`${needAttention.length} clientes necesitan atención · ${totalCritical} alertas críticas · ${totalOverdue} tareas vencidas`}
        >
          {needAttention.length === 0 ? (
            <p className="text-sm text-success">
              Toda la cartera al día. Buen momento para avanzar planes
              estratégicos.
            </p>
          ) : (
            <div className="space-y-6">
              {(["urgente", "revisar", "vigilar"] as const).map((tier) => {
                const items = needAttention.filter(
                  (client) => client.tier === tier,
                );
                if (items.length === 0) return null;
                return (
                  <div key={tier}>
                    <p className={EYEBROW}>
                      {TIER_META[tier].label} ({items.length})
                    </p>
                    <List className="mt-2">
                      {items.map((client) => (
                        <List.Item
                          as="button"
                          key={client.organization_id}
                          type="button"
                          onClick={() =>
                            onSelectClient(client.organization_id)
                          }
                          className="flex w-full items-start justify-between gap-4 py-3 text-left text-sm hover:bg-surface"
                        >
                          <span className="min-w-0">
                            <span className="font-medium">
                              {client.display_name}
                            </span>
                            <span className="mt-1 block text-xs text-muted">
                              {clientReason(client)}
                            </span>
                          </span>
                          <Badge tone={TIER_META[tier].tone}>
                            {client.score}
                          </Badge>
                        </List.Item>
                      ))}
                    </List>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}

      {tab === "negocio" ? (
        <>
          <Card
            title={`Negocio agregado · últimos ${data.window_days} días`}
            actions={
              <PeriodSelector
                periodDays={periodDays}
                onPeriodChange={setPeriodDays}
              />
            }
          >
            <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
              <OverviewTile
                label="Facturación neta"
                value={formatMoney(data.business.net_sales)}
                delta={
                  <PeriodDeltaBadge
                    current={data.business.net_sales}
                    previous={data.business.prev_net_sales}
                  />
                }
              />
              <OverviewTile
                label="Pedidos"
                value={String(data.business.orders)}
                delta={
                  <PeriodDeltaBadge
                    current={data.business.orders}
                    previous={data.business.prev_orders}
                  />
                }
              />
              <OverviewTile
                label="Inversión Meta"
                value={formatMoney(data.business.meta_spend)}
                delta={
                  <PeriodDeltaBadge
                    current={data.business.meta_spend}
                    previous={data.business.prev_meta_spend}
                  />
                }
              />
              <OverviewTile
                label="ROAS agregado"
                value={
                  data.business.roas != null
                    ? `${data.business.roas.toFixed(2)}x`
                    : "—"
                }
              />
              <OverviewTile
                label="Valor de compra Meta"
                value={formatMoney(data.business.meta_purchase_value)}
              />
            </div>

            {Object.keys(data.plan_mix).length > 0 ? (
              <div className="mt-4 border-t border-edge pt-4">
                <p className={EYEBROW}>Clientes por plan</p>
                {Object.keys(data.plan_mix).length >= 2 ? (
                  <div className="mt-2">
                    <BarChart
                      data={Object.entries(data.plan_mix).map(
                        ([status, count]) => ({
                          plan: displayValue(status),
                          count,
                        }),
                      )}
                      xKey="plan"
                      series={[{ key: "count", label: "Clientes" }]}
                      height={180}
                    />
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(data.plan_mix).map(([status, count]) => (
                      <Badge key={status} tone="neutral">
                        {displayValue(status)}: {count}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </Card>

          <Card title="Klaviyo">
            <p className="text-sm text-muted">
              Conector preparado, sin cuentas conectadas. El email marketing no
              entra todavía en el agregado.
            </p>
          </Card>
        </>
      ) : null}

      {tab === "salud" ? (
        <Card
          title="Salud de la cartera"
          description="Semáforo por cliente. Ordenado por lo que más atención necesita."
        >
          <Table
            ariaLabel="Salud de la cartera"
            columns={[
              {
                key: "client",
                label: "Cliente",
                render: (row) => (
                  <span className="font-medium">{row.display_name}</span>
                ),
              },
              {
                key: "stores",
                label: "Tiendas",
                render: (row) => String(row.store_count),
              },
              {
                key: "plan",
                label: "Plan",
                render: (row) =>
                  row.plan_status ? displayValue(row.plan_status) : "—",
              },
              {
                key: "state",
                label: "Estado",
                render: (row) => (
                  <Badge tone={TIER_META[row.tier].tone}>
                    {TIER_META[row.tier].label}
                  </Badge>
                ),
              },
              {
                key: "alerts",
                label: "Alertas",
                render: (row) =>
                  row.open_alerts === 0 ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span>
                      {row.open_alerts}
                      {row.critical_alerts > 0 ? (
                        <span className="ml-1 text-xs text-danger">
                          ({row.critical_alerts} crít.)
                        </span>
                      ) : null}
                    </span>
                  ),
              },
              {
                key: "overdue",
                label: "Tareas vencidas",
                render: (row) => String(row.overdue_tasks),
              },
              {
                key: "data",
                label: "Datos",
                render: (row) =>
                  row.data_issues.length === 0 ? (
                    <span className="text-muted">OK</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {row.data_issues.map((issue) => (
                        <Badge key={issue} tone="warn">
                          {issue}
                        </Badge>
                      ))}
                    </span>
                  ),
              },
              {
                key: "open",
                label: "",
                render: (row) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSelectClient(row.organization_id)}
                  >
                    Abrir
                  </Button>
                ),
              },
            ]}
            rows={ranked.map((client) => ({ ...client, id: client.organization_id }))}
          />
        </Card>
      ) : null}

      {tab === "tareas" ? (
        <Card
          title="Tareas de la cartera"
          description="Tareas abiertas de todos tus clientes. Las vencidas, primero."
        >
          <Table
            ariaLabel="Tareas de la cartera"
            emptyLabel="No hay tareas abiertas en la cartera."
            columns={[
              {
                key: "title",
                label: "Tarea",
                render: (row) => (
                  <span className="font-medium">{row.title}</span>
                ),
              },
              {
                key: "client",
                label: "Cliente",
                render: (row) => row.organization_name,
              },
              {
                key: "priority",
                label: "Prioridad",
                render: (row) => (
                  <Badge
                    tone={
                      ["urgent", "high"].includes(row.priority)
                        ? "warn"
                        : "neutral"
                    }
                  >
                    {displayValue(row.priority)}
                  </Badge>
                ),
              },
              {
                key: "due",
                label: "Vence",
                render: (row) =>
                  !row.due_at ? (
                    <span className="text-muted">sin fecha</span>
                  ) : row.is_overdue ? (
                    <span className="text-danger">
                      vencida ({new Date(row.due_at).toLocaleDateString("es-ES")})
                    </span>
                  ) : (
                    new Date(row.due_at).toLocaleDateString("es-ES")
                  ),
              },
              {
                key: "open",
                label: "",
                render: (row) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSelectClient(row.organization_id)}
                  >
                    Ir al cliente
                  </Button>
                ),
              },
            ]}
            rows={data.tasks}
          />
        </Card>
      ) : null}
    </div>
  );
}

function OverviewTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: ReactNode;
}) {
  return <Metric label={label} value={value} delta={delta} />;
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
        <span className="text-xs text-muted">{displayValue(row.status)}</span>
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
                ? formatMoney(summary.net_sales)
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
                ? formatMoney(summary.net_profit)
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
    <Card
      title="Todas las tiendas"
      actions={
        <PeriodSelector
          periodDays={periodDays}
          onPeriodChange={onPeriodChange}
        />
      }
    >
      <Table
        ariaLabel="Todas las tiendas Shopify"
        columns={columns}
        rows={connections}
      />
    </Card>
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

  // La tabla comparativa "Todas las tiendas" solo aporta con 2+ tiendas.
  const showStoresOverview =
    isConsultant && Boolean(organization) && shopifyConnections.length > 1;

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
    <div className="portal-page space-y-8">
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

      {activeTab === "klaviyo" && organization ? (
        <KlaviyoEmailPanel
          organizationId={organization.id}
          variant={isConsultant ? "consultant" : "client"}
        />
      ) : null}

      {activeTab === "todo" || activeTab === "shopify" ? (
        <Card
          title={
            <div>
              <Heading size="lg">
                {activeConnectionId
                  ? "Resumen de la tienda seleccionada"
                  : "Resumen ejecutivo"}
              </Heading>
              {metrics ? (
                <p className="text-xs text-muted">
                  hasta {new Date(metrics.period.end).toLocaleString()}
                </p>
              ) : null}
            </div>
          }
          actions={
            !showStoresOverview ? (
              <PeriodSelector
                periodDays={periodDays}
                onPeriodChange={setPeriodDays}
              />
            ) : null
          }
        >

          {isLoadingMetrics ? (
            <div className="p-4">
              <LoadingBlock label="Cargando métricas..." />
            </div>
          ) : metricsError ? (
            <div className="p-4">
              <ErrorBlock>{metricsError}</ErrorBlock>
            </div>
          ) : (
            <>
              {!metrics ? (
                <Banner tone="warn" className="mb-3 text-sm">
                  <p className="font-medium">
                    Sin datos sincronizados de Shopify todavía.
                  </p>
                  <p className="text-muted">
                    Los KPIs se muestran a 0 hasta la primera sincronización.{" "}
                    <Link href="/integraciones">Revisar integración</Link>
                  </p>
                </Banner>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Metric
                  card
                  label="Facturación neta"
                  value={formatMoney(metrics?.sales.net_sales ?? 0)}
                  trend={metrics?.daily?.map((day) => day.net_sales)}
                  trendTone={trendToneFor(
                    metrics?.sales.net_sales ?? 0,
                    metrics?.previous_period?.sales.net_sales,
                  )}
                  delta={
                    <PeriodDeltaBadge
                      current={metrics?.sales.net_sales ?? 0}
                      previous={metrics?.previous_period?.sales.net_sales}
                      label="periodo anterior"
                    />
                  }
                />
                <Metric
                  card
                  label="Pedidos"
                  value={metrics?.sales.orders_count ?? 0}
                  trend={metrics?.daily?.map((day) => day.orders_count)}
                  trendTone={trendToneFor(
                    metrics?.sales.orders_count ?? 0,
                    metrics?.previous_period?.sales.orders_count,
                  )}
                  delta={
                    <PeriodDeltaBadge
                      current={metrics?.sales.orders_count ?? 0}
                      previous={metrics?.previous_period?.sales.orders_count}
                      label="periodo anterior"
                    />
                  }
                />
                <Metric
                  card
                  label="Ticket medio (AOV)"
                  value={formatMoney(metrics?.sales.aov ?? 0)}
                  delta={
                    <PeriodDeltaBadge
                      current={metrics?.sales.aov ?? 0}
                      previous={metrics?.previous_period?.sales.aov}
                      label="periodo anterior"
                    />
                  }
                />
                <Metric
                  card
                  label="Beneficio neto estimado"
                  value={formatMoney(metrics?.financial.net_profit ?? 0)}
                  tone={
                    Number(metrics?.financial.net_profit ?? 0) >= 0
                      ? "success"
                      : "danger"
                  }
                  hint={`${Number(
                    metrics?.financial.net_margin_pct ?? 0,
                  ).toFixed(1)}% margen`}
                  delta={
                    <PeriodDeltaBadge
                      current={metrics?.financial.net_profit ?? 0}
                      previous={metrics?.previous_period?.financial.net_profit}
                      label="periodo anterior"
                    />
                  }
                />
                <Metric
                  card
                  label="Break-even mensual"
                  value={
                    metrics?.financial.break_even_monthly_revenue != null
                      ? formatMoney(
                          metrics.financial.break_even_monthly_revenue,
                        )
                      : "n/a"
                  }
                />
                <Metric
                  card
                  label="Gastos fijos/mes"
                  value={formatMoney(
                    metrics?.financial.monthly_fixed_costs ?? 0,
                  )}
                />
              </div>

              {metrics &&
              (!metrics.financial.has_settings ||
                metrics.financial.fixed_expenses_count === 0 ||
                metrics.financial.items_without_cost > 0) ? (
                <Banner tone="warn" className="mt-4 text-sm">
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
                </Banner>
              ) : null}

              <div className="grid gap-x-8 border-t border-edge pt-3 md:grid-cols-3">
                <Metric
                  size="sm"
                  label="Referencias con stock"
                  value={metrics?.stock.tracked_items ?? 0}
                />
                <Metric
                  size="sm"
                  label="Con poco stock"
                  value={metrics?.stock.low_stock_items ?? 0}
                  tone={
                    (metrics?.stock.low_stock_items ?? 0) > 0
                      ? "warn"
                      : "default"
                  }
                />
                <Metric
                  size="sm"
                  label="Agotadas"
                  value={metrics?.stock.out_of_stock_items ?? 0}
                  tone={
                    (metrics?.stock.out_of_stock_items ?? 0) > 0
                      ? "danger"
                      : "default"
                  }
                />
              </div>
            </>
          )}
        </Card>
      ) : null}

      {activeTab === "todo" || activeTab === "meta" ? (
        <Card
          title="Meta Ads"
          description="Rendimiento atribuido cuando exista una cuenta publicitaria conectada."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Metric
              card
              label="Inversión Meta"
              value={formatMoney(metaMetrics?.acquisition.spend ?? 0)}
              trend={metaMetrics?.daily?.map((day) => day.spend)}
            />
            <Metric
              card
              label="ROAS"
              value={
                metaMetrics?.acquisition.roas != null
                  ? `${Number(metaMetrics.acquisition.roas).toFixed(2)}x`
                  : "0.00x"
              }
            />
            <Metric
              card
              label="CAC"
              value={
                metaMetrics?.acquisition.cac != null
                  ? formatMoney(metaMetrics.acquisition.cac)
                  : formatMoney(0)
              }
            />
            <Metric
              card
              label="Compras atribuidas"
              value={Number(
                metaMetrics?.acquisition.purchases ?? 0,
              ).toFixed(0)}
            />
            <article className="rounded-md border border-edge bg-white p-4 sm:col-span-2">
              <p className={EYEBROW}>Adquisición</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {metaMetrics && metaMetrics.acquisition.days_with_data > 0
                  ? `Datos de ${metaMetrics.acquisition.days_with_data} días. Atribucion segun ventana por defecto de Meta; puede diferir del Ads Manager.`
                  : "Sin datos de Meta Ads. Conecta la cuenta publicitaria en Integraciones para comparar inversion y ROAS contra el break-even."}
              </p>
            </article>
          </div>
          {!metaMetrics || metaMetrics.acquisition.days_with_data === 0 ? (
            <div className="pt-4">
              <ButtonLink href="/integraciones">
                Conectar Meta Ads
              </ButtonLink>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/*
        Que ve cada rol del diagnostico IA (decision de producto 2026-08-26):
        el cliente necesita saber "que esta pasando" en su negocio -- eso es
        el resumen ejecutivo (A02), y su variante `summary` ya es solo lectura
        (sin tabla de hallazgos/recomendaciones ni boton de aprobar, ver
        ai-diagnostic-section.tsx). El "como lo calculamos y priorizamos"
        -- el backlog completo de tareas propuestas (A04) y la logica de
        reposicion de stock (A06), ambos en variante `full` con el boton que
        aprueba y materializa tareas -- es trabajo interno del consultor.
        Las tareas que el consultor aprueba sí llegan al cliente, pero via
        Tareas/Mi Camino, no como panel de IA en bruto sin filtrar.
      */}
      {activeTab === "todo" && organization ? (
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
      ) : null}

      {activeTab === "todo" && isConsultant && organization ? (
        <>
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
        <Card
          title="Tiendas Shopify"
          description="Selecciona una tienda para consultar sus métricas y diagnóstico."
        >
          <List>
            {isLoadingStores ? (
              <div className="px-4 py-3">
                <LoadingBlock label="Cargando tiendas..." />
              </div>
            ) : isConsultant &&
              shopifyConnections.length >
                0 ? null : shopifyConnections.length ? (
              shopifyConnections.map((connection) => (
                <List.Item
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
                  <p className="text-sm text-muted">
                    {displayValue(connection.status)}
                  </p>
                  <ButtonLink
                    className="w-fit"
                    href={`/shopify?organizationId=${selectedOrganizationId}&connectionId=${connection.id}`}
                  >
                    Ver tienda
                  </ButtonLink>
                </List.Item>
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
                    <ButtonLink
                      href="/integraciones"
                    >
                      Conectar Shopify
                    </ButtonLink>
                  }
                />
              </div>
            )}
          </List>
        </Card>
      ) : null}
    </div>
  );
}

function DashboardRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId, setOrganizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  // Consultor sin cliente activo -> vista general de la cartera. Al elegir un
  // cliente aqui, el mismo Dashboard pasa a mostrar ese cliente.
  if (isConsultant && !organizationId) {
    return <GeneralOverview onSelectClient={setOrganizationId} />;
  }

  return <DashboardContent bootstrap={bootstrap} />;
}

export default function DashboardPage() {
  return (
    <PortalShell title="Dashboard">
      {(bootstrap) => <DashboardRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
