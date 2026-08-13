"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { usePaginatedUrl } from "@/hooks/use-paginated-url";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  EmptyState,
  Heading,
  Badge,
  Button,
  Card,
  ErrorBlock,
  Input,
  LoadingBlock,
  Modal,
  Pagination,
  Select,
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
  category: string;
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

// Badges + acciones + comentarios de una tarea: se usa tanto en la fila de la
// vista de lista como dentro del modal de detalle de la vista de tarjetas,
// para no duplicar la logica de estado/comentarios en dos sitios.
function TaskBadges({ task }: { task: Task }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="neutral">
        {CATEGORY_LABELS[task.category] ?? task.category}
      </Badge>
      <Badge tone="neutral">
        {PRIORITY_LABELS[task.priority] ?? task.priority}
      </Badge>
      <Badge tone="neutral">{STATUS_LABELS[task.status] ?? task.status}</Badge>
      {task.source === "alert" ? (
        <Badge tone="brand">desde alerta</Badge>
      ) : null}
      {isTaskOverdue(task) ? <Badge tone="danger">Vencida</Badge> : null}
    </div>
  );
}

function TaskDetail({
  task,
  commentDraft,
  onCommentChange,
  onSubmitComment,
  onStatusChange,
}: {
  task: Task;
  commentDraft: string;
  onCommentChange: (value: string) => void;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
  onStatusChange: (status: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <TaskBadges task={task} />
          <p className="mt-2 font-medium">{task.title}</p>
          {task.description ? (
            <p className="mt-1 text-sm leading-6 text-muted">
              {task.description}
            </p>
          ) : null}
          {task.due_at ? (
            <p className="mt-1 font-mono text-xs text-muted">
              vence {formatDueDate(task.due_at)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {task.status === "pending" ? (
            <Button
              variant="secondary"
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
                variant="secondary"
                size="sm"
                onClick={() => onStatusChange("ignored")}
              >
                Ignorar
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {task.task_comments.length > 0 ? (
        <div className="mt-3 space-y-2 border-l-2 border-line pl-3">
          {task.task_comments.map((comment) => (
            <div key={comment.id} className="text-sm">
              <p className="leading-6">{comment.body}</p>
              <p className="font-mono text-xs text-muted">
                {comment.is_internal ? "interno · " : ""}
                {new Date(comment.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <form className="mt-3 flex gap-2" onSubmit={onSubmitComment}>
        <Input
          className="min-w-0 flex-1"
          aria-label={`Comentario para la tarea ${task.title}`}
          value={commentDraft}
          onChange={(event) => onCommentChange(event.target.value)}
          placeholder="Añadir comentario..."
        />
        <Button variant="secondary" type="submit">
          Comentar
        </Button>
      </form>
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
  const [viewMode, setViewMode] = useState<"list" | "cards">("cards");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const loadOperations = useCallback(async () => {
    if (!organization) {
      return;
    }

    setIsLoading(true);
    const response = await apiFetch(
      `/v1/organizations/${organization.id}/operations`,
    );

    if (!response.ok) {
      setError(await readApiError(response));
      setIsLoading(false);
      return;
    }

    setPayload((await response.json()) as OperationsResponse);
    setError(null);
    setIsLoading(false);
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

    const response = await apiFetch(
      `/v1/organizations/${organization.id}/operations/run-rules`,
      {
        method: "POST",
      },
    );

    if (!response.ok) {
      setError(await readApiError(response));
    }

    setIsEvaluating(false);
    void loadOperations();
  }

  async function changeTaskStatus(taskId: string, status: string) {
    if (!organization) {
      return;
    }

    setError(null);
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

    toast.success("Estado de la tarea actualizado.");
    void loadOperations();
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

    const response = await apiFetch(
      `/v1/organizations/${organization.id}/tasks/${taskId}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    setCommentDrafts((drafts) => ({ ...drafts, [taskId]: "" }));
    toast.success("Comentario añadido.");
    void loadOperations();
  }

  async function changeAlertStatus(alertId: string, status: string) {
    if (!organization) {
      return;
    }

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
  }

  const activeAlerts = (payload?.alerts ?? []).filter((alert) =>
    ["open", "acknowledged"].includes(alert.status),
  );
  const resolvedAlerts = (payload?.alerts ?? []).filter(
    (alert) => !["open", "acknowledged"].includes(alert.status),
  );

  const normalizedTaskQuery = searchQuery.trim().toLowerCase();

  const filteredTasks = (payload?.tasks ?? []).filter((task) => {
    if (categoryFilter !== "all" && task.category !== categoryFilter) {
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

  const tasksPage = usePaginatedUrl(filteredTasks, TASKS_PAGE_SIZE);

  return (
    <div className="space-y-4">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/20 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="search"
            aria-label="Buscar tarea"
            placeholder="Buscar por título o descripción..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-56"
          />
          <Select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "open", label: "Abiertas (pendiente + en curso)" },
              { value: "pending", label: "Pendientes" },
              { value: "in_progress", label: "En curso" },
              { value: "completed", label: "Completadas" },
              { value: "ignored", label: "Ignoradas" },
              { value: "all", label: "Todas" },
            ]}
          />
          <Select
            aria-label="Filtrar por modulo"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: "all", label: "Todos los modulos" },
              { value: "shopify", label: "Shopify" },
              { value: "meta", label: "Meta Ads" },
              { value: "klaviyo", label: "Klaviyo" },
              { value: "general", label: "General" },
            ]}
          />
        </div>
        <Button
          type="button"
          onClick={() => void evaluateRules()}
          disabled={isEvaluating}
        >
          {isEvaluating ? "Evaluando..." : "Evaluar reglas ahora"}
        </Button>
      </section>

      {isLoading ? (
        <LoadingBlock label="Cargando tareas y alertas..." />
      ) : (
        <>
          <section className="border-t border-ink/20">
            <div className="border-b border-line px-4 py-3">
              <Heading size="lg">
                Alertas activas ({activeAlerts.length})
              </Heading>
            </div>
            <div className="divide-y divide-line">
              {activeAlerts.length === 0 ? (
                <EmptyState
                  title="Sin alertas activas"
                  hint="Pulsa «Evaluar reglas ahora» para comprobar los datos actuales."
                  action={
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void evaluateRules()}
                      disabled={isEvaluating}
                    >
                      {isEvaluating ? "Evaluando..." : "Evaluar reglas"}
                    </Button>
                  }
                />
              ) : (
                activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          tone={SEVERITY_TONE[alert.severity] ?? "neutral"}
                        >
                          {alert.severity}
                        </Badge>
                        <p className="font-medium">{alert.title}</p>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {alert.message}
                      </p>
                      <p className="mt-1 font-mono text-xs text-muted">
                        detectada{" "}
                        {new Date(alert.first_detected_at).toLocaleString()} ·
                        última vez{" "}
                        {new Date(alert.last_detected_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {alert.status === "open" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() =>
                            void changeAlertStatus(alert.id, "acknowledged")
                          }
                        >
                          Vista
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() =>
                          void changeAlertStatus(alert.id, "dismissed")
                        }
                      >
                        Descartar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="border-t border-ink/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <Heading size="lg">Tareas ({filteredTasks.length})</Heading>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={viewMode === "list" ? "primary" : "secondary"}
                  onClick={() => setViewMode("list")}
                >
                  Lista
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "cards" ? "primary" : "secondary"}
                  onClick={() => setViewMode("cards")}
                >
                  Tarjetas
                </Button>
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <EmptyState
                title="Sin tareas para este filtro"
                hint="Prueba otro filtro o crea una tarea desde una recomendación."
              />
            ) : viewMode === "list" ? (
              <div className="divide-y divide-line">
                {tasksPage.pageItems.map((task) => (
                  <div key={task.id} className="px-4 py-3">
                    <TaskDetail
                      task={task}
                      commentDraft={commentDrafts[task.id] ?? ""}
                      onCommentChange={(value) =>
                        setCommentDrafts((drafts) => ({
                          ...drafts,
                          [task.id]: value,
                        }))
                      }
                      onSubmitComment={(event) => submitComment(event, task.id)}
                      onStatusChange={(status) =>
                        void changeTaskStatus(task.id, status)
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {tasksPage.pageItems.map((task) => (
                  <Card key={task.id} className="flex flex-col gap-3">
                    <TaskBadges task={task} />
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                          {task.description}
                        </p>
                      ) : null}
                      {task.due_at ? (
                        <p className="mt-1 font-mono text-xs text-muted">
                          vence {formatDueDate(task.due_at)}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-auto"
                      onClick={() => setDetailTaskId(task.id)}
                    >
                      Ver detalle
                      {task.task_comments.length > 0
                        ? ` (${task.task_comments.length})`
                        : ""}
                    </Button>
                  </Card>
                ))}
              </div>
            )}

            <Pagination
              className="mx-4 mb-3"
              page={tasksPage.page}
              pageCount={tasksPage.pageCount}
              onChange={tasksPage.setPage}
            />
          </section>

          {(() => {
            const detailTask = detailTaskId
              ? filteredTasks.find((task) => task.id === detailTaskId)
              : null;
            if (!detailTask) {
              return null;
            }
            return (
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
            );
          })()}

          {resolvedAlerts.length > 0 ? (
            <section className="border-t border-ink/20">
              <div className="border-b border-line px-4 py-3">
                <Heading size="lg">
                  Alertas resueltas ({resolvedAlerts.length})
                </Heading>
              </div>
              <div className="divide-y divide-line">
                {resolvedAlerts.slice(0, 20).map((alert) => (
                  <div key={alert.id} className="px-4 py-3">
                    <p className="text-sm">{alert.title}</p>
                    <p className="font-mono text-xs text-muted">
                      {alert.status} ·{" "}
                      {alert.resolved_at
                        ? new Date(alert.resolved_at).toLocaleString()
                        : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <PortalShell title="Tareas y alertas">
      {(bootstrap) => <OperationsContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
