"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import {
  Badge,
  Button,
  Card,
  Dropdown,
  ErrorBlock,
  Input,
  Label,
  LoadingBlock,
  MoreIcon,
  ProgressBar,
  Select,
  Textarea,
  toast,
} from "@/components/ui";

type CreatorOrigin = "consultant" | "client" | null;

type MilestoneTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  category: string;
  source: string;
  created_by_origin?: CreatorOrigin;
};

type Milestone = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  status: string;
  target_date: string | null;
  completed_at: string | null;
  created_by_origin?: CreatorOrigin;
  milestone_task_links: Array<{ task_id: string; tasks: MilestoneTask | null }>;
};

type Phase = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  status: string;
  activated_at: string | null;
  completed_at: string | null;
  created_by_origin?: CreatorOrigin;
  strategic_plan_milestones: Milestone[];
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  starts_on: string | null;
  completed_on: string | null;
  strategic_plan_phases: Phase[];
};

type PlanResponse = {
  organization_id: string;
  plan: Plan | null;
};

const PHASE_STATUS_LABELS: Record<string, string> = {
  locked: "Bloqueada",
  pending: "Pendiente",
  active: "Activa",
  completed: "Completada",
};

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  locked: "Bloqueado",
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completado",
  skipped: "Omitido",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  ignored: "Ignorada",
  cancelled: "Cancelada",
};

const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const TASK_SOURCE_LABELS: Record<string, string> = {
  ai_consultant: "IA",
  strategic_plan: "Mi Camino",
  consulting_call: "Llamada",
  alert: "Alerta",
  manual: "Manual",
  system: "Sistema",
};

// Peticion explicita de Rafa (2026-07-29): "como en GitHub", que se note por
// color quien propuso que -- el consultor y el cliente pueden ambos crear
// fases/hitos/tareas (assertCanManagePlan), y antes no habia forma de
// distinguirlos. El origen se deriva del platform_role del creador en el
// backend (ver strategic-plans.ts, attachCreatorOrigin), no se guarda aparte.
const ORIGIN_COLOR: Record<"consultant" | "client", string> = {
  consultant: "var(--color-brand)",
  client: "var(--color-success)",
};
const ORIGIN_LABEL: Record<"consultant" | "client", string> = {
  consultant: "Consultor",
  client: "Cliente",
};

function OriginDot({ origin }: { origin: CreatorOrigin }) {
  if (!origin) return null;
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: ORIGIN_COLOR[origin] }}
      title={`Propuesto por: ${ORIGIN_LABEL[origin]}`}
      aria-hidden
    />
  );
}

async function readApiError(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string; message?: string; detail?: string }
    | null;
  return [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail].filter(Boolean).join(" - ");
}

// --- Lista numerada (peticion explicita de Rafa 2026-07-29: sin burbujas ni
// flechas de diagrama, todo en vertical, fases y hitos numerados) ----------

