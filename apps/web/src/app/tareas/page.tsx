"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { usePaginatedUrl } from "@/hooks/use-paginated-url";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { Badge, Button, Input, LoadingBlock, Pagination, Select } from "@ecomscaling/ui";

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

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-edge text-muted",
  low: "border-edge text-muted",
  medium: "border-warn text-warn-deep",
  high: "border-brand text-brand",
  critical: "border-brand bg-brand text-white",
};

// DB-07: SLA de overdue formalizado -- una tarea esta vencida si su
// due_at ya paso y sigue abierta (pending/in_progress); el mismo criterio
// que calcula "overdue_tasks" para el health score del panel de consultor
// (consultant.ts), aplicado aqui por primera vez a la vista del cliente que
// gestiona la tarea (antes due_at se guardaba y viajaba en la respuesta de
// la API pero nunca se mostraba).
function isTaskOverdue(task: Task) {
  return Boolean(task.due_at) && ["pending", "in_progress"].includes(task.status) && Date.parse(task.due_at as string) < Date.now();
}

function formatDueDate(dueAt: string) {
  return new Date(dueAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; detail?: string }
    | null;
  return [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - ");
}

function OperationsContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const organization =
    bootstrap.memberships.find((membership) => membership.organization_id === selectedOrganizationId)
      ?.organization ?? bootstrap.memberships[0]?.organization ?? null;

  const [payload, setPayload] = useState<OperationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const loadOperations = useCallback(async () => {
    if (!organization) {
      return;
    }

    setIsLoading(true);
    const response = await apiFetch(`/v1/organizations/${organization.id}/operations`);

    if (!response.ok) {
      setError(await readApiError(response));
      setIsLoading(false);
      return;
    }

    setPayload((await response.json()) as OperationsResponse);
    setError(null);
    setIsLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    void loadOperations();
  }, [loadOperations]);

  async function evaluateRules() {
    if (!organization) {
      return;
    }

    setIsEvaluating(true);
    setError(null);

    const response = await apiFetch(`/v1/organizations/${organization.id}/operations/run-rules`, {
      method: "POST",
    });

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
    const response = await apiFetch(`/v1/organizations/${organization.id}/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    void loadOperations();
  }

  async function submitComment(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();

    if (!organization) {
      return;
    }

    const body = commentDrafts[taskId]?.trim();

    if (!body) {
      return;
    }

    const response = await apiFetch(`/v1/organizations/${organization.id}/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    setCommentDrafts((drafts) => ({ ...drafts, [taskId]: "" }));
    void loadOperations();
  }

  async function changeAlertStatus(alertId: string, status: string) {
    if (!organization) {
      return;
    }

    const response = await apiFetch(`/v1/organizations/${organization.id}/alerts/${alertId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    void loadOperations();
  }

  const activeAlerts = (payload?.alerts ?? []).filter((alert) =>
    ["open", "acknowledged"].includes(alert.status),
  );
  const resolvedAlerts = (payload?.alerts ?? []).filter(
    (alert) => !["open", "acknowledged"].includes(alert.status),
  );

  const filteredTasks = (payload?.tasks ?? []).filter((task) => {
    if (categoryFilter !== "all" && task.category !== categoryFilter) {
      return false;
    }
    if (statusFilter === "open") {
      return ["pending", "in_progress"].includes(task.status);
    }
    if (statusFilter === "all") {
      return true;
    }
    return task.status === statusFilter;
  });

  const tasksPage = usePaginatedUrl(filteredTasks, TASKS_PAGE_SIZE);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="border-l-2 border-brand py-0.5 pl-3 text-sm text-brand-deep">{error}</div>
      ) : null}

      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/20 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="open">Abiertas (pendiente + en curso)</option>
            <option value="pending">Pendientes</option>
            <option value="in_progress">En curso</option>
            <option value="completed">Completadas</option>
            <option value="ignored">Ignoradas</option>
            <option value="all">Todas</option>
          </Select>
          <Select
            aria-label="Filtrar por modulo"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">Todos los modulos</option>
            <option value="shopify">Shopify</option>
            <option value="meta">Meta Ads</option>
            <option value="klaviyo">Klaviyo</option>
            <option value="general">General</option>
          </Select>
        </div>
        <Button type="button" onClick={() => void evaluateRules()} disabled={isEvaluating}>
          {isEvaluating ? "Evaluando..." : "Evaluar reglas ahora"}
        </Button>
      </section>

      {isLoading ? (
        <LoadingBlock label="Cargando tareas y alertas..." />
      ) : (
        <>
          <section className="border-t border-ink/20">
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-display text-2xl">Alertas activas ({activeAlerts.length})</h2>
            </div>
            <div className="divide-y divide-line">
              {activeAlerts.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">
                  Sin alertas activas. Pulsa &quot;Evaluar reglas ahora&quot; para comprobar los datos actuales.
                </p>
              ) : (
                activeAlerts.map((alert) => (
                  <div key={alert.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            "border px-2 py-0.5 text-xs",
                            SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info,
                          ].join(" ")}
                        >
                          {alert.severity}
                        </span>
                        <p className="font-medium">{alert.title}</p>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-muted">{alert.message}</p>
                      <p className="mt-1 font-mono text-xs text-muted">
                        detectada {new Date(alert.first_detected_at).toLocaleString()} · última vez{" "}
                        {new Date(alert.last_detected_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {alert.status === "open" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() => void changeAlertStatus(alert.id, "acknowledged")}
                        >
                          Vista
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => void changeAlertStatus(alert.id, "dismissed")}
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
            <div className="border-b border-line px-4 py-3">
              <h2 className="font-display text-2xl">Tareas ({filteredTasks.length})</h2>
            </div>
            <div className="divide-y divide-line">
              {filteredTasks.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">Sin tareas para este filtro.</p>
              ) : (
                tasksPage.pageItems.map((task) => (
                  <div key={task.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="border border-ink px-2 py-0.5 font-mono text-xs uppercase">
                            {CATEGORY_LABELS[task.category] ?? task.category}
                          </span>
                          <span className="bg-surface px-2 py-0.5 font-mono text-xs">
                            {PRIORITY_LABELS[task.priority] ?? task.priority}
                          </span>
                          <span className="border border-edge px-2 py-0.5 text-xs text-muted">
                            {STATUS_LABELS[task.status] ?? task.status}
                          </span>
                          {task.source === "alert" ? (
                            <span className="border border-brand px-2 py-0.5 text-xs text-brand">
                              desde alerta
                            </span>
                          ) : null}
                          {isTaskOverdue(task) ? <Badge tone="danger">Vencida</Badge> : null}
                          <p className="font-medium">{task.title}</p>
                        </div>
                        {task.description ? (
                          <p className="mt-1 text-sm leading-6 text-muted">{task.description}</p>
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
                            type="button"
                            onClick={() => void changeTaskStatus(task.id, "in_progress")}
                          >
                            Empezar
                          </Button>
                        ) : null}
                        {["pending", "in_progress"].includes(task.status) ? (
                          <>
                            <Button
                              size="sm"
                              type="button"
                              onClick={() => void changeTaskStatus(task.id, "completed")}
                            >
                              Completar
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={() => void changeTaskStatus(task.id, "ignored")}
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

                    <form className="mt-3 flex gap-2" onSubmit={(event) => submitComment(event, task.id)}>
                      <Input
                        className="min-w-0 flex-1"
                        aria-label={`Comentario para la tarea ${task.title}`}
                        value={commentDrafts[task.id] ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((drafts) => ({ ...drafts, [task.id]: event.target.value }))
                        }
                        placeholder="Añadir comentario..."
                      />
                      <Button variant="secondary" type="submit">
                        Comentar
                      </Button>
                    </form>
                  </div>
                ))
              )}
            </div>
            <Pagination
              className="mx-4 mb-3"
              page={tasksPage.page}
              pageCount={tasksPage.pageCount}
              onChange={tasksPage.setPage}
            />
          </section>

          {resolvedAlerts.length > 0 ? (
            <section className="border-t border-ink/20">
              <div className="border-b border-line px-4 py-3">
                <h2 className="font-display text-2xl">Alertas resueltas ({resolvedAlerts.length})</h2>
              </div>
              <div className="divide-y divide-line">
                {resolvedAlerts.slice(0, 20).map((alert) => (
                  <div key={alert.id} className="px-4 py-3">
                    <p className="text-sm">{alert.title}</p>
                    <p className="font-mono text-xs text-muted">
                      {alert.status} ·{" "}
                      {alert.resolved_at ? new Date(alert.resolved_at).toLocaleString() : ""}
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
