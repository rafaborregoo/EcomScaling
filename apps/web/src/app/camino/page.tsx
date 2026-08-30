"use client";

import {
  FormEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import { readApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/money";
import {
  AsyncState,
  Badge,
  BarChart,
  Button,
  Card,
  CheckIcon,
  Dropdown,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  Field,
  GripVerticalIcon,
  IconChevronDown,
  IconChevronUp,
  Input,
  Label,
  List,
  LoadingBlock,
  Modal,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  ProgressBar,
  Select,
  Textarea,
  toast,
  type Tone,
} from "@/components/ui";

type CreatorOrigin = "consultant" | "client" | null;

type MilestoneTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
  categories: string[];
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

type ObjectiveCatalogEntry = {
  key: string;
  label: string;
  unit: "money" | "pct" | "count" | "ratio" | "number";
  direction: "up" | "down";
  source: "shopify" | "meta" | "manual";
};

type Objective = {
  id: string;
  metric_key: string;
  label: string;
  unit: ObjectiveCatalogEntry["unit"];
  direction: "up" | "down";
  source: "shopify" | "meta" | "manual";
  target_value: number;
  period: string;
  actual_value: number | null;
  progress_pct: number | null;
  status: "sin_datos" | "en_curso" | "cumplido";
};

type ObjectivesResponse = {
  objectives: Objective[];
  catalog: ObjectiveCatalogEntry[];
};

const OBJECTIVE_PERIOD_LABELS: Record<string, string> = {
  monthly: "mensual",
  quarterly: "trimestral",
  yearly: "anual",
};

function formatObjectiveValue(value: number, unit: ObjectiveCatalogEntry["unit"]) {
  if (unit === "money") return formatMoney(value);
  if (unit === "pct") return `${value.toFixed(1)}%`;
  if (unit === "ratio") return `${value.toFixed(2)}x`;
  return value.toFixed(0);
}

type InternalNote = {
  id: string;
  body: string;
  author_user_id: string;
  created_at: string;
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

// Mismo criterio que `isTaskOverdue` en tareas/page.tsx: due_at ya paso y la
// tarea sigue abierta. Se aplica aqui porque `due_at` llegaba en la respuesta
// pero nunca se mostraba en Mi Camino -- una tarea de un hito podia estar
// vencida sin ninguna senal visible en esta vista.
function isTaskOverdue(task: MilestoneTask) {
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

// --- Arbol de rama (peticion explicita de Rafa 2026-08-27: nada de lista
// plana numerada, un tronco con nodos de fase, ramas de hitos colgando de
// cada fase, y un nodo "+" punteado en la punta de cada rama para anadir la
// siguiente etapa -- ese "+" es el CTA principal, sustituye a "+ Hito"/
// "+ Tarea" escondidos en un menu de tres puntos). El menu de tres puntos
// sigue existiendo solo para acciones secundarias (editar, empezar,
// completar, omitir), nunca para anadir. -----------------------------------

// Ancho de los nodos circulares por nivel del arbol -- el tronco de fases
// usa nodos mas grandes que la rama de hitos, asi la jerarquia se lee de un
// vistazo sin depender solo del indentado.
const TREE_NODE_SIZE = { phase: 40, milestone: 32 } as const;

// Paleta del arbol: azul y verde solo como matiz (borde fino + nodo), fondo
// blanco salvo la fase/hito en foco que se tinta muy suave. Antes cada tarjeta
// llevaba un `border-2` de color plano y el toggle del hito era un Button
// solido de HeroUI -> barras azules macizas ilegibles (ver captura de Rafa).
function nodeTone(kind: "done" | "active" | "idle") {
  if (kind === "done")
    return {
      border: "var(--color-success)",
      badgeBg: "var(--color-success)",
      badgeText: "#fff",
      bg: "#fff",
    };
  if (kind === "active")
    return {
      border: "var(--color-brand)",
      badgeBg: "var(--color-brand)",
      badgeText: "#fff",
      bg: "var(--color-brand-tint)",
    };
  return {
    border: "var(--color-edge)",
    badgeBg: "#fff",
    badgeText: "var(--color-muted)",
    bg: "#fff",
  };
}

function TreeTrunk({ size }: { size: number }) {
  return (
    <div
      className="absolute top-2 bottom-2 w-0.5 bg-line"
      style={{ left: size / 2 - 1 }}
      aria-hidden
    />
  );
}

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
      <Button
        variant="ghost"
        size="sm"
        aria-label={ariaLabel}
        className="min-h-8 min-w-8 shrink-0 px-2"
      >
        <MoreIcon aria-hidden />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => onAction(String(key))}>
          {items.map((item) => (
            <Dropdown.Item
              key={item.id}
              id={item.id}
              textValue={item.label}
              variant={item.danger ? "danger" : undefined}
            >
              <Label>{item.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

// Nodo "+" punteado en la punta de una rama: pulsarlo abre el formulario de
// alta en el sitio (misma fila), no un modal aparte -- se ve la rama crecer.
function TreeAddNode({
  size,
  label,
  isOpen,
  onClick,
}: {
  size: number;
  label: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={isOpen}
        aria-label={label}
        className={[
          "z-10 flex shrink-0 items-center justify-center rounded-full border-2 border-dashed font-mono transition-colors",
          isOpen
            ? "border-brand text-brand"
            : "border-edge text-muted hover:border-brand hover:text-brand",
        ].join(" ")}
        style={{ width: size, height: size }}
      >
        {isOpen ? "×" : "+"}
      </button>
      <button
        type="button"
        onClick={onClick}
        className="text-left text-xs font-medium text-muted hover:text-brand"
      >
        {isOpen ? "Cancelar" : label}
      </button>
    </div>
  );
}

// Asa de arrastre: solo el asa mueve la fila, no toda la tarjeta -- asi el
// resto del row sigue siendo clic para expandir/completar sin arrastres
// accidentales. Se le pasan los props de dnd-kit (`attributes` + `listeners`).
function DragHandle({
  label,
  handleProps,
}: {
  label: string;
  handleProps: Record<string, unknown>;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="shrink-0 cursor-grab touch-none px-1 text-muted/60 transition-colors hover:text-brand active:cursor-grabbing"
      {...handleProps}
    >
      <GripVerticalIcon aria-hidden />
    </button>
  );
}

function PhaseNode({
  phase,
  canManage,
  isEditing,
  onEdit,
  handleProps,
}: {
  phase: Phase;
  canManage: boolean;
  isEditing: boolean;
  onEdit: () => void;
  handleProps?: Record<string, unknown>;
}) {
  const size = TREE_NODE_SIZE.phase;
  const t = nodeTone(
    phase.status === "completed"
      ? "done"
      : phase.status === "active"
        ? "active"
        : "idle",
  );
  return (
    <div className="relative flex items-start gap-3">
      <span
        className="z-10 flex shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold"
        style={{
          background: t.badgeBg,
          color: t.badgeText,
          borderColor: t.border,
          width: size,
          height: size,
        }}
      >
        {phase.status === "completed" ? (
          <CheckIcon aria-hidden />
        ) : (
          phase.position
        )}
      </span>
      <div
        className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow"
        style={{ borderColor: t.border, background: t.bg }}
        aria-current={phase.status === "active" ? "step" : undefined}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {canManage && handleProps ? (
              <DragHandle
                label={`Reordenar la fase ${phase.name}`}
                handleProps={handleProps}
              />
            ) : null}
            <OriginDot origin={phase.created_by_origin ?? null} />
            <p className="truncate text-sm font-semibold">{phase.name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              tone={
                phase.status === "completed"
                  ? "success"
                  : phase.status === "active"
                    ? "brand"
                    : "neutral"
              }
            >
              {PHASE_STATUS_LABELS[phase.status] ?? phase.status}
            </Badge>
            {canManage ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                aria-expanded={isEditing}
              >
                {isEditing ? "Cerrar" : "Editar"}
              </Button>
            ) : null}
          </div>
        </div>
        {phase.description ? (
          <p className="mt-1 text-xs text-muted">{phase.description}</p>
        ) : null}
      </div>
    </div>
  );
}

function MilestoneNode({
  numberLabel,
  milestone,
  canManage,
  isFocus,
  isExpanded,
  onToggleExpand,
  onToggleComplete,
  isEditing,
  onAction,
  handleProps,
}: {
  numberLabel: string;
  milestone: Milestone;
  canManage: boolean;
  isFocus: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleComplete: () => void;
  isEditing: boolean;
  onAction: (action: "start" | "skip" | "edit") => void;
  handleProps?: Record<string, unknown>;
}) {
  const size = TREE_NODE_SIZE.milestone;
  const isDone = ["completed", "skipped"].includes(milestone.status);
  const t = nodeTone(
    milestone.status === "completed"
      ? "done"
      : milestone.status === "in_progress"
        ? "active"
        : "idle",
  );
  const taskCount = milestone.milestone_task_links.length;

  const menuItems: Array<{ id: string; label: string }> = [];
  if (milestone.status === "pending")
    menuItems.push({ id: "start", label: "Empezar" });
  if (["pending", "in_progress"].includes(milestone.status))
    menuItems.push({ id: "skip", label: "Omitir" });
  menuItems.push({
    id: "edit",
    label: isEditing ? "Cerrar edición" : "Editar hito",
  });

  return (
    <div className="relative flex items-center gap-2.5">
      {/* El circulo de la izquierda ES el boton de completar: un clic aqui
          marca/desmarca el hito, sin abrir menus ni apuntar a un sitio fino. */}
      <button
        type="button"
        onClick={canManage ? onToggleComplete : undefined}
        aria-label={
          milestone.status === "completed"
            ? `Reabrir el hito ${milestone.name}`
            : `Completar el hito ${milestone.name}`
        }
        aria-pressed={milestone.status === "completed"}
        disabled={!canManage}
        className={[
          "z-10 flex shrink-0 items-center justify-center rounded-full border font-mono text-[0.65rem] font-semibold transition-transform",
          canManage ? "cursor-pointer hover:scale-110" : "cursor-default",
        ].join(" ")}
        style={{
          background: t.badgeBg,
          color: t.badgeText,
          borderColor: t.border,
          width: size,
          height: size,
        }}
      >
        {milestone.status === "completed" ? (
          <CheckIcon aria-hidden />
        ) : (
          milestone.position
        )}
      </button>
      <div
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors"
        style={{
          borderColor: t.border,
          background: isFocus ? "var(--color-brand-tint)" : t.bg,
        }}
        aria-current={isFocus ? "step" : undefined}
      >
        {canManage && handleProps ? (
          <DragHandle
            label={`Reordenar el hito ${milestone.name}`}
            handleProps={handleProps}
          />
        ) : null}
        {/* Todo el ancho restante es clic para expandir el detalle. */}
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md py-1 text-left hover:bg-black/[0.02]"
        >
          <span className="shrink-0 font-mono text-[0.65rem] text-muted">
            {numberLabel}
          </span>
          <OriginDot origin={milestone.created_by_origin ?? null} />
          <p
            className={[
              "min-w-0 flex-1 truncate text-xs font-medium",
              isDone ? "text-muted line-through" : "",
            ].join(" ")}
          >
            {milestone.name}
          </p>
          {isExpanded ? (
            <IconChevronUp className="shrink-0 text-[0.6rem] text-muted" aria-hidden />
          ) : (
            <IconChevronDown
              className="shrink-0 text-[0.6rem] text-muted"
              aria-hidden
            />
          )}
        </button>
        <span className="shrink-0 text-[0.65rem] text-muted">
          {MILESTONE_STATUS_LABELS[milestone.status] ?? milestone.status}
          {taskCount ? ` · ${taskCount} tareas` : ""}
        </span>
        {canManage ? (
          <RowMenu
            ariaLabel={`Más acciones del hito ${milestone.name}`}
            onAction={(key) => onAction(key as "start" | "skip" | "edit")}
            items={menuItems}
          />
        ) : null}
      </div>
    </div>
  );
}

// Wrappers sortables: envuelven el nodo con useSortable y le pasan el asa.
function SortablePhase({
  phase,
  children,
}: {
  phase: Phase;
  children: (handleProps: Record<string, unknown>) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: phase.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-20 opacity-80" : undefined}
    >
      {children({ ...attributes, ...listeners })}
    </li>
  );
}

function SortableMilestone({
  milestone,
  children,
}: {
  milestone: Milestone;
  children: (handleProps: Record<string, unknown>) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: milestone.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-20 opacity-80" : undefined}
    >
      {children({ ...attributes, ...listeners })}
    </li>
  );
}

// --- Formularios reutilizados en el panel de detalle ------------------------

function AddTaskForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    priority: string;
    dueAt: string;
  }) => Promise<void>;
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
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      priority,
      dueAt,
    });
    setIsSubmitting(false);
  }

  return (
    <Card title="Añadir tarea" className="mt-3">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <Field label="Título">
          <Input
            className="mt-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </Field>
        <Field label="Descripción (opcional)">
          <Textarea
            className="mt-2 h-20"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Field label="Prioridad">
            <Select
              className="mt-2"
              value={priority}
              onChange={setPriority}
              options={[
                { value: "low", label: "Baja" },
                { value: "medium", label: "Media" },
                { value: "high", label: "Alta" },
                { value: "urgent", label: "Urgente" },
              ]}
            />
          </Field>
          <Field label="Fecha límite">
            <Input
              type="date"
              className="mt-2 w-40"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !title.trim()}
          >
            {isSubmitting ? "Creando..." : "Crear tarea"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
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
  onSubmit: (payload: {
    name: string;
    description: string;
    targetDate: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [targetDate, setTargetDate] = useState(initialTargetDate ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    await onSubmit({
      name: name.trim(),
      description: description.trim(),
      targetDate,
    });
    setIsSubmitting(false);
  }

  return (
    <Card title={submitLabel} className="mt-2">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <Field label="Nombre">
          <Input
            className="mt-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Field label="Descripción (opcional)">
          <Textarea
            className="mt-2 h-20"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        {showTargetDate ? (
          <Field label="Fecha objetivo">
            <Input
              type="date"
              className="mt-2 w-40"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </Field>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? "Guardando..." : submitLabel}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TaskListItem({
  numberLabel,
  task,
}: {
  numberLabel: string;
  task: MilestoneTask;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-edge bg-surface px-2.5 py-1.5 text-sm">
      <span className="shrink-0 font-mono text-[0.65rem] text-muted">
        {numberLabel}
      </span>
      <OriginDot origin={task.created_by_origin ?? null} />
      <span
        className={[
          "min-w-0 flex-1 truncate",
          ["completed", "ignored", "cancelled"].includes(task.status)
            ? "text-muted line-through"
            : "",
        ].join(" ")}
      >
        {task.title}
      </span>
      <Badge tone="neutral">
        {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
      </Badge>
      <Badge tone="neutral">
        {TASK_STATUS_LABELS[task.status] ?? task.status}
      </Badge>
      {isTaskOverdue(task) ? (
        <Badge tone="danger">Vencida</Badge>
      ) : task.due_at ? (
        <span className="text-[0.65rem] text-muted">
          vence {formatDueDate(task.due_at)}
        </span>
      ) : null}
      {TASK_SOURCE_LABELS[task.source] ? (
        <Badge tone="brand">{TASK_SOURCE_LABELS[task.source]}</Badge>
      ) : null}
    </div>
  );
}

// Notas privadas del consultor sobre un hito -- el cliente nunca las ve (RLS
// de milestone_internal_notes ya lo garantiza en el backend, aqui solo se
// monta el componente cuando isConsultantView). Se cargan aparte del arbol
// principal del plan porque su RLS es distinta (ver getStrategicPlan).
function MilestoneInternalNotes({
  organizationId,
  milestoneId,
}: {
  organizationId: string;
  milestoneId: string;
}) {
  const [notes, setNotes] = useState<InternalNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/milestones/${milestoneId}/internal-notes`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      const data = (await response.json()) as { notes: InternalNote[] };
      setNotes(data.notes);
      setError(null);
    } catch {
      setError("No se pudieron cargar las notas internas. Reintenta.");
    }
  }, [organizationId, milestoneId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/milestones/${milestoneId}/internal-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: draft.trim() }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setDraft("");
      await loadNotes();
    } catch {
      setError("No se pudo guardar la nota interna. Reintenta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-2 border-t border-edge pt-2">
      <p className={EYEBROW}>Notas internas (solo consultores)</p>
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : notes === null ? (
        <p className="mt-1 text-xs text-muted">Cargando...</p>
      ) : notes.length === 0 ? (
        <p className="mt-1 text-xs text-muted">Sin notas todavía.</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {notes.map((note) => (
            <li key={note.id} className="text-xs">
              <p className="leading-5">{note.body}</p>
              <p className="text-[0.6rem] text-muted">
                {new Date(note.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form className="mt-2 flex gap-2" onSubmit={submitNote}>
        <Input
          className="min-w-0 flex-1"
          aria-label="Nueva nota interna"
          placeholder="Añadir nota interna..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={isSubmitting || !draft.trim()}>
          Añadir
        </Button>
      </form>
    </div>
  );
}

// Objetivos de negocio y su progresion (peticion de Rafa 2026-08-27: Mi
// Camino no es onboarding, es donde consultor y cliente ven objetivos y
// cuanto se ha avanzado). El "real" siempre viene calculado por el backend
// contra los ultimos 30 dias -- aqui solo se pinta lo que devuelve
// /objectives, ningun calculo de metricas se duplica en el cliente.
function ObjectiveCard({
  objective,
  canManage,
  isRemoving,
  isSavingActual,
  onRemove,
  onSetActual,
}: {
  objective: Objective;
  canManage: boolean;
  isRemoving: boolean;
  isSavingActual: boolean;
  onRemove: () => void;
  onSetActual: (value: number) => void;
}) {
  const statusInfo: Record<Objective["status"], { label: string; tone: Tone }> = {
    cumplido: { label: "Cumplido", tone: "success" },
    en_curso: { label: "En curso", tone: "brand" },
    sin_datos: { label: "Sin datos", tone: "neutral" },
  };
  const info = statusInfo[objective.status];
  const progress = objective.progress_pct;
  // Objetivo de valor manual: el "actual" lo teclea el consultor aqui mismo,
  // no sale de ninguna metrica de plataforma.
  const isManual = objective.source === "manual";
  const [isEditingActual, setIsEditingActual] = useState(false);
  const [actualDraft, setActualDraft] = useState(
    objective.actual_value !== null ? String(objective.actual_value) : "",
  );

  return (
    <div className="rounded-md border border-edge p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={EYEBROW}>
            Objetivo{" "}
            {OBJECTIVE_PERIOD_LABELS[objective.period] ?? objective.period}
            {isManual ? " · manual" : ""}
          </p>
          <p className="mt-1 font-medium">{objective.label}</p>
        </div>
        <Badge tone={info.tone}>{info.label}</Badge>
      </div>
      {isManual && isEditingActual ? (
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(actualDraft);
            if (!Number.isFinite(value) || value < 0) return;
            onSetActual(value);
            setIsEditingActual(false);
          }}
        >
          <Field label="Valor actual">
            <Input
              className="mt-1 w-36"
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={actualDraft}
              onChange={(event) => setActualDraft(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" size="sm" disabled={isSavingActual}>
            {isSavingActual ? "Guardando..." : "Guardar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsEditingActual(false)}
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <div className="mt-3 flex items-baseline gap-2">
          <p className="font-mono text-2xl tracking-tight">
            {objective.actual_value !== null
              ? formatObjectiveValue(objective.actual_value, objective.unit)
              : "—"}
          </p>
          <p className="text-sm text-muted">
            de {formatObjectiveValue(objective.target_value, objective.unit)}{" "}
            objetivo
          </p>
          {isManual && canManage ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto min-h-8 min-w-8 px-2"
              aria-label={
                objective.actual_value !== null
                  ? "Editar valor actual"
                  : "Añadir valor actual"
              }
              onClick={() => {
                setActualDraft(
                  objective.actual_value !== null
                    ? String(objective.actual_value)
                    : "",
                );
                setIsEditingActual(true);
              }}
            >
              {objective.actual_value !== null ? (
                <PencilIcon aria-hidden />
              ) : (
                <PlusIcon aria-hidden />
              )}
            </Button>
          ) : null}
        </div>
      )}
      {progress !== null ? (
        <ProgressBar
          value={Math.min(100, progress)}
          aria-label={`Progreso de ${objective.label}`}
          className="mt-2"
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      ) : (
        <p className="mt-2 text-xs text-muted">
          {isManual
            ? "Introduce el valor actual para ver el progreso."
            : "Sin datos todavía para esta métrica en los últimos 30 días."}
        </p>
      )}
      {canManage ? (
        <Button
          className="mt-3"
          size="sm"
          variant="ghost"
          disabled={isRemoving}
          onClick={onRemove}
        >
          {isRemoving ? "Quitando..." : "Quitar objetivo"}
        </Button>
      ) : null}
    </div>
  );
}

function AddObjectiveModal({
  isOpen,
  catalog,
  existingKeys,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  catalog: ObjectiveCatalogEntry[];
  existingKeys: string[];
  onClose: () => void;
  onSubmit: (payload: {
    metricKey: string;
    targetValue: number;
    period: string;
  }) => Promise<boolean>;
}) {
  const available = catalog;
  const [metricKey, setMetricKey] = useState(available[0]?.key ?? "");
  const [targetValue, setTargetValue] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const alreadySet = existingKeys.includes(metricKey);

  // Cada apertura arranca en limpio: sin esto, un intento abandonado deja los
  // valores tecleados para la siguiente vez que se abre el modal.
  useEffect(() => {
    if (isOpen) {
      setMetricKey(available[0]?.key ?? "");
      setTargetValue("");
      setPeriod("monthly");
    }
  }, [isOpen, available]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(targetValue);
    if (!metricKey || !Number.isFinite(value) || value < 0) return;
    setIsSubmitting(true);
    const created = await onSubmit({ metricKey, targetValue: value, period });
    setIsSubmitting(false);
    if (created) {
      setTargetValue("");
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog aria-label="Añadir objetivo">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Añadir objetivo</Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSubmit}>
              <Modal.Body>
                <div className="space-y-3">
                  <Field label="Métrica">
                    <Select
                      className="mt-2"
                      value={metricKey}
                      onChange={setMetricKey}
                      options={available.map((entry) => ({
                        value: entry.key,
                        label: entry.label,
                      }))}
                    />
                  </Field>
                  {alreadySet ? (
                    <p className="text-xs text-muted">
                      Ya hay un objetivo activo para esta métrica: guardar
                      reemplaza el valor actual.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <Field label="Valor objetivo">
                      <Input
                        className="mt-2 w-40"
                        type="number"
                        step="0.01"
                        min="0"
                        value={targetValue}
                        onChange={(event) => setTargetValue(event.target.value)}
                        required
                      />
                    </Field>
                    <Field label="Periodo">
                      <Select
                        className="mt-2"
                        value={period}
                        onChange={setPeriod}
                        options={[
                          { value: "monthly", label: "Mensual" },
                          { value: "quarterly", label: "Trimestral" },
                          { value: "yearly", label: "Anual" },
                        ]}
                      />
                    </Field>
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !metricKey || !targetValue}
                >
                  {isSubmitting ? "Guardando..." : "Guardar objetivo"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function ObjectivesPanel({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const [data, setData] = useState<ObjectivesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingActualId, setSavingActualId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/objectives`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setData((await response.json()) as ObjectivesResponse);
      setError(null);
    } catch {
      setError("No se pudieron cargar los objetivos. Reintenta.");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addObjective(payload: {
    metricKey: string;
    targetValue: number;
    period: string;
  }) {
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/objectives`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return false;
      }
      toast.success("Objetivo guardado.");
      await load();
      return true;
    } catch {
      setError("No se pudo guardar el objetivo. Reintenta.");
      return false;
    }
  }

  async function removeObjective(id: string) {
    setRemovingId(id);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/objectives/${id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await load();
    } catch {
      setError("No se pudo quitar el objetivo. Reintenta.");
    } finally {
      setRemovingId(null);
    }
  }

  async function setObjectiveActual(id: string, value: number) {
    setSavingActualId(id);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/objectives/${id}/actual`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      await load();
    } catch {
      setError("No se pudo guardar el valor actual. Reintenta.");
    } finally {
      setSavingActualId(null);
    }
  }

  return (
    <Card
      title="Objetivos"
      description="Metas de negocio con progreso real calculado sobre los últimos 30 días."
      actions={
        canManage ? (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => setIsAdding(true)}
          >
            + Objetivo
          </Button>
        ) : null
      }
    >
      {error ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-edge bg-surface px-3 py-2 text-xs text-muted">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-3">
          <LoadingBlock label="Cargando objetivos..." />
        </div>
      ) : data && data.objectives.length > 0 ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.objectives.map((objective) => (
            <ObjectiveCard
              key={objective.id}
              objective={objective}
              canManage={canManage}
              isRemoving={removingId === objective.id}
              isSavingActual={savingActualId === objective.id}
              onRemove={() => void removeObjective(objective.id)}
              onSetActual={(value) =>
                void setObjectiveActual(objective.id, value)
              }
            />
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState
            title="Sin objetivos definidos"
            hint={
              canManage
                ? "Añade el primero desde «+ Objetivo»: ingresos, margen, ROAS, CAC, pedidos, ticket medio o stock."
                : "Tu consultor todavía no ha definido objetivos para este negocio."
            }
          />
        </div>
      )}

      {data ? (
        <AddObjectiveModal
          isOpen={isAdding}
          catalog={data.catalog}
          existingKeys={data.objectives.map((objective) => objective.metric_key)}
          onClose={() => setIsAdding(false)}
          onSubmit={addObjective}
        />
      ) : null}
    </Card>
  );
}

// --- Contenido principal -----------------------------------------------------

function PlanContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;
  const membership = bootstrap.memberships.find(
    (item) => item.organization_id === (organization?.id ?? ""),
  );
  const isConsultantView = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const canManage =
    isConsultantView || ["owner", "manager"].includes(membership?.role ?? "");

  const [payload, setPayload] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planOutline, setPlanOutline] = useState("");
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(
    null,
  );
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [addingMilestonePhaseId, setAddingMilestonePhaseId] = useState<
    string | null
  >(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(
    null,
  );
  const [addingTaskMilestoneId, setAddingTaskMilestoneId] = useState<
    string | null
  >(null);
  const [isAddingPhase, setIsAddingPhase] = useState(false);
  const organizationId = organization?.id ?? null;

  // distance:6 -> un clic normal no dispara arrastre, solo si mueves el puntero.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const loadPlan = useCallback(async () => {
    if (!organizationId) {
      setPayload(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/strategic-plan`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setPayload((await response.json()) as PlanResponse);
      setError(null);
    } catch {
      setError(
        "No se pudo cargar el plan estratégico por un error de red. Reintenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  async function submitPlanMutation(
    path: string,
    init: RequestInit,
    successMessage: string,
  ): Promise<boolean> {
    try {
      const response = await apiFetch(path, init);
      if (!response.ok) {
        setError(await readApiError(response));
        return false;
      }
      toast.success(successMessage);
      void loadPlan();
      return true;
    } catch {
      setError(
        "No se pudo completar la operación del plan por un error de red. Reintenta.",
      );
      return false;
    }
  }

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organization) return;

    const phases: Array<{ name: string; milestones: Array<{ name: string }> }> =
      [];
    for (const rawLine of planOutline.split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/^fase\s*:/i.test(line)) {
        phases.push({
          name: line.replace(/^fase\s*:/i, "").trim(),
          milestones: [],
        });
      } else if (phases.length > 0) {
        phases[phases.length - 1].milestones.push({
          name: line.replace(/^[-*]\s*/, ""),
        });
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/strategic-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: planName, phases }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setPlanName("");
      setPlanOutline("");
      toast.success("Plan creado en borrador.");
      void loadPlan();
    } catch {
      setError(
        "No se pudo crear el plan por un error de red. Revisa la conexión y reintenta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function activatePlan(planId: string) {
    if (!organization) return;
    await submitPlanMutation(
      `/v1/organizations/${organization.id}/strategic-plan/${planId}/activate`,
      { method: "POST" },
      "Plan activado.",
    );
  }

  async function changeMilestoneStatus(milestoneId: string, status: string) {
    if (!organization) return;
    await submitPlanMutation(
      `/v1/organizations/${organization.id}/milestones/${milestoneId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
      "Estado del hito actualizado.",
    );
  }

  function toggleMilestoneComplete(milestone: Milestone) {
    void changeMilestoneStatus(
      milestone.id,
      milestone.status === "completed" ? "pending" : "completed",
    );
  }

  // Reorden por drag & drop: se reordena de forma optimista sobre `payload` y
  // luego se confirma en el backend; si falla, `loadPlan` restaura el orden real.
  async function persistReorder(path: string, orderedIds: string[]) {
    if (!organization) return;
    try {
      const response = await apiFetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        void loadPlan();
      }
    } catch {
      setError("No se pudo guardar el nuevo orden. Reintenta.");
      void loadPlan();
    }
  }

  function handlePhaseDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !plan) return;
    const ordered = phases.slice().sort((a, b) => a.position - b.position);
    const oldIndex = ordered.findIndex((p) => p.id === active.id);
    const newIndex = ordered.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ordered, oldIndex, newIndex).map((p, index) => ({
      ...p,
      position: index + 1,
    }));
    setPayload((current) =>
      current?.plan
        ? { ...current, plan: { ...current.plan, strategic_plan_phases: next } }
        : current,
    );
    void persistReorder(
      `/v1/organizations/${organization?.id}/strategic-plan/${plan.id}/phases/reorder`,
      next.map((p) => p.id),
    );
  }

  function handleMilestoneDragEnd(phaseId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !plan) return;
    const phase = phases.find((p) => p.id === phaseId);
    if (!phase) return;
    const ordered = phase.strategic_plan_milestones
      .slice()
      .sort((a, b) => a.position - b.position);
    const oldIndex = ordered.findIndex((m) => m.id === active.id);
    const newIndex = ordered.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextMilestones = arrayMove(ordered, oldIndex, newIndex).map(
      (m, index) => ({ ...m, position: index + 1 }),
    );
    setPayload((current) =>
      current?.plan
        ? {
            ...current,
            plan: {
              ...current.plan,
              strategic_plan_phases: current.plan.strategic_plan_phases.map(
                (p) =>
                  p.id === phaseId
                    ? { ...p, strategic_plan_milestones: nextMilestones }
                    : p,
              ),
            },
          }
        : current,
    );
    void persistReorder(
      `/v1/organizations/${organization?.id}/strategic-plan/phases/${phaseId}/milestones/reorder`,
      nextMilestones.map((m) => m.id),
    );
  }

  async function editMilestone(
    milestoneId: string,
    payload2: { name: string; description: string; targetDate: string },
  ) {
    if (!organization) return;
    return submitPlanMutation(
      `/v1/organizations/${organization.id}/milestones/${milestoneId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload2.name,
          description: payload2.description || null,
          targetDate: payload2.targetDate || null,
        }),
      },
      "Hito actualizado.",
    );
  }

  async function editPhase(
    phaseId: string,
    payload2: { name: string; description: string },
  ) {
    if (!organization) return;
    return submitPlanMutation(
      `/v1/organizations/${organization.id}/strategic-plan/phases/${phaseId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload2.name,
          description: payload2.description || null,
        }),
      },
      "Fase actualizada.",
    );
  }

  async function addMilestoneTask(
    milestoneId: string,
    payload2: {
      title: string;
      description: string;
      priority: string;
      dueAt: string;
    },
  ) {
    if (!organization) return;
    return submitPlanMutation(
      `/v1/organizations/${organization.id}/milestones/${milestoneId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload2.title,
          description: payload2.description || null,
          priority: payload2.priority,
          dueAt: payload2.dueAt || null,
        }),
      },
      "Tarea creada y enlazada al hito.",
    );
  }

  async function addMilestone(
    phaseId: string,
    payload2: { name: string; description: string; targetDate: string },
  ) {
    if (!organization) return;
    return submitPlanMutation(
      `/v1/organizations/${organization.id}/strategic-plan/phases/${phaseId}/milestones`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload2.name,
          description: payload2.description || null,
          targetDate: payload2.targetDate || null,
        }),
      },
      "Hito creado.",
    );
  }

  async function addPhase(payload2: { name: string; description: string }) {
    if (!organization || !plan) return;
    const saved = await submitPlanMutation(
      `/v1/organizations/${organization.id}/strategic-plan/${plan.id}/phases`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: payload2.name,
          description: payload2.description || null,
        }),
      },
      "Fase creada.",
    );
    if (saved) {
      setIsAddingPhase(false);
    }
  }

  const plan = payload?.plan ?? null;
  const phases = (plan?.strategic_plan_phases ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);
  const totalMilestones = phases.reduce(
    (sum, phase) => sum + phase.strategic_plan_milestones.length,
    0,
  );
  const doneMilestones = phases.reduce(
    (sum, phase) =>
      sum +
      phase.strategic_plan_milestones.filter((m) =>
        ["completed", "skipped"].includes(m.status),
      ).length,
    0,
  );

  // "Donde estas ahora": orienta a quien abre el plan sin tener que leer todo
  // el arbol de fases. La fase activa manda; dentro de ella, el hito en curso
  // o, si ninguno arranco todavia, el primer hito pendiente por posicion.
  const activePhase = phases.find((phase) => phase.status === "active") ?? null;
  const focusMilestone = activePhase
    ? (activePhase.strategic_plan_milestones
        .slice()
        .sort((a, b) => a.position - b.position)
        .find((m) => m.status === "in_progress") ??
      activePhase.strategic_plan_milestones
        .slice()
        .sort((a, b) => a.position - b.position)
        .find((m) => m.status === "pending") ??
      null)
    : null;

  return (
    <div className="portal-page space-y-6">
      {organizationId ? (
        <ObjectivesPanel organizationId={organizationId} canManage={canManage} />
      ) : null}

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {isLoading ? (
        <AsyncState status="loading" loadingLabel="Cargando plan..." />
      ) : plan ? (
        <>
          <Card
            kicker={`v${plan.version} · ${displayValue(plan.status)}`}
            title={plan.name}
            description={plan.description ?? undefined}
            actions={
              <div className="flex items-center gap-2">
                {plan.status === "draft" && canManage ? (
                  <Button
                    type="button"
                    onClick={() => void activatePlan(plan.id)}
                  >
                    Activar plan
                  </Button>
                ) : null}
              </div>
            }
          >
            {totalMilestones > 0 ? (
              <ProgressBar
                value={(doneMilestones / totalMilestones) * 100}
                aria-label="Progreso del plan"
              >
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
            {activePhase ? (
              <p className="mt-2 text-sm">
                {isConsultantView ? "El cliente está en" : "Estás en"} la fase{" "}
                <strong className="font-semibold">{activePhase.name}</strong>
                {focusMilestone ? (
                  <>
                    , en el hito{" "}
                    <strong className="font-semibold">
                      {focusMilestone.name}
                    </strong>
                    {focusMilestone.target_date
                      ? ` (objetivo ${focusMilestone.target_date})`
                      : ""}
                    .
                  </>
                ) : (
                  ", sin ningún hito en curso todavía."
                )}
              </p>
            ) : null}
            <div className="mt-2 flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <OriginDot origin="consultant" /> Propuesto por consultor
              </span>
              <span className="flex items-center gap-1.5">
                <OriginDot origin="client" /> Propuesto por cliente
              </span>
            </div>
          </Card>

          {phases.length === 0 && !canManage ? (
            <EmptyState
              title="Este plan todavía no tiene fases"
              hint="Tu consultor todavía está preparando las fases del plan."
            />
          ) : null}

          <div className="relative pb-1">
            {phases.length > 0 ? (
              <TreeTrunk size={TREE_NODE_SIZE.phase} />
            ) : null}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handlePhaseDragEnd}
            >
              <SortableContext
                items={phases.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
            <ol className="space-y-6">
              {phases.map((phase) => {
                const milestones = phase.strategic_plan_milestones
                  .slice()
                  .sort((a, b) => a.position - b.position);
                const isEditingPhase = editingPhaseId === phase.id;
                const isAddingMilestone = addingMilestonePhaseId === phase.id;
                return (
                  <SortablePhase key={phase.id} phase={phase}>
                    {(phaseHandle) => (
                      <>
                    <PhaseNode
                      phase={phase}
                      canManage={canManage}
                      isEditing={isEditingPhase}
                      onEdit={() =>
                        setEditingPhaseId(isEditingPhase ? null : phase.id)
                      }
                      handleProps={phaseHandle}
                    />

                    {isEditingPhase ? (
                      <div className="ml-12 mt-2">
                        <NameDescriptionForm
                          initialName={phase.name}
                          initialDescription={phase.description ?? ""}
                          submitLabel="Guardar"
                          onCancel={() => setEditingPhaseId(null)}
                          onSubmit={async (payload) => {
                            if (await editPhase(phase.id, payload)) {
                              setEditingPhaseId(null);
                            }
                          }}
                        />
                      </div>
                    ) : null}

                    <div className="relative ml-5 mt-3">
                      {milestones.length > 0 ? (
                        <TreeTrunk size={TREE_NODE_SIZE.milestone} />
                      ) : null}
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) =>
                          handleMilestoneDragEnd(phase.id, event)
                        }
                      >
                        <SortableContext
                          items={milestones.map((m) => m.id)}
                          strategy={verticalListSortingStrategy}
                        >
                      <ol className="space-y-2.5">
                        {milestones.map((milestone, milestoneIndex) => {
                          const isMilestoneExpanded =
                            expandedMilestoneId === milestone.id;
                          const isEditingMilestone =
                            editingMilestoneId === milestone.id;
                          const isAddingTask =
                            addingTaskMilestoneId === milestone.id;
                          const tasks = milestone.milestone_task_links
                            .map((link) => link.tasks)
                            .filter((task): task is MilestoneTask =>
                              Boolean(task),
                            );
                          return (
                            <SortableMilestone
                              key={milestone.id}
                              milestone={milestone}
                            >
                              {(milestoneHandle) => (
                                <>
                              <MilestoneNode
                                numberLabel={`${phase.position}.${milestoneIndex + 1}`}
                                milestone={milestone}
                                canManage={canManage}
                                isFocus={focusMilestone?.id === milestone.id}
                                isExpanded={isMilestoneExpanded}
                                onToggleExpand={() =>
                                  setExpandedMilestoneId(
                                    isMilestoneExpanded ? null : milestone.id,
                                  )
                                }
                                onToggleComplete={() =>
                                  toggleMilestoneComplete(milestone)
                                }
                                isEditing={isEditingMilestone}
                                handleProps={milestoneHandle}
                                onAction={(action) => {
                                  if (action === "start") {
                                    void changeMilestoneStatus(
                                      milestone.id,
                                      "in_progress",
                                    );
                                  } else if (action === "skip") {
                                    void changeMilestoneStatus(
                                      milestone.id,
                                      "skipped",
                                    );
                                  } else {
                                    setEditingMilestoneId(
                                      isEditingMilestone ? null : milestone.id,
                                    );
                                  }
                                }}
                              />

                              {isEditingMilestone ? (
                                <div className="ml-11 mt-2">
                                  <NameDescriptionForm
                                    initialName={milestone.name}
                                    initialDescription={
                                      milestone.description ?? ""
                                    }
                                    initialTargetDate={
                                      milestone.target_date ?? ""
                                    }
                                    showTargetDate
                                    submitLabel="Guardar"
                                    onCancel={() => setEditingMilestoneId(null)}
                                    onSubmit={async (payload) => {
                                      if (
                                        await editMilestone(
                                          milestone.id,
                                          payload,
                                        )
                                      ) {
                                        setEditingMilestoneId(null);
                                      }
                                    }}
                                  />
                                </div>
                              ) : null}

                              {isMilestoneExpanded ? (
                                <div className="ml-11 mt-2 space-y-2">
                                  {milestone.description ? (
                                    <p className="text-xs text-muted">
                                      {milestone.description}
                                    </p>
                                  ) : null}
                                  {milestone.target_date ? (
                                    <p className="text-xs text-muted">
                                      objetivo {milestone.target_date}
                                    </p>
                                  ) : null}
                                  {tasks.length > 0 ? (
                                    <ul className="flex flex-wrap gap-1.5">
                                      {tasks.map((task, taskIndex) => (
                                        <li key={task.id}>
                                          <TaskListItem
                                            numberLabel={`${phase.position}.${milestoneIndex + 1}.${taskIndex + 1}`}
                                            task={task}
                                          />
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                  {canManage ? (
                                    isAddingTask ? (
                                      <AddTaskForm
                                        onCancel={() =>
                                          setAddingTaskMilestoneId(null)
                                        }
                                        onSubmit={async (payload) => {
                                          if (
                                            await addMilestoneTask(
                                              milestone.id,
                                              payload,
                                            )
                                          ) {
                                            setAddingTaskMilestoneId(null);
                                          }
                                        }}
                                      />
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          setAddingTaskMilestoneId(
                                            milestone.id,
                                          )
                                        }
                                      >
                                        + Tarea
                                      </Button>
                                    )
                                  ) : null}
                                  {isConsultantView ? (
                                    <MilestoneInternalNotes
                                      organizationId={organization?.id ?? ""}
                                      milestoneId={milestone.id}
                                    />
                                  ) : null}
                                </div>
                              ) : null}
                                </>
                              )}
                            </SortableMilestone>
                          );
                        })}
                      </ol>
                        </SortableContext>
                      </DndContext>
                      <ol className="mt-2.5">
                        {canManage ? (
                          <li>
                            {isAddingMilestone ? (
                              <div className="ml-1">
                                <NameDescriptionForm
                                  initialName=""
                                  initialDescription=""
                                  initialTargetDate=""
                                  showTargetDate
                                  submitLabel="Crear hito"
                                  onCancel={() =>
                                    setAddingMilestonePhaseId(null)
                                  }
                                  onSubmit={async (payload) => {
                                    if (
                                      await addMilestone(phase.id, payload)
                                    ) {
                                      setAddingMilestonePhaseId(null);
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <TreeAddNode
                                size={TREE_NODE_SIZE.milestone}
                                label="Añadir hito"
                                isOpen={false}
                                onClick={() =>
                                  setAddingMilestonePhaseId(phase.id)
                                }
                              />
                            )}
                          </li>
                        ) : null}
                      </ol>
                    </div>
                      </>
                    )}
                  </SortablePhase>
                );
              })}
            </ol>
              </SortableContext>
            </DndContext>
            <ol>
              {canManage ? (
                <li>
                  {isAddingPhase ? (
                    <div className="ml-12">
                      <NameDescriptionForm
                        initialName=""
                        initialDescription=""
                        submitLabel="Crear fase"
                        onCancel={() => setIsAddingPhase(false)}
                        onSubmit={addPhase}
                      />
                    </div>
                  ) : (
                    <TreeAddNode
                      size={TREE_NODE_SIZE.phase}
                      label="Añadir fase"
                      isOpen={false}
                      onClick={() => setIsAddingPhase(true)}
                    />
                  )}
                </li>
              ) : null}
            </ol>
          </div>
        </>
      ) : (
        <Card title="Sin plan estrategico">
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
                placeholder={
                  "Fase: Fundamentos\n- Configurar costes y gastos fijos\n- Cargar costes de producto\nFase: Adquisicion\n- Conectar Meta Ads\n- Definir presupuesto inicial"
                }
                required
              />
              <p className="text-xs text-muted">
                Formato: cada linea &quot;Fase: nombre&quot; abre una fase; las
                lineas siguientes son sus hitos.
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

// --- Estado "vista general" de /camino (consultor sin cliente activo):
// listado de todos los clientes con su salud y por donde va su plan. ---

type ConsultantPlanRow = {
  organization_id: string;
  display_name: string;
  health_tier: "urgente" | "revisar" | "vigilar" | "al_dia";
  health_score: number;
  overdue_tasks: number;
  critical_alerts: number;
  plan: {
    id: string;
    name: string;
    status: string;
    version: number;
    phase_count: number;
    active_phase: string | null;
    milestones_total: number;
    milestones_done: number;
    progress_pct: number;
  } | null;
};

const PLAN_HEALTH_META: Record<
  ConsultantPlanRow["health_tier"],
  { label: string; tone: Tone }
> = {
  urgente: { label: "Urgente", tone: "danger" },
  revisar: { label: "Revisar", tone: "warn" },
  vigilar: { label: "Vigilar", tone: "neutral" },
  al_dia: { label: "Al día", tone: "success" },
};

function ConsultantPlansView() {
  const { setOrganizationId } = useActiveOrganization();
  const [rows, setRows] = useState<ConsultantPlanRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch("/v1/consultant/plans")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const payload = (await response.json()) as {
          portfolio: ConsultantPlanRow[];
        };
        setRows(payload.portfolio);
        setError(null);
      })
      .catch(() => {
        if (!cancelled)
          setError("No se pudo cargar el estado de los planes por un error de red.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading && !rows) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando planes de la cartera..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="portal-page">
        <ErrorBlock>{error}</ErrorBlock>
      </div>
    );
  }
  if (!rows) return null;

  const sorted = [...rows].sort((a, b) => b.health_score - a.health_score);
  const withoutPlan = rows.filter((row) => !row.plan).length;

  // El gráfico solo aporta comparando: 2+ clientes con plan.
  const progressChartData = sorted
    .filter((row) => row.plan)
    .map((row) => ({
      name: row.display_name,
      progress: row.plan?.progress_pct ?? 0,
    }));

  return (
    <div className="portal-page space-y-6">
      <Card
        title="Mi Camino · toda la cartera"
        description={`${rows.length} clientes · ${withoutPlan} sin plan estratégico. Elige uno para trabajar su plan.`}
      >
        {progressChartData.length >= 2 ? (
          <div className="mb-6">
            <p className={EYEBROW}>Progreso del plan por cliente (%)</p>
            <div className="mt-2">
              <BarChart
                data={progressChartData}
                xKey="name"
                series={[{ key: "progress", label: "Progreso" }]}
                horizontal
                height={Math.max(120, progressChartData.length * 40)}
                valueFormatter={(value) => `${Math.round(value)}%`}
              />
            </div>
          </div>
        ) : null}

        {sorted.length === 0 ? (
          <EmptyState
            title="Aún no tienes clientes asignados"
            hint="Cuando se te asigne una organización, su plan aparecerá aquí."
          />
        ) : (
          <List>
            {sorted.map((row) => (
              <List.Item
                as="button"
                key={row.organization_id}
                type="button"
                onClick={() => setOrganizationId(row.organization_id)}
                className="grid w-full gap-2 py-3 text-left hover:bg-surface md:grid-cols-[1.4fr_1fr_1.6fr] md:items-center"
              >
                <div className="flex items-center gap-2">
                  <Badge tone={PLAN_HEALTH_META[row.health_tier].tone}>
                    {PLAN_HEALTH_META[row.health_tier].label}
                  </Badge>
                  <span className="font-medium">{row.display_name}</span>
                </div>

                <div className="text-xs text-muted">
                  {row.plan ? (
                    <>
                      <span className="text-ink">{row.plan.name}</span>
                      {" · "}
                      {displayValue(row.plan.status)}
                      {row.plan.active_phase ? (
                        <>
                          {" · fase: "}
                          {row.plan.active_phase}
                        </>
                      ) : null}
                    </>
                  ) : (
                    <Badge tone="warn">Sin plan estratégico</Badge>
                  )}
                </div>

                <div>
                  {row.plan ? (
                    <>
                      <ProgressBar value={row.plan.progress_pct} />
                      <p className="mt-1 text-xs text-muted">
                        {row.plan.milestones_done}/{row.plan.milestones_total}{" "}
                        hitos ({row.plan.progress_pct}%)
                        {row.overdue_tasks > 0
                          ? ` · ${row.overdue_tasks} tareas vencidas`
                          : ""}
                        {row.critical_alerts > 0
                          ? ` · ${row.critical_alerts} alertas críticas`
                          : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted">
                      {row.overdue_tasks > 0
                        ? `${row.overdue_tasks} tareas vencidas`
                        : "—"}
                    </p>
                  )}
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}

function StrategicPlanRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (isConsultant && !organizationId) {
    return <ConsultantPlansView />;
  }

  return <PlanContent bootstrap={bootstrap} />;
}

function StrategicPlanPageContent() {
  return (
    <PortalShell title="Mi Camino">
      {(bootstrap) => <StrategicPlanRouter bootstrap={bootstrap} />}
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