function RowMenu({
  ariaLabel,
  onAction,
  items,
}: {
  ariaLabel: string;
  onAction: (key: string) => void;
  items: Array<{ id: string; label: string; danger?: boolean }>;
}) {
  if (items.length === 0) return null;
  return (
    <Dropdown>
      <Button variant="ghost" size="sm" aria-label={ariaLabel} className="shrink-0 px-2">
        <MoreIcon aria-hidden />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <Dropdown.Item key={item.id} id={item.id} textValue={item.label} variant={item.danger ? "danger" : undefined}>
              <Label>{item.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function PhaseListItem({
  phase,
  canManage,
  isEditing,
  isAddingMilestone,
  onAction,
}: {
  phase: Phase;
  canManage: boolean;
  isEditing: boolean;
  isAddingMilestone: boolean;
  onAction: (action: "edit" | "add-milestone") => void;
}) {
  const tone = phase.status === "completed" ? "var(--color-success)" : phase.status === "active" ? "var(--color-brand)" : "var(--color-edge-strong)";
  return (
    <div className="flex w-full items-center gap-3 rounded-lg border-2 bg-white px-3 py-2.5 shadow-sm" style={{ borderColor: tone }}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold text-white"
        style={{ background: tone }}
      >
        {phase.position}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <OriginDot origin={phase.created_by_origin ?? null} />
          <p className="truncate text-sm font-semibold">{phase.name}</p>
        </div>
      </div>
      <Badge tone={phase.status === "completed" ? "success" : phase.status === "active" ? "brand" : "neutral"}>
        {PHASE_STATUS_LABELS[phase.status] ?? phase.status}
      </Badge>
      {canManage ? (
        <RowMenu
          ariaLabel={`Acciones de la fase ${phase.name}`}
          onAction={(key) => onAction(key as "edit" | "add-milestone")}
          items={[
            { id: "edit", label: isEditing ? "Cerrar edición" : "Editar fase" },
            { id: "add-milestone", label: isAddingMilestone ? "Cerrar" : "+ Hito" },
          ]}
        />
      ) : null}
    </div>
  );
}

function MilestoneListItem({
  numberLabel,
  milestone,
  canManage,
  isExpanded,
  onToggleExpand,
  isEditing,
  isAddingTask,
  onAction,
}: {
  numberLabel: string;
  milestone: Milestone;
  canManage: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isEditing: boolean;
  isAddingTask: boolean;
  onAction: (action: "start" | "complete" | "edit" | "add-task") => void;
}) {
  const tone = milestone.status === "completed" ? "var(--color-success)" : milestone.status === "in_progress" ? "var(--color-brand)" : "var(--color-edge-strong)";
  const taskCount = milestone.milestone_task_links.length;

  const menuItems: Array<{ id: string; label: string }> = [];
  if (milestone.status === "pending") menuItems.push({ id: "start", label: "Empezar" });
  if (["pending", "in_progress"].includes(milestone.status)) menuItems.push({ id: "complete", label: "Completar" });
  menuItems.push({ id: "edit", label: isEditing ? "Cerrar edición" : "Editar hito" });
  menuItems.push({ id: "add-task", label: isAddingTask ? "Cerrar" : "+ Tarea" });

  return (
    <div className="flex w-full items-center gap-2.5 rounded-md border-2 bg-white px-2.5 py-1.5 shadow-sm" style={{ borderColor: tone }}>
      <button type="button" onClick={onToggleExpand} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left">
        <span className="shrink-0 font-mono text-[0.65rem] text-muted">{numberLabel}</span>
        <OriginDot origin={milestone.created_by_origin ?? null} />
        <p className={["min-w-0 flex-1 truncate text-xs font-medium", ["completed", "skipped"].includes(milestone.status) ? "text-muted line-through" : ""].join(" ")}>
          {milestone.name}
        </p>
      </button>
      <span className="shrink-0 font-mono text-[0.6rem] text-muted">
        {MILESTONE_STATUS_LABELS[milestone.status] ?? milestone.status}
        {taskCount ? ` · ${taskCount} tareas` : ""}
      </span>
      {canManage ? (
        <RowMenu
          ariaLabel={`Acciones del hito ${milestone.name}`}
          onAction={(key) => onAction(key as "start" | "complete" | "edit" | "add-task")}
          items={menuItems}
        />
      ) : null}
    </div>
  );
}

// --- Formularios reutilizados en el panel de detalle ------------------------

function AddTaskForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (payload: { title: string; description: string; priority: string; dueAt: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueAt, setDueAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    await onSubmit({ title: title.trim(), description: description.trim(), priority, dueAt });
    setIsSubmitting(false);
  }

  return (
    <form className="mt-3 space-y-2 rounded-md border border-line bg-surface/40 p-3" onSubmit={handleSubmit}>
      <Input aria-label="Titulo de la tarea" placeholder="Titulo de la tarea" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <Textarea aria-label="Descripcion de la tarea" placeholder="Descripcion (opcional)" className="h-20" value={description} onChange={(event) => setDescription(event.target.value)} />
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
        <Input type="date" aria-label="Fecha limite" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="w-40" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting || !title.trim()}>
          {isSubmitting ? "Creando..." : "Crear tarea"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function NameDescriptionForm({
  initialName,
  initialDescription,
  initialTargetDate,
  showTargetDate,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initialName: string;
  initialDescription: string;
  initialTargetDate?: string;
  showTargetDate?: boolean;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (payload: { name: string; description: string; targetDate: string }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [targetDate, setTargetDate] = useState(initialTargetDate ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    await onSubmit({ name: name.trim(), description: description.trim(), targetDate });
    setIsSubmitting(false);
  }

  return (
    <form className="mt-2 space-y-2 rounded-md border border-line bg-surface/40 p-3" onSubmit={handleSubmit}>
      <Input aria-label="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
      <Textarea aria-label="Descripcion" className="h-20" placeholder="Descripcion (opcional)" value={description} onChange={(event) => setDescription(event.target.value)} />
      {showTargetDate ? (
        <Input type="date" aria-label="Fecha objetivo" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="w-40" />
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? "Guardando..." : submitLabel}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function TaskListItem({ numberLabel, task }: { numberLabel: string; task: MilestoneTask }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface/30 px-2.5 py-1.5 text-sm">
      <span className="shrink-0 font-mono text-[0.65rem] text-muted">{numberLabel}</span>
      <OriginDot origin={task.created_by_origin ?? null} />
      <span
        className={["min-w-0 flex-1 truncate", ["completed", "ignored", "cancelled"].includes(task.status) ? "text-muted line-through" : ""].join(" ")}
      >
        {task.title}
      </span>
      <Badge tone="neutral">{TASK_PRIORITY_LABELS[task.priority] ?? task.priority}</Badge>
      <Badge tone="neutral">{TASK_STATUS_LABELS[task.status] ?? task.status}</Badge>
      {TASK_SOURCE_LABELS[task.source] ? <Badge tone="brand">{TASK_SOURCE_LABELS[task.source]}</Badge> : null}
    </div>
  );
}

// --- Contenido principal -----------------------------------------------------

function PlanContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const organization =
    bootstrap.memberships.find((membership) => membership.organization_id === selectedOrganizationId)
      ?.organization ?? bootstrap.memberships[0]?.organization ?? null;
  const membership = bootstrap.memberships.find((item) => item.organization_id === (organization?.id ?? ""));
  const canManage =
    ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role) ||
    ["owner", "manager"].includes(membership?.role ?? "");

  const [payload, setPayload] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planOutline, setPlanOutline] = useState("");
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [addingMilestonePhaseId, setAddingMilestonePhaseId] = useState<string | null>(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [addingTaskMilestoneId, setAddingTaskMilestoneId] = useState<string | null>(null);
  const [isAddingPhase, setIsAddingPhase] = useState(false);

  const loadPlan = useCallback(async () => {
    if (!organization) return;
    setIsLoading(true);
    const response = await apiFetch(`/v1/organizations/${organization.id}/strategic-plan`);
    if (!response.ok) {
      setError(await readApiError(response));
      setIsLoading(false);
      return;
    }
    setPayload((await response.json()) as PlanResponse);
    setError(null);
    setIsLoading(false);
  }, [organization?.id]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;

    const phases: Array<{ name: string; milestones: Array<{ name: string }> }> = [];
    for (const rawLine of planOutline.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^fase\s*:/i.test(line)) {
        phases.push({ name: line.replace(/^fase\s*:/i, "").trim(), milestones: [] });
      } else if (phases.length > 0) {
        phases[phases.length - 1].milestones.push({ name: line.replace(/^[-*]\s*/, "") });
      }
    }

    setIsSubmitting(true);
    setError(null);
    const response = await apiFetch(`/v1/organizations/${organization.id}/strategic-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: planName, phases }),
    });
    if (!response.ok) {
      setError(await readApiError(response));
      setIsSubmitting(false);
      return;
    }
    setPlanName("");
    setPlanOutline("");
    setIsSubmitting(false);
    toast.success("Plan creado en borrador.");
    void loadPlan();
  }

  async function activatePlan(planId: string) {
    if (!organization) return;
    const response = await apiFetch(`/v1/organizations/${organization.id}/strategic-plan/${planId}/activate`, { method: "POST" });
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    toast.success("Plan activado.");
    void loadPlan();
  }

  async function changeMilestoneStatus(milestoneId: string, status: string) {
    if (!organization) return;
    const response = await apiFetch(`/v1/organizations/${organization.id}/milestones/${milestoneId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    toast.success("Estado del hito actualizado.");
    void loadPlan();
  }

  async function editMilestone(milestoneId: string, payload2: { name: string; description: string; targetDate: string }) {
    if (!organization) return;
    const response = await apiFetch(`/v1/organizations/${organization.id}/milestones/${milestoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload2.name, description: payload2.description || null, targetDate: payload2.targetDate || null }),
    });
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    toast.success("Hito actualizado.");
    void loadPlan();
  }

  async function editPhase(phaseId: string, payload2: { name: string; description: string }) {
    if (!organization) return;
    const response = await apiFetch(`/v1/organizations/${organization.id}/strategic-plan/phases/${phaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload2.name, description: payload2.description || null }),
    });
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    toast.success("Fase actualizada.");
    void loadPlan();
  }

  async function addMilestoneTask(milestoneId: string, payload2: { title: string; description: string; priority: string; dueAt: string }) {
    if (!organization) return;
    const response = await apiFetch(`/v1/organizations/${organization.id}/milestones/${milestoneId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: payload2.title, description: payload2.description || null, priority: payload2.priority, dueAt: payload2.dueAt || null }),
    });
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    toast.success("Tarea creada y enlazada al hito.");
    void loadPlan();
  }

  async function addMilestone(phaseId: string, payload2: { name: string; description: string; targetDate: string }) {
    if (!organization) return;
    const response = await apiFetch(`/v1/organizations/${organization.id}/strategic-plan/phases/${phaseId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload2.name, description: payload2.description || null, targetDate: payload2.targetDate || null }),
    });
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    toast.success("Hito creado.");
    void loadPlan();
  }

  async function addPhase(payload2: { name: string; description: string }) {
    if (!organization || !plan) return;
    const response = await apiFetch(`/v1/organizations/${organization.id}/strategic-plan/${plan.id}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: payload2.name, description: payload2.description || null }),
    });
    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }
    toast.success("Fase creada.");
    setIsAddingPhase(false);
    void loadPlan();
  }

  const plan = payload?.plan ?? null;
  const phases = (plan?.strategic_plan_phases ?? []).slice().sort((a, b) => a.position - b.position);
  const totalMilestones = phases.reduce((sum, phase) => sum + phase.strategic_plan_milestones.length, 0);
  const doneMilestones = phases.reduce(
    (sum, phase) => sum + phase.strategic_plan_milestones.filter((m) => ["completed", "skipped"].includes(m.status)).length,
    0,
  );

  return (
    <div className="space-y-4">
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {isLoading ? (
        <LoadingBlock label="Cargando plan..." />
      ) : plan ? (
        <>
          <Card
            className="border-t border-ink/20"
            kicker={`v${plan.version} · ${plan.status}`}
            title={plan.name}
            description={plan.description ?? undefined}
            actions={
              <div className="flex items-center gap-2">
                {plan.status === "draft" && canManage ? (
                  <Button type="button" onClick={() => void activatePlan(plan.id)}>
                    Activar plan
                  </Button>
                ) : null}
                {canManage ? (
                  <Button variant="secondary" type="button" onClick={() => setIsAddingPhase((value) => !value)}>
                    {isAddingPhase ? "Cerrar" : "+ Fase"}
                  </Button>
                ) : null}
              </div>
            }
          >
            {totalMilestones > 0 ? (
              <ProgressBar value={(doneMilestones / totalMilestones) * 100} aria-label="Progreso del plan">
                <div className="flex justify-between text-xs text-muted">
                  <span>Progreso</span>
                  <span className="font-mono">
                    {doneMilestones}/{totalMilestones} hitos
                  </span>
                </div>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            ) : null}
            <div className="mt-2 flex items-center gap-4 font-mono text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <OriginDot origin="consultant" /> Propuesto por consultor
              </span>
              <span className="flex items-center gap-1.5">
                <OriginDot origin="client" /> Propuesto por cliente
              </span>
            </div>
            {isAddingPhase ? (
              <NameDescriptionForm
                initialName=""
                initialDescription=""
                submitLabel="Crear fase"
                onCancel={() => setIsAddingPhase(false)}
                onSubmit={addPhase}
              />
            ) : null}
          </Card>

          <ol className="space-y-2">
            {phases.map((phase) => {
              const milestones = phase.strategic_plan_milestones.slice().sort((a, b) => a.position - b.position);
              const isEditingPhase = editingPhaseId === phase.id;
              const isAddingMilestone = addingMilestonePhaseId === phase.id;
              return (
                <li key={phase.id}>
                  <PhaseListItem
                    phase={phase}
                    canManage={canManage}
                    isEditing={isEditingPhase}
                    isAddingMilestone={isAddingMilestone}
                    onAction={(action) => {
                      if (action === "edit") {
                        setEditingPhaseId(isEditingPhase ? null : phase.id);
                      } else {
                        setAddingMilestonePhaseId(isAddingMilestone ? null : phase.id);
                      }
                    }}
                  />

                  {phase.description ? <p className="ml-11 mt-1 text-xs text-muted">{phase.description}</p> : null}

                  {isEditingPhase ? (
                    <div className="ml-11 mt-1.5">
                      <NameDescriptionForm
                        initialName={phase.name}
                        initialDescription={phase.description ?? ""}
                        submitLabel="Guardar"
                        onCancel={() => setEditingPhaseId(null)}
                        onSubmit={async (payload) => {
                          await editPhase(phase.id, payload);
                          setEditingPhaseId(null);
                        }}
                      />
                    </div>
                  ) : null}

                  {isAddingMilestone ? (
                    <div className="ml-11 mt-1.5">
                      <NameDescriptionForm
                        initialName=""
                        initialDescription=""
                        initialTargetDate=""
                        showTargetDate
                        submitLabel="Crear hito"
                        onCancel={() => setAddingMilestonePhaseId(null)}
                        onSubmit={async (payload) => {
                          await addMilestone(phase.id, payload);
                          setAddingMilestonePhaseId(null);
                        }}
                      />
                    </div>
                  ) : null}

                  {milestones.length > 0 ? (
                    <ol className="ml-4 mt-1.5 space-y-1 border-l-2 border-line pl-3">
                      {milestones.map((milestone, milestoneIndex) => {
                        const isMilestoneExpanded = expandedMilestoneId === milestone.id;
                        const isEditingMilestone = editingMilestoneId === milestone.id;
                        const isAddingTask = addingTaskMilestoneId === milestone.id;
                        const tasks = milestone.milestone_task_links
                          .map((link) => link.tasks)
                          .filter((task): task is MilestoneTask => Boolean(task));
                        return (
                          <li key={milestone.id}>
                            <MilestoneListItem
                              numberLabel={`${phase.position}.${milestoneIndex + 1}`}
                              milestone={milestone}
                              canManage={canManage}
                              isExpanded={isMilestoneExpanded}
                              onToggleExpand={() => setExpandedMilestoneId(isMilestoneExpanded ? null : milestone.id)}
                              isEditing={isEditingMilestone}
                              isAddingTask={isAddingTask}
                              onAction={(action) => {
                                if (action === "start") {
                                  void changeMilestoneStatus(milestone.id, "in_progress");
                                } else if (action === "complete") {
                                  void changeMilestoneStatus(milestone.id, "completed");
                                } else if (action === "edit") {
                                  setEditingMilestoneId(isEditingMilestone ? null : milestone.id);
                                } else {
                                  setAddingTaskMilestoneId(isAddingTask ? null : milestone.id);
                                }
                              }}
                            />

                            {isEditingMilestone ? (
                              <div className="ml-4 mt-1.5">
                                <NameDescriptionForm
                                  initialName={milestone.name}
                                  initialDescription={milestone.description ?? ""}
                                  initialTargetDate={milestone.target_date ?? ""}
                                  showTargetDate
                                  submitLabel="Guardar"
                                  onCancel={() => setEditingMilestoneId(null)}
                                  onSubmit={async (payload) => {
                                    await editMilestone(milestone.id, payload);
                                    setEditingMilestoneId(null);
                                  }}
                                />
                              </div>
                            ) : null}

                            {isAddingTask ? (
                              <div className="ml-4 mt-1.5">
                                <AddTaskForm
                                  onCancel={() => setAddingTaskMilestoneId(null)}
                                  onSubmit={async (payload) => {
                                    await addMilestoneTask(milestone.id, payload);
                                    setAddingTaskMilestoneId(null);
                                  }}
                                />
                              </div>
                            ) : null}

                            {isMilestoneExpanded ? (
                              <div className="ml-4 mt-1.5 space-y-1">
                                {milestone.description ? <p className="text-xs text-muted">{milestone.description}</p> : null}
                                {milestone.target_date ? <p className="font-mono text-xs text-muted">objetivo {milestone.target_date}</p> : null}
                                {tasks.length > 0 ? (
                                  <ol className="space-y-1 border-l-2 border-line pl-3">
                                    {tasks.map((task, taskIndex) => (
                                      <li key={task.id}>
                                        <TaskListItem numberLabel={`${phase.position}.${milestoneIndex + 1}.${taskIndex + 1}`} task={task} />
                                      </li>
                                    ))}
                                  </ol>
                                ) : null}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <Card title="Sin plan estrategico" className="border-t border-ink/20">
          <p className="text-sm leading-6 text-muted">
            {canManage
              ? "Crea el primer plan: escribe el nombre y el esquema de fases e hitos."
              : "Tu consultor todavia no ha publicado un plan para esta organización."}
          </p>
          {canManage ? (
            <form className="mt-4 space-y-3" onSubmit={createPlan}>
              <Input
                aria-label="Nombre del plan"
                value={planName}
                onChange={(event) => setPlanName(event.target.value)}
                placeholder="Nombre del plan (p. ej. Escalar a 50k/mes)"
                required
              />
              <Textarea
                className="h-48 font-mono"
                aria-label="Esquema de fases e hitos"
                value={planOutline}
                onChange={(event) => setPlanOutline(event.target.value)}
                placeholder={"Fase: Fundamentos\n- Configurar costes y gastos fijos\n- Cargar costes de producto\nFase: Adquisicion\n- Conectar Meta Ads\n- Definir presupuesto inicial"}
                required
              />
              <p className="text-xs text-muted">
                Formato: cada linea &quot;Fase: nombre&quot; abre una fase; las lineas siguientes son sus hitos.
              </p>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear plan en borrador"}
              </Button>
            </form>
          ) : null}
        </Card>
      )}
    </div>
  );
}

function StrategicPlanPageContent() {
  return (
    <PortalShell title="Mi Camino">
      {(bootstrap) => <PlanContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}

export default function StrategicPlanPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando Mi Camino..." />}>
      <StrategicPlanPageContent />
    </Suspense>
  );
}
