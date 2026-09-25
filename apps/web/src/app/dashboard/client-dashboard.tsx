"use client";

import { useCallback, useEffect, useState } from "react";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import { MessageThread } from "@/components/consultant-messages";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/money";
import {
  Badge,
  Banner,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Heading,
  List,
  LoadingBlock,
  Metric,
} from "@/components/ui";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import { canShowProfit, storePulse } from "./store-pulse";
import { useUrlSection } from "@/lib/use-url-section";
import { KlaviyoEmailPanel } from "@/components/klaviyo-email-panel";
import { ConsultantAgenda } from "@/components/consultant-agenda";

const CLIENT_DASHBOARD_TABS = ["todo", "shopify", "meta", "klaviyo"] as const;

/**
 * El panel del cliente.
 *
 * Antes era el panel del consultor con tres cosas tapadas: el mismo
 * `DashboardContent`, las mismas pestañas, y hasta un `<ConsultantAgenda>`
 * incrustado. Pero las dos vistas responden preguntas distintas:
 *
 *   consultor -> "¿qué cliente necesita mi atención y qué hago hoy?"
 *   cliente   -> "¿cómo va mi tienda y qué tengo que hacer?"
 *
 * Y hay un segundo eje: **si el cliente tiene consultor o no**. Sin consultor,
 * los agentes son su acompañamiento, no un extra. El orquestador ya los
 * ejecutaba dos veces al día para todas las organizaciones; lo que faltaba era
 * que llegaran a alguien.
 */

type ShopifySummary = {
  sales: { net_sales: number; orders_count: number; aov: number };
  stock: { out_of_stock_items: number; low_stock_items: number };
  financial: {
    net_profit: number;
    has_settings: boolean;
    items_without_cost: number;
  };
  previous_period: { sales: { net_sales: number } } | null;
};

type ClientTask = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_at: string | null;
};

type MetaSummary = {
  acquisition: {
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    roas: number | null;
    cac: number | null;
    days_with_data: number;
  };
};

const PULSE_TONE = {
  success: "success",
  warn: "warn",
  danger: "danger",
  neutral: "warn",
} as const;

// Los del enum `task_status`: 'completed', 'ignored' y 'cancelled' ya no son
// trabajo pendiente.
const OPEN_STATUSES = ["pending", "in_progress"];

function useClientData(organizationId: string, connectionId: string | null) {
  const [metrics, setMetrics] = useState<ShopifySummary | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const scope = connectionId
      ? `&connectionId=${encodeURIComponent(connectionId)}`
      : "";
    try {
      const [metricsResponse, operationsResponse] = await Promise.all([
        apiFetch(
          `/v1/organizations/${organizationId}/shopify/metrics?days=30${scope}`,
        ),
        apiFetch(`/v1/organizations/${organizationId}/operations`),
      ]);

      if (metricsResponse.ok) {
        setMetrics((await metricsResponse.json()) as ShopifySummary);
      } else if (metricsResponse.status !== 404) {
        setError(await readApiError(metricsResponse));
      }

      if (operationsResponse.ok) {
        const payload = (await operationsResponse.json()) as {
          tasks?: ClientTask[];
        };
        setTasks(payload.tasks ?? []);
      }
    } catch {
      setError("No se pudo cargar tu tienda. Reintenta en un momento.");
    } finally {
      setLoaded(true);
    }
  }, [connectionId, organizationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { metrics, tasks, loaded, error };
}

function ClientShopifyPanel({
  metrics,
  error,
}: {
  metrics: ShopifySummary | null;
  error: string | null;
}) {
  const showProfit = metrics
    ? canShowProfit({
        hasFinancialSettings: metrics.financial.has_settings,
        itemsWithoutCost: metrics.financial.items_without_cost,
      })
    : false;

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}
      <div>
        <Heading>Shopify</Heading>
        <p className="mt-1 text-sm text-muted">
          Ventas, margen e inventario de los últimos 30 días.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric card label="Ventas netas" value={formatMoney(metrics?.sales.net_sales ?? 0)} />
        <Metric card label="Pedidos" value={(metrics?.sales.orders_count ?? 0).toLocaleString("es-ES")} />
        <Metric card label="Ticket medio" value={formatMoney(metrics?.sales.aov ?? 0)} />
        <Metric
          card
          tone={showProfit && (metrics?.financial.net_profit ?? 0) < 0 ? "danger" : "default"}
          label="Beneficio"
          value={showProfit ? formatMoney(metrics?.financial.net_profit ?? 0) : "Falta configurar"}
          hint={showProfit ? undefined : "Configura los costes para calcularlo"}
        />
      </div>
      <Card title="Inventario">
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric
            label="Productos agotados"
            value={(metrics?.stock.out_of_stock_items ?? 0).toLocaleString("es-ES")}
            tone={(metrics?.stock.out_of_stock_items ?? 0) > 0 ? "danger" : "default"}
          />
          <Metric
            label="Stock bajo"
            value={(metrics?.stock.low_stock_items ?? 0).toLocaleString("es-ES")}
            tone={(metrics?.stock.low_stock_items ?? 0) > 0 ? "warn" : "default"}
          />
        </div>
        <ButtonLink className="mt-5" href="/shopify" variant="secondary">
          Ver análisis completo de Shopify
        </ButtonLink>
      </Card>
    </div>
  );
}

function ClientMetaPanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const [metrics, setMetrics] = useState<MetaSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/meta/metrics?days=30`,
        );
        if (!active) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        setMetrics((await response.json()) as MetaSummary);
      } catch {
        if (active) setError("No se pudieron cargar los datos de Meta Ads.");
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [organizationId]);

  if (isLoading) {
    return <div className="portal-page"><LoadingBlock label="Cargando Meta Ads…" /></div>;
  }

  if (error) {
    return <div className="portal-page"><ErrorBlock>{error}</ErrorBlock></div>;
  }

  if (!metrics || metrics.acquisition.days_with_data === 0) {
    return (
      <div className="portal-page">
        <EmptyState
          title="Meta Ads sin datos"
          hint="Conecta una cuenta publicitaria para revisar inversión, ROAS y compras atribuidas."
          action={<ButtonLink href="/integraciones">Conectar Meta Ads</ButtonLink>}
        />
      </div>
    );
  }

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      <div>
        <Heading>Meta Ads</Heading>
        <p className="mt-1 text-sm text-muted">
          Rendimiento atribuido de los últimos 30 días.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric card label="Inversión" value={formatMoney(metrics.acquisition.spend)} />
        <Metric card label="ROAS" value={metrics.acquisition.roas != null ? `${metrics.acquisition.roas.toFixed(2)}x` : "Sin datos"} />
        <Metric card label="CPA atribuido" value={metrics.acquisition.cac != null ? formatMoney(metrics.acquisition.cac) : "Sin datos"} />
        <Metric card label="Compras atribuidas" value={metrics.acquisition.purchases.toLocaleString("es-ES")} />
      </div>
      <Card title="Alcance y tráfico">
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric label="Impresiones" value={metrics.acquisition.impressions.toLocaleString("es-ES")} />
          <Metric label="Clics" value={metrics.acquisition.clicks.toLocaleString("es-ES")} />
        </div>
        <ButtonLink className="mt-5" href="/meta" variant="secondary">
          Ver análisis completo de Meta Ads
        </ButtonLink>
      </Card>
    </div>
  );
}

/**
 * Los agentes que acompañan a un cliente sin consultor.
 *
 * El planificador de tareas NO está aquí a propósito: vive en /tareas, que es
 * donde aterrizan las acciones que aprueba ("Aprobar y crear en Tareas"). El
 * dashboard diagnostica; Tareas es la lista con la que se trabaja.
 */
const AUTONOMOUS_AGENTS = [
  {
    title: "Tu stock",
    getPath: "/ai/stock-planner",
    runPath: "/ai/stock-planner-run",
    loadingLabel: "Revisando el stock…",
    tasksLabelSingular: "reposición",
    variant: "full" as const,
  },
  {
    title: "Tu email marketing",
    getPath: "/ai/email-analyst",
    runPath: "/ai/email-analyst-run",
    loadingLabel: "Revisando tus campañas…",
    tasksLabelSingular: "mejora",
    variant: "full" as const,
  },
];

export function ClientDashboard({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [activeTab] = useUrlSection(
    "tab",
    CLIENT_DASHBOARD_TABS,
    "todo",
  );
  const organization = bootstrap.memberships.find(
    (membership) => membership.organization_id === organizationId,
  )?.organization;

  const { metrics, tasks, loaded, error } = useClientData(
    organizationId ?? "",
    connectionId || null,
  );
  // La forma del panel depende de si hay consultor, así que no se pinta nada
  // definitivo hasta saberlo: cambiar de forma delante del usuario es peor
  // que esperar medio segundo más.
  const { consultant, resolved: consultantResolved } =
    useAssignedConsultant(organizationId ?? null);
  const resolved = loaded && consultantResolved;

  if (!organizationId || !organization) {
    return (
      <div className="portal-page">
        <EmptyState
          title="Sin tienda todavía"
          hint="Cuando se te asigne una tienda, aquí verás cómo va."
        />
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando tu tienda…" />
      </div>
    );
  }

  // El segundo nav del Dashboard es la navegación de estas cuatro vistas. El
  // Resumen por proveedor: el Dashboard sirve para decidir, no para duplicar
  // la analítica exhaustiva, que vive en el módulo Analítica.
  if (activeTab === "shopify") {
    return <ClientShopifyPanel metrics={metrics} error={error} />;
  }

  if (activeTab === "meta") {
    return <ClientMetaPanel organizationId={organizationId} />;
  }

  if (activeTab === "klaviyo") {
    return (
      <div className="portal-page">
        <KlaviyoEmailPanel organizationId={organizationId} variant="client" compact />
      </div>
    );
  }

  const pulse = storePulse({
    netSales: metrics?.sales.net_sales ?? 0,
    netProfit: metrics?.financial.net_profit ?? null,
    hasFinancialSettings: metrics?.financial.has_settings ?? false,
    previousNetSales: metrics?.previous_period?.sales.net_sales ?? null,
  });

  const showProfit = metrics
    ? canShowProfit({
        hasFinancialSettings: metrics.financial.has_settings,
        itemsWithoutCost: metrics.financial.items_without_cost,
      })
    : false;

  const openTasks = tasks.filter((task) => OPEN_STATUSES.includes(task.status));
  const outOfStock = metrics?.stock.out_of_stock_items ?? 0;

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {/* El titular es el producto; las cifras solo lo sostienen. Un cliente
          que ve "Ventas 12.400 €" no sabe si eso está bien. */}
      <div>
        <p className={EYEBROW}>{organization.display_name} · últimos 30 días</p>
        <Heading>{pulse.headline}</Heading>
        {pulse.detail ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{pulse.detail}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          card
          tone={PULSE_TONE[pulse.tone]}
          label="Ventas netas"
          value={formatMoney(metrics?.sales.net_sales ?? 0)}
        />
        <Metric
          card
          label="Pedidos"
          value={(metrics?.sales.orders_count ?? 0).toLocaleString("es-ES")}
        />
        <Metric
          card
          label="Ticket medio"
          value={formatMoney(metrics?.sales.aov ?? 0)}
        />
        {showProfit ? (
          <Metric
            card
            tone={
              (metrics?.financial.net_profit ?? 0) < 0 ? "danger" : "default"
            }
            label="Beneficio"
            value={formatMoney(metrics?.financial.net_profit ?? 0)}
          />
        ) : (
          // Un beneficio sin costes de producto ni gastos fijos es un número
          // que el cliente se creería. Mejor decir qué falta.
          <Metric
            card
            tone="warn"
            label="Beneficio"
            value="Falta configurar"
            hint="Sin costes de producto no se puede calcular"
          />
        )}
      </div>

      {outOfStock > 0 ? (
        <Banner tone="warn">
          Tienes <strong>{outOfStock} productos agotados</strong>. Cada día que
          pasan sin stock son ventas que no llegan.{" "}
          <ButtonLink href="/shopify" variant="secondary">
            Ver cuáles
          </ButtonLink>
        </Banner>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[60fr_40fr]">
        <Card
          title="Qué tienes que hacer"
          description="Lo que está pendiente en tu tienda ahora mismo."
          actions={
            openTasks.length > 0 ? (
              <Badge tone="warn">{openTasks.length}</Badge>
            ) : undefined
          }
        >
          {openTasks.length === 0 ? (
            <EmptyState
              title="Nada pendiente"
              hint="Cuando haya trabajo que hacer en tu tienda, aparecerá aquí."
            />
          ) : (
            <List as="ul">
              {openTasks.slice(0, 6).map((task) => (
                <List.Item
                  as="li"
                  key={task.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <span className="min-w-0 flex-1 text-sm">{task.title}</span>
                  {task.due_at ? (
                    <span className="shrink-0 text-xs text-muted">
                      {new Date(task.due_at).toLocaleDateString("es-ES")}
                    </span>
                  ) : null}
                </List.Item>
              ))}
            </List>
          )}
          {openTasks.length > 0 ? (
            <ButtonLink className="mt-4" href="/tareas" variant="secondary">
              Ver tareas
            </ButtonLink>
          ) : null}
        </Card>

        {/* La bisagra del panel: quién te acompaña. */}
        {consultant ? (
          <Card
            className="border-accent"
            title="Tu consultor"
            description={consultant.full_name ?? "Asignado a tu tienda"}
          >
            <MessageThread
              organizationId={organizationId}
              viewerIsClient
              className="h-72"
            />
          </Card>
        ) : (
          <Card
            title="Tu copiloto"
            description="No tienes consultor asignado: pregúntale al copiloto lo que le preguntarías a uno."
          >
            <p className="text-sm leading-6 text-muted">
              Conoce tus ventas, tu stock y tus campañas. Puedes preguntarle por
              qué ha bajado algo, qué reponer o qué hacer esta semana.
            </p>
            <ButtonLink className="mt-4" href="/mensajes">
              Abrir el copiloto
            </ButtonLink>
          </Card>
        )}
      </div>

      <ConsultantAgenda embedded fixedScope={organizationId} />

      {/* Con consultor, el resumen basta: él filtra el resto. Sin consultor,
          los análisis SON el acompañamiento -- y ya se estaban ejecutando dos
          veces al día sin que nadie pudiera verlos. */}
      <AiDiagnosticSection
        organizationId={organizationId}
        title="Cómo va tu negocio"
        getPath="/ai/monitor"
        runPath="/ai/monitor-run"
        loadingLabel="Analizando tu tienda…"
        tasksLabelSingular="observación"
        variant={consultant ? "summary" : "full"}
        days={30}
      />

      {!consultant
        ? AUTONOMOUS_AGENTS.map((agent) => (
            <AiDiagnosticSection
              key={agent.getPath}
              organizationId={organizationId}
              title={agent.title}
              getPath={agent.getPath}
              runPath={agent.runPath}
              loadingLabel={agent.loadingLabel}
              tasksLabelSingular={agent.tasksLabelSingular}
              variant={agent.variant}
              days={30}
            />
          ))
        : null}
    </div>
  );
}
