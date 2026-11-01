"use client";


/**
 * Mesa de trabajo diaria (docs/PLAN_MESA_TRABAJO_DIARIA_CONSULTOR.md).
 *
 * `/consultor` deja de ser "la lista de clientes" y pasa a ser la pantalla
 * desde la que se decide donde intervenir. Nada de esto es una metrica nueva:
 * el backend (`/v1/consultant/daily-workbench`) reune alertas, tareas,
 * llamadas, mensajes, conexiones, hitos y propuestas que ya existen, y cada
 * fila abre el modulo que la ejecuta con el cliente ya seleccionado.
 *
 * Dos cosas que la pantalla NO hace, a proposito: no aprueba salidas de IA
 * (eso se decide en /tareas) y no muestra un 0 cuando lo que hay es un canal
 * sin conectar.
 */

import { type ReactNode, useMemo, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/money";
import { panelPct } from "@e-nora/contracts";
import { useProfitability } from "@/app/panel/panel-data";
import { isWithinNextDays } from "@/lib/elapsed";
import { invalidateCachedQueries } from "@/lib/use-cached-query";
import { withPortalRouteContext } from "@/lib/portal-route-context";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import {
  ScrollArea,
  Badge,
  Button,
  ButtonLink,
  CollapsibleSection,
  EmptyState,
  EYEBROW,
  Field,
  Input,
  Link,
  Metric,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Banner,
  toast,
  type Tone,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleMore,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  List,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui";

// --- Contrato con el endpoint ---------------------------------------------

export type WorkbenchActionKind =
  | "critical_alert"
  | "call_approval"
  | "ai_proposal"
  | "unread_message"
  | "integration_reauth"
  | "financial_coverage"
  | "milestone_due";

export type WorkbenchAction = {
  id: string;
  kind: WorkbenchActionKind;
  organization_id: string;
  organization_name: string;
  priority: "urgent" | "high" | "normal";
  title: string;
  reason: string;
  evidence: Array<{ label: string; value: string; source?: string }>;
  due_at: string | null;
  assignee_name: string | null;
  href: string;
  action_label: string;
  /** Decision atomica que se toma sin salir de la mesa (resumen o propuesta unica). */
  decision?: { endpoint: string } | null;
};

export type PortfolioHealthRow = {
  organization_id: string;
  organization_name: string;
  status: "urgente" | "revisar" | "vigilar" | "al_dia";
  next_action: { title: string; href: string; action_label: string } | null;
  open_alerts: number;
  critical_alerts: number;
  open_tasks: number;
  data_issues: string[];
  next_event: { label: string; at: string } | null;
  href: string;
};

export type UpcomingItem = {
  id: string;
  kind: "task" | "milestone" | "campaign" | "call";
  organization_id: string;
  organization_name: string;
  title: string;
  at: string;
  href: string;
};

export type ClientDeskData = {
  organization_id: string;
  camino_notice?: string | null;
  organization_name: string;
  status: string | null;
  currency_code: string | null;
  timezone: string | null;
  stores: Array<{
    id: string;
    provider: string;
    name: string | null;
    status: string;
    last_sync_at: string | null;
  }>;
  business: {
    window_days: number;
    has_financial_settings: boolean;
    shopify_connected: boolean;
    meta_connected: boolean;
    net_sales: number | null;
    orders: number;
    shopify_currency_code: string | null;
    meta_currency_code: string | null;
    meta_spend: number | null;
    meta_purchase_value: number | null;
    roas: number | null;
    prev_net_sales: number | null;
    prev_orders: number | null;
    prev_meta_spend: number | null;
    prev_roas: number | null;
    out_of_stock_items: number | null;
    low_stock_items: number | null;
    coverage: string[];
  } | null;
  last_review: { reviewed_at: string; note: string | null } | null;
  changes: {
    // Desde cuando se cuenta la actividad, y si ese corte es una revision tuya
    // o el inicio de la ventana. El mismo numero significa cosas distintas.
    since: string;
    since_kind: "review" | "window";
    new_alerts: number;
    closed_tasks: number;
    net_sales_delta: number | null;
    orders_delta: number | null;
    meta_spend_delta: number | null;
  };
  camino: {
    connection_id?: string | null;
    store_name?: string | null;
    phase_name: string;
    phase_status: string;
    milestones_total: number;
    milestones_done: number;
    next_milestone: {
      id: string;
      name: string;
      target_date: string | null;
      phase_name: string | null;
    } | null;
  } | null;
  relationship: {
    next_call: { id: string; title: string; scheduled_at: string | null } | null;
    last_call: {
      id: string;
      title: string;
      held_at: string | null;
      summary_pending: boolean;
    } | null;
    unread_count: number;
    counterpart_name: string | null;
  };
};

export type ClientOnboarding = {
  organization_id: string;
  completed: number;
  next: string | null;
  steps: Array<{ key: string; label: string; status: "done" | "pending" | "unknown"; href: string; action: string; detail: string }>;
};

export function ClientOnboardingSteps({ onboarding }: { onboarding: ClientOnboarding }) {
  return <section aria-label="Puesta en marcha del cliente" className="space-y-3 py-4">
    <h3 className="text-sm font-semibold">Puesta en marcha · {onboarding.completed} de {onboarding.steps.length} pasos</h3>
    <ol className="divide-y divide-separator">
      {onboarding.steps.map((step) => <li key={step.key} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
        <div className="min-w-0 flex-1 basis-64"><p className="font-medium">{step.label} <Badge tone={step.status === "done" ? "success" : "neutral"}>{step.status === "done" ? "Completado" : step.status === "unknown" ? "Sin comprobar" : "Pendiente"}</Badge></p>
          {step.status !== "done" ? <p className="mt-1 max-w-prose text-xs text-muted">{step.status === "unknown" ? "No se pudo leer la fuente. Recarga para comprobar este paso." : step.detail}</p> : null}
        </div>
        {step.status !== "done" ? <ButtonLink href={step.href} size="sm" variant="secondary">{step.action}</ButtonLink> : null}
      </li>)}
    </ol>
  </section>;
}

export type DailyWorkbench = {
  window_days: number;
  generated_at: string;
  summary: {
    clients: number;
    urgent_clients: number;
    critical_alerts: number;
    pending_call_summaries: number;
    pending_ai_proposals: number;
    unread_threads: number;
    data_issues: number;
  };
  actions: WorkbenchAction[];
  portfolio: PortfolioHealthRow[];
  onboarding?: ClientOnboarding[];
  upcoming: UpcomingItem[];
  sources: Record<string, "ok" | "error">;
  client?: ClientDeskData;
};

// --- Etiquetas -------------------------------------------------------------

const PRIORITY_BADGE: Record<
  WorkbenchAction["priority"],
  { label: string; tone: Tone } | null
> = {
  urgent: { label: "Urgente", tone: "danger" },
  high: { label: "Alta", tone: "warn" },
  normal: null,
};

const KIND_LABELS: Record<WorkbenchActionKind, string> = {
  critical_alert: "Alerta",
  call_approval: "Resumen de llamada",
  ai_proposal: "Propuesta IA",
  unread_message: "Mensaje",
  integration_reauth: "Integración",
  financial_coverage: "Datos",
  milestone_due: "Hito",
};

export const STATUS_BADGE: Record<
  PortfolioHealthRow["status"],
  { label: string; tone: Tone }
> = {
  urgente: { label: "Urgente", tone: "danger" },
  revisar: { label: "Revisar", tone: "warn" },
  vigilar: { label: "Vigilar", tone: "neutral" },
  al_dia: { label: "Al día", tone: "success" },
};

const UPCOMING_LABELS: Record<UpcomingItem["kind"], string> = {
  task: "Tarea",
  milestone: "Hito",
  campaign: "Campaña",
  call: "Llamada",
};

const SOURCE_LABELS: Record<string, string> = {
  alerts: "alertas",
  tasks: "tareas",
  calls: "llamadas",
  proposals: "propuestas de IA",
  messages: "mensajes",
  connections: "integraciones",
  financial: "configuración financiera",
  milestones: "hitos",
  campaigns: "planificación",
};

export const WINDOW_OPTIONS = [7, 30, 90] as const;

// --- Formato ---------------------------------------------------------------

function formatDay(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  return new Date(at).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "sin fecha";
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  return new Date(at).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

// --- Filtros de la bandeja -------------------------------------------------

export type InboxFilter =
  | "todo"
  | "urgente"
  | "decision"
  | "datos"
  | "semana";

const INBOX_FILTERS: Array<{ value: InboxFilter; label: string }> = [
  { value: "todo", label: "Todo" },
  { value: "urgente", label: "Urgente" },
  { value: "decision", label: "Esperando mi decisión" },
  { value: "datos", label: "Datos e integraciones" },
  { value: "semana", label: "Esta semana" },
];

const DECISION_KINDS: WorkbenchActionKind[] = [
  "call_approval",
  "ai_proposal",
  "unread_message",
];
const DATA_KINDS: WorkbenchActionKind[] = [
  "integration_reauth",
  "financial_coverage",
];


// `Date.now()` vive en `@/lib/elapsed`, fuera del render: llamarlo en el
// cuerpo de un componente lo marca `react-hooks/purity`.
function matchesFilter(action: WorkbenchAction, filter: InboxFilter): boolean {
  switch (filter) {
    case "urgente":
      return action.priority === "urgent";
    case "decision":
      return DECISION_KINDS.includes(action.kind);
    case "datos":
      return DATA_KINDS.includes(action.kind);
    case "semana":
      return isWithinNextDays(action.due_at, 7);
    default:
      return true;
  }
}

const INITIAL_ROWS = 8;

/**
 * El orden de la cola ya deja las filas del mismo cliente contiguas (mismo
 * `attention.score` -> mismo puesto en el desempate). Agrupar por adyacencia
 * evita repetir el nombre del cliente en cada fila: con 4-5 propuestas de un
 * mismo cliente, verlo cinco veces seguidas es lo que hacia la cola ilegible.
 */
function groupByOrganization(actions: WorkbenchAction[]) {
  const groups: Array<{
    organization_id: string;
    organization_name: string;
    actions: WorkbenchAction[];
  }> = [];
  for (const action of actions) {
    const last = groups[groups.length - 1];
    if (last && last.organization_id === action.organization_id) {
      last.actions.push(action);
    } else {
      groups.push({
        organization_id: action.organization_id,
        organization_name: action.organization_name,
        actions: [action],
      });
    }
  }
  return groups;
}

/**
 * La cola unica de trabajo. Cada fila dice cliente, que hay que hacer, por
 * que ahora y con que evidencia; y tiene un solo CTA, al modulo que lo
 * ejecuta. El estado nunca va solo en el color: el badge lleva texto y el
 * motivo se escribe.
 */
export function DailyActionInbox({
  actions,
  emptyHint,
  filter,
  onFilterChange,
  onDecided,
}: {
  actions: WorkbenchAction[];
  emptyHint?: ReactNode;
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  onDecided: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () => actions.filter((action) => matchesFilter(action, filter)),
    [actions, filter],
  );
  // Se corta por clientes enteros: un cliente no queda partido entre lo
  // visible y lo plegado.
  const groups = groupByOrganization(filtered);
  let headGroups = 0;
  for (let rows = 0; headGroups < groups.length; headGroups++) {
    rows += groups[headGroups]!.actions.length;
    if (headGroups > 0 && rows > INITIAL_ROWS) break;
  }

  const renderGroup = (group: ReturnType<typeof groupByOrganization>[number]) => (
                <li key={group.organization_id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-foreground">
                      {group.organization_name}
                    </span>
                    {group.actions.length > 1 ? (
                      <span className="text-xs text-muted">
                        {group.actions.length} acciones
                      </span>
                    ) : null}
                  </div>
                  <ul className="divide-y divide-separator">
                    {group.actions.map((action) => (
                      <li key={action.id}>
                        <ActionRow action={action} onDecided={onDecided} />
                      </li>
                    ))}
                  </ul>
                </li>
              );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Para resolver hoy</CardTitle>
        <CardDescription>{actions.length === 0
          ? "No hay nada pendiente de decisión en tu cartera."
          : `${actions.length} ${actions.length === 1 ? "acción" : "acciones"} en cola, ordenadas por urgencia y por el cliente que peor va.`}</CardDescription>
      </CardHeader>
      <CardContent>
        {actions.length > 0 ? (
          <ToggleGroup
            aria-label="Filtrar la cola de trabajo"
            spacing={2}
            value={filter}
            onValueChange={(value) => {
              onFilterChange(value);
              setShowAll(false);
            }}
          >
            {INBOX_FILTERS.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}{" "}
                <span className="text-xs text-muted tabular-nums">
                  {actions.filter((action) => matchesFilter(action, option.value)).length}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}

        {actions.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Todo al día"
              hint={
                emptyHint ??
                "Ninguna alerta, tarea, llamada ni integración pide decisión ahora mismo."
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState size="sm" title="Nada en este filtro" hint="Prueba con «Todo»." />
        ) : (
          <Collapsible open={showAll} onOpenChange={setShowAll}>
            <ul className="mt-4 divide-y divide-separator">
              {groups.slice(0, headGroups).map(renderGroup)}
            </ul>
            {headGroups < groups.length ? (
              <>
                <CollapsibleContent>
                  <ul className="divide-y divide-separator border-t border-separator">
                    {groups.slice(headGroups).map(renderGroup)}
                  </ul>
                </CollapsibleContent>
                <CollapsibleMore
                  className="mt-4"
                  count={groups.length - headGroups}
                  more={`Ver todo (${filtered.length})`}
                  less="Ver menos"
                />
              </>
            ) : null}
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

const DECISION_LABELS: Partial<Record<WorkbenchActionKind, { approve: string; reject: string; done: string }>> = {
  call_approval: { approve: "Aprobar y publicar", reject: "Rechazar", done: "Resumen publicado." },
  ai_proposal: { approve: "Aprobar", reject: "Descartar", done: "Propuesta aprobada." },
};

/**
 * Aprobar o descartar sin salir de la mesa. Usa el mismo endpoint que Llamadas
 * y Tareas: la mesa no tiene logica de aprobacion propia, solo el atajo.
 */
function DecisionButtons({
  action,
  onDecided,
}: {
  action: WorkbenchAction;
  onDecided: () => void;
}) {
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const labels = DECISION_LABELS[action.kind];
  if (!action.decision || !labels) return null;
  const endpoint = action.decision.endpoint;

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    try {
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success(decision === "approved" ? labels!.done : "Descartado.");
      invalidateCachedQueries();
      onDecided();
    } catch {
      toast.danger("No se pudo guardar la decisión por un error de red. Reintenta.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="default" disabled={busy !== null} onClick={() => void decide("approved")}>
        {busy === "approved" ? "Guardando…" : labels.approve}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy !== null} onClick={() => void decide("rejected")}>
        {busy === "rejected" ? "Guardando…" : labels.reject}
      </Button>
    </>
  );
}

function ActionRow({
  action,
  onDecided,
}: {
  action: WorkbenchAction;
  onDecided: () => void;
}) {
  const badge = PRIORITY_BADGE[action.priority];
  const meta = [
    action.assignee_name ? `Responsable: ${action.assignee_name}` : null,
    action.due_at ? `Vence ${formatDateTime(action.due_at)}` : null,
  ].filter(Boolean);
  const [showDetail, setShowDetail] = useState(false);
  const isDesktop = useIsDesktop();

  return (
    <div className="task-lift flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
      <div className="min-w-[15rem] flex-1">
        {/* El tipo (Alerta/Propuesta IA...) va siempre visible,
            no solo en la meta de abajo: sin badge de prioridad (la mayoria de
            filas son "normal"), era la unica pista de que trataba cada una. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={EYEBROW}>{KIND_LABELS[action.kind]}</span>
          {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
        </div>
        <button
          type="button"
          onClick={() => setShowDetail(true)}
          className="mt-1 block text-left text-sm font-medium text-foreground hover:text-accent"
        >
          {action.title}
        </button>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {action.reason}
        </p>
        {action.evidence.length > 0 ? (
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {action.evidence.map((item) => (
              <div key={`${item.label}:${item.value}`} className="flex gap-1">
                <dt>{item.label}:</dt>
                <dd className="text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {meta.length > 0 ? (
          <p className="mt-1 text-xs text-muted">{meta.join(" · ")}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <DecisionButtons action={action} onDecided={onDecided} />
        <ButtonLink
          href={action.href}
          size="sm"
          variant={action.decision ? "ghost" : "secondary"}
        >
          {action.decision ? "Ver detalle" : action.action_label}
        </ButtonLink>
      </div>

      {/* Detalle en cajón: la fila ya trae lo esencial, pero con evidencia
          larga o un motivo detallado, "abrir el modulo" es un salto de
          contexto de mas solo para leer. Aqui se lee sin salir de la mesa. */}
      <Drawer
        open={showDetail}
        onOpenChange={setShowDetail}
        swipeDirection={isDesktop ? "right" : "down"}
        showSwipeHandle={!isDesktop}
      >
        <DrawerContent className="sm:max-w-[40rem]">
          <DrawerHeader>
            {KIND_LABELS[action.kind] ? <span className={EYEBROW}>{KIND_LABELS[action.kind]}</span> : null}
            <DrawerTitle>{action.title}</DrawerTitle>
            <DrawerDescription>
              {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
              <span className="font-medium text-ink">{action.organization_name}</span>
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1 space-y-4 p-4 sm:px-6">
          <p className="leading-relaxed text-ink">{action.reason}</p>
          {action.evidence.length > 0 ? (
            <dl className="divide-y divide-line text-sm">
              {action.evidence.map((item) => (
                <div key={`${item.label}:${item.value}`} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted">{item.label}</dt>
                  <dd className="font-medium text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {meta.length > 0 ? <p className="text-xs text-muted">{meta.join(" · ")}</p> : null}
          </ScrollArea>
          <DrawerFooter>
            <ButtonLink href={action.href} onClick={() => setShowDetail(false)}>
              {action.action_label}
            </ButtonLink>
            <DrawerClose render={<Button variant="outline" />}>Cerrar</DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

const HEALTH_STATUS_ORDER: PortfolioHealthRow["status"][] = [
  "urgente",
  "revisar",
  "vigilar",
  "al_dia",
];

type HealthFilter = "todos" | PortfolioHealthRow["status"];

/**
 * Todos los clientes, no solo los que tienen problemas: la columna que manda
 * es "siguiente accion", no la puntuacion. Un cliente al dia tambien tiene que
 * verse, porque "no hay nada" es informacion.
 *
 * Plegado por defecto (§ pantallazo del consultor): esta era la seccion mas
 * larga de la mesa y competia por atencion con "Para resolver hoy", que es la
 * que manda. El resumen de la cabecera ya dice si hace falta mirarla.
 */
export function PortfolioHealthBoard({
  rows,
  onOpen,
}: {
  rows: PortfolioHealthRow[];
  onOpen: (organizationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<HealthFilter>("todos");
  const normalized = query.trim().toLowerCase();

  const filtered = rows.filter((row) => {
    if (statusFilter !== "todos" && row.status !== statusFilter) return false;
    if (normalized && !row.organization_name.toLowerCase().includes(normalized))
      return false;
    return true;
  });

  const urgentCount = rows.filter((row) => row.status === "urgente").length;
  const reviewCount = rows.filter((row) => row.status === "revisar").length;

  return (
    <CollapsibleSection
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>Cartera en salud</span>
          {urgentCount > 0 ? (
            <Badge tone="danger">{urgentCount} urgente{urgentCount === 1 ? "" : "s"}</Badge>
          ) : null}
          {reviewCount > 0 ? (
            <Badge tone="warn">{reviewCount} por revisar</Badge>
          ) : null}
          <span className="text-xs font-normal text-muted">
            {rows.length} {rows.length === 1 ? "cliente" : "clientes"}
          </span>
        </span>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup aria-label="Filtrar cartera por estado" spacing={2} value={statusFilter} onValueChange={setStatusFilter}>
          <ToggleGroupItem value="todos">
            Todos <span className="text-xs text-muted tabular-nums">{rows.length}</span>
          </ToggleGroupItem>
          {HEALTH_STATUS_ORDER.map((status) => {
            const total = rows.filter((row) => row.status === status).length;
            if (total === 0) return null;
            return (
              <ToggleGroupItem key={status} value={status}>
                {STATUS_BADGE[status].label} <span className="text-xs text-muted tabular-nums">{total}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        {rows.length > 6 ? (
          <div className="w-48">
            <Input
              type="search"
              aria-label="Buscar cliente en la cartera"
              placeholder="Buscar cliente..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState size="sm" title="Sin resultados para este filtro" />
      ) : (
        <ul className="mt-4 divide-y divide-separator">
          {filtered.map((row) => {
            const badge = STATUS_BADGE[row.status];
            const counters = [
              `${row.open_alerts} ${row.open_alerts === 1 ? "alerta" : "alertas"}`,
              row.critical_alerts > 0
                ? `${row.critical_alerts} críticas`
                : null,
              `${row.open_tasks} ${row.open_tasks === 1 ? "tarea" : "tareas"}`,
            ].filter(Boolean);

            return (
              <li
                key={row.organization_id}
                className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3"
              >
                <div className="min-w-[15rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    <Link
                      href={row.href}
                      onClick={() => onOpen(row.organization_id)}
                      className="text-sm font-medium no-underline hover:text-accent hover:no-underline"
                    >
                      {row.organization_name}
                    </Link>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-foreground">
                    {row.next_action
                      ? row.next_action.title
                      : "Sin nada pendiente de decisión."}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {counters.join(" · ")}
                  </p>
                  {row.data_issues.length > 0 ? (
                    <p className="mt-1 text-xs text-warning">
                      Salud del dato: {row.data_issues.join(" · ")}
                    </p>
                  ) : null}
                  {row.next_event ? (
                    <p className="mt-1 text-xs text-muted">
                      Próximo: {row.next_event.label} ·{" "}
                      {formatDay(row.next_event.at)}
                    </p>
                  ) : null}
                </div>
                <div role="group" aria-label="Acciones de la cartera" className="flex flex-wrap items-center gap-2 shrink-0">
                  {row.next_action ? (
                    <ButtonLink
                      href={row.next_action.href}
                      size="sm"
                      variant="ghost"
                    >
                      {row.next_action.action_label}
                    </ButtonLink>
                  ) : null}
                  <ButtonLink
                    href={row.href}
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpen(row.organization_id)}
                  >
                    Abrir mesa
                  </ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </CollapsibleSection>
  );
}

/**
 * Lo que vence o se publica en siete dias, agrupado por dia. Sirve para dos
 * bloques distintos del mismo dato (`items` ya viene filtrado por quien lo
 * llama): la agenda de llamadas al lado de la cola, y "esta semana" con
 * hitos/campanas/tareas debajo de la cartera -- son preguntas distintas
 * ("con quien hablo" vs. "que tengo que preparar") aunque compartan formato.
 */
export function UpcomingWork({
  items,
  title = "Próximos siete días",
  description = "Tareas con fecha, hitos del plan, campañas y llamadas que hay que preparar.",
  emptyLabel = "Nada fechado en los próximos siete días.",
}: {
  items: UpcomingItem[];
  title?: string;
  description?: string;
  emptyLabel?: string;
}) {
  const byDay = useMemo(() => {
    const groups = new Map<string, UpcomingItem[]>();
    for (const item of items) {
      const key = dayKey(item.at);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [items]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {byDay.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">{emptyLabel}</p>
        ) : (
          <div className="mt-4 space-y-4">
            {byDay.map(([day, dayItems]) => (
              <div key={day}>
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted">
                  {formatDay(`${day}T12:00:00.000Z`)}
                </p>
                <List as="ul" className="mt-2">
                  {dayItems.map((item) => (
                    <Item key={item.id} className="task-lift" render={<li />}>
                      <ItemContent>
                        <ItemTitle>{item.title}</ItemTitle>
                        <ItemDescription>
                          {UPCOMING_LABELS[item.kind]} ·{" "}
                          {item.organization_name}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <ButtonLink
                          href={item.href}
                          size="sm"
                          variant="ghost"
                        >
                          Abrir
                        </ButtonLink>
                      </ItemActions>
                    </Item>
                  ))}
                </List>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Atajo a la llamada mas proxima de toda la cartera. No es un widget nuevo de
 * datos: reutiliza `upcoming` (misma fuente que "Proximos siete dias") y abre
 * la ficha del cliente, que ya trae "Relacion y proxima conversacion" con el
 * contexto real (ultimo resumen, mensajes sin leer). Construir aqui una
 * segunda copia de ese bloque hubiera sido duplicar datos que ya se muestran.
 */
export function NextCallWidget({
  items,
  onOpen,
}: {
  items: UpcomingItem[];
  onOpen: (organizationId: string) => void;
}) {
  const calls = items
    .filter((item) => item.kind === "call")
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const next = calls[0];
  if (!next) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próxima llamada</CardTitle>
        <CardDescription>{next.organization_name}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mt-1 text-sm font-medium text-foreground">{next.title}</p>
        <p className="mt-1 text-xs text-muted">{formatDateTime(next.at)}</p>
        <div className="mt-3">
          <ButtonLink
            href={`/consultor?organizationId=${next.organization_id}`}
            size="sm"
            onClick={() => onOpen(next.organization_id)}
          >
            Preparar llamada
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Bloque secundario y plegable. Se apoya en `/v1/consultant/overview`, que ya
 * existe: no se recalcula nada aqui. Un canal sin conectar se dice; no se
 * pinta un 0.
 */
export function PortfolioPulse({
  business,
  windowDays,
  isLoading,
}: {
  business: {
    net_sales: number | null;
    orders: number;
    meta_spend: number | null;
    roas: number | null;
    shopify_currency_code: string | null;
    meta_currency_code: string | null;
    prev_net_sales: number | null;
    prev_orders: number;
    prev_meta_spend: number | null;
  } | null;
  windowDays: number;
  isLoading: boolean;
}) {
  return (
    <CollapsibleSection title={`Movimiento reciente · ${windowDays} días`}>
      {isLoading ? (
        <p className="text-[13px] text-muted">Cargando el resumen…</p>
      ) : !business ? (
        <p className="text-[13px] text-muted">
          El resumen de cartera no está disponible ahora mismo.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            size="sm"
            label="Ventas netas"
            value={business.shopify_currency_code && business.net_sales != null ? formatMoney(business.net_sales, business.shopify_currency_code) : "Moneda no comparable"}
            hint={`Periodo anterior: ${business.shopify_currency_code && business.prev_net_sales != null ? formatMoney(business.prev_net_sales, business.shopify_currency_code) : "Moneda no comparable"}`}
          />
          <Metric
            size="sm"
            label="Pedidos"
            value={String(business.orders)}
            hint={`Periodo anterior: ${business.prev_orders}`}
          />
          <Metric
            size="sm"
            label="Inversión Meta"
            value={business.meta_currency_code && business.meta_spend != null ? formatMoney(business.meta_spend, business.meta_currency_code) : "Moneda no comparable"}
            hint={`Periodo anterior: ${business.meta_currency_code && business.prev_meta_spend != null ? formatMoney(business.prev_meta_spend, business.meta_currency_code) : "Moneda no comparable"}`}
          />
          <Metric
            size="sm"
            label="ROAS"
            value={business.roas == null ? "Sin datos" : business.roas.toFixed(2)}
            hint={
              business.roas == null
                ? "Meta Ads sin inversión o sin conectar en el periodo"
                : "Ingresos atribuidos por Meta / inversión Meta"
            }
          />
        </div>
      )}
    </CollapsibleSection>
  );
}

/** Aviso de bloques caidos: la mesa sigue siendo util y declara la limitacion. */
export function DegradedSources({
  sources,
  onRetry,
}: {
  sources: Record<string, "ok" | "error">;
  onRetry: () => void;
}) {
  const failed = Object.entries(sources)
    .filter(([, state]) => state === "error")
    .map(([key]) => SOURCE_LABELS[key] ?? key);

  if (failed.length === 0) return null;

  return (
    <Banner tone="warn">
      No se pudieron cargar {failed.join(", ")}. El resto de la mesa está
      completo, pero puede faltar trabajo de esos bloques.{" "}
      <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
        Reintentar
      </Button>
    </Banner>
  );
}

// --- Ficha de cliente ------------------------------------------------------

function deltaLabel(
  current: number,
  previous: number | null,
  format: (value: number) => string,
): string {
  if (previous === null) return "Sin periodo de comparación";
  const diff = current - previous;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${format(diff)} vs. periodo anterior`;
}

/**
 * "Marcar como revisado". Es explicito a proposito: visitar la ficha no puede
 * mover el hito, o el consultor perderia la comparacion justo cuando entra a
 * mirar. La nota es opcional y corta -- acota la revision, no es un mensaje.
 */
function MarkReviewedButton({
  organizationId,
  lastReview,
  onReviewed,
}: {
  organizationId: string;
  lastReview: { reviewed_at: string; note: string | null } | null;
  onReviewed: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit() {
    setIsSaving(true);
    try {
      const response = await apiFetch(
        `/v1/consultant/organizations/${organizationId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(note.trim() ? { note: note.trim() } : {}),
        },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Revisión marcada. A partir de aquí empieza lo nuevo.");
      setNote("");
      setIsOpen(false);
      onReviewed();
    } catch {
      toast.danger(
        "No se pudo marcar la revisión. Revisa la conexión e inténtalo de nuevo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {isOpen ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Nota de la revisión (opcional)">
            <Input
              value={note}
              maxLength={500}
              placeholder="Qué has mirado o dejado pendiente..."
              onChange={(event) => setNote(event.target.value)}
              className="w-64"
            />
          </Field>
          <div role="group" aria-label="Acciones de revisión" className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={isSaving} onClick={() => void submit()}>
              {isSaving ? "Guardando..." : "Confirmar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setIsOpen(true)}>
          Marcar como revisado
        </Button>
      )}
      {lastReview ? (
        <p className="text-xs text-muted">
          Última revisión: {formatDateTime(lastReview.reviewed_at)}
          {lastReview.note ? ` · ${lastReview.note}` : ""}
        </p>
      ) : null}
    </div>
  );
}

/**
 * La mesa de UN cliente: que cambio, que toca decidir y como se ejecuta. No
 * duplica Dashboard ni Tareas: enlaza a ellos. La administracion de tiendas y
 * accesos baja al final, plegada.
 */
/**
 * Beneficio y margen del cliente en la propia mesa: antes la ficha solo decia
 * "faltan costes" o nada, y para saber si el cliente gana dinero habia que
 * salir al Panel. Misma lectura que el Panel (`/consultant/profitability`), sin
 * recalcular nada aqui.
 */
function ClientProfitStrip({
  organizationId,
  days,
}: {
  organizationId: string;
  days: number;
}) {
  const profitability = useProfitability(days, organizationId);
  const row = profitability.data?.clients[0] ?? null;
  if (profitability.isLoading) {
    return <p className="mt-4 text-[13px] text-muted">Calculando beneficio…</p>;
  }
  if (!row || row.net_profit == null || !row.currency_code) {
    return (
      <p className="mt-4 text-[13px] text-muted">
        Beneficio no disponible: {row && !row.currency_code ? "tiendas en monedas distintas" : "sin lectura de rentabilidad"}.
      </p>
    );
  }
  const money = (value: number) => formatMoney(value, row.currency_code);
  const belowTarget =
    row.margin_pct != null && row.margin_target != null && row.margin_pct < row.margin_target;
  return (
    <div className="mt-4 border-t border-separator pt-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Beneficio neto"
          value={money(row.net_profit)}
          tone={row.net_profit < 0 ? "danger" : "default"}
          hint="Ventas menos producto, envío, comisiones, ads y fijos"
        />
        <Metric
          label="Margen neto"
          value={row.margin_pct == null ? "—" : panelPct(row.margin_pct)}
          tone={belowTarget ? "warn" : "default"}
          hint={row.margin_target == null ? "Sin objetivo pactado" : `Objetivo ${panelPct(row.margin_target)}`}
        />
        <Metric
          label="Palancas detectadas"
          value={row.lever_total > 0 ? `+${money(row.lever_total)}/mes` : "—"}
          hint="Lo que el Panel estima recuperable"
        />
      </div>
      <div className="mt-3">
        <ButtonLink
          href={`/panel?organizationId=${organizationId}`}
          size="sm"
          variant="ghost"
        >
          Abrir rentabilidad
        </ButtonLink>
      </div>
    </div>
  );
}

export function ClientDesk({
  client,
  onboarding,
  actions,
  upcoming,
  administration,
  onBack,
  onReviewed,
}: {
  client: ClientDeskData;
  onboarding?: ClientOnboarding;
  actions: WorkbenchAction[];
  upcoming: UpcomingItem[];
  administration: ReactNode;
  onBack: () => void;
  onReviewed: () => void;
}) {
  const shopifyMoney = (value: number | null) =>
    value == null || !client.business?.shopify_currency_code
      ? "Moneda no comparable"
      : formatMoney(value, client.business.shopify_currency_code);
  const metaMoney = (value: number | null) =>
    value == null || !client.business?.meta_currency_code
      ? "Moneda no comparable"
      : formatMoney(value, client.business.meta_currency_code);
  const business = client.business;
  const primary = actions[0] ?? null;
  const sinceLabel =
    client.changes.since_kind === "review"
      ? `desde tu revisión del ${formatDateTime(client.changes.since)}`
      : "en el periodo";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardKicker>Mesa de cliente</CardKicker>
          <CardTitle>{client.organization_name}</CardTitle>
          <CardDescription>{primary
            ? `Lo primero: ${primary.title}`
            : "Sin nada pendiente de decisión en este cliente."}</CardDescription>
          <CardAction><div role="group" aria-label="Acciones del cliente" className="flex flex-wrap items-center gap-2">
            {primary ? (
              <ButtonLink
                href={primary.href}
                size="sm"
                variant="default"
              >
                {primary.action_label}
              </ButtonLink>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={onBack}>
              Volver a la cartera
            </Button>
          </div></CardAction>
        </CardHeader>
        <CardContent>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
            {client.stores.length === 0 ? (
              <li>Sin tiendas conectadas</li>
            ) : (
              client.stores.map((store) => (
                <li key={store.id}>
                  <span className="text-foreground">
                    {store.name ?? store.provider}
                  </span>{" "}
                  · {store.status} ·{" "}
                  {store.last_sync_at
                    ? `sync ${formatDateTime(store.last_sync_at)}`
                    : "sin sincronizar"}
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      {onboarding && onboarding.next ? <ClientOnboardingSteps onboarding={onboarding} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Estado del negocio</CardTitle>
          <CardDescription>{business
            ? `Todas las tiendas de ${client.organization_name}. Últimos ${business.window_days} días, comparados con los ${business.window_days} anteriores. Los importes solo se agregan si sus monedas son compatibles.`
            : undefined}</CardDescription>
        </CardHeader>
        <CardContent>
          {!business ? (
            <p className="mt-4 text-[13px] text-muted">
              No se pudo calcular el resumen de negocio de este cliente.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Metric
                  label="Ventas netas"
                  value={
                    business.shopify_connected ? shopifyMoney(business.net_sales) : "—"
                  }
                  hint={
                    business.shopify_connected && business.shopify_currency_code && business.net_sales != null && business.prev_net_sales != null
                      ? deltaLabel(business.net_sales, business.prev_net_sales, (value) => formatMoney(value, business.shopify_currency_code))
                      : business.shopify_connected ? "Moneda no comparable" : "Shopify sin conectar"
                  }
                />
                <Metric
                  label="Pedidos"
                  value={
                    business.shopify_connected ? String(business.orders) : "—"
                  }
                  hint={
                    business.shopify_connected
                      ? deltaLabel(business.orders, business.prev_orders, (value) =>
                          String(value),
                        )
                      : "Shopify sin conectar"
                  }
                />
                <Metric
                  label="Ticket medio"
                  value={
                    business.shopify_connected && business.net_sales != null && business.orders > 0
                      ? shopifyMoney(business.net_sales / business.orders)
                      : "—"
                  }
                  hint={
                    business.orders > 0
                      ? "Ventas netas / pedidos del periodo"
                      : "Sin pedidos en el periodo"
                  }
                />
                <Metric
                  label="Inversión Meta"
                  value={
                    business.meta_connected ? metaMoney(business.meta_spend) : "—"
                  }
                  hint={
                    business.meta_connected && business.meta_currency_code && business.meta_spend != null && business.prev_meta_spend != null
                      ? deltaLabel(
                          business.meta_spend,
                          business.prev_meta_spend,
                          (value) => formatMoney(value, business.meta_currency_code),
                        )
                      : business.meta_connected ? "Moneda no comparable" : "Meta Ads sin conectar"
                  }
                />
                <Metric
                  label="ROAS Meta"
                  value={business.roas == null ? "—" : business.roas.toFixed(2)}
                  tone={
                    business.roas != null && business.roas < 1
                      ? "danger"
                      : "default"
                  }
                  hint={
                    business.roas == null
                      ? "Sin inversión o sin conexión en el periodo"
                      : `Ingresos atribuidos en ${business.meta_currency_code} / inversión Meta en ${business.meta_currency_code}`
                  }
                />
                <Metric
                  label="Stock agotado"
                  value={
                    business.out_of_stock_items == null
                      ? "—"
                      : String(business.out_of_stock_items)
                  }
                  tone={
                    business.out_of_stock_items && business.out_of_stock_items > 0
                      ? "warn"
                      : "default"
                  }
                  hint={
                    business.low_stock_items == null
                      ? "Sin inventario sincronizado"
                      : `${business.low_stock_items} referencias con stock bajo`
                  }
                />
              </div>
              {business.has_financial_settings ? (
                <ClientProfitStrip
                  organizationId={client.organization_id}
                  days={business.window_days}
                />
              ) : (
                <p className="mt-4 text-[13px] leading-relaxed text-warning">
                  Beneficio y margen no se muestran: faltan los costes de este
                  cliente.{" "}
                  <Link
                    href={`/configuracion?organizationId=${client.organization_id}`}
                  >
                    Completar configuración financiera
                  </Link>
                  .
                </p>
              )}
              {business.coverage.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  {business.coverage.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{client.changes.since_kind === "review"
            ? "Qué cambió desde tu última revisión"
            : "Qué cambió"}</CardTitle>
          <CardDescription>Variaciones materiales, no una cronología completa. Las cifras de negocio siempre comparan periodo contra periodo anterior.</CardDescription>
          <CardAction><MarkReviewedButton
            organizationId={client.organization_id}
            lastReview={client.last_review}
            onReviewed={onReviewed}
          /></CardAction>
        </CardHeader>
        <CardContent>
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-foreground">
            <li>
              Ventas:{" "}
              {client.changes.net_sales_delta === null
                ? "sin comparación disponible"
                : deltaLabel(
                    client.changes.net_sales_delta,
                    0,
                    shopifyMoney,
                  ).replace(" vs. periodo anterior", " respecto al periodo anterior")}
            </li>
            <li>
              Pedidos:{" "}
              {client.changes.orders_delta === null
                ? "sin comparación disponible"
                : `${client.changes.orders_delta > 0 ? "+" : ""}${client.changes.orders_delta} respecto al periodo anterior`}
            </li>
            <li>
              Inversión Meta:{" "}
              {client.changes.meta_spend_delta === null
                ? "sin comparación disponible"
                : deltaLabel(
                    client.changes.meta_spend_delta,
                    0,
                    metaMoney,
                  ).replace(" vs. periodo anterior", " respecto al periodo anterior")}
            </li>
            <li>
              {client.changes.new_alerts}{" "}
              {client.changes.new_alerts === 1
                ? "alerta nueva"
                : "alertas nuevas"}{" "}
              {sinceLabel}.
            </li>
            <li>
              {client.changes.closed_tasks}{" "}
              {client.changes.closed_tasks === 1
                ? "tarea cerrada"
                : "tareas cerradas"}{" "}
              {sinceLabel}.
            </li>
          </ul>
          {client.changes.since_kind === "window" ? (
            <p className="mt-4 text-xs text-muted">
              Aún no has marcado ninguna revisión de este cliente, así que la
              actividad se cuenta desde el inicio del periodo.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decidir ahora</CardTitle>
          <CardDescription>Como mucho tres cosas. Cada una abre el módulo donde se ejecuta.</CardDescription>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <EmptyState size="sm" title="Nada pendiente de decisión en este cliente" />
          ) : (
            <ul className="mt-4 divide-y divide-separator">
              {actions.slice(0, 3).map((action) => (
                <li key={action.id}>
                  <ActionRow action={action} onDecided={onReviewed} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Camino y compromisos</CardTitle>
          <CardDescription>Fase activa, siguiente hito y progreso real del plan.</CardDescription>
          <CardAction><ButtonLink
            href={withPortalRouteContext("/camino", client.organization_id, client.camino?.connection_id)}
            size="sm"
            variant="ghost"
          >
            Abrir Mi Camino
          </ButtonLink></CardAction>
        </CardHeader>
        <CardContent>
          {!client.camino ? (
            <p className="mt-4 text-[13px] text-muted">
              {client.camino_notice ?? "Este cliente aún no tiene una fase activa en su plan estratégico."}
            </p>
          ) : (
            <div className="mt-4 space-y-2 text-[13px] leading-relaxed text-foreground">
              <p>
                Fase activa:{" "}
                <span className="font-medium">{client.camino.phase_name}</span> (
                {client.camino.milestones_done}/{client.camino.milestones_total}{" "}
                hitos completados)
              </p>
              <p>
                Siguiente hito:{" "}
                {client.camino.next_milestone
                  ? `${client.camino.next_milestone.name}${
                    client.camino.next_milestone.target_date
                      ? ` · ${client.camino.next_milestone.target_date}`
                      : " · sin fecha"
                  }`
                  : "sin hitos pendientes"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Relación y próxima conversación</CardTitle>
          <CardDescription>Con qué contexto llegas a la siguiente llamada.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-foreground">
            <li>
              Próxima llamada:{" "}
              {client.relationship.next_call
                ? `${client.relationship.next_call.title} · ${formatDateTime(client.relationship.next_call.scheduled_at)}`
                : "nada agendado"}
            </li>
            <li>
              Última llamada:{" "}
              {client.relationship.last_call
                ? `${client.relationship.last_call.title} · ${formatDateTime(client.relationship.last_call.held_at)}${
                  client.relationship.last_call.summary_pending
                    ? " · resumen pendiente de aprobar"
                    : ""
                }`
                : "sin llamadas realizadas"}
            </li>
            <li>
              Mensajes sin leer: {client.relationship.unread_count}
              {client.relationship.counterpart_name
                ? ` · interlocutor: ${client.relationship.counterpart_name}`
                : ""}
            </li>
          </ul>
          <div role="group" aria-label="Acciones del cliente" className="flex flex-wrap items-center gap-2 mt-4">
            <ButtonLink
              href={`/llamadas?organizationId=${client.organization_id}`}
              size="sm"
              variant="ghost"
            >
              Abrir Llamadas
            </ButtonLink>
            <ButtonLink
              href={`/mensajes?organizationId=${client.organization_id}`}
              size="sm"
              variant="ghost"
            >
              Abrir Mensajes
            </ButtonLink>
          </div>
        </CardContent>
      </Card>

      {upcoming.length > 0 ? <UpcomingWork items={upcoming} /> : null}

      <CollapsibleSection title="Datos y administración">
        {administration}
      </CollapsibleSection>
    </div>
  );
}
