"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { usePaginatedUrl } from "@/hooks/use-paginated-url";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { displayValue } from "@/lib/display-labels";
import {
  LoadingBlock,
  Checkbox,
  EmptyState,
  Badge,
  Button,
  Card,
  ErrorBlock,
  Input,
  List,
  Modal,
  Pagination,
  Select,
  Textarea,
  toast,
} from "@/components/ui";

const TASKS_PAGE_SIZE = 20;

type TaskComment = {
  id: string;
  body: string;
  is_internal: boolean;
  author_user_id: string;
  created_at: string;
};

type Task = {
  id: string;
  alert_id: string | null;
  source: string;
  status: string;
  priority: string;
  categories: string[];
  title: string;
  description: string | null;
  due_at: string | null;
  is_visible_to_client: boolean;
  created_at: string;
  updated_at: string;
  task_comments: TaskComment[];
};

type Alert = {
  id: string;
  status: string;
  severity: string;
  title: string;
  message: string;
  metric_value: number | null;
  first_detected_at: string;
  last_detected_at: string;
  resolved_at: string | null;
};

type OperationsResponse = {
  organization_id: string;
  tasks: Task[];
  alerts: Alert[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  ignored: "Ignorada",
  cancelled: "Cancelada",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

const CATEGORY_LABELS: Record<string, string> = {
  shopify: "Shopify",
  meta: "Meta Ads",
  klaviyo: "Klaviyo",
  general: "General",
};

const SEVERITY_TONE: Record<string, "neutral" | "warn" | "danger"> = {
  info: "neutral",
  low: "neutral",
  medium: "warn",
  high: "danger",
  critical: "danger",
};

const SEVERITY_LABELS: Record<string, string> = {
  info: "Informativa",
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

// DB-07: SLA de overdue formalizado -- una tarea esta vencida si su
// due_at ya paso y sigue abierta (pending/in_progress); el mismo criterio
// que calcula "overdue_tasks" para el health score del panel de consultor
// (consultant.ts), aplicado aqui por primera vez a la vista del cliente que
// gestiona la tarea (antes due_at se guardaba y viajaba en la respuesta de
// la API pero nunca se mostraba).
function isTaskOverdue(task: Task) {
  return (
    Boolean(task.due_at) &&
    ["pending", "in_progress"].includes(task.status) &&
    Date.parse(task.due_at as string) < Date.now()
  );
}

function formatDueDate(dueAt: string) {
  return new Date(dueAt).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function TaskDetail({
  task,
  showVisibility,
  commentDraft,
  onCommentChange,
  canMarkInternal,
  isInternalDraft,
  onInternalChange,
  onSubmitComment,
  onStatusChange,
}: {
  task: Task;
  showVisibility: boolean;
  commentDraft: string;
  onCommentChange: (value: string) => void;
  canMarkInternal: boolean;
  isInternalDraft: boolean;
  onInternalChange: (value: boolean) => void;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
  onStatusChange: (status: string) => void;
}) {
  const meta = [
    task.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" · "),
    PRIORITY_LABELS[task.priority] ?? task.priority,
    STATUS_LABELS[task.status] ?? task.status,
    task.source === "alert" ? "desde alerta" : null,
    task.due_at ? `vence ${formatDueDate(task.due_at)}` : null,
    isTaskOverdue(task) ? "vencida" : null,
    showVisibility && !task.is_visible_to_client ? "interna" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-black">{task.title}</p>
          <p className="mt-1 text-xs text-muted">{meta.join(" · ")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {task.status === "pending" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange("in_progress")}
            >
              Empezar
            </Button>
          ) : null}
          {["pending", "in_progress"].includes(task.status) ? (
            <>
              <Button size="sm" onClick={() => onStatusChange("completed")}>
                Completar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStatusChange("ignored")}
              >
                Ignorar
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {task.description ? (
        <p className="text-[13px] leading-relaxed text-black">
          {task.description}
        </p>
      ) : null}

      <div className="border-t border-edge pt-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Comentarios
          {task.task_comments.length > 0
            ? ` (${task.task_comments.length})`
            : ""}
        </p>

        {task.task_comments.length > 0 ? (
          <ul className="mt-2 space-y-3">
            {task.task_comments.map((comment) => (
              <li key={comment.id}>
                <p className="text-[13px] leading-relaxed text-black">
                  {comment.body}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {comment.is_internal ? "interno · " : ""}
                  {new Date(comment.created_at).toLocaleString("es-ES")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-muted">
            Sin comentarios todavía.
          </p>
        )}

        <form className="mt-3 space-y-2" onSubmit={onSubmitComment}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="min-w-0 flex-1"
              aria-label={`Comentario para la tarea ${task.title}`}
              value={commentDraft}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="Añadir comentario..."
            />
            <Button
              variant="secondary"
              type="submit"
              className="w-full sm:w-auto"
            >
              Comentar
            </Button>
          </div>
          {canMarkInternal ? (
            <Checkbox checked={isInternalDraft} onChange={onInternalChange}>
              Comentario interno (el cliente no lo verá)
            </Checkbox>
          ) : null}
        </form>
      </div>
    </div>
  );
}

// Alta manual (FE-03: el modulo de tareas no tenia forma de anadir un
// pendiente ad-hoc -- solo llegaban desde reglas de alertas, IA, llamadas o
// Mi Camino). El checkbox de visibilidad solo aparece para consultor/admin;
// una tarea que crea el propio cliente siempre es visible para si mismo.
function NewTaskForm({
  canMarkInternal,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  canMarkInternal: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    priority: string;
    category: string;
    dueAt: string;
    isVisibleToClient: boolean;
  }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");
  const [dueAt, setDueAt] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    const created = await onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      dueAt,
      isVisibleToClient: !isInternal,
    });
    if (created) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCategory("general");
      setDueAt("");
      setIsInternal(false);
    }
  }

  return (
    <Card>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <Input
          aria-label="Titulo de la tarea"
          placeholder="Titulo de la tarea"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <Textarea
          aria-label="Descripcion de la tarea"
          placeholder="Descripcion (opcional)"
          className="h-20"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Prioridad"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "low", label: "Baja" },
              { value: "medium", label: "Media" },
              { value: "high", label: "Alta" },
              { value: "urgent", label: "Urgente" },
            ]}
          />
          <Select
            aria-label="Modulo"
            value={category}
            onChange={setCategory}
            options={[
              { value: "shopify", label: "Shopify" },
              { value: "meta", label: "Meta Ads" },
              { value: "klaviyo", label: "Klaviyo" },
              { value: "general", label: "General" },
            ]}
          />
          <Input
            type="date"
            aria-label="Fecha limite"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="w-40"
          />
        </div>
        {canMarkInternal ? (
          <Checkbox checked={isInternal} onChange={setIsInternal}>
            Tarea interna (el cliente no la verá)
          </Checkbox>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={isSubmitting || !title.trim()}>
            {isSubmitting ? "Creando..." : "Crear tarea"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Escala tipografica del modulo (una sola en toda la app):
//  - Titulo de fila:        text-sm font-medium text-black
//  - Cuerpo / descripcion:  text-[13px] text-muted leading-relaxed
//  - Meta (fecha, modulo):  text-xs text-muted   (sin font-mono: era ruido)
// La jerarquia la da el contraste tamano+peso+color, no poner todo a
// `text-sm text-muted` (que es como estaba: "se lee todo igual").

type TabDef = { value: string; label: string; count?: number };

function TabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-edge">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(tab.value)}
            className={[
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-brand font-medium text-black"
                : "border-transparent text-muted hover:text-black",
            ].join(" ")}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className="ml-1.5 text-xs text-muted">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// Fila compacta de tarea: lo justo para escanear (titulo + una senal de
// prioridad/vencimiento + meta en una linea). El detalle completo
// (descripcion, comentarios, mas acciones) vive en el modal, no bajo cada
// fila -- antes cada fila traia su propio formulario de comentario y todos
// los badges, y 20 de esas era el "descontrol".
function TaskRow({
  task,
  showVisibility,
  clientName,
  isPending,
  onStatusChange,
  onOpenDetail,
}: {
  task: Task;
  showVisibility: boolean;
  clientName?: string;
  isPending: boolean;
  onStatusChange: (status: string) => void;
  onOpenDetail: () => void;
}) {
  const overdue = isTaskOverdue(task);
  const priorityBadge =
    task.priority === "urgent"
      ? ({ tone: "danger", label: PRIORITY_LABELS.urgent } as const)
      : task.priority === "high"
        ? ({ tone: "warn", label: PRIORITY_LABELS.high } as const)
        : null;

  const meta = [
    clientName ?? null,
    task.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" · "),
    STATUS_LABELS[task.status] ?? task.status,
    task.source === "alert" ? "desde alerta" : null,
    task.due_at ? `vence ${formatDueDate(task.due_at)}` : null,
    task.task_comments.length > 0
      ? `${task.task_comments.length} coment.`
      : null,
    showVisibility && !task.is_visible_to_client ? "interna" : null,
  ].filter(Boolean);

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {overdue ? (
            <Badge tone="danger">Vencida</Badge>
          ) : priorityBadge ? (
            <Badge tone={priorityBadge.tone}>{priorityBadge.label}</Badge>
          ) : null}
          <p className="truncate text-sm font-medium text-black">
            {task.title}
          </p>
        </div>
        <p className="mt-0.5 text-xs text-muted">{meta.join(" · ")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {task.status === "pending" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => onStatusChange("in_progress")}
          >
            Empezar
          </Button>
        ) : null}
        {["pending", "in_progress"].includes(task.status) ? (
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => onStatusChange("completed")}
          >
            {isPending ? "..." : "Completar"}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onOpenDetail}>
          Detalle
        </Button>
      </div>
    </div>
  );
}

// --- Estado "vista general" de /tareas (consultor sin cliente activo):
// tareas y alertas de toda la cartera, mismos filtros + filtro por cliente. ---

type PortfolioTask = Task & {
  organization_id: string;
  organization_name: string;
};
type PortfolioAlert = Alert & {
  organization_id: string;
  organization_name: string;
};
type ConsultantOperations = {
  organizations: Array<{ id: string; display_name: string }>;
  tasks: PortfolioTask[];
  alerts: PortfolioAlert[];
};

function ConsultantOperationsView({ isConsultant }: { isConsultant: boolean }) {
  const [data, setData] = useState<ConsultantOperations | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<"tasks" | "alerts">("tasks");
  const [statusFilter, setStatusFilter] = useState("open");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentInternalDrafts, setCommentInternalDrafts] = useState<
    Record<string, boolean>
  >({});

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/v1/consultant/operations");
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setData((await response.json()) as ConsultantOperations);
      setError(null);
    } catch {
      setError("No se pudieron cargar las operaciones por un error de red.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeTaskStatus(
    organizationId: string,
    taskId: string,
    status: string,
  ) {
    setPendingTaskId(taskId);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/tasks/${taskId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success(`Tarea marcada como «${STATUS_LABELS[status] ?? status}».`);
      void load();
    } catch {
      setError("No se pudo actualizar la tarea por un error de red.");
    } finally {
      setPendingTaskId(null);
    }
  }

  async function submitComment(
    event: FormEvent<HTMLFormElement>,
    organizationId: string,
    taskId: string,
  ) {
    event.preventDefault();
    const body = commentDrafts[taskId]?.trim();
    if (!body) return;
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body,
            isInternal: Boolean(commentInternalDrafts[taskId]),
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setCommentDrafts((drafts) => ({ ...drafts, [taskId]: "" }));
      setCommentInternalDrafts((drafts) => ({ ...drafts, [taskId]: false }));
      toast.success("Comentario añadido.");
      void load();
    } catch {
      setError("No se pudo añadir el comentario por un error de red.");
    }
  }

  async function changeAlertStatus(
    organizationId: string,
    alertId: string,
    status: string,
  ) {
    setPendingAlertId(alertId);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/alerts/${alertId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Estado de la alerta actualizado.");
      void load();
    } catch {
      setError("No se pudo actualizar la alerta por un error de red.");
    } finally {
      setPendingAlertId(null);
    }
  }

  if (isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando tareas de la cartera..." />
      </div>
    );
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTasks = (data?.tasks ?? []).filter((task) => {
    if (clientFilter !== "all" && task.organization_id !== clientFilter)
      return false;
    if (categoryFilter !== "all" && !task.categories.includes(categoryFilter))
      return false;
    if (
      statusFilter === "open" &&
      !["pending", "in_progress"].includes(task.status)
    )
      return false;
    if (
      statusFilter !== "open" &&
      statusFilter !== "all" &&
      task.status !== statusFilter
    )
      return false;
    if (
      normalizedQuery &&
      !task.title.toLowerCase().includes(normalizedQuery) &&
      !(task.description ?? "").toLowerCase().includes(normalizedQuery)
    )
      return false;
    return true;
  });

  const sortedTasks = filteredTasks.slice().sort((a, b) => {
    const overdueDelta = Number(isTaskOverdue(b)) - Number(isTaskOverdue(a));
    if (overdueDelta !== 0) return overdueDelta;
    const priorityDelta =
      (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
    if (priorityDelta !== 0) return priorityDelta;
    if (a.due_at && b.due_at) return Date.parse(a.due_at) - Date.parse(b.due_at);
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });

  const activeAlerts = (data?.alerts ?? []).filter(
    (alert) =>
      ["open", "acknowledged"].includes(alert.status) &&
      (clientFilter === "all" || alert.organization_id === clientFilter),
  );

  const detailTask = detailTaskId
    ? filteredTasks.find((task) => task.id === detailTaskId) ?? null
    : null;

  const clientOptions = [
    { value: "all", label: "Todos los clientes" },
    ...(data?.organizations ?? []).map((organization) => ({
      value: organization.id,
      label: organization.display_name,
    })),
  ];

  return (
    <div className="portal-page space-y-5">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <TabBar
        tabs={[
          { value: "tasks", label: "Tareas", count: filteredTasks.length },
          { value: "alerts", label: "Alertas", count: activeAlerts.length },
        ]}
        value={tab}
        onChange={(value) => setTab(value as "tasks" | "alerts")}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-full sm:w-64"
          type="search"
          aria-label="Buscar tarea"
          placeholder="Buscar por título o descripción..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <Select
          className="w-48"
          aria-label="Filtrar por cliente"
          value={clientFilter}
          onChange={setClientFilter}
          options={clientOptions}
        />
        {tab === "tasks" ? (
          <>
            <Select
              className="w-44"
              aria-label="Filtrar por estado"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "open", label: "Abiertas" },
                { value: "pending", label: "Pendientes" },
                { value: "in_progress", label: "En curso" },
                { value: "completed", label: "Completadas" },
                { value: "ignored", label: "Ignoradas" },
                { value: "all", label: "Todas" },
              ]}
            />
            <Select
              className="w-40"
              aria-label="Filtrar por módulo"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "all", label: "Todos los módulos" },
                { value: "shopify", label: "Shopify" },
                { value: "meta", label: "Meta Ads" },
                { value: "klaviyo", label: "Klaviyo" },
                { value: "general", label: "General" },
              ]}
            />
          </>
        ) : null}
      </div>

      {tab === "tasks" ? (
        <Card>
          {sortedTasks.length === 0 ? (
            <EmptyState
              title="Sin tareas para este filtro"
              hint="Prueba otro filtro o abre un cliente para crear una."
            />
          ) : (
            <List>
              {sortedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  showVisibility={isConsultant}
                  clientName={task.organization_name}
                  isPending={pendingTaskId === task.id}
                  onStatusChange={(status) =>
                    void changeTaskStatus(task.organization_id, task.id, status)
                  }
                  onOpenDetail={() => setDetailTaskId(task.id)}
                />
              ))}
            </List>
          )}
        </Card>
      ) : (
        <Card>
          {activeAlerts.length === 0 ? (
            <EmptyState
              title="Sin alertas activas en la cartera"
              hint="Las alertas se generan al evaluar las reglas de cada cliente."
            />
          ) : (
            <List>
              {activeAlerts.map((alert) => {
                const busy = pendingAlertId === alert.id;
                return (
                  <List.Item
                    key={alert.id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={SEVERITY_TONE[alert.severity] ?? "neutral"}>
                          {SEVERITY_LABELS[alert.severity] ?? alert.severity}
                        </Badge>
                        <p className="text-sm font-medium text-black">
                          {alert.title}
                        </p>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted">
                        {alert.message}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {alert.organization_name} · detectada{" "}
                        {new Date(alert.first_detected_at).toLocaleDateString(
                          "es-ES",
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {alert.status === "open" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void changeAlertStatus(
                              alert.organization_id,
                              alert.id,
                              "acknowledged",
                            )
                          }
                        >
                          Marcar vista
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void changeAlertStatus(
                            alert.organization_id,
                            alert.id,
                            "resolved",
                          )
                        }
                      >
                        {busy ? "..." : "Resolver"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          void changeAlertStatus(
                            alert.organization_id,
                            alert.id,
                            "dismissed",
                          )
                        }
                      >
                        Descartar
                      </Button>
                    </div>
                  </List.Item>
                );
              })}
            </List>
          )}
        </Card>
      )}

      {detailTask ? (
        <Modal isOpen onOpenChange={(open) => !open && setDetailTaskId(null)}>
          <Modal.Backdrop>
            <Modal.Container size="md">
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>
                    Detalle de tarea · {detailTask.organization_name}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <TaskDetail
                    task={detailTask}
                    showVisibility={isConsultant}
                    canMarkInternal={isConsultant}
                    isInternalDraft={Boolean(
                      commentInternalDrafts[detailTask.id],
                    )}
                    onInternalChange={(value) =>
                      setCommentInternalDrafts((drafts) => ({
                        ...drafts,
                        [detailTask.id]: value,
                      }))
                    }
                    commentDraft={commentDrafts[detailTask.id] ?? ""}
                    onCommentChange={(value) =>
                      setCommentDrafts((drafts) => ({
                        ...drafts,
                        [detailTask.id]: value,
                      }))
                    }
                    onSubmitComment={(event) =>
                      submitComment(
                        event,
                        detailTask.organization_id,
                        detailTask.id,
                      )
                    }
                    onStatusChange={(status) =>
                      void changeTaskStatus(
                        detailTask.organization_id,
                        detailTask.id,
                        status,
                      )
                    }
                  />
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ) : null}
    </div>
  );
}

function OperationsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  const [payload, setPayload] = useState<OperationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  // FE-03: sin buscador, encontrar una tarea concreta entre muchas exigia
  // escanear la lista/tarjetas a ojo -- filtro por titulo o descripcion.
  const [searchQuery, setSearchQuery] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [commentInternalDrafts, setCommentInternalDrafts] = useState<
    Record<string, boolean>
  >({});
  const [tab, setTab] = useState<"tasks" | "alerts">("tasks");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  // Fila con una accion en vuelo: desactiva sus botones y muestra "..." para
  // que se vea que la accion se registro (antes no habia ninguna senal hasta
  // que recargaba la lista entera).
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);

  const loadOperations = useCallback(async () => {
    if (!organization) {
      setPayload(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/operations`,
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setPayload((await response.json()) as OperationsResponse);
      setError(null);
    } catch {
      setError(
        "No se pudieron cargar las operaciones por un error de red. Reintenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  async function evaluateRules() {
    if (!organization) {
      return;
    }

    setIsEvaluating(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/operations/run-rules`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      void loadOperations();
    } catch {
      setError(
        "No se pudieron evaluar las reglas por un error de red. Reintenta.",
      );
    } finally {
      setIsEvaluating(false);
    }
  }

  async function changeTaskStatus(taskId: string, status: string) {
    if (!organization) {
      return;
    }

    setError(null);
    setPendingTaskId(taskId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/tasks/${taskId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      toast.success(`Tarea marcada como «${STATUS_LABELS[status] ?? status}».`);
      void loadOperations();
    } catch {
      setError(
        "No se pudo actualizar la tarea por un error de red. Reintenta.",
      );
    } finally {
      setPendingTaskId(null);
    }
  }

  async function submitComment(
    event: FormEvent<HTMLFormElement>,
    taskId: string,
  ) {
    event.preventDefault();

    if (!organization) {
      return;
    }

    const body = commentDrafts[taskId]?.trim();

    if (!body) {
      return;
    }

    const isInternal = Boolean(commentInternalDrafts[taskId]);

    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, isInternal }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setCommentDrafts((drafts) => ({ ...drafts, [taskId]: "" }));
      setCommentInternalDrafts((drafts) => ({ ...drafts, [taskId]: false }));
      toast.success("Comentario añadido.");
      void loadOperations();
    } catch {
      setError(
        "No se pudo añadir el comentario por un error de red. Reintenta.",
      );
    }
  }

  async function createTaskManual(input: {
    title: string;
    description: string;
    priority: string;
    category: string;
    dueAt: string;
    isVisibleToClient: boolean;
  }) {
    if (!organization) {
      return false;
    }

    setIsSubmittingTask(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: input.title,
            description: input.description || null,
            priority: input.priority,
            category: input.category,
            dueAt: input.dueAt || null,
            isVisibleToClient: input.isVisibleToClient,
          }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return false;
      }

      toast.success("Tarea creada.");
      void loadOperations();
      return true;
    } catch {
      setError("No se pudo crear la tarea por un error de red. Reintenta.");
      return false;
    } finally {
      setIsSubmittingTask(false);
    }
  }

  async function changeAlertStatus(alertId: string, status: string) {
    if (!organization) {
      return;
    }

    setError(null);
    setPendingAlertId(alertId);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/alerts/${alertId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      toast.success("Estado de la alerta actualizado.");
      void loadOperations();
    } catch {
      setError(
        "No se pudo actualizar la alerta por un error de red. Reintenta.",
      );
    } finally {
      setPendingAlertId(null);
    }
  }

  const activeAlerts = (payload?.alerts ?? []).filter((alert) =>
    ["open", "acknowledged"].includes(alert.status),
  );
  const resolvedAlerts = (payload?.alerts ?? []).filter(
    (alert) => !["open", "acknowledged"].includes(alert.status),
  );

  const normalizedTaskQuery = searchQuery.trim().toLowerCase();

  const filteredTasks = (payload?.tasks ?? []).filter((task) => {
    if (categoryFilter !== "all" && !task.categories.includes(categoryFilter)) {
      return false;
    }
    if (
      statusFilter === "open" &&
      !["pending", "in_progress"].includes(task.status)
    ) {
      return false;
    }
    if (
      statusFilter !== "open" &&
      statusFilter !== "all" &&
      task.status !== statusFilter
    ) {
      return false;
    }
    if (
      normalizedTaskQuery &&
      !task.title.toLowerCase().includes(normalizedTaskQuery) &&
      !(task.description ?? "").toLowerCase().includes(normalizedTaskQuery)
    ) {
      return false;
    }
    return true;
  });

  // Antes el orden era el que devolviera la API (created_at desc) sin
  // importar prioridad ni vencimiento -- una tarea urgente podia quedar
  // enterrada en la pagina 3. Vencidas primero, luego por prioridad, luego la
  // que vence antes; a igualdad, la mas reciente arriba (orden original).
  const sortedTasks = filteredTasks.slice().sort((a, b) => {
    const overdueDelta = Number(isTaskOverdue(b)) - Number(isTaskOverdue(a));
    if (overdueDelta !== 0) return overdueDelta;

    const priorityDelta =
      (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
    if (priorityDelta !== 0) return priorityDelta;

    if (a.due_at && b.due_at) {
      return Date.parse(a.due_at) - Date.parse(b.due_at);
    }
    if (a.due_at) return -1;
    if (b.due_at) return 1;

    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });

  const tasksPage = usePaginatedUrl(sortedTasks, TASKS_PAGE_SIZE);

  const detailTask = detailTaskId
    ? filteredTasks.find((task) => task.id === detailTaskId) ?? null
    : null;

  return (
    <div className="portal-page space-y-5">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <TabBar
        tabs={[
          { value: "tasks", label: "Tareas", count: filteredTasks.length },
          { value: "alerts", label: "Alertas", count: activeAlerts.length },
        ]}
        value={tab}
        onChange={(value) => setTab(value as "tasks" | "alerts")}
      />

      {isLoading ? (
        <LoadingBlock label="Cargando tareas y alertas..." />
      ) : tab === "tasks" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-full sm:w-64"
              type="search"
              aria-label="Buscar tarea"
              placeholder="Buscar por título o descripción..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <Select
              className="w-44"
              aria-label="Filtrar por estado"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "open", label: "Abiertas" },
                { value: "pending", label: "Pendientes" },
                { value: "in_progress", label: "En curso" },
                { value: "completed", label: "Completadas" },
                { value: "ignored", label: "Ignoradas" },
                { value: "all", label: "Todas" },
              ]}
            />
            <Select
              className="w-40"
              aria-label="Filtrar por módulo"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "all", label: "Todos los módulos" },
                { value: "shopify", label: "Shopify" },
                { value: "meta", label: "Meta Ads" },
                { value: "klaviyo", label: "Klaviyo" },
                { value: "general", label: "General" },
              ]}
            />
            <Button
              type="button"
              variant="secondary"
              className="ml-auto"
              onClick={() => setIsCreatingTask((value) => !value)}
            >
              {isCreatingTask ? "Cerrar" : "Nueva tarea"}
            </Button>
          </div>

          {isCreatingTask ? (
            <NewTaskForm
              canMarkInternal={isConsultant}
              isSubmitting={isSubmittingTask}
              onCancel={() => setIsCreatingTask(false)}
              onSubmit={async (payload) => {
                const created = await createTaskManual(payload);
                if (created) setIsCreatingTask(false);
                return created;
              }}
            />
          ) : null}

          <Card>
            {filteredTasks.length === 0 ? (
              <EmptyState
                title="Sin tareas para este filtro"
                hint="Prueba otro filtro, o crea una con «Nueva tarea»."
              />
            ) : (
              <>
                <List>
                  {tasksPage.pageItems.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      showVisibility={isConsultant}
                      isPending={pendingTaskId === task.id}
                      onStatusChange={(status) =>
                        void changeTaskStatus(task.id, status)
                      }
                      onOpenDetail={() => setDetailTaskId(task.id)}
                    />
                  ))}
                </List>
                <Pagination
                  className="mt-3"
                  page={tasksPage.page}
                  pageCount={tasksPage.pageCount}
                  onChange={tasksPage.setPage}
                />
              </>
            )}
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {activeAlerts.length} activa{activeAlerts.length === 1 ? "" : "s"}
              {resolvedAlerts.length > 0
                ? ` · ${resolvedAlerts.length} resuelta${
                    resolvedAlerts.length === 1 ? "" : "s"
                  }`
                : ""}
            </p>
            <Button
              type="button"
              onClick={() => void evaluateRules()}
              disabled={isEvaluating}
            >
              {isEvaluating ? "Evaluando..." : "Evaluar reglas ahora"}
            </Button>
          </div>

          <Card>
            {activeAlerts.length === 0 ? (
              <EmptyState
                title="Sin alertas activas"
                hint="Pulsa «Evaluar reglas ahora» para comprobar los datos actuales."
              />
            ) : (
              <List>
                {activeAlerts.map((alert) => {
                  const busy = pendingAlertId === alert.id;
                  return (
                    <List.Item
                      key={alert.id}
                      className="flex flex-wrap items-start justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            tone={SEVERITY_TONE[alert.severity] ?? "neutral"}
                          >
                            {SEVERITY_LABELS[alert.severity] ?? alert.severity}
                          </Badge>
                          <p className="text-sm font-medium text-black">
                            {alert.title}
                          </p>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">
                          {alert.message}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          detectada{" "}
                          {new Date(
                            alert.first_detected_at,
                          ).toLocaleDateString("es-ES")}
                          {" · última vez "}
                          {new Date(
                            alert.last_detected_at,
                          ).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {alert.status === "open" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void changeAlertStatus(alert.id, "acknowledged")
                            }
                          >
                            Marcar vista
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void changeAlertStatus(alert.id, "resolved")
                          }
                        >
                          {busy ? "..." : "Resolver"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void changeAlertStatus(alert.id, "dismissed")
                          }
                        >
                          Descartar
                        </Button>
                      </div>
                    </List.Item>
                  );
                })}
              </List>
            )}
          </Card>

          {resolvedAlerts.length > 0 ? (
            <Card title="Resueltas recientes">
              <List>
                {resolvedAlerts.slice(0, 20).map((alert) => (
                  <List.Item key={alert.id} className="py-2.5">
                    <p className="text-sm text-black">{alert.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {displayValue(alert.status)}
                      {alert.resolved_at
                        ? ` · ${new Date(alert.resolved_at).toLocaleDateString("es-ES")}`
                        : ""}
                    </p>
                  </List.Item>
                ))}
              </List>
            </Card>
          ) : null}
        </div>
      )}

      {detailTask ? (
        <Modal
          isOpen
          onOpenChange={(open) => !open && setDetailTaskId(null)}
        >
          <Modal.Backdrop>
            <Modal.Container size="md">
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Detalle de tarea</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <TaskDetail
                    task={detailTask}
                    showVisibility={isConsultant}
                    canMarkInternal={isConsultant}
                    isInternalDraft={Boolean(
                      commentInternalDrafts[detailTask.id],
                    )}
                    onInternalChange={(value) =>
                      setCommentInternalDrafts((drafts) => ({
                        ...drafts,
                        [detailTask.id]: value,
                      }))
                    }
                    commentDraft={commentDrafts[detailTask.id] ?? ""}
                    onCommentChange={(value) =>
                      setCommentDrafts((drafts) => ({
                        ...drafts,
                        [detailTask.id]: value,
                      }))
                    }
                    onSubmitComment={(event) =>
                      submitComment(event, detailTask.id)
                    }
                    onStatusChange={(status) =>
                      void changeTaskStatus(detailTask.id, status)
                    }
                  />
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ) : null}
    </div>
  );
}

function TasksRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  // Consultor sin cliente activo -> tareas/alertas de toda la cartera.
  if (isConsultant && !organizationId) {
    return <ConsultantOperationsView isConsultant={isConsultant} />;
  }

  return <OperationsContent bootstrap={bootstrap} />;
}

export default function TasksPage() {
  return (
    <PortalShell title="Tareas y alertas">
      {(bootstrap) => <TasksRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
