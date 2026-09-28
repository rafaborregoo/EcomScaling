"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";

export type WorkbenchArea = "all" | "shopify" | "meta" | "klaviyo";

type WorkbenchTask = {
  id: string;
  alert_id: string | null;
  source: string;
  status: string;
  priority: string;
  categories: string[];
  title: string;
  description: string | null;
  due_at: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  is_visible_to_client: boolean;
  created_at: string;
  updated_at: string;
  task_comments: Array<{
    id: string;
    body: string;
    is_internal: boolean;
    author_user_id: string;
    created_at: string;
  }>;
};

type WorkbenchAlert = {
  id: string;
  status: string;
  severity: string;
  title: string;
  message: string;
  first_detected_at: string;
  last_detected_at: string;
};

type OperationsPayload = { tasks: WorkbenchTask[]; alerts: WorkbenchAlert[] };
type AssigneeOption = {
  id: string;
  name: string;
  role: string;
  is_self: boolean;
};
type Draft = {
  title: string;
  description: string;
  priority: string;
  area: Exclude<WorkbenchArea, "all"> | "general";
  dueDate: string;
  visibleToClient: boolean;
  assignedTo: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  description: "",
  priority: "medium",
  area: "general",
  dueDate: "",
  visibleToClient: true,
  assignedTo: "",
};
const OPEN = new Set(["pending", "in_progress"]);
const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const AREA_LABEL: Record<string, string> = {
  shopify: "Shopify",
  meta: "Meta Ads",
  klaviyo: "Klaviyo",
  general: "General",
};
const PRIORITY_OPTIONS = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];
const AREA_OPTIONS = [
  { value: "general", label: "General" },
  { value: "shopify", label: "Shopify" },
  { value: "meta", label: "Meta Ads" },
  { value: "klaviyo", label: "Klaviyo" },
];

function formatDueDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

function isOverdue(task: WorkbenchTask, now: number) {
  return Boolean(
    task.due_at && OPEN.has(task.status) && Date.parse(task.due_at) < now,
  );
}

