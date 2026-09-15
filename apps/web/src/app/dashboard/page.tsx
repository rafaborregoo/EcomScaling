"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useSearchParams } from "next/navigation";
import {
  getLocalTimeZone,
  today,
  type DateValue,
} from "@internationalized/date";
import { PortalShell } from "@/components/portal-shell";
import { ClientDashboard } from "./client-dashboard";
import { insightAnchorId, insightSpotFor } from "@/lib/insights-registry";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { mapWithConcurrency } from "@/lib/async-concurrency";
import { formatMoney } from "@/lib/money";
import { displayValue } from "@/lib/display-labels";
import {
  Accordion,
  AlertTriangleIcon,
  AreaChart,
  Avatar,
  Badge,
  Banner,
  ButtonLink,
  Card,
  CircleCheckIcon,
  ClockIcon,
  CloseIcon,
  CollapsibleSection,
  DateField,
  DateRangePicker,
  FieldError,
  Heading,
  Button,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  InfoIcon,
  Label,
  Link,
  LoadingBlock,
  Metric,
  MetricInsights,
  Modal,
  ProviderIcon,
  RangeCalendar,
  MultiSparkline,
  Table,
  Tabs,
  type AccordionItem,
  type TableColumnDef,
  type Tone,
} from "@/components/ui";
import {
  AiDiagnosticSection,
  findingsVerdict,
  partitionConnectivity,
  type AiFinding,
} from "@/components/ai-diagnostic-section";
import {
  AREA_LABEL,
  AREA_TONE,
  EvidenceChips,
  useProposedTasks,
} from "@/components/ai-proposed-tasks";
import { KlaviyoEmailPanel } from "@/components/klaviyo-email-panel";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { ConsultantAgenda } from "@/components/consultant-agenda";
import { ModuleSummary } from "@/components/module-summary";
import {
  MessageThread,
  MessageThreadsCard,
} from "@/components/consultant-messages";

const DASHBOARD_TABS = ["todo", "shopify", "meta", "klaviyo"] as const;
type DashboardTab = (typeof DASHBOARD_TABS)[number];

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
  backfill?: { status: "running" | "done"; pct: number; from: string } | null;
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
    <CollapsibleSection title="Qué requiere atención · ordenado por impacto">
      <div className="mb-3">
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
              className="group rounded-md border border-separator p-4 transition-colors hover:border-foreground"
            >
              <div className="flex items-start justify-between gap-3">
                {/* min-w-0 + break-words: `title` es texto del usuario (una
                    alerta o una tarea). Sin esto, un titulo largo sin espacios
                    ensancha la tarjeta y empuja el Badge fuera de pantalla. */}
                <div className="min-w-0">
                  <p className={EYEBROW}>
                    {item.eyebrow}
                  </p>
                  <p className="mt-1 break-words font-medium group-hover:underline">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {item.detail}
                  </p>
                </div>
                <Badge tone={item.tone} className="shrink-0">
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
    </CollapsibleSection>
  );
}

// --- Widgets compactos de la pestaña "Todo" ---------------------------------
// "Todo" = un vistazo funcional de CADA modulo en rejilla; el detalle completo
// (tablas, series, diagnostico por tienda) vive en la pestaña de cada modulo.

type DashboardPlan = {
  plan: {
    name: string;
    status: string;
    strategic_plan_phases: Array<{
      name: string;
      status: string;
      position: number;
      strategic_plan_milestones: Array<{ status: string }>;
    }>;
  } | null;
};

