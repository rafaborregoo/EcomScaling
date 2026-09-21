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
import { isWithinNextDays } from "@/lib/elapsed";
import { invalidateCachedQueries } from "@/lib/use-cached-query";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CollapsibleSection,
  EmptyState,
  Field,
  Input,
  Link,
  Metric,
  Banner,
  toast,
  type Tone,
} from "@/components/ui";

// --- Contrato con el endpoint ---------------------------------------------

export type WorkbenchActionKind =
  | "critical_alert"
  | "overdue_task"
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
};

export type PortfolioHealthRow = {
  organization_id: string;
  organization_name: string;
  status: "urgente" | "revisar" | "vigilar" | "al_dia";
  next_action: { title: string; href: string; action_label: string } | null;
  open_alerts: number;
  critical_alerts: number;
  open_tasks: number;
  overdue_tasks: number;
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
    net_sales: number;
    orders: number;
    meta_spend: number;
    meta_purchase_value: number;
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

export type DailyWorkbench = {
  window_days: number;
  generated_at: string;
  summary: {
    clients: number;
    urgent_clients: number;
    critical_alerts: number;
    overdue_tasks: number;
    pending_call_summaries: number;
    pending_ai_proposals: number;
    unread_threads: number;
    data_issues: number;
  };
  actions: WorkbenchAction[];
  portfolio: PortfolioHealthRow[];
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
  overdue_task: "Tarea vencida",
  call_approval: "Resumen de llamada",
  ai_proposal: "Propuesta IA",
  unread_message: "Mensaje",
  integration_reauth: "Integración",
  financial_coverage: "Datos",
  milestone_due: "Hito",
};

const STATUS_BADGE: Record<
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

type InboxFilter = "todo" | "urgente" | "decision" | "datos" | "semana";

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

// Un CTA de la mesa casi siempre cambia de cliente al saltar de modulo. La
// cache de paginas es por URL, no por tenant: sin vaciarla, /tareas o
// /llamadas pintan por un instante los datos del cliente anterior. Es lo
// mismo que hace el selector del shell al cambiar de organizacion.
function leaveForModule() {
  invalidateCachedQueries();
}

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
 * La cola unica de trabajo. Cada fila dice cliente, que hay que hacer, por
 * que ahora y con que evidencia; y tiene un solo CTA, al modulo que lo
 * ejecuta. El estado nunca va solo en el color: el badge lleva texto y el
 * motivo se escribe.
 */
export function DailyActionInbox({
  actions,
  emptyHint,
}: {
  actions: WorkbenchAction[];
  emptyHint?: ReactNode;
}) {
  const [filter, setFilter] = useState<InboxFilter>("todo");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () => actions.filter((action) => matchesFilter(action, filter)),
    [actions, filter],
  );
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_ROWS);

  return (
    <Card
      title="Para resolver hoy"
      description={
        actions.length === 0
          ? "No hay nada pendiente de decisión en tu cartera."
          : `${actions.length} ${actions.length === 1 ? "acción" : "acciones"} en cola, ordenadas por urgencia y por el cliente que peor va.`
      }
    >
      {actions.length > 0 ? (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar la cola de trabajo"
        >
          {INBOX_FILTERS.map((option) => {
            const count = actions.filter((action) =>
              matchesFilter(action, option.value),
            ).length;
            const active = option.value === filter;
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={active ? "primary" : "ghost"}
                aria-pressed={active}
                onClick={() => {
                  setFilter(option.value);
                  setShowAll(false);
                }}
              >
                {option.label} ({count})
              </Button>
            );
          })}
        </div>
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
        <p className="mt-4 text-[13px] text-muted">
          Nada en este filtro. Prueba con &quot;Todo&quot;.
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-separator">
            {visible.map((action) => (
              <li key={action.id}>
                <ActionRow action={action} />
              </li>
            ))}
          </ul>
          {filtered.length > INITIAL_ROWS ? (
            <div className="mt-4">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll
                  ? `Ver solo las ${INITIAL_ROWS} primeras`
                  : `Ver todo (${filtered.length})`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function ActionRow({ action }: { action: WorkbenchAction }) {
  const badge = PRIORITY_BADGE[action.priority];
  const meta = [
    KIND_LABELS[action.kind],
    action.assignee_name ? `Responsable: ${action.assignee_name}` : null,
    action.due_at ? `Vence ${formatDateTime(action.due_at)}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3">
      <div className="min-w-[15rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
          <span className="text-sm font-medium text-foreground">
            {action.organization_name}
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-foreground">
          {action.title}
        </p>
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
        <p className="mt-1 text-xs text-muted">{meta.join(" · ")}</p>
      </div>
      <div className="shrink-0">
        <ButtonLink
          href={action.href}
          size="sm"
          variant="secondary"
          onClick={leaveForModule}
        >
          {action.action_label}
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * Todos los clientes, no solo los que tienen problemas: la columna que manda
 * es "siguiente accion", no la puntuacion. Un cliente al dia tambien tiene que
 * verse, porque "no hay nada" es informacion.
 */
export function PortfolioHealthBoard({
  rows,
  onOpen,
}: {
  rows: PortfolioHealthRow[];
  onOpen: (organizationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? rows.filter((row) =>
        row.organization_name.toLowerCase().includes(normalized),
      )
    : rows;

  return (
    <Card
      title="Cartera en salud"
      description={`${rows.length} ${rows.length === 1 ? "cliente" : "clientes"} · el estado se explica con texto, no solo con color.`}
      actions={
        rows.length > 6 ? (
          <input
            type="search"
            aria-label="Buscar cliente en la cartera"
            placeholder="Buscar cliente..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-48 rounded-md border border-edge px-3 py-2 text-sm"
          />
        ) : null
      }
    >
      {filtered.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted">
          Sin resultados para &quot;{query}&quot;.
        </p>
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
              row.overdue_tasks > 0 ? `${row.overdue_tasks} vencidas` : null,
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
                <div className="flex shrink-0 flex-wrap gap-2">
                  {row.next_action ? (
                    <ButtonLink
                      href={row.next_action.href}
                      size="sm"
                      variant="ghost"
                      onClick={leaveForModule}
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
    </Card>
  );
}

/** Lo que vence o se publica en siete dias, agrupado por dia. */
export function UpcomingWork({ items }: { items: UpcomingItem[] }) {
  const byDay = useMemo(() => {
    const groups = new Map<string, UpcomingItem[]>();
    for (const item of items) {
      const key = dayKey(item.at);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return [...groups.entries()];
  }, [items]);

  return (
    <Card
      title="Próximos siete días"
      description="Tareas con fecha, hitos del plan, campañas y llamadas que hay que preparar."
    >
      {byDay.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted">
          Nada fechado en los próximos siete días.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {byDay.map(([day, dayItems]) => (
            <div key={day}>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted">
                {formatDay(`${day}T12:00:00.000Z`)}
              </p>
              <ul className="mt-2 divide-y divide-separator">
                {dayItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                  >
                    <div className="min-w-[12rem] flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {UPCOMING_LABELS[item.kind]} ·{" "}
                        {item.organization_name}
                      </p>
                    </div>
                    <ButtonLink
                      href={item.href}
                      size="sm"
                      variant="ghost"
                      onClick={leaveForModule}
                    >
                      Abrir
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
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
    net_sales: number;
    orders: number;
    meta_spend: number;
    roas: number | null;
    prev_net_sales: number;
    prev_orders: number;
    prev_meta_spend: number;
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
            value={formatMoney(business.net_sales)}
            hint={`Periodo anterior: ${formatMoney(business.prev_net_sales)}`}
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
            value={formatMoney(business.meta_spend)}
            hint={`Periodo anterior: ${formatMoney(business.prev_meta_spend)}`}
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
          <Button size="sm" disabled={isSaving} onClick={() => void submit()}>
            {isSaving ? "Guardando..." : "Confirmar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
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
export function ClientDesk({
  client,
  actions,
  upcoming,
  administration,
  onBack,
  onReviewed,
}: {
  client: ClientDeskData;
  actions: WorkbenchAction[];
  upcoming: UpcomingItem[];
  administration: ReactNode;
  onBack: () => void;
  onReviewed: () => void;
}) {
  const currency = client.currency_code ?? "EUR";
  const money = (value: number) => formatMoney(value, currency);
  const business = client.business;
  const primary = actions[0] ?? null;
  const sinceLabel =
    client.changes.since_kind === "review"
      ? `desde tu revisión del ${formatDateTime(client.changes.since)}`
      : "en el periodo";

  return (
    <div className="space-y-6">
      <Card
        kicker="Mesa de cliente"
        title={client.organization_name}
        description={
          primary
            ? `Lo primero: ${primary.title}`
            : "Sin nada pendiente de decisión en este cliente."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {primary ? (
              <ButtonLink
                href={primary.href}
                size="sm"
                variant="primary"
                onClick={leaveForModule}
              >
                {primary.action_label}
              </ButtonLink>
            ) : null}
            <Button type="button" size="sm" variant="ghost" onClick={onBack}>
              Volver a la cartera
            </Button>
          </div>
        }
      >
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
      </Card>

      <Card
        title="Estado del negocio"
        description={
          business
            ? `Últimos ${business.window_days} días, comparados con los ${business.window_days} anteriores.`
            : undefined
        }
      >
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
                  business.shopify_connected ? money(business.net_sales) : "—"
                }
                hint={
                  business.shopify_connected
                    ? deltaLabel(business.net_sales, business.prev_net_sales, money)
                    : "Shopify sin conectar"
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
                  business.shopify_connected && business.orders > 0
                    ? money(business.net_sales / business.orders)
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
                  business.meta_connected ? money(business.meta_spend) : "—"
                }
                hint={
                  business.meta_connected
                    ? deltaLabel(
                        business.meta_spend,
                        business.prev_meta_spend,
                        money,
                      )
                    : "Meta Ads sin conectar"
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
                    : "EUR atribuidos por Meta / inversión Meta"
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
            {!business.has_financial_settings ? (
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
            ) : null}
            {business.coverage.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {business.coverage.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Card>

      <Card
        title={
          client.changes.since_kind === "review"
            ? "Qué cambió desde tu última revisión"
            : "Qué cambió"
        }
        description="Variaciones materiales, no una cronología completa. Las cifras de negocio siempre comparan periodo contra periodo anterior."
        actions={
          <MarkReviewedButton
            organizationId={client.organization_id}
            lastReview={client.last_review}
            onReviewed={onReviewed}
          />
        }
      >
        <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-foreground">
          <li>
            Ventas:{" "}
            {client.changes.net_sales_delta === null
              ? "sin comparación disponible"
              : deltaLabel(
                  client.changes.net_sales_delta,
                  0,
                  money,
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
                  money,
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
      </Card>

      <Card
        title="Decidir ahora"
        description="Como mucho tres cosas. Cada una abre el módulo donde se ejecuta."
      >
        {actions.length === 0 ? (
          <p className="mt-4 text-[13px] text-muted">
            Nada pendiente de decisión en este cliente.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-separator">
            {actions.slice(0, 3).map((action) => (
              <li key={action.id}>
                <ActionRow action={action} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Camino y compromisos"
        description="Fase activa, siguiente hito y progreso real del plan."
        actions={
          <ButtonLink
            href={`/camino?organizationId=${client.organization_id}`}
            size="sm"
            variant="ghost"
          >
            Abrir Mi Camino
          </ButtonLink>
        }
      >
        {!client.camino ? (
          <p className="mt-4 text-[13px] text-muted">
            Este cliente aún no tiene una fase activa en su plan estratégico.
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
      </Card>

      <Card
        title="Relación y próxima conversación"
        description="Con qué contexto llegas a la siguiente llamada."
      >
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
        <div className="mt-4 flex flex-wrap gap-2">
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
      </Card>

      {upcoming.length > 0 ? <UpcomingWork items={upcoming} /> : null}

      <CollapsibleSection title="Datos y administración">
        {administration}
      </CollapsibleSection>
    </div>
  );
}