export function DashboardWorkbench({
  organizationId,
  area,
  viewerRole,
  canResolveTasks,
}: {
  organizationId: string;
  area: WorkbenchArea;
  viewerRole: "client" | "consultant";
  canResolveTasks: boolean;
}) {
  const {
    data,
    error,
    isLoading: loading,
    reload: load,
  } = useCachedQuery<OperationsPayload>(
    `/v1/organizations/${organizationId}/operations`,
  );
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [assigneesLoaded, setAssigneesLoaded] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [completionTask, setCompletionTask] = useState<WorkbenchTask | null>(
    null,
  );
  const [resolutionStatus, setResolutionStatus] = useState<
    "completed" | "ignored"
  >("completed");
  const [outcomeDraft, setOutcomeDraft] = useState("");
  const [draft, setDraft] = useState<Draft>({
    ...EMPTY_DRAFT,
    area: area === "all" ? "general" : area,
  });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [internalComment, setInternalComment] = useState<
    Record<string, boolean>
  >({});
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [assignmentDrafts, setAssignmentDrafts] = useState<
    Record<string, { assignedTo: string; dueDate: string }>
  >({});
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    if ((!createOpen && !expandedTaskId) || assigneesLoaded) return;
    let active = true;
    void apiFetch(`/v1/organizations/${organizationId}/task-assignees`)
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          assignees?: AssigneeOption[];
        };
        if (!active) return;
        const options = payload.assignees ?? [];
        setAssignees(options);
        setAssigneesLoaded(true);
        const self = options.find((option) => option.is_self)?.id ?? "";
        setDraft((prev) => ({ ...prev, assignedTo: prev.assignedTo || self }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [assigneesLoaded, createOpen, expandedTaskId, organizationId]);

  useEffect(() => {
    function refreshForOrganization(event: Event) {
      const detail = (event as CustomEvent<{ organizationId?: string }>).detail;
      if (!detail?.organizationId || detail.organizationId === organizationId)
        void load();
    }
    window.addEventListener(
      "dashboard:workbench-refresh",
      refreshForOrganization,
    );
    return () =>
      window.removeEventListener(
        "dashboard:workbench-refresh",
        refreshForOrganization,
      );
  }, [load, organizationId]);

  const visibleTasks = useMemo(() => {
    const all = data?.tasks ?? [];
    return all
      .filter((task) => viewerRole !== "client" || task.is_visible_to_client)
      .filter(
        (task) =>
          area === "all" ||
          task.categories.includes(area) ||
          task.categories.includes("general"),
      )
      .sort((a, b) => {
        const aOpen = OPEN.has(a.status) ? 0 : 1;
        const bOpen = OPEN.has(b.status) ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        const priority =
          (PRIORITY_RANK[a.priority] ?? 4) - (PRIORITY_RANK[b.priority] ?? 4);
        if (priority) return priority;
        return (
          (a.due_at ? Date.parse(a.due_at) : Infinity) -
          (b.due_at ? Date.parse(b.due_at) : Infinity)
        );
      });
  }, [area, data?.tasks, viewerRole]);

  const openTasks = visibleTasks.filter((task) => OPEN.has(task.status));
  const completedTasks = visibleTasks
    .filter((task) => task.status === "completed")
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .slice(0, 4);
  const overdueCount = openTasks.filter((task) =>
    isOverdue(task, nowMs),
  ).length;
  const activeAlerts = (data?.alerts ?? []).filter((alert) =>
    ["open", "acknowledged"].includes(alert.status),
  );

  async function changeStatus(task: WorkbenchTask, status: "in_progress") {
    setPendingId(task.id);
    setActionError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/tasks/${task.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      load();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar la tarea.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function addComment(
    event: FormEvent<HTMLFormElement>,
    task: WorkbenchTask,
  ) {
    event.preventDefault();
    const body = commentDrafts[task.id]?.trim();
    if (!body) return;
    setPendingId(task.id);
    setActionError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/tasks/${task.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body,
            isInternal:
              viewerRole === "consultant" && Boolean(internalComment[task.id]),
          }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      setCommentDrafts((prev) => ({ ...prev, [task.id]: "" }));
      load();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "No se pudo guardar la nota.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    setPendingId("create");
    setActionError(null);
    try {
      const dueAt = draft.dueDate
        ? new Date(`${draft.dueDate}T12:00:00`).toISOString()
        : null;
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title.trim(),
            description: draft.description.trim() || null,
            priority: draft.priority,
            categories: [draft.area],
            dueAt,
            isVisibleToClient:
              viewerRole === "client" ? true : draft.visibleToClient,
            assignedTo: draft.assignedTo || undefined,
          }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      setDraft({
        ...EMPTY_DRAFT,
        assignedTo: assignees.find((option) => option.is_self)?.id ?? "",
        area: area === "all" ? "general" : area,
      });
      setCreateOpen(false);
      load();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "No se pudo crear la tarea.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function saveAssignment(task: WorkbenchTask) {
    const assignment = assignmentDrafts[task.id] ?? {
      assignedTo: task.assigned_to ?? "",
      dueDate: task.due_at
        ? new Date(task.due_at).toISOString().slice(0, 10)
        : "",
    };
    setPendingId(task.id);
    setActionError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/tasks/${task.id}/assignment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignedTo: assignment.assignedTo || null,
            dueAt: assignment.dueDate
              ? new Date(`${assignment.dueDate}T12:00:00`).toISOString()
              : null,
          }),
        },
      );
      if (!response.ok) throw new Error(await readApiError(response));
      load();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "No se pudo actualizar el responsable o la fecha.",
      );
    } finally {
      setPendingId(null);
    }
  }

  async function completeWithOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completionTask || !outcomeDraft.trim()) return;
    const task = completionTask;
    setPendingId(task.id);
    setActionError(null);
    try {
      const notePrefix =
        resolutionStatus === "completed" ? "Resultado:" : "Motivo de descarte:";
      const noteResponse = await apiFetch(
        `/v1/organizations/${organizationId}/tasks/${task.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: `${notePrefix} ${outcomeDraft.trim()}`,
            isInternal: false,
          }),
        },
      );
      if (!noteResponse.ok) throw new Error(await readApiError(noteResponse));
      const statusResponse = await apiFetch(
        `/v1/organizations/${organizationId}/tasks/${task.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: resolutionStatus,
            ...(resolutionStatus === "ignored"
              ? { reason: outcomeDraft.trim() }
              : {}),
          }),
        },
      );
      if (!statusResponse.ok)
        throw new Error(await readApiError(statusResponse));
      setCompletionTask(null);
      setOutcomeDraft("");
      load();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "No se pudo registrar el resultado.",
      );
    } finally {
      setPendingId(null);
    }
  }

  function startTaskFromAlert(alert: WorkbenchAlert) {
    const linked = (data?.tasks ?? []).find(
      (task) => task.alert_id === alert.id && OPEN.has(task.status),
    );
    if (linked) {
      setExpandedTaskId(linked.id);
      return;
    }
    setDraft({
      ...EMPTY_DRAFT,
      assignedTo: assignees.find((option) => option.is_self)?.id ?? "",
      area: area === "all" ? "general" : area,
      title: alert.title,
      description: alert.message,
      priority: ["critical", "high"].includes(alert.severity)
        ? "high"
        : "medium",
      visibleToClient: true,
    });
    setCreateOpen(true);
  }

  return (
    <Card
      title="Mesa de trabajo"
      description={
        area === "all"
          ? "Decisiones, responsables y próximos pasos para esta tienda."
          : `Trabajo y seguimiento de ${AREA_LABEL[area]}.`
      }
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          Nueva tarea
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={openTasks.length ? "warn" : "success"}>
          {openTasks.length} abiertas
        </Badge>
        {overdueCount ? (
          <Badge tone="danger">{overdueCount} vencidas</Badge>
        ) : null}
        <Badge tone="neutral">{activeAlerts.length} alertas activas</Badge>
        <span className="ml-auto text-xs text-muted">
          {viewerRole === "consultant"
            ? "Cada tarea puede tener responsable y fecha; el cliente conserva la decisión de completarla."
            : "Asigna un responsable y fecha; al poner fecha, la tarea aparece también en la agenda."}
        </span>
      </div>

      {actionError ? <ErrorBlock>{actionError}</ErrorBlock> : null}
      {loading ? (
        <LoadingBlock label="Cargando tareas y alertas…" />
      ) : error ? (
        <div className="space-y-3">
          <ErrorBlock>{error}</ErrorBlock>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : openTasks.length === 0 ? (
        <EmptyState
          title="No hay trabajo abierto en esta sección"
          hint="Puedes crear una tarea desde una recomendación o añadir un próximo paso manualmente."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              Añadir próximo paso
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-separator">
          {openTasks.slice(0, 8).map((task) => {
            const overdue = isOverdue(task, nowMs);
            const comments = task.task_comments.filter(
              (comment) => viewerRole !== "client" || !comment.is_internal,
            );
            const expanded = expandedTaskId === task.id;
            return (
              <li key={task.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="text-left text-sm font-medium hover:underline"
                      aria-expanded={expanded}
                      onClick={() =>
                        setExpandedTaskId(expanded ? null : task.id)
                      }
                    >
                      {task.title}
                    </button>
                    <p className="mt-1 text-xs text-muted">
                      {task.categories
                        .map((category) => AREA_LABEL[category] ?? category)
                        .join(" · ") || "General"}
                      {" · "}
                      {task.priority === "urgent"
                        ? "Urgente"
                        : task.priority === "high"
                          ? "Alta"
                          : task.priority === "low"
                            ? "Baja"
                            : "Normal"}
                      {" · "}
                      <span className={overdue ? "text-danger" : ""}>
                        {overdue ? "Vencida · " : ""}
                        {formatDueDate(task.due_at)}
                      </span>
                      {task.assignee_name
                        ? ` · ${task.assignee_name}`
                        : " · Sin responsable"}
                    </p>
                    {task.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                        {task.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {canResolveTasks && task.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pendingId === task.id}
                        onClick={() => void changeStatus(task, "in_progress")}
                      >
                        Empezar
                      </Button>
                    ) : null}
                    {canResolveTasks ? (
                      <Button
                        size="sm"
                        disabled={pendingId === task.id}
                        onClick={() => {
                          setCompletionTask(task);
                          setResolutionStatus("completed");
                          setOutcomeDraft("");
                        }}
                      >
                        Completar
                      </Button>
                    ) : (
                      <Badge tone="neutral">Esperando al cliente</Badge>
                    )}
                    {canResolveTasks ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pendingId === task.id}
                        onClick={() => {
                          setCompletionTask(task);
                          setResolutionStatus("ignored");
                          setOutcomeDraft("");
                        }}
                      >
                        Descartar
                      </Button>
                    ) : null}
                    {viewerRole === "consultant" ? (
                      <Badge
                        tone={task.is_visible_to_client ? "success" : "neutral"}
                      >
                        {task.is_visible_to_client
                          ? "Visible al cliente"
                          : "Interna"}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {expanded ? (
                  <div className="mt-3 rounded-md bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium">
                        Seguimiento y resultado
                      </p>
                      <a
                        className="text-xs text-accent hover:underline"
                        href="/tareas"
                      >
                        Abrir ficha completa
                      </a>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="space-y-1 text-xs">
                        <span>Responsable</span>
                        <Select
                          value={
                            (assignmentDrafts[task.id]?.assignedTo ??
                              task.assigned_to) ||
                            ""
                          }
                          placeholder="Sin responsable"
                          options={[
                            { value: "", label: "Sin responsable" },
                            ...assignees.map((option) => ({
                              value: option.id,
                              label: option.is_self
                                ? `${option.name} · tú`
                                : option.name,
                            })),
                          ]}
                          onChange={(value) =>
                            setAssignmentDrafts((prev) => ({
                              ...prev,
                              [task.id]: {
                                assignedTo: value,
                                dueDate:
                                  prev[task.id]?.dueDate ??
                                  (task.due_at
                                    ? new Date(task.due_at)
                                        .toISOString()
                                        .slice(0, 10)
                                    : ""),
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span>Fecha objetivo</span>
                        <input
                          type="date"
                          className="min-h-10 w-full rounded-md border border-separator bg-background px-2 text-sm"
                          value={
                            assignmentDrafts[task.id]?.dueDate ??
                            (task.due_at
                              ? new Date(task.due_at).toISOString().slice(0, 10)
                              : "")
                          }
                          onChange={(event) =>
                            setAssignmentDrafts((prev) => ({
                              ...prev,
                              [task.id]: {
                                assignedTo:
                                  prev[task.id]?.assignedTo ??
                                  task.assigned_to ??
                                  "",
                                dueDate: event.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pendingId === task.id}
                        onClick={() => void saveAssignment(task)}
                      >
                        Guardar
                      </Button>
                    </div>
                    {comments.length ? (
                      <ul className="mt-2 space-y-2">
                        {comments.slice(-3).map((comment) => (
                          <li key={comment.id} className="text-xs">
                            <p>{comment.body}</p>
                            <p className="mt-0.5 text-muted">
                              {new Date(comment.created_at).toLocaleString(
                                "es-ES",
                              )}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted">
                        Aún no hay notas de seguimiento.
                      </p>
                    )}
                    <form
                      className="mt-3 flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => void addComment(event, task)}
                    >
                      <input
                        className="min-h-9 min-w-0 flex-1 rounded-md border border-separator bg-background px-3 text-sm"
                        value={commentDrafts[task.id] ?? ""}
                        onChange={(event) =>
                          setCommentDrafts((prev) => ({
                            ...prev,
                            [task.id]: event.target.value,
                          }))
                        }
                        placeholder="Añadir avance o resultado…"
                        aria-label={`Nota de seguimiento para ${task.title}`}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        type="submit"
                        disabled={
                          !commentDrafts[task.id]?.trim() ||
                          pendingId === task.id
                        }
                      >
                        Guardar nota
                      </Button>
                    </form>
                    {viewerRole === "consultant" ? (
                      <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={Boolean(internalComment[task.id])}
                          onChange={(event) =>
                            setInternalComment((prev) => ({
                              ...prev,
                              [task.id]: event.target.checked,
                            }))
                          }
                        />
                        Nota interna, no visible al cliente
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {openTasks.length > 8 ? (
        <p className="mt-3 text-xs text-muted">
          Mostrando 8 de {openTasks.length}.{" "}
          <a className="text-accent hover:underline" href="/tareas">
            Ver todas las tareas
          </a>
        </p>
      ) : null}
      {completedTasks.length > 0 ? (
        <details className="mt-4 border-t border-separator pt-3">
          <summary className="cursor-pointer text-xs font-medium">
            Resultados recientes · {completedTasks.length}
          </summary>
          <ul className="mt-2 divide-y divide-separator">
            {completedTasks.map((task) => (
              <li key={task.id} className="py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-medium">{task.title}</p>
                  <span className="text-[11px] text-muted">
                    Completada ·{" "}
                    {new Date(task.updated_at).toLocaleDateString("es-ES")}
                  </span>
                </div>
                {task.task_comments
                  .filter(
                    (comment) =>
                      viewerRole !== "client" || !comment.is_internal,
                  )
                  .slice(-1)
                  .map((comment) => (
                    <p key={comment.id} className="mt-1 text-xs text-muted">
                      Resultado: {comment.body}
                    </p>
                  ))}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {activeAlerts.length > 0 ? (
        <div className="mt-4 border-t border-separator pt-3">
          <p className="text-xs font-medium">Señales que requieren atención</p>
          <ul className="mt-2 space-y-2">
            {activeAlerts.slice(0, 3).map((alert) => {
              const linked = (data?.tasks ?? []).find(
                (task) => task.alert_id === alert.id && OPEN.has(task.status),
              );
              return (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{alert.title}</p>
                    <p className="mt-0.5 text-muted">{alert.message}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        alert.severity === "critical" ||
                        alert.severity === "high"
                          ? "danger"
                          : "warn"
                      }
                    >
                      {linked ? "Con tarea" : "Sin tarea"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startTaskFromAlert(alert)}
                    >
                      {linked ? "Abrir seguimiento" : "Crear tarea"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {createOpen ? (
        <Modal isOpen onOpenChange={(open) => !open && setCreateOpen(false)}>
          <Modal.Backdrop>
            <Modal.Container size="md">
              <Modal.Dialog aria-label="Crear tarea de trabajo">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Crear próximo paso</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form
                    id={`dashboard-task-${organizationId}`}
                    className="space-y-4"
                    onSubmit={(event) => void createTask(event)}
                  >
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">Qué hay que hacer</span>
                      <input
                        required
                        maxLength={255}
                        autoFocus
                        className="min-h-10 w-full rounded-md border border-separator bg-background px-3"
                        value={draft.title}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Ej.: Revisar el ROAS de la campaña principal"
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">
                        Contexto y criterio de finalización
                      </span>
                      <Textarea
                        rows={3}
                        maxLength={4000}
                        value={draft.description}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Qué hay que revisar y cómo sabremos que está resuelto…"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="space-y-1 text-xs">
                        <span>Área</span>
                        <Select
                          value={draft.area}
                          options={AREA_OPTIONS}
                          onChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              area: value as Draft["area"],
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span>Prioridad</span>
                        <Select
                          value={draft.priority}
                          options={PRIORITY_OPTIONS}
                          onChange={(value) =>
                            setDraft((prev) => ({ ...prev, priority: value }))
                          }
                        />
                      </label>
                      <label className="space-y-1 text-xs">
                        <span>Fecha objetivo</span>
                        <input
                          type="date"
                          className="min-h-10 w-full rounded-md border border-separator bg-background px-2 text-sm"
                          value={draft.dueDate}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              dueDate: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">Responsable</span>
                      <Select
                        value={draft.assignedTo}
                        placeholder="Selecciona una persona"
                        options={assignees.map((option) => ({
                          value: option.id,
                          label: option.is_self
                            ? `${option.name} · tú`
                            : option.name,
                        }))}
                        onChange={(value) =>
                          setDraft((prev) => ({ ...prev, assignedTo: value }))
                        }
                      />
                    </label>
                    {viewerRole === "consultant" ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={draft.visibleToClient}
                          onChange={(event) =>
                            setDraft((prev) => ({
                              ...prev,
                              visibleToClient: event.target.checked,
                            }))
                          }
                        />
                        Visible para el cliente
                      </label>
                    ) : (
                      <p className="text-xs text-muted">
                        La fecha objetivo sincroniza este trabajo con la agenda
                        de la tienda.
                      </p>
                    )}
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="secondary"
                    onClick={() => setCreateOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={!draft.title.trim() || pendingId === "create"}
                    onClick={() =>
                      (
                        document.getElementById(
                          `dashboard-task-${organizationId}`,
                        ) as HTMLFormElement | null
                      )?.requestSubmit()
                    }
                  >
                    {pendingId === "create" ? "Guardando…" : "Crear tarea"}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ) : null}
      {completionTask ? (
        <Modal isOpen onOpenChange={(open) => !open && setCompletionTask(null)}>
          <Modal.Backdrop>
            <Modal.Container size="sm">
              <Modal.Dialog
                aria-label={
                  resolutionStatus === "completed"
                    ? "Cerrar tarea con resultado"
                    : "Descartar tarea con motivo"
                }
              >
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>
                    {resolutionStatus === "completed"
                      ? "Registrar resultado"
                      : "¿Por qué no se realizará?"}
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  {actionError ? <ErrorBlock>{actionError}</ErrorBlock> : null}
                  <p className="mb-3 text-sm text-muted">
                    {completionTask.title}
                  </p>
                  <form
                    id={`dashboard-task-outcome-${completionTask.id}`}
                    onSubmit={(event) => void completeWithOutcome(event)}
                  >
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">
                        {resolutionStatus === "completed"
                          ? "¿Qué se consiguió o qué cambió?"
                          : "Motivo para no continuar"}
                      </span>
                      <Textarea
                        required
                        autoFocus
                        rows={4}
                        maxLength={2000}
                        value={outcomeDraft}
                        onChange={(event) =>
                          setOutcomeDraft(event.target.value)
                        }
                        placeholder={
                          resolutionStatus === "completed"
                            ? "Describe brevemente el resultado y, si hay datos, el impacto observado…"
                            : "Por ejemplo, ya no aplica, falta información o se eligió otra vía…"
                        }
                      />
                    </label>
                  </form>
                </Modal.Body>
                <Modal.Footer>
                  <Button
                    variant="secondary"
                    onClick={() => setCompletionTask(null)}
                  >
                    Volver
                  </Button>
                  <Button
                    disabled={
                      !outcomeDraft.trim() || pendingId === completionTask.id
                    }
                    onClick={() =>
                      (
                        document.getElementById(
                          `dashboard-task-outcome-${completionTask.id}`,
                        ) as HTMLFormElement | null
                      )?.requestSubmit()
                    }
                  >
                    {pendingId === completionTask.id
                      ? "Guardando…"
                      : resolutionStatus === "completed"
                        ? "Guardar resultado y completar"
                        : "Guardar motivo y descartar"}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      ) : null}
    </Card>
  );
}