function planProgress(data: DashboardPlan | null) {
  const phases = data?.plan?.strategic_plan_phases ?? [];
  const milestones = phases.flatMap((phase) => phase.strategic_plan_milestones);
  const total = milestones.filter((m) => m.status !== "skipped").length;
  const done = milestones.filter((m) => m.status === "completed").length;
  const activePhase =
    phases.find((p) => p.status === "active") ??
    phases.find((p) => p.status === "in_progress") ??
    phases.find((p) => p.status === "pending") ??
    null;
  return {
    hasPlan: Boolean(data?.plan),
    activePhase: activePhase?.name ?? null,
    total,
    done,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

function ShopifyMiniCard({
  metrics,
  isLoading,
  error,
  onOpen,
}: {
  metrics: ShopifyMetrics | null;
  isLoading: boolean;
  error: string | null;
  onOpen: () => void;
}) {
  return (
    <Card
      title="Shopify"
      actions={
        metrics ? (
          <Button variant="ghost" size="sm" type="button" onClick={onOpen}>
            Ver detalle
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <LoadingBlock label="Cargando ventas..." />
      ) : error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : !metrics ? (
        <EmptyState
          title="Sin datos de Shopify"
          hint="Conecta la tienda para ver ventas, margen y stock."
          action={<ButtonLink href="/integraciones">Conectar Shopify</ButtonLink>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Metric
            size="sm"
            label="Facturación neta"
            value={formatMoney(metrics.sales.net_sales)}
            trend={metrics.daily?.map((day) => day.net_sales)}
          />
          <Metric size="sm" label="Pedidos" value={metrics.sales.orders_count} />
          <Metric
            size="sm"
            label="Beneficio neto"
            value={formatMoney(metrics.financial.net_profit)}
            tone={
              Number(metrics.financial.net_profit) >= 0 ? "success" : "danger"
            }
            hint={`${Number(metrics.financial.net_margin_pct).toFixed(1)}% margen`}
          />
          <Metric
            size="sm"
            label="Agotadas"
            value={metrics.stock.out_of_stock_items}
            tone={metrics.stock.out_of_stock_items > 0 ? "danger" : "default"}
          />
        </div>
      )}
    </Card>
  );
}

function MetaMiniCard({
  metaMetrics,
  onOpen,
}: {
  metaMetrics: MetaMetrics | null;
  onOpen: () => void;
}) {
  const connected =
    metaMetrics != null && metaMetrics.acquisition.days_with_data > 0;
  return (
    <Card
      title="Meta Ads"
      actions={
        connected ? (
          <Button variant="ghost" size="sm" type="button" onClick={onOpen}>
            Ver detalle
          </Button>
        ) : null
      }
    >
      {!connected ? (
        <EmptyState
          title="Meta Ads sin conectar"
          hint="Sin inversión ni ROAS hasta autorizar una cuenta publicitaria."
          action={
            <ButtonLink href="/integraciones">Conectar Meta Ads</ButtonLink>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Metric
            size="sm"
            label="Inversión"
            value={formatMoney(metaMetrics.acquisition.spend)}
            trend={metaMetrics.daily?.map((day) => day.spend)}
          />
          <Metric
            size="sm"
            label="ROAS"
            value={
              metaMetrics.acquisition.roas != null
                ? `${Number(metaMetrics.acquisition.roas).toFixed(2)}x`
                : "—"
            }
          />
          <Metric
            size="sm"
            label="CAC"
            value={
              metaMetrics.acquisition.cac != null
                ? formatMoney(metaMetrics.acquisition.cac)
                : "—"
            }
          />
          <Metric
            size="sm"
            label="Compras"
            value={Number(metaMetrics.acquisition.purchases).toFixed(0)}
          />
        </div>
      )}
    </Card>
  );
}

function PlanTasksMiniCard({
  plan,
  tasks,
}: {
  plan: DashboardPlan | null;
  tasks: DashboardOperations["tasks"];
}) {
  const [nowMs] = useState(() => Date.now());
  const progress = planProgress(plan);
  const open = tasks
    .filter((task) => ["pending", "in_progress"].includes(task.status))
    .sort((a, b) => {
      const aDue = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY;
      const bDue = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY;
      return aDue - bDue;
    });

  return (
    <Card
      title="Camino y tareas"
      actions={<Link href="/camino">Ver Camino</Link>}
    >
      {progress.hasPlan ? (
        <div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">
              {progress.activePhase
                ? `Fase: ${progress.activePhase}`
                : "Plan sin fase activa"}
            </span>
            <span className="font-mono text-muted">
              {progress.done}/{progress.total} hitos · {progress.pct}%
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-foreground"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Sin plan estratégico. <Link href="/camino">Crear en Mi Camino</Link>
        </p>
      )}

      <div className="mt-4 border-t border-separator pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className={EYEBROW}>Tareas abiertas ({open.length})</p>
          <Link href="/tareas">Ver tareas</Link>
        </div>
        {open.length === 0 ? (
          <p className="mt-2 text-xs text-muted">Sin tareas abiertas.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-xs">
            {open.slice(0, 4).map((task) => {
              const overdue =
                Boolean(task.due_at) &&
                Date.parse(task.due_at as string) < nowMs;
              return (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">{task.title}</span>
                  <span className={overdue ? "text-danger" : "text-muted"}>
                    {task.due_at
                      ? new Date(task.due_at).toLocaleDateString("es-ES")
                      : "sin fecha"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

// UN solo widget para toda la IA (cliente y consultor): veredicto de una linea
// por agente, y cada uno se despliega in situ con su analisis completo. No hay
// secciones IA sueltas debajo. Endpoints cacheados 24h -> abrir uno no relanza
// el modelo.
type AiAgentConfig = {
  key: string;
  label: string;
  getPath: string;
  runPath: string;
  loadingLabel: string;
  tasksLabelSingular: string;
  variant: "full" | "summary" | "tasks";
  consultantOnly: boolean;
};

const AI_AGENTS: AiAgentConfig[] = [
  {
    key: "monitor",
    label: "Resumen ejecutivo",
    getPath: "/ai/monitor",
    runPath: "/ai/monitor-run",
    loadingLabel:
      "Analizando el negocio con IA... la primera vez puede tardar 1-2 minutos.",
    tasksLabelSingular: "tarea",
    variant: "summary",
    consultantOnly: false,
  },
  {
    key: "task-planner",
    label: "Plan diario",
    getPath: "/ai/task-planner",
    runPath: "/ai/task-planner-run",
    loadingLabel: "Priorizando el backlog con IA...",
    tasksLabelSingular: "tarea",
    // Este agente propone trabajo, no diagnostica: solo se pintan las tareas.
    // El diagnostico del negocio es el "Resumen ejecutivo" (A02).
    variant: "tasks",
    consultantOnly: true,
  },
  {
    key: "plan-week",
    label: "Plan semanal",
    getPath: "/ai/plan/week",
    runPath: "/ai/plan/week/run",
    loadingLabel: "Preparando el plan de la semana...",
    tasksLabelSingular: "tarea",
    variant: "tasks",
    consultantOnly: true,
  },
  {
    key: "plan-month",
    label: "Plan mensual",
    getPath: "/ai/plan/month",
    runPath: "/ai/plan/month/run",
    loadingLabel: "Preparando el plan del mes...",
    tasksLabelSingular: "tarea",
    variant: "tasks",
    consultantOnly: true,
  },
  {
    // A13/A14 existian en el runtime y en el orquestador, pero no en esta
    // lista: sin entrada aqui nadie los llamaba nunca y por eso las unicas
    // propuestas que llegaban al consultor eran las de Klaviyo (A12).
    key: "operativa-shopify",
    label: "Shopify",
    getPath: "/ai/operativa-shopify",
    runPath: "/ai/operativa-shopify-run",
    loadingLabel: "Revisando la operativa de Shopify...",
    tasksLabelSingular: "tarea de Shopify",
    variant: "tasks",
    consultantOnly: true,
  },
  {
    key: "operativa-meta",
    label: "Meta Ads",
    getPath: "/ai/operativa-meta",
    runPath: "/ai/operativa-meta-run",
    loadingLabel: "Revisando la operativa de Meta Ads...",
    tasksLabelSingular: "tarea de Meta Ads",
    variant: "tasks",
    consultantOnly: true,
  },
  {
    key: "stock-planner",
    label: "Stock",
    getPath: "/ai/stock-planner",
    runPath: "/ai/stock-planner-run",
    loadingLabel: "Cruzando stock y ventas con IA...",
    tasksLabelSingular: "tarea de reposición",
    variant: "full",
    consultantOnly: true,
  },
  {
    key: "email-analyst",
    label: "Email / Klaviyo",
    getPath: "/ai/email-analyst",
    runPath: "/ai/email-analyst-run",
    loadingLabel: "Analizando el email marketing con IA...",
    tasksLabelSingular: "tarea de email",
    variant: "full",
    consultantOnly: true,
  },
  {
    key: "knowledge-manager",
    label: "Conocimiento",
    getPath: "/ai/knowledge-manager",
    runPath: "/ai/knowledge-manager-run",
    loadingLabel: "Revisando la base de conocimiento con IA...",
    tasksLabelSingular: "tarea",
    variant: "full",
    consultantOnly: true,
  },
];

type AgentSnapshot = {
  key: string;
  label: string;
  verdict: ReturnType<typeof findingsVerdict> | null;
  pending: number;
};

// Icono + color por tono del veredicto. Menos texto de primeras: el detalle
// (la frase completa) queda en el `title` y al desplegar el agente.
function verdictVisual(tone: Tone): {
  Icon: ComponentType<{ className?: string }>;
  color: string;
} {
  switch (tone) {
    case "danger":
      return { Icon: AlertTriangleIcon, color: "text-danger" };
    case "warn":
      return { Icon: AlertTriangleIcon, color: "text-warn-deep" };
    case "success":
      return { Icon: CircleCheckIcon, color: "text-success" };
    default:
      return { Icon: InfoIcon, color: "text-muted" };
  }
}

function AiAgentsPanel({
  organizationId,
  days,
  isConsultant,
  isPlatformAdmin,
}: {
  organizationId: string;
  days: number;
  isConsultant: boolean;
  isPlatformAdmin: boolean;
}) {
  const { connectionId } = useActiveConnection();
  const [snapshots, setSnapshots] = useState<AgentSnapshot[] | null>(null);
  const [connectors, setConnectors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const agents = AI_AGENTS.filter(
    (agent) => isConsultant || !agent.consultantOnly,
  );

  useEffect(() => {
    let cancelled = false;
    const params = [
      connectionId ? `connectionId=${encodeURIComponent(connectionId)}` : null,
      days ? `days=${days}` : null,
    ].filter(Boolean);
    const qs = params.length > 0 ? `?${params.join("&")}` : "";
    const scoped = AI_AGENTS.filter(
      (agent) => isConsultant || !agent.consultantOnly,
    );

    Promise.all(
      scoped.map(async (agent) => {
        try {
          const res = await apiFetch(
            `/v1/organizations/${organizationId}${agent.getPath}${qs}`,
          );
          if (!res.ok) return { agent, data: null };
          return {
            agent,
            data: (await res.json()) as {
              output?: { findings?: AiFinding[]; proposed_writes?: unknown[] };
              output_status?: string;
            },
          };
        } catch {
          return { agent, data: null };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      if (results.every((result) => result.data === null)) {
        setError("No se pudo cargar el estado de los agentes.");
        setSnapshots(null);
        return;
      }
      const allConnectors = new Set<string>();
      setError(null);
      setSnapshots(
        results.map((result) => {
          if (!result.data) {
            return {
              key: result.agent.key,
              label: result.agent.label,
              verdict: null,
              pending: 0,
            };
          }
          const { rest, connectors: found } = partitionConnectivity(
            result.data.output?.findings ?? [],
          );
          found.forEach((connector) => allConnectors.add(connector));
          return {
            key: result.agent.key,
            label: result.agent.label,
            verdict: findingsVerdict(rest),
            pending:
              result.data.output_status === "pending_approval"
                ? (result.data.output?.proposed_writes ?? []).length
                : 0,
          };
        }),
      );
      setConnectors([...allConnectors]);
    });

    return () => {
      cancelled = true;
    };
  }, [organizationId, connectionId, days, isConsultant]);

  return (
    <Card title="Agentes IA">
      {error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : !snapshots ? (
        <LoadingBlock label="Consultando agentes..." />
      ) : (
        <>
          {connectors.length ? (
            <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <CloseIcon aria-hidden className="size-3 text-danger" />
              Sin conectar: {connectors.join(" · ")}
              <Link href="/integraciones">Conectar</Link>
            </p>
          ) : null}

          <ul className="divide-y divide-separator">
            {snapshots.map((snapshot) => {
              const config = agents.find((a) => a.key === snapshot.key);
              const isOpen = expanded === snapshot.key;
              const visual = verdictVisual(snapshot.verdict?.tone ?? "neutral");
              return (
                <li key={snapshot.key} className="py-3">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setExpanded((prev) =>
                        prev === snapshot.key ? null : snapshot.key,
                      )
                    }
                    className="flex w-full items-center gap-2 text-left"
                  >
                    <IconChevronDown
                      aria-hidden
                      className={`size-3 shrink-0 text-muted transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                    <visual.Icon
                      className={`size-4 shrink-0 ${
                        snapshot.verdict ? visual.color : "text-muted"
                      }`}
                    />
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {snapshot.label}
                    </span>
                    {snapshot.verdict && snapshot.verdict.riskCount > 0 ? (
                      <span
                        className={`flex items-center gap-1 text-xs font-medium ${visual.color}`}
                        title={snapshot.verdict.text}
                      >
                        <AlertTriangleIcon aria-hidden className="size-3" />
                        {snapshot.verdict.riskCount}
                      </span>
                    ) : null}
                    {snapshot.pending > 0 ? (
                      <span
                        className="flex items-center gap-1 text-xs font-medium text-warn-deep"
                        title={`${snapshot.pending} propuesta(s) sin decidir`}
                      >
                        <ClockIcon aria-hidden className="size-3" />
                        {snapshot.pending}
                      </span>
                    ) : null}
                  </button>
                  {isOpen && config ? (
                    <div className="mt-3 border-l-2 border-separator pl-4">
                      <AiDiagnosticSection
                        bare
                        organizationId={organizationId}
                        title={config.label}
                        getPath={config.getPath}
                        runPath={config.runPath}
                        loadingLabel={config.loadingLabel}
                        tasksLabelSingular={config.tasksLabelSingular}
                        days={days}
                        variant={config.variant}
                        showInternals={isPlatformAdmin}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
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
// Una sola vista, sin pestañas: cola de clientes ordenada por prioridad. Por
// cliente -> motivo de atencion, avance del plan estrategico, trabajo abierto
// y accion directa para añadirle una tarea. La lista de clientes/tiendas vive
// en /clientes y /tiendas; aqui solo lo accionable hoy.

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

type OwnStoreOverview = {
  organization_id: string;
  display_name: string;
  status: string;
  currency_code: string;
  net_sales: number;
  orders: number;
  meta_spend: number;
  roas: number | null;
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
  orders_last_24h: RecentOrdersRow[];
  own_stores: OwnStoreOverview[];
}

type RecentOrdersRow = {
  organization_id: string;
  display_name: string;
  currency_code: string;
  orders_count: number;
  net_sales: number;
};

// Ranking por tienda: un cliente puede tener varias, y el agregado por cliente
// esconde que dentro de él una tira y otra está parada. Ordenado por pedidos
// (lo que pide el ranking), con AOV para que dos tiendas de volumen distinto
// sean comparables.
type StoreOrdersRow = {
  store_id: string;
  organization_id: string;
  organization_name: string;
  shop_name: string;
  myshopify_domain: string | null;
  currency_code: string;
  orders_count: number;
  net_sales: number;
  units_sold: number;
  aov: number;
};

type OrdersRange = { id: string; label: string; rangeLabel: string; days: number };

const ORDERS_RANGES: OrdersRange[] = [
  { id: "1d", label: "1d", rangeLabel: "últimas 24 h", days: 1 },
  { id: "3d", label: "3d", rangeLabel: "últimos 3 días", days: 3 },
  { id: "7d", label: "1 sem", rangeLabel: "última semana", days: 7 },
  { id: "30d", label: "1 mes", rangeLabel: "último mes", days: 30 },
];

// Modal con calendario de rango (HeroUI nativo, sin estilos propios) para el
// boton "+": el consultor elige las fechas exactas que quiera.
function CustomRangeModal({
  isOpen,
  onClose,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply: (fromIso: string, toIso: string) => void;
}) {
  const tz = getLocalTimeZone();
  const [value, setValue] = useState<{ start: DateValue; end: DateValue } | null>(
    null,
  );
  const maxValue = today(tz);
  const invalid = value != null && value.end.compare(value.start) < 0;

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog aria-label="Elegir rango de fechas">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Rango de fechas</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <DateRangePicker
                maxValue={maxValue}
                isInvalid={invalid}
                value={value}
                onChange={setValue}
              >
                <Label>Desde / hasta</Label>
                <DateField.Group fullWidth>
                  <DateField.Input slot="start">
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateRangePicker.RangeSeparator />
                  <DateField.Input slot="end">
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DateRangePicker.Trigger>
                      <DateRangePicker.TriggerIndicator />
                    </DateRangePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                {invalid ? (
                  <FieldError>La fecha final es anterior a la inicial.</FieldError>
                ) : null}
                <DateRangePicker.Popover>
                  <RangeCalendar aria-label="Rango de fechas">
                    <RangeCalendar.Header>
                      <RangeCalendar.NavButton slot="previous" />
                      <RangeCalendar.YearPickerTrigger>
                        <RangeCalendar.YearPickerTriggerHeading />
                        <RangeCalendar.YearPickerTriggerIndicator />
                      </RangeCalendar.YearPickerTrigger>
                      <RangeCalendar.NavButton slot="next" />
                    </RangeCalendar.Header>
                    <RangeCalendar.Grid>
                      <RangeCalendar.GridHeader>
                        {(day) => (
                          <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>
                        )}
                      </RangeCalendar.GridHeader>
                      <RangeCalendar.GridBody>
                        {(date) => <RangeCalendar.Cell date={date} />}
                      </RangeCalendar.GridBody>
                    </RangeCalendar.Grid>
                    <RangeCalendar.YearPickerGrid>
                      <RangeCalendar.YearPickerGridBody>
                        {({ year }) => (
                          <RangeCalendar.YearPickerCell year={year} />
                        )}
                      </RangeCalendar.YearPickerGridBody>
                    </RangeCalendar.YearPickerGrid>
                  </RangeCalendar>
                </DateRangePicker.Popover>
              </DateRangePicker>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!value || invalid}
                onClick={() => {
                  if (!value || invalid) return;
                  onApply(
                    value.start.toDate(tz).toISOString(),
                    value.end.add({ days: 1 }).toDate(tz).toISOString(),
                  );
                }}
              >
                Aplicar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

type OrdersDailyPoint = {
  bucket_date: string;
  organization_id: string;
  orders_count: number;
};

// Modal de seguimiento: el mismo sparkline pero con ejes, fecha (en pequeño,
// vía el tooltip) y grid -- para leer el detalle en vez de solo la forma.
function OrdersChartModal({
  isOpen,
  onClose,
  data,
  series,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: Array<Record<string, number | string>>;
  series: Array<{ key: string; label: string; color: string }>;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog aria-label="Seguimiento de pedidos">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Seguimiento de pedidos</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {series.length > 0 ? (
                <AreaChart
                  data={data}
                  xKey="date"
                  series={series}
                  height={320}
                  valueFormatter={(value) => String(Math.round(value))}
                />
              ) : (
                <p className="py-6 text-center text-sm text-muted">
                  Activa al menos una tienda abajo para verla en el gráfico.
                </p>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// Un color por cliente en el sparkline grande -- se reusa como "swatch" junto
// a su fila en la lista para poder identificar cual es cual.
const CLIENT_COLORS = [
  "#1d4ed8", // accent (marca)
  "#059669",
  "#d97706",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#65a30d",
];

// Serie diaria por cliente -> datos para <MultiSparkline>. Rellena con 0 los
// días sin pedidos (en UTC, igual que el date_trunc del SQL) para que cada
// línea sea continua.
function buildOrdersSparkline(
  daily: OrdersDailyPoint[],
  rows: RecentOrdersRow[],
  fromIso: string,
  toIso: string,
) {
  const days: string[] = [];
  const cursor = new Date(fromIso);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(toIso);
  while (cursor < end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const byDay = new Map<string, Record<string, number>>();
  for (const point of daily) {
    const record = byDay.get(point.bucket_date) ?? {};
    record[point.organization_id] = point.orders_count;
    byDay.set(point.bucket_date, record);
  }
  const data = days.map((iso) => {
    const record = byDay.get(iso) ?? {};
    // Fecha en pequeño legible (no el ISO crudo) -- se ve en el tooltip del
    // modal de seguimiento; el sparkline chromeless de la card la ignora.
    const point: Record<string, number | string> = {
      date: new Date(iso).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
      }),
    };
    for (const row of rows) {
      point[row.organization_id] = record[row.organization_id] ?? 0;
    }
    return point;
  });
  const series = rows.map((row, index) => ({
    key: row.organization_id,
    label: row.display_name,
    color: CLIENT_COLORS[index % CLIENT_COLORS.length],
  }));
  return { data, series };
}

// Widget "Pedidos" (vista general): a la izquierda el ranking de clientes por
// facturacion en el rango elegido (sin numerar, el orden es la senal), con un
// swatch de color por fila; a la derecha, dentro de la misma card, un
// sparkline grande con la evolucion de pedidos de todos los clientes a la vez,
// cada uno con su color. Filas clicables.
function RecentOrdersWidget({
  initialRows,
  onSelectClient,
}: {
  initialRows: RecentOrdersRow[];
  onSelectClient: (organizationId: string) => void;
}) {
  const [preset, setPreset] = useState<string>("1d");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [rows, setRows] = useState<RecentOrdersRow[]>(initialRows);
  const [stores, setStores] = useState<StoreOrdersRow[]>([]);
  // Qué se rankea: clientes (por facturación) o tiendas (por pedidos).
  const [scope, setScope] = useState<"clients" | "stores">("clients");
  const [daily, setDaily] = useState<OrdersDailyPoint[]>([]);
  const [span, setSpan] = useState<{ from: string; to: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [chartModalOpen, setChartModalOpen] = useState(false);
  // Tiendas "apagadas" del grafico (no de la lista) -- el consultor las quita
  // cuando una domina el grafico y tapa a las demas.
  const [hiddenOrgs, setHiddenOrgs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let from: string;
    let to: string;
    if (preset === "custom" && custom) {
      from = custom.from;
      to = custom.to;
    } else {
      const range =
        ORDERS_RANGES.find((entry) => entry.id === preset) ?? ORDERS_RANGES[0];
      to = new Date().toISOString();
      from = new Date(
        Date.now() - range.days * 24 * 60 * 60 * 1000,
      ).toISOString();
    }
    setIsLoading(true);
    apiFetch(
      `/v1/consultant/orders?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    )
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("No se pudieron cargar los pedidos.");
          return;
        }
        const payload = (await res.json()) as {
          from: string;
          to: string;
          rows: RecentOrdersRow[];
          stores?: StoreOrdersRow[];
          daily: OrdersDailyPoint[];
        };
        setRows(payload.rows ?? []);
        setStores(payload.stores ?? []);
        setDaily(payload.daily ?? []);
        setSpan({ from: payload.from, to: payload.to });
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar los pedidos.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preset, custom]);

  const totalOrders = rows.reduce((sum, row) => sum + row.orders_count, 0);
  const revenueByCurrency = new Map<string, number>();
  for (const row of rows) {
    revenueByCurrency.set(
      row.currency_code,
      (revenueByCurrency.get(row.currency_code) ?? 0) + row.net_sales,
    );
  }
  const revenueLabel = [...revenueByCurrency.entries()]
    .map(([currency, value]) => formatMoney(value, currency))
    .join(" · ");

  const rangeLabel =
    preset === "custom" && custom
      ? `${new Date(custom.from).toLocaleDateString("es-ES")} – ${new Date(
          new Date(custom.to).getTime() - 1,
        ).toLocaleDateString("es-ES")}`
      : (ORDERS_RANGES.find((entry) => entry.id === preset)?.rangeLabel ??
        "rango");

  const chip = (active: boolean) =>
    `text-xs transition-colors ${
      active ? "text-foreground" : "text-muted hover:text-foreground"
    }`;

  const { data: chartData, series: chartSeries } = buildOrdersSparkline(
    daily,
    rows,
    span?.from ?? new Date().toISOString(),
    span?.to ?? new Date().toISOString(),
  );
  const visibleSeries = chartSeries.filter(
    (serie) => !hiddenOrgs.has(serie.key),
  );

  function toggleOrg(organizationId: string) {
    setHiddenOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(organizationId)) next.delete(organizationId);
      else next.add(organizationId);
      return next;
    });
  }

  return (
    <Card
      title="Pedidos"
      actions={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {ORDERS_RANGES.map((range) => (
            <button
              key={range.id}
              type="button"
              className={chip(preset === range.id)}
              onClick={() => setPreset(range.id)}
            >
              {range.label}
            </button>
          ))}
          <button
            type="button"
            className={chip(preset === "custom")}
            onClick={() => setModalOpen(true)}
            aria-label="Rango de fechas personalizado"
          >
            +
          </button>
          {preset !== "1d" ? (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
              onClick={() => {
                setPreset("1d");
                setCustom(null);
              }}
            >
              <CloseIcon aria-hidden className="size-3" />
              Limpiar
            </button>
          ) : null}
        </div>
      }
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="text-sm text-muted">
          {rangeLabel}
          {rows.length > 0 ? (
            <>
              {" · "}
              {totalOrders} {totalOrders === 1 ? "pedido" : "pedidos"}
              {" · "}
              <span className="font-semibold text-success">{revenueLabel}</span>
            </>
          ) : null}
        </p>
        {/* El ranking por cliente responde "quién factura más"; el de tiendas,
            "qué tienda mueve más pedidos" -- que no es lo mismo en cuanto un
            cliente tiene dos tiendas. */}
        {stores.length > 0 ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={chip(scope === "clients")}
              aria-pressed={scope === "clients"}
              onClick={() => setScope("clients")}
            >
              Clientes
            </button>
            <button
              type="button"
              className={chip(scope === "stores")}
              aria-pressed={scope === "stores"}
              onClick={() => setScope("stores")}
            >
              Tiendas
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : isLoading && rows.length === 0 ? (
        <LoadingBlock label="Cargando pedidos..." />
      ) : rows.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          Ningún cliente ha recibido pedidos en este rango.
        </p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          {scope === "stores" ? (
            <ul className="divide-y divide-separator lg:w-1/2 lg:shrink-0">
              {stores.map((store) => (
                <li key={store.store_id}>
                  <button
                    type="button"
                    onClick={() => onSelectClient(store.organization_id)}
                    className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-surface"
                  >
                    <Avatar name={store.shop_name} size="sm" color="accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {store.shop_name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {store.organization_name}
                        {" · "}
                        {store.units_sold} uds · AOV{" "}
                        {formatMoney(store.aov, store.currency_code)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {store.orders_count}{" "}
                      {store.orders_count === 1 ? "pedido" : "pedidos"}
                    </span>
                    <span className="hidden shrink-0 text-right font-mono font-semibold text-success sm:block sm:w-28">
                      {formatMoney(store.net_sales, store.currency_code)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
          <ul className="divide-y divide-separator lg:w-1/2 lg:shrink-0">
            {rows.map((row, index) => (
              <li key={row.organization_id}>
                <button
                  type="button"
                  onClick={() => onSelectClient(row.organization_id)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-surface"
                >
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        CLIENT_COLORS[index % CLIENT_COLORS.length],
                    }}
                  />
                  <Avatar name={row.display_name} size="sm" color="accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {row.display_name}
                    </span>
                    {/* En móvil el contador baja a una segunda línea: en una
                        sola no queda ancho para el nombre. */}
                    <span className="block text-xs text-muted sm:hidden">
                      {row.orders_count}{" "}
                      {row.orders_count === 1 ? "pedido" : "pedidos"}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-sm text-muted sm:block">
                    {row.orders_count}{" "}
                    {row.orders_count === 1 ? "pedido" : "pedidos"}
                  </span>
                  <span className="shrink-0 text-right font-mono font-semibold text-success sm:w-28">
                    {formatMoney(row.net_sales, row.currency_code)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          )}
          <div className="min-w-0 flex-1">
            {chartData.length > 1 ? (
              <MultiSparkline
                data={chartData}
                xKey="date"
                series={visibleSeries}
              />
            ) : (
              <p className="text-center text-xs text-muted">
                Elige un rango más amplio para ver la evolución.
              </p>
            )}

            {/* Debajo del grafico: apagar tiendas y abrir el seguimiento
                detallado (mismos datos, con ejes, fecha y tooltip). */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {rows.map((row, index) => {
                const hidden = hiddenOrgs.has(row.organization_id);
                return (
                  <button
                    key={row.organization_id}
                    type="button"
                    onClick={() => toggleOrg(row.organization_id)}
                    aria-pressed={!hidden}
                    className={`flex items-center gap-1.5 text-xs transition-opacity ${
                      hidden ? "opacity-40" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          CLIENT_COLORS[index % CLIENT_COLORS.length],
                      }}
                    />
                    <span className="max-w-24 truncate">
                      {row.display_name}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="mt-2 text-xs text-accent hover:underline"
              onClick={() => setChartModalOpen(true)}
            >
              Ver seguimiento
            </button>
          </div>
        </div>
      )}

      <CustomRangeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onApply={(from, to) => {
          setCustom({ from, to });
          setPreset("custom");
          setModalOpen(false);
        }}
      />
      <OrdersChartModal
        isOpen={chartModalOpen}
        onClose={() => setChartModalOpen(false)}
        data={chartData}
        series={visibleSeries}
      />
    </Card>
  );
}

// Widget "Tareas que propone la IA" (vista general): en la cabecera, el nombre
// del cliente entre dos flechas para ir pasando (peor primero); debajo, la
// lista de tareas propuestas por los agentes de operativa en un Accordion
// nativo de HeroUI -- cada una despliega el porqué, las cifras que lo sostienen
// y la rama de Mi Camino (o "tarea libre"). Aquí no se aprueban: enlace a
// /tareas, que es donde vive la decisión (AiProposedTasksCard).
//
// El tipo, las etiquetas de canal y la carga se comparten con esa tarjeta
// (@/components/ai-proposed-tasks): son la misma respuesta del mismo endpoint,
// y tenerlo duplicado ya provocó que las dos vistas se desincronizaran.
function AiProposedTasksWidget({
  onSelectClient,
}: {
  onSelectClient: (organizationId: string) => void;
}) {
  const { clients, error } = useProposedTasks();
  const [index, setIndex] = useState(0);

  const current = clients?.[index] ?? null;

  const taskItems: AccordionItem[] = (current?.tasks ?? []).map(
    (task, taskIndex) => ({
      id: `${current?.organization_id}:${taskIndex}`,
      title: (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1 truncate">{task.title}</span>
          <Badge tone={AREA_TONE[task.area]}>{AREA_LABEL[task.area]}</Badge>
        </span>
      ),
      content: (
        <div className="space-y-2 text-sm">
          <p>{task.rationale || task.description}</p>
          <EvidenceChips evidence={task.evidence} />
          <p className="text-xs">
            {task.phase ? (
              <>
                Rama de Mi Camino:{" "}
                <span className="font-medium text-accent">{task.phase}</span>
              </>
            ) : (
              <span className="text-muted">
                Tarea libre · no influye en ninguna rama
              </span>
            )}
          </p>
          {task.pending_approval ? (
            <Badge tone="warn">Sin aprobar</Badge>
          ) : null}
        </div>
      ),
    }),
  );

  return (
    <Card className="border border-warn">
      {error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : !clients ? (
        <LoadingBlock label="Cargando propuestas..." />
      ) : clients.length === 0 ? (
        <>
          <p className={`${EYEBROW} mb-1`}>Tareas que propone la IA</p>
          <p className="py-2 text-sm text-muted">
            La IA no ha propuesto tareas para ningún cliente todavía.
          </p>
        </>
      ) : !current ? null : (
        <>
          <div className="flex items-center gap-2 border-b border-separator pb-3">
            <button
              type="button"
              aria-label="Cliente anterior"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              className="shrink-0 rounded-full p-1 text-accent transition-colors hover:bg-accent/10 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <IconChevronLeft aria-hidden className="size-5" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className={EYEBROW}>Tareas que propone la IA</p>
              <p className="truncate text-base font-semibold text-accent">
                {current.display_name}
              </p>
              <p className="text-xs text-muted">
                {index + 1} / {clients.length} · {current.tasks.length}{" "}
                {current.tasks.length === 1 ? "tarea" : "tareas"} ·{" "}
                <Link
                  href="/tareas"
                  onClick={() => onSelectClient(current.organization_id)}
                >
                  Ver en tareas
                </Link>
              </p>
            </div>
            <button
              type="button"
              aria-label="Cliente siguiente"
              disabled={index >= clients.length - 1}
              onClick={() =>
                setIndex((value) => Math.min(clients.length - 1, value + 1))
              }
              className="shrink-0 rounded-full p-1 text-accent transition-colors hover:bg-accent/10 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <IconChevronRight aria-hidden className="size-5" />
            </button>
          </div>

          <Accordion className="mt-2" items={taskItems} />
        </>
      )}
    </Card>
  );
}

type MetaPortfolioClient = {
  organization_id: string;
  display_name: string;
  currency_code: string;
  score: number;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
  roas: number | null;
  cac: number | null;
  ctr: number | null;
  cpm: number | null;
  days_with_data: number;
  break_even_roas: number | null;
  contribution_per_order: number | null;
  dependency_pct: number | null;
  delta: {
    spend_pct: number | null;
    roas_pct: number | null;
    cac_pct: number | null;
    purchases_pct: number | null;
    purchase_value_pct: number | null;
    ctr_pct: number | null;
    cpm_pct: number | null;
  };
};

const META_COMPARE_OPTIONS = [
  { id: "week", label: "vs semana" },
  { id: "month", label: "vs mes" },
  { id: "year", label: "vs año" },
];

// Δ% coloreado. `invert` para métricas donde subir es malo (CAC, CPM).
function deltaChip(pct: number | null, invert = false) {
  if (pct == null) return { text: "—", cls: "text-muted" };
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
  const better = invert ? rounded < 0 : rounded > 0;
  const cls =
    rounded === 0 ? "text-muted" : better ? "text-success" : "text-danger";
  const arrow = rounded === 0 ? "→" : rounded > 0 ? "↑" : "↓";
  return { text: `${arrow} ${Math.abs(pct).toFixed(1)}%`, cls };
}

// Widget "Meta Ads · cartera": lista de clientes ordenada por cuánto hay que
// revisar su cuenta de Meta (score determinista). Sin gráfico: al pulsar una
// fila se despliegan las métricas con su cambio vs. el periodo comparado.
function MetaPortfolioWidget() {
  const [compare, setCompare] = useState("month");
  const [clients, setClients] = useState<MetaPortfolioClient[] | null>(null);
  const [backfilling, setBackfilling] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClients(null);
    setError(null);
    apiFetch(`/v1/consultant/meta-portfolio?compare=${compare}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("No se pudo cargar la cartera de Meta Ads.");
          return;
        }
        const payload = (await res.json()) as {
          clients: MetaPortfolioClient[];
          backfilling_accounts?: number;
        };
        setClients(payload.clients ?? []);
        setBackfilling(payload.backfilling_accounts ?? 0);
      })
      .catch(() => {
        if (!cancelled)
          setError("No se pudo cargar la cartera de Meta Ads.");
      });
    return () => {
      cancelled = true;
    };
  }, [compare]);

  const chip = (active: boolean) =>
    `text-xs transition-colors ${
      active ? "text-foreground" : "text-muted hover:text-foreground"
    }`;

  const items: AccordionItem[] = (clients ?? []).map((client) => {
    const money = (value: number | null) =>
      value == null ? "—" : formatMoney(value, client.currency_code);
    const target = client.break_even_roas ?? 1;
    const roasTone =
      client.roas == null
        ? "neutral"
        : client.roas >= target
          ? "success"
          : "danger";
    const rows: Array<{
      label: string;
      value: string;
      delta: number | null;
      invert?: boolean;
    }> = [
      {
        label: "Inversión",
        value: money(client.spend),
        delta: client.delta.spend_pct,
      },
      {
        label: "ROAS",
        value: client.roas == null ? "—" : `${client.roas.toFixed(2)}×`,
        delta: client.delta.roas_pct,
      },
      {
        label: "CAC",
        value: money(client.cac),
        delta: client.delta.cac_pct,
        invert: true,
      },
      {
        label: "Compras",
        value: String(Math.round(client.purchases)),
        delta: client.delta.purchases_pct,
      },
      {
        label: "Valor de compra",
        value: money(client.purchase_value),
        delta: client.delta.purchase_value_pct,
      },
      {
        label: "CTR",
        value: client.ctr == null ? "—" : `${client.ctr.toFixed(2)}%`,
        delta: client.delta.ctr_pct,
      },
      {
        label: "CPM",
        value: money(client.cpm),
        delta: client.delta.cpm_pct,
        invert: true,
      },
    ];

    return {
      id: client.organization_id,
      title: (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 flex-1 truncate">{client.display_name}</span>
          <Badge tone={roasTone}>
            {client.roas == null ? "sin ROAS" : `${client.roas.toFixed(2)}×`}
          </Badge>
        </span>
      ),
      content: (
        <div className="text-sm">
          {rows.map((row) => {
            const d = deltaChip(row.delta, row.invert);
            return (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_4.5rem] items-baseline gap-x-3 border-b border-separator/60 py-1.5 last:border-0"
              >
                <span className="text-muted">{row.label}</span>
                <span className="font-mono">{row.value}</span>
                <span className={`text-right text-xs ${d.cls}`}>{d.text}</span>
              </div>
            );
          })}
          <p className="mt-2 text-xs text-muted">
            {client.break_even_roas != null
              ? `Objetivo ROAS ≥ ${client.break_even_roas.toFixed(2)}× (break-even). `
              : "Sin configuración financiera: no hay break-even. "}
            {client.dependency_pct != null
              ? `Meta = ${client.dependency_pct.toFixed(0)}% de la facturación. `
              : ""}
            {client.days_with_data} días con datos.
          </p>
        </div>
      ),
    };
  });

  return (
    <Card
      title="Meta Ads · cartera"
      className="border border-accent"
      actions={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {META_COMPARE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={chip(compare === option.id)}
              onClick={() => setCompare(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      {backfilling > 0 ? (
        <Banner tone="warn" className="mb-3 text-sm">
          Importando el histórico de Meta de {backfilling}{" "}
          {backfilling === 1 ? "cuenta" : "cuentas"}. Los datos y comparativas
          anteriores irán apareciendo conforme avanza.
        </Banner>
      ) : null}
      {error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : !clients ? (
        <LoadingBlock label="Cargando Meta Ads..." />
      ) : clients.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          Ningún cliente con inversión en Meta en este periodo.
        </p>
      ) : (
        <>
          <p className="mb-1 text-xs text-muted">
            {clients.length} {clients.length === 1 ? "cuenta" : "cuentas"} · la
            que más hay que revisar, arriba
            {compare === "year"
              ? " · el año anterior puede no tener histórico"
              : ""}
          </p>
          <Accordion items={items} />
        </>
      )}
    </Card>
  );
}

type KlaviyoPortfolioClient = {
  organization_id: string;
  display_name: string;
  currency_code: string;
  campaigns_sent: number;
  last_send_at: string | null;
  revenue: number;
  recipients: number;
  open_rate: number | null;
  click_rate: number | null;
};

const KLAVIYO_WINDOW_OPTIONS = [
  { id: "7d", label: "1 semana" },
  { id: "30d", label: "1 mes" },
  { id: "90d", label: "3 meses" },
  { id: "all", label: "Indefinido" },
];

// Widget "Email · campañas por cliente" (vista general): qué clientes han
// enviado campañas de Klaviyo en la ventana elegida, quien más arriba, con
// enlaces a ver los resultados (/marketing) y el tracking de ese cliente.
function KlaviyoCampaignsWidget({
  onSelectClient,
}: {
  onSelectClient: (organizationId: string) => void;
}) {
  const [range, setRange] = useState("30d");
  const [clients, setClients] = useState<KlaviyoPortfolioClient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClients(null);
    setError(null);
    apiFetch(`/v1/consultant/klaviyo-portfolio?window=${range}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("No se pudo cargar el email marketing.");
          return;
        }
        const payload = (await res.json()) as {
          clients: KlaviyoPortfolioClient[];
        };
        setClients(payload.clients ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el email marketing.");
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const chip = (active: boolean) =>
    `text-xs transition-colors ${
      active ? "text-foreground" : "text-muted hover:text-foreground"
    }`;

  return (
    <Card
      title="Email · campañas por cliente"
      actions={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {KLAVIYO_WINDOW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={chip(range === option.id)}
              onClick={() => setRange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    >
      {error ? (
        <ErrorBlock>{error}</ErrorBlock>
      ) : !clients ? (
        <LoadingBlock label="Cargando campañas..." />
      ) : clients.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          Ningún cliente envió campañas de email en este periodo.
        </p>
      ) : (
        <>
          <p className="mb-1 text-xs text-muted">
            {clients.length} {clients.length === 1 ? "cliente" : "clientes"} ·
            quien más campañas ha enviado, arriba
          </p>
          <ul className="divide-y divide-separator">
            {clients.map((client) => (
              <li
                key={client.organization_id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {client.display_name}
                </span>
                <Badge tone="warn">
                  {client.campaigns_sent}{" "}
                  {client.campaigns_sent === 1 ? "campaña" : "campañas"}
                </Badge>
                <span className="font-mono text-sm">
                  {formatMoney(client.revenue, client.currency_code)}
                </span>
                <span className="w-full text-xs text-muted">
                  {client.last_send_at
                    ? `Último envío ${new Date(
                        client.last_send_at,
                      ).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                      })}`
                    : "Sin envíos con fecha"}
                  {client.open_rate != null
                    ? ` · apertura ${(client.open_rate * 100).toFixed(0)}%`
                    : ""}
                  {client.click_rate != null
                    ? ` · clic ${(client.click_rate * 100).toFixed(0)}%`
                    : ""}
                  {" · "}
                  <Link
                    href="/marketing"
                    onClick={() => onSelectClient(client.organization_id)}
                  >
                    Ver campañas
                  </Link>
                  {" · "}
                  <Link
                    href="/planificacion/tracking"
                    onClick={() => onSelectClient(client.organization_id)}
                  >
                    Tracking
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

// Vista general del consultor (sin cliente activo). Por ahora: widget de
// "Pedidos" + "Tareas que propone la IA" + "Meta Ads · cartera" + "Email ·
// campañas por cliente".
function GeneralOverview({
  onSelectClient,
}: {
  onSelectClient: (organizationId: string) => void;
}) {
  const [data, setData] = useState<ConsultantOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch("/v1/consultant/overview?days=30")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError("No se pudo cargar la vista general.");
          setData(null);
          return;
        }
        setData((await res.json()) as ConsultantOverview);
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
  }, []);

  if (isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando vista general..." />
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

  return (
    <div className="portal-page space-y-4 sm:space-y-6">
      <RecentOrdersWidget
        initialRows={data.orders_last_24h ?? []}
        onSelectClient={onSelectClient}
      />
      {/* Agenda 65% / chats 35% */}
      <div className="grid gap-4 lg:grid-cols-[65fr_35fr]">
        <ConsultantAgenda
          embedded
          clients={data.portfolio.map((client) => ({
            organization_id: client.organization_id,
            display_name: client.display_name,
          }))}
          onSelectClient={onSelectClient}
        />
        <MessageThreadsCard />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AiProposedTasksWidget onSelectClient={onSelectClient} />
        <MetaPortfolioWidget />
      </div>
      <KlaviyoCampaignsWidget onSelectClient={onSelectClient} />
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
  const [plan, setPlan] = useState<DashboardPlan | null>(null);
  const [hasFinancialConfig, setHasFinancialConfig] = useState(false);
  const [financialConfigError, setFinancialConfigError] = useState<
    string | null
  >(null);
  const [isLoadingFinancialConfig, setIsLoadingFinancialConfig] =
    useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("todo");
  const searchParams = useSearchParams();

  // Enlace desde la zona de IA del header: `?tab=meta#insight-roas`. La
  // pestaña se resuelve al montar y no en el estado inicial -- el servidor no
  // ve la URL del cliente y el HTML tiene que coincidir. El salto al ancla
  // tampoco vale el nativo: cuando el navegador lo intenta, la pestaña de
  // destino todavia no se ha renderizado y el elemento no existe.
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (!requested) return;
    if (!DASHBOARD_TABS.includes(requested as DashboardTab)) return;
    setActiveTab(requested as DashboardTab);
    const anchor = window.location.hash.slice(1);
    if (!anchor) return;
    requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ block: "center" });
    });
  }, [searchParams]);

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
        } else {
          setShopifyConnections([]);
        }
      } catch {
        setShopifyConnections([]);
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
            // El API devuelve {error, message, detail}: sin eso el fallo llega
            // como "HTTP 500" pelado y no hay forma de diagnosticarlo.
            const body = (await shopifyResult.value
              .json()
              .catch(() => null)) as {
              error?: string;
              message?: string;
              detail?: string;
            } | null;
            setMetrics(null);
            setMetricsError(
              [
                `No se pudieron cargar las métricas (HTTP ${shopifyResult.value.status})`,
                body?.error,
                body?.message,
                body?.detail,
              ]
                .filter(Boolean)
                .join(" - "),
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

  useEffect(() => {
    async function loadPlan() {
      if (!organization) return;
      try {
        const response = await apiFetch(
          `/v1/organizations/${organization.id}/strategic-plan`,
        );
        setPlan(response.ok ? ((await response.json()) as DashboardPlan) : null);
      } catch {
        setPlan(null);
      }
    }

    void loadPlan();
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
    <div className="portal-page space-y-6 sm:space-y-8">
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as DashboardTab)}
        items={[
          { value: "todo", label: "Todo" },
          {
            value: "shopify",
            label: "Shopify",
            icon: (
              <ProviderIcon provider="shopify" />
            ),
          },
          {
            value: "meta",
            label: "Meta Ads",
            icon: (
              <ProviderIcon provider="meta_ads" />
            ),
          },
          {
            value: "klaviyo",
            label: "Klaviyo",
            icon: <ProviderIcon provider="klaviyo" />,
          },
        ]}
      />

      {/* La foto del negocio en seis cifras, antes de bajar a cada módulo.
          Es también lo que ve el Consultor IA como "vista actual" cuando se
          le pregunta desde aquí. */}
      {metrics ? (
        <ModuleSummary
          period={
            metrics.period.days === "all"
              ? "Todo el histórico"
              : `Últimos ${metrics.period.days} días`
          }
          metrics={[
            {
              label: "Ventas netas",
              value: formatMoney(metrics.sales.net_sales),
              hint: (() => {
                const delta = periodDeltaPct(
                  metrics.sales.net_sales,
                  metrics.previous_period?.sales.net_sales,
                );
                return delta === null
                  ? undefined
                  : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}% vs periodo anterior`;
              })(),
            },
            {
              label: "Pedidos",
              value: metrics.sales.orders_count.toLocaleString("es-ES"),
              hint: `Ticket medio ${formatMoney(metrics.sales.aov)}`,
            },
            {
              label: "Beneficio neto",
              value: metrics.financial.has_settings
                ? formatMoney(metrics.financial.net_profit)
                : "Sin configurar",
              tone: !metrics.financial.has_settings
                ? "warn"
                : metrics.financial.net_profit < 0
                  ? "danger"
                  : "success",
              hint: metrics.financial.has_settings
                ? `Margen neto ${metrics.financial.net_margin_pct.toFixed(1)}%`
                : "Faltan costes y comisiones",
            },
            {
              label: "Inversión Meta",
              value: metaMetrics
                ? formatMoney(metaMetrics.acquisition.spend)
                : "Sin conectar",
              hint:
                metaMetrics?.acquisition.roas != null
                  ? `ROAS ${metaMetrics.acquisition.roas.toFixed(2)}x`
                  : undefined,
            },
            {
              label: "Sin stock",
              value: metrics.stock.out_of_stock_items.toLocaleString("es-ES"),
              tone: metrics.stock.out_of_stock_items > 0 ? "danger" : "success",
              hint: `${metrics.stock.low_stock_items} con stock bajo`,
            },
            {
              label: "Trabajo abierto",
              value: (operations?.tasks ?? [])
                .filter((task) =>
                  ["pending", "in_progress"].includes(task.status),
                )
                .length.toLocaleString("es-ES"),
              hint: `${(operations?.alerts ?? []).filter((alert) => !["resolved", "dismissed"].includes(alert.status)).length} alertas activas`,
            },
          ]}
        />
      ) : null}

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

      {/* "Todo" = un widget funcional por modulo, en rejilla. El detalle
          completo de cada modulo esta en su propia pestaña. */}
      {activeTab === "todo" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ShopifyMiniCard
            metrics={metrics}
            isLoading={isLoadingMetrics || isLoadingStores}
            error={metricsError}
            onOpen={() => setActiveTab("shopify")}
          />
          <MetaMiniCard
            metaMetrics={metaMetrics}
            onOpen={() => setActiveTab("meta")}
          />
          <PlanTasksMiniCard plan={plan} tasks={operations?.tasks ?? []} />
        </div>
      ) : null}

      {/* Agenda y chat de esta tienda, lado a lado (65/35). Mismo par de
          módulos que la vista general del consultor, aquí acotados a la
          organización activa (los ve tanto el cliente como el consultor con
          cliente activo). */}
      {activeTab === "todo" ? (
        <div className="grid gap-4 lg:grid-cols-[65fr_35fr]">
          <ConsultantAgenda embedded fixedScope={organization.id} />
          <Card title="Chats">
            <MessageThread
              organizationId={organization.id}
              viewerIsClient={!isConsultant}
              className="h-80"
            />
          </Card>
        </div>
      ) : null}

      {activeTab === "todo" ? (
        <AiAgentsPanel
          organizationId={organization.id}
          days={aiDiagnosticDays}
          isConsultant={isConsultant}
          isPlatformAdmin={
            bootstrap.profile.platform_role === "platform_admin"
          }
        />
      ) : null}

      {activeTab === "shopify" && showStoresOverview && organization ? (
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

      {activeTab === "shopify" ? (
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

              <div className="grid gap-x-8 border-t border-separator pt-3 md:grid-cols-3">
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

      {activeTab === "meta" ? (
        <Card
          title="Meta Ads"
          description="Rendimiento atribuido cuando exista una cuenta publicitaria conectada."
        >
          {metaMetrics?.backfill?.status === "running" ? (
            <Banner tone="warn" className="mb-3 text-sm">
              Importando el histórico de Meta ({metaMetrics.backfill.pct}%). Los
              datos anteriores a los últimos meses irán apareciendo conforme
              avanza.
            </Banner>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Metric
              card
              label="Inversión Meta"
              value={formatMoney(metaMetrics?.acquisition.spend ?? 0)}
              trend={metaMetrics?.daily?.map((day) => day.spend)}
            />
            {/* `data-insight-target` + el id del registro: al llegar desde la
                zona de IA del header, esta card parpadea (globals.css). */}
            <div id={insightAnchorId("roas")} data-insight-target>
              <Metric
                card
                label="ROAS"
                value={
                  metaMetrics?.acquisition.roas != null
                    ? `${Number(metaMetrics.acquisition.roas).toFixed(2)}x`
                    : "0.00x"
                }
                insight={
                  <MetricInsights
                    metricLabel="ROAS"
                    insights={
                      insightSpotFor(
                        {
                          organizationId: organization.id,
                          connectionId: activeConnectionId,
                          isConsultant,
                        },
                        "roas",
                      )?.insights ?? []
                    }
                    onCreateTask={() => {}}
                  />
                }
              />
            </div>
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
            <article className="rounded-md border border-separator p-4 sm:col-span-2">
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
        Toda la IA vive en el widget "Agentes IA" (AiAgentsPanel) de la
        pestaña "Todo": un veredicto por agente y el analisis completo al
        desplegar. El cliente solo ve el resumen ejecutivo (A02, variante
        `summary`, solo lectura); el consultor ve tambien Plan de tareas
        (A04), Stock (A06), Email y Conocimiento, cada uno con su boton de
        aprobar propuestas. Ya no hay secciones IA sueltas aqui.
      */}

      {activeTab === "shopify" &&
      !isConsultant &&
      !isLoadingStores &&
      shopifyConnections.length === 0 ? (
        <EmptyState
          title="Sin tiendas Shopify conectadas"
          hint="Conecta la tienda para empezar a ver ventas, margen y stock en tiempo real."
          action={<ButtonLink href="/integraciones">Conectar Shopify</ButtonLink>}
        />
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

  // El cliente tiene su propio panel: responde a "¿cómo va mi tienda y qué
  // tengo que hacer?", no a "¿qué cliente necesita mi atención?". Antes era
  // este mismo DashboardContent con tres condicionales por rol -- incluido un
  // <ConsultantAgenda> incrustado en la vista del cliente.
  if (!isConsultant) {
    return <ClientDashboard bootstrap={bootstrap} />;
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
