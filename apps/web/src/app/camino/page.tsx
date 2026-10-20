"use client";

import { useSearchParams } from "next/navigation";
import {
  FormEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { WorkPageHeader } from "@/components/trabajo-ui";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import { readApiError } from "@/lib/api-error";
import { invalidateCachedQueries, useCachedQuery } from "@/lib/use-cached-query";
import { formatMoney } from "@/lib/money";
import { ModuleSummary } from "@/components/module-summary";
import { useMetricAnalysis } from "@/components/metric-verdict";
import { useAssignedConsultant } from "@/hooks/use-assigned-consultant";
import { clientNextStep } from "./next-step";
import { CaminoMap, type DiscussTopic } from "./camino-map";
import { DiscussModal } from "@/components/discuss-modal";
import { DraftNotice } from "./draft-notice";
import { draftReadiness } from "./draft-readiness";
import { formatEffort, metaOwnerLabel, taskWantsEmailDraft, type PlanTaskMeta } from "./plan-task-meta";
import s from "./camino-map.module.css";
import d from "./camino-desk.module.css";
import { CaminoRoutesView, type CaminoRoute } from "./camino-routes-view";
import { CAMINO_CURRENCIES, CaminoCreatePanel } from "./camino-create-panel";
import { ACTIVE_CONNECTION_STORAGE_KEY } from "@/components/active-connection";
import { CaminoProposalDecision, type StoredCaminoProposal } from "./proposal-decision";
import { isPast } from "@/lib/elapsed";
import { latestMarketingAssetByTask, marketingAssetHref, marketingAssetStatusLabel, type CaminoMarketingAsset } from "@/lib/camino-marketing-assets";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  CheckIcon,
  ConfirmDialog,
  Dialog,
  Dropdown,
  EmptyState,
  ErrorBlock,
  Field,
  GripVerticalIcon,
  IconChevronDown,
  IconChevronUp,
  Input,
  Label,
  List,
  LoadingBlock,
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
  description?: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  categories?: string[];
  source: string;
  created_by_origin?: CreatorOrigin;
  plan_meta?: PlanTaskMeta | null;
};

const taskCanGenerateMarketing = taskWantsEmailDraft;

type Milestone = {
  id: string;
  name: string;
  description: string | null;
  success_criteria?: string | null;
  rationale?: string | null;
  position: number;
  status: string;
  target_date: string | null;
  completed_at: string | null;
  completion_evidence?: string | null;
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
  horizon_months?: number | null;
  currency_code?: string | null;
  goal?: {
    metric_key: string;
    metric_label: string;
    unit: "money" | "pct" | "count" | "ratio";
    currency_code: string | null;
    baseline: number | null;
    target: number | null;
    target_offset_days: number;
    baseline_window_days?: number;
    baseline_observed_at?: string;
    target_date?: string;
    rationale: string;
    assumptions: string[];
    decision_gates?: Array<{ decision: string; proceed_when: string; hold_when: string; evidence_needed: string }>;
    confidence: "low" | "medium" | "high";
  } | null;
  status: string;
  version: number;
  starts_on: string | null;
  completed_on: string | null;
  strategic_plan_phases: Phase[];
};

type PlanResponse = {
  organization_id: string;
  plan: Plan | null;
  weekly_reviews?: CaminoWeeklyReviewRecord[];
  marketing_assets?: CaminoMarketingAsset[];
  marketing_assets_available?: boolean;
};

type CaminoWeeklyReviewRecord = {
  id: string;
  period_start: string;
  period_end: string;
  created_at: string;
  status?: "running" | "succeeded" | "failed";
  trigger_kind?: "scheduled" | "objective_change";
  can_retry?: boolean;
  proposals?: StoredCaminoProposal[];
  output: {
    executive_summary: string;
    goal_progress: {
      status: string;
      explanation: string;
      observed_value: number | null;
      comparison_value: number | null;
      baseline_value?: number | null;
      expected_value?: number | null;
      target_value?: number | null;
      metric_label?: string;
      unit?: "money" | "pct" | "count" | "ratio";
      measurement_period?: "equivalent_monthly" | "calendar_month_to_date" | "rolling_7_days" | "point_in_time";
      measurement_window_days?: number;
    };
    progress: Array<{ item: string; status: string; evidence: string }>;
    risks: Array<{ severity: string; detail: string; evidence: string }>;
    learnings?: Array<{ title: string; learning: string; evidence: string; applies_to: string; confidence: string }>;
    next_actions: Array<{ priority: string; title: string; rationale: string; owner: string; due_in_days: number }>;
    change_proposals: Array<{ change: string; target_type: string; target_id: string | null; description: string; reason: string; evidence: string }>;
    confidence: string;
    warnings: string[];
  } | null;
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
  milestone_id: string | null;
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

function formatObjectiveValue(
  value: number,
  unit: ObjectiveCatalogEntry["unit"],
  currency = "EUR",
) {
  if (unit === "money") return formatMoney(value, currency);
  if (unit === "pct") return `${value.toFixed(1)}%`;
  if (unit === "ratio") return `${value.toFixed(2)}x`;
  return value.toFixed(0);
}

function formatPlanGoalValue(
  value: number,
  goal: NonNullable<Plan["goal"]>,
  // Moneda elegida para el camino; manda sobre la que informó la tienda.
  currency: string,
) {
  return formatObjectiveValue(value, goal.unit, currency);
}

const CURRENCY_OPTIONS = CAMINO_CURRENCIES.map((code) => ({ value: code, label: code }));

// Mensaje ya escrito al abrir el chat desde un hito: dice de qué hito se habla
// y cómo va, para que la conversación arranque con contexto. Se puede editar.
function discussDraft(topic: DiscussTopic, fromConsultant: boolean) {
  const due = topic.targetDate
    ? ` (${topic.late ? "vencía" : "vence"} el ${new Date(`${topic.targetDate.slice(0, 10)}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" })})`
    : "";
  const progress = topic.totalTasks
    ? ` ${fromConsultant ? "Lleváis" : "Llevamos"} ${topic.doneTasks} de ${topic.totalTasks} tareas hechas${topic.late ? " y va con retraso" : ""}.`
    : topic.late
      ? " Va con retraso."
      : "";
  return fromConsultant
    ? `Hola, te escribo sobre el hito ${topic.code} «${topic.name}»${due}.${progress} `
    : `Hola, quería revisar contigo el hito ${topic.code} «${topic.name}»${due}.${progress} `;
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
      aria-hidden
    />
  );
}

/**
 * El punto de color codifica quien propuso la fase/hito, pero un `title` sobre
 * un elemento `aria-hidden` no lo lee ningun lector de pantalla (y en tactil no
 * existe). El dato viaja ahora como texto solo-lectores junto al punto.
 */
function originSentence(origin: CreatorOrigin) {
  return origin ? `Propuesto por ${ORIGIN_LABEL[origin].toLowerCase()}.` : "";
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

// Paleta del arbol en clases del sistema, no en estilos inline. Antes cada
// nodo calculaba `var(--color-...)` y `#fff` a mano en un `style`, que ademas
// de saltarse ADR-0020 dejaba fuera hover y foco. Aqui solo hay tres estados y
// el color es un matiz (borde + texto), nunca un relleno macizo.
const NODE_STATE = {
  done: {
    node: "border-separator bg-surface text-success",
    row: "border-separator",
  },
  active: {
    node: "border-accent bg-accent-soft text-accent",
    row: "border-accent bg-accent-soft",
  },
  idle: {
    node: "border-separator bg-white text-muted",
    row: "border-separator bg-white",
  },
} as const;

function nodeState(kind: keyof typeof NODE_STATE) {
  return NODE_STATE[kind];
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
        className="min-h-8 min-w-8 shrink-0 px-2 pointer-coarse:min-w-11"
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

// Antes, todo el bloque de una fase/hito era un `div role="button"` que
// envolvia el asa de arrastre, el boton de editar y el menu de acciones. Eso
// es un fallo de WCAG 4.1.2: no se pueden anidar controles dentro de un
// elemento con rol de boton -- el lector de pantalla anuncia la tarjeta entera
// como un unico boton cuyo nombre es todo su contenido, y los controles de
// dentro dependian de `stopPropagation` para no disparar tambien el toggle.
//
// Ahora el patron es el estandar de "disclosure": un <button> de verdad que
// contiene SOLO el titulo y la flecha, con aria-expanded y aria-controls
// apuntando al panel que abre; el resto de controles son hermanos suyos, no
// hijos. Ids compartidos entre el boton y su panel:
const phasePanelId = (phaseId: string) => `camino-fase-${phaseId}`;
const milestonePanelId = (milestoneId: string) => `camino-hito-${milestoneId}`;

// Nodo "+" en la punta de una rama: pulsarlo abre el formulario de alta en el
// sitio (misma fila), no un modal aparte -- se ve la rama crecer. Es el CTA
// principal del arbol, asi que se pinta como un boton solido de verdad (nodo
// de acento relleno + boton `secondary`), no un circulo punteado transparente.
function TreeAddNode({
  size,
  label,
  onClick,
}: {
  size: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <span
        aria-hidden
        className="z-10 flex shrink-0 items-center justify-center rounded-full border border-accent bg-accent-soft text-accent"
        style={{ width: size, height: size }}
      >
        <PlusIcon aria-hidden />
      </span>
      <Button size="sm" variant="secondary" onClick={onClick}>
        <PlusIcon aria-hidden />
        {label}
      </Button>
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
      className="shrink-0 cursor-grab touch-none px-1 text-muted/60 transition-colors hover:text-accent active:cursor-grabbing pointer-coarse:min-h-11 pointer-coarse:px-2.5"
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
  isOpen,
  onToggle,
  doneCount,
  totalCount,
}: {
  phase: Phase;
  canManage: boolean;
  isEditing: boolean;
  onEdit: () => void;
  handleProps?: Record<string, unknown>;
  isOpen: boolean;
  onToggle: () => void;
  doneCount: number;
  totalCount: number;
}) {
  const size = TREE_NODE_SIZE.phase;
  const state = nodeState(
    phase.status === "completed"
      ? "done"
      : phase.status === "active"
        ? "active"
        : "idle",
  );
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const Chevron = isOpen ? IconChevronUp : IconChevronDown;

  return (
    <div className="relative flex items-start gap-3">
      <span
        aria-hidden
        className={`z-10 flex shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold ${state.node}`}
        style={{ width: size, height: size }}
      >
        {phase.status === "completed" ? (
          <CheckIcon aria-hidden />
        ) : (
          phase.position
        )}
      </span>

      <div
        className={`min-w-0 flex-1 rounded-lg border px-3 py-2.5 ${state.row}`}
        aria-current={phase.status === "active" ? "step" : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          {canManage && handleProps ? (
            <DragHandle
              label={`Reordenar la fase ${phase.name}`}
              handleProps={handleProps}
            />
          ) : null}
          <OriginDot origin={phase.created_by_origin ?? null} />
          <span className="sr-only">
            {originSentence(phase.created_by_origin ?? null)}
          </span>

          {/* El disclosure es solo el titulo y su flecha. El resto de
              controles son hermanos, nunca hijos de este boton. */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            aria-controls={phasePanelId(phase.id)}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left"
          >
            <span className="min-w-0 break-words text-sm font-semibold">
              {phase.name}
            </span>
            <Chevron className="shrink-0 text-muted" aria-hidden />
          </button>

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

        {/* Progreso con semantica real: antes eran dos spans aria-hidden, asi
            que un lector de pantalla solo oia "3/7 hitos" sin saber que era
            una barra de progreso. */}
        {totalCount > 0 ? (
          <div
            className="mt-1.5 flex items-center gap-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={doneCount}
            aria-valuetext={`${doneCount} de ${totalCount} hitos completados`}
            aria-label={`Progreso de la fase ${phase.name}`}
          >
            <span className="shrink-0 font-mono text-[0.65rem] text-muted">
              {doneCount}/{totalCount} hitos
            </span>
            <span
              className="h-1 w-full max-w-32 overflow-hidden rounded-full bg-separator"
              aria-hidden
            >
              <span
                className="block h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </span>
          </div>
        ) : null}

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
  const state = nodeState(
    milestone.status === "completed"
      ? "done"
      : milestone.status === "in_progress"
        ? "active"
        : "idle",
  );
  const taskCount = milestone.milestone_task_links.length;
  const Chevron = isExpanded ? IconChevronUp : IconChevronDown;

  // El boton "Hecho"/"Reabrir" desaparece: hacia exactamente lo mismo que el
  // circulo de la izquierda, que ya es un boton con su propia etiqueta. Una
  // fila, un control por accion.
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
    <div className="relative flex items-start gap-2.5">
      <button
        type="button"
        onClick={canManage ? onToggleComplete : undefined}
        aria-label={
          milestone.status === "completed"
            ? `Reabrir el hito ${milestone.name}`
            : `Marcar como completado el hito ${milestone.name}`
        }
        aria-pressed={milestone.status === "completed"}
        disabled={!canManage}
        className={[
          "z-10 flex shrink-0 items-center justify-center rounded-full border font-mono text-[0.65rem] font-semibold transition-transform",
          state.node,
          canManage ? "cursor-pointer hover:scale-110" : "cursor-default",
        ].join(" ")}
        style={{ width: size, height: size }}
      >
        {milestone.status === "completed" ? (
          <CheckIcon aria-hidden />
        ) : (
          milestone.position
        )}
      </button>

      <div
        className={[
          "flex min-w-0 flex-1 flex-col gap-1 rounded-lg border px-2.5 py-2 sm:flex-row sm:items-center sm:gap-2.5",
          isFocus ? "border-accent bg-accent-soft" : state.row,
        ].join(" ")}
        aria-current={isFocus ? "step" : undefined}
      >
        <div className="flex min-w-0 items-center gap-2 sm:flex-1 sm:gap-2.5">
          {canManage && handleProps ? (
            <DragHandle
              label={`Reordenar el hito ${milestone.name}`}
              handleProps={handleProps}
            />
          ) : null}
          <span className="shrink-0 font-mono text-[0.65rem] text-muted">
            {numberLabel}
          </span>
          <OriginDot origin={milestone.created_by_origin ?? null} />
          <span className="sr-only">
            {originSentence(milestone.created_by_origin ?? null)}
          </span>
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            aria-controls={milestonePanelId(milestone.id)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 text-left"
          >
            {/* Sin `truncate`: un hito con nombre largo se leia cortado y sin
                forma de ver el resto. Ahora rompe de linea. */}
            <span
              className={[
                "min-w-0 flex-1 break-words text-xs font-medium",
                isDone ? "text-muted line-through" : "",
              ].join(" ")}
            >
              {milestone.name}
            </span>
            <Chevron
              className="shrink-0 text-[0.6rem] text-muted"
              aria-hidden
            />
          </button>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 pl-8 sm:justify-start sm:pl-0">
          {/* La fecha objetivo sube a la fila: era el dato que obligaba a
              desplegar cada hito uno a uno para saber si el plan va tarde. */}
          <span className="shrink-0 text-[0.65rem] text-muted">
            {MILESTONE_STATUS_LABELS[milestone.status] ?? milestone.status}
            {milestone.target_date ? ` · ${milestone.target_date}` : ""}
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id });
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: milestone.id });
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

function EditTaskForm({
  task,
  onCancel,
  onSubmit,
}: {
  task: MilestoneTask;
  onCancel: () => void;
  onSubmit: (payload: { title: string; description: string; priority: string; dueAt: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [dueAt, setDueAt] = useState(task.due_at?.slice(0, 10) ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    await onSubmit({ title: title.trim(), description: description.trim(), priority, dueAt });
    setIsSubmitting(false);
  }

  return (
    <Card title="Editar tarea" className="mt-2">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <Field label="Título"><Input className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
        <Field label="Descripción (opcional)"><Textarea className="mt-2 h-20" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <div className="flex flex-wrap gap-3">
          <Field label="Prioridad"><Select className="mt-2" value={priority} onChange={setPriority} options={[
            { value: "low", label: "Baja" }, { value: "medium", label: "Media" }, { value: "high", label: "Alta" }, { value: "urgent", label: "Urgente" },
          ]} /></Field>
          <Field label="Fecha límite"><Input type="date" className="mt-2 w-40" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isSubmitting || !title.trim()}>{isSubmitting ? "Guardando…" : "Guardar tarea"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
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
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !name.trim()}
          >
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
  linkedMarketingAsset,
  canManage,
  canEdit,
  onToggleDone,
  onEdit,
  onRemove,
  onGenerateMarketing,
  isGeneratingMarketing,
  viewerIsClient,
}: {
  viewerIsClient?: boolean;
  numberLabel: string;
  task: MilestoneTask;
  linkedMarketingAsset?: CaminoMarketingAsset | null;
  canManage: boolean;
  canEdit?: boolean;
  onToggleDone: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  onGenerateMarketing?: () => void;
  isGeneratingMarketing?: boolean;
}) {
  const done = task.status === "completed";
  // «Quitar» pide confirmación; el diálogo se abre desde el menú «⋯».
  const [removeOpen, setRemoveOpen] = useState(false);
  const metaLine = [metaOwnerLabel(task.plan_meta, viewerIsClient ?? false), formatEffort(task.plan_meta?.effort_hours)]
    .filter(Boolean)
    .join(" · ");
  const menuItems = [
    ...(canEdit && onEdit ? [{ id: "edit", label: "Editar tarea" }] : []),
    ...(canEdit && onRemove ? [{ id: "remove", label: "Quitar del Camino", danger: true }] : []),
  ];
  return (
    <div className="task-lift-card flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-separator bg-surface px-2.5 py-1.5 text-sm">
      <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
        {canManage ? (
          <button
            type="button"
            onClick={onToggleDone}
            aria-pressed={done}
            aria-label={
              done ? "Reabrir la tarea" : "Marcar la tarea como hecha"
            }
            title={done ? "Reabrir" : "Marcar hecha"}
            className={[
              "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
              done
                ? "border-accent bg-accent text-white"
                : "border-muted-foreground/40 hover:border-accent hover:bg-accent/10",
            ].join(" ")}
          >
            {done ? <CheckIcon aria-hidden /> : null}
          </button>
        ) : null}
        <span className="shrink-0 font-mono text-[0.65rem] text-muted">
          {numberLabel}
        </span>
        <OriginDot origin={task.created_by_origin ?? null} />
        <span
          className={[
            "min-w-0 flex-1 break-words",
            ["completed", "ignored", "cancelled"].includes(task.status)
              ? "text-muted line-through"
              : "",
          ].join(" ")}
        >
          {task.title}
        </span>
      </div>
      {metaLine ? <span className="text-[0.7rem] text-muted">{metaLine}</span> : null}
      {["high", "urgent"].includes(task.priority) ? (
        <Badge tone={task.priority === "urgent" ? "danger" : "warn"}>
          {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
        </Badge>
      ) : null}
      {!["pending", "completed"].includes(task.status) ? (
        <Badge tone="neutral">
          {TASK_STATUS_LABELS[task.status] ?? task.status}
        </Badge>
      ) : null}
      {isTaskOverdue(task) ? (
        <Badge tone="danger">Vencida</Badge>
      ) : task.due_at ? (
        <span className="text-[0.65rem] text-muted">
          vence {formatDueDate(task.due_at)}
        </span>
      ) : null}
      {task.source !== "strategic_plan" && TASK_SOURCE_LABELS[task.source] ? (
        <Badge tone="brand">{TASK_SOURCE_LABELS[task.source]}</Badge>
      ) : null}
      {linkedMarketingAsset ? (
        <Badge tone={linkedMarketingAsset.status === "rejected" ? "danger" : linkedMarketingAsset.status === "approved" ? "success" : "neutral"}>
          Marketing · {marketingAssetStatusLabel(linkedMarketingAsset)}
        </Badge>
      ) : null}
      {onGenerateMarketing ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={isGeneratingMarketing}
          onClick={onGenerateMarketing}
          aria-label={`Crear borrador de email para: ${task.title}`}
        >
          {isGeneratingMarketing ? "Preparando borrador…" : linkedMarketingAsset ? "Abrir borrador" : "Crear borrador de email"}
        </Button>
      ) : null}
      <RowMenu
        ariaLabel={`Más acciones de la tarea: ${task.title}`}
        items={menuItems}
        onAction={(key) => (key === "edit" ? onEdit?.() : setRemoveOpen(true))}
      />
      {canEdit && onRemove ? (
        <ConfirmDialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          status="default"
          title="Quitar tarea del Camino"
          description="La tarea se desvinculará de este hito y seguirá disponible en Tareas."
          confirmLabel="Quitar tarea"
          onConfirm={onRemove}
        />
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
    <div className="mt-2 border-t border-separator pt-2">
      <p className="text-sm font-semibold text-foreground">
        Notas internas (solo consultores)
      </p>
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
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting || !draft.trim()}
        >
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
  currency,
  milestoneLabel,
  canManage,
  isRemoving,
  isSavingActual,
  onRemove,
  onSetActual,
}: {
  objective: Objective;
  currency: string;
  milestoneLabel: string | null;
  canManage: boolean;
  isRemoving: boolean;
  isSavingActual: boolean;
  onRemove: () => void;
  onSetActual: (value: number) => void;
}) {
  const statusInfo: Record<Objective["status"], { label: string; tone: Tone }> =
    {
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
    <article className={s.objectiveRow}>
      <div className={s.objectiveIdentity}>
        <div>
          <h3 className={s.objectiveName}>{objective.label}</h3>
          <p className={s.objectivePeriod}>
            {OBJECTIVE_PERIOD_LABELS[objective.period] ?? objective.period}
            {isManual ? " · Manual" : " · Indicador conectado"}
            {milestoneLabel ? ` · ${milestoneLabel}` : " · Sin hito"}
          </p>
        </div>
        <Badge tone={info.tone}>{info.label}</Badge>
      </div>
      <div className={s.objectiveMeasure}>
      {isManual && isEditingActual ? (
        <form
          className={s.objectiveActualForm}
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
        <div className={s.objectiveValueLine}>
          <p className={s.objectiveValue}>
            {objective.actual_value !== null
              ? formatObjectiveValue(objective.actual_value, objective.unit, currency)
              : "—"}
          </p>
          <p className={s.objectiveTarget}>
            de {formatObjectiveValue(objective.target_value, objective.unit, currency)}{" "}
            objetivo
          </p>
          {isManual && canManage ? (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto min-h-8 min-w-8 px-2 pointer-coarse:min-w-11"
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
          className={s.objectiveProgress}
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      ) : (
        <p className={s.objectiveNoData}>
          {isManual
            ? "Introduce el valor actual para ver el progreso."
            : "Sin datos todavía para esta métrica en los últimos 30 días."}
        </p>
      )}
      {canManage ? (
        <Button
          className={s.objectiveRemove}
          size="sm"
          variant="ghost"
          disabled={isRemoving}
          onClick={onRemove}
        >
          {isRemoving ? "Quitando..." : "Quitar objetivo"}
        </Button>
      ) : null}
      </div>
    </article>
  );
}

function AddObjectiveModal({
  isOpen,
  catalog,
  existing,
  milestones,
  suggestionFor,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  catalog: ObjectiveCatalogEntry[];
  existing: Objective[];
  milestones: Array<{ id: string; label: string }>;
  /** Cifra recomendada por el analista de métricas (ADR-0027), si la hay. */
  suggestionFor: (metricKey: string) => { value: number; text: string } | null;
  onClose: () => void;
  onSubmit: (payload: {
    metricKey: string;
    targetValue: number;
    period: string;
    milestoneId: string | null;
  }) => Promise<boolean>;
}) {
  const available = catalog;
  const [metricKey, setMetricKey] = useState(available[0]?.key ?? "");
  const [milestoneId, setMilestoneId] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const suggestion = suggestionFor(metricKey);
  const alreadySet = existing.some(
    (objective) =>
      objective.metric_key === metricKey &&
      (objective.milestone_id ?? "") === milestoneId,
  );

  // Cada apertura arranca en limpio: sin esto, un intento abandonado deja los
  // valores tecleados para la siguiente vez que se abre el modal.
  useEffect(() => {
    if (isOpen) {
      setMetricKey(available[0]?.key ?? "");
      setMilestoneId("");
      setTargetValue("");
      setPeriod("monthly");
    }
  }, [isOpen, available]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(targetValue);
    if (!metricKey || !Number.isFinite(value) || value < 0) return;
    setIsSubmitting(true);
    const created = await onSubmit({
      metricKey,
      targetValue: value,
      period,
      milestoneId: milestoneId || null,
    });
    setIsSubmitting(false);
    if (created) {
      setTargetValue("");
      onClose();
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Añadir objetivo"
      isBusy={isSubmitting}
      isDirty={Boolean(targetValue)}
      formId="add-objective-form"
      primary={{
        label: "Guardar objetivo",
        busyLabel: "Guardando…",
        disabled: !metricKey || !targetValue,
      }}
    >
      <form id="add-objective-form" className="space-y-4" onSubmit={handleSubmit}>
        <Field label="Métrica">
          <Select
            value={metricKey}
            onChange={setMetricKey}
            options={available.map((entry) => ({
              value: entry.key,
              label: entry.label,
            }))}
          />
        </Field>
        <Field label="Hito">
          <Select
            value={milestoneId}
            onChange={setMilestoneId}
            options={[
              { value: "", label: "Sin hito (objetivo del negocio, sale en el panel)" },
              ...milestones.map((milestone) => ({
                value: milestone.id,
                label: milestone.label,
              })),
            ]}
          />
        </Field>
        {alreadySet ? (
          <Banner tone="warn">
            Ya hay un objetivo activo para esta métrica. Guardar reemplaza el valor actual.
          </Banner>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Valor objetivo">
            <Input
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
        {suggestion ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-separator p-3">
            <p className="max-w-prose text-sm leading-snug text-foreground">{suggestion.text}</p>
            {suggestion.value ? (
              <Button variant="secondary" size="sm" type="button" onClick={() => setTargetValue(String(suggestion.value))}>
                Usar {suggestion.value.toLocaleString("es-ES")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}

/**
 * Cambiar la cifra de la meta del Camino. Lo pueden hacer consultor y cliente;
 * a la otra parte le llega un aviso y la IA revisa el Camino y propone ajustes
 * (nada se aplica sin que alguien lo acepte).
 */
function GoalTargetDialog({
  isOpen,
  organizationId,
  planId,
  currentTarget,
  label,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  organizationId: string;
  planId: string;
  currentTarget: number | null;
  label: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTarget(currentTarget === null ? "" : String(currentTarget));
      setReason("");
      setError(null);
    }
  }, [isOpen, currentTarget]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(target);
    if (target === "" || !Number.isFinite(value) || value < 0) return;
    setIsSubmitting(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/strategic-plan/${planId}/goal`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: value, reason: reason.trim() || undefined }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Meta cambiada. La IA revisará el Camino y te avisará si propone ajustes.");
      onSaved();
      onClose();
    } catch {
      setError("No se pudo cambiar la meta. Reintenta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Cambiar la meta"
      isBusy={isSubmitting}
      isDirty={target !== (currentTarget === null ? "" : String(currentTarget)) || Boolean(reason)}
      formId="goal-target-form"
      primary={{
        label: "Guardar meta",
        busyLabel: "Guardando…",
        disabled: target === "" || Number(target) === currentTarget,
      }}
    >
      <form id="goal-target-form" className="space-y-4" onSubmit={handleSubmit}>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Field label={label}>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            required
          />
        </Field>
        <Field label="Motivo (opcional)">
          <Input
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </form>
    </Dialog>
  );
}

function ObjectivesPanel({
  organizationId,
  objectivesQuery,
  milestones,
  currency,
  canManage,
  variant,
}: {
  organizationId: string;
  currency: string;
  // La consulta vive en PlanContent: la misma respuesta alimenta el mapa.
  objectivesQuery: ReturnType<typeof useCachedQuery<ObjectivesResponse>>;
  milestones: Array<{ id: string; label: string }>;
  canManage: boolean;
  variant: "client" | "consultant";
}) {
  const milestoneLabels = new Map(milestones.map((m) => [m.id, m.label]));
  const data = objectivesQuery.data ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const error =
    actionError ??
    (objectivesQuery.error
      ? "No se pudieron cargar los objetivos. Revisa la conexión e inténtalo de nuevo."
      : null);
  const setError = setActionError;
  const isLoading = objectivesQuery.isLoading;
  const [isAdding, setIsAdding] = useState(false);
  // Objetivo sugerido por el analista de métricas (ADR-0027): sale de los costes
  // de la tienda y del margen neto objetivo. Vivía en Configuración, que ya no
  // fija objetivos. Solo se pide con el modal abierto.
  const analysisOf = useMetricAnalysis(organizationId, isAdding ? 30 : "all");
  const suggestionFor = (metricKey: string) =>
    (metricKey === "roas"
      ? analysisOf("meta_roas")?.suggested_target ?? analysisOf("mer")?.suggested_target
      : metricKey === "cac_blended"
        ? analysisOf("cac_new")?.suggested_target
        : null) ?? null;
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingActualId, setSavingActualId] = useState<string | null>(null);

  const load = useCallback(() => {
    setActionError(null);
    objectivesQuery.reload();
  }, [objectivesQuery.reload]);

  async function addObjective(payload: {
    metricKey: string;
    targetValue: number;
    period: string;
    milestoneId: string | null;
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
      toast.success("Objetivo guardado. La IA revisará el Camino y avisará si propone ajustes.");
      load();
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
      load();
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
      load();
    } catch {
      setError("No se pudo guardar el valor actual. Reintenta.");
    } finally {
      setSavingActualId(null);
    }
  }

  return (
    <section
      className={[
        s.objectivesPanel,
        variant === "consultant" ? s.objectivesConsultant : "",
      ].join(" ")}
      aria-labelledby="business-objectives-title"
    >
      <header className={s.objectivesHeader}>
        <div>
          <h2 id="business-objectives-title">Objetivos por hito</h2>
        </div>
        {canManage ? (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setIsAdding(true)}
          >
            <PlusIcon aria-hidden />
            Añadir objetivo
          </Button>
        ) : null}
      </header>
      {error ? (
        <div className={s.objectiveNotice}>
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className={s.objectiveLoading}>
          <LoadingBlock label="Cargando objetivos..." />
        </div>
      ) : data && data.objectives.length > 0 ? (
        <div className={s.objectiveRows}>
          {data.objectives.map((objective) => (
            <ObjectiveCard
              key={objective.id}
              objective={objective}
              currency={currency}
              milestoneLabel={
                objective.milestone_id
                  ? (milestoneLabels.get(objective.milestone_id) ?? "Hito de otro camino")
                  : null
              }
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
        <p className={s.objectiveEmpty}>
          {canManage
            ? "Sin objetivos. Añade el primero con «+ Objetivo»."
            : "Todavía no hay objetivos para este negocio."}
        </p>
      )}

      {data ? (
        <AddObjectiveModal
          isOpen={isAdding}
          catalog={data.catalog}
          existing={data.objectives}
          milestones={milestones}
          suggestionFor={suggestionFor}
          onClose={() => setIsAdding(false)}
          onSubmit={addObjective}
        />
      ) : null}
    </section>
  );
}

/**
 * "Qué toca ahora", para el cliente.
 *
 * El árbol de abajo es el mismo para los dos porque el artefacto es el mismo,
 * pero el consultor lo abre para asesorar -- necesita verlo entero -- y el
 * cliente para saber qué hace hoy. Hasta ahora tenía que deducirlo leyéndose el
 * plan; esto lo dice, y nombra los estados que engañan (borrador, fase parada,
 * fase terminada sin relevo).
 */
const NEXT_STEP_LABEL: Record<"brand" | "warn" | "success", string> = {
  brand: "En marcha",
  warn: "Atención",
  success: "Completado",
};

function ClientNextStep({ plan, phases }: { plan: Plan; phases: Phase[] }) {
  const step = clientNextStep(
    plan.status,
    phases,
    new Date().toISOString().slice(0, 10),
  );

  return (
    <Card
      kicker="Ahora"
      title={step.headline}
      description={step.detail}
      actions={
        <div className="flex items-center gap-2">
          <Badge tone={step.tone}>{NEXT_STEP_LABEL[step.tone]}</Badge>
          {step.tasks.length > 0 ? (
            <ButtonLink href="/tareas" variant="secondary">
              Ver mis tareas
            </ButtonLink>
          ) : null}
        </div>
      }
    >
      {step.tasks.length > 0 ? (
        <List as="ul">
          {step.tasks.map((task) => (
            <List.Item as="li" key={task.id} className="py-2 text-sm">
              {task.title}
            </List.Item>
          ))}
        </List>
      ) : null}
    </Card>
  );
}

// --- Contenido principal -----------------------------------------------------

function PlanContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  // Tienda activa del selector: el camino se propone para la tienda que el
  // consultor tiene delante, no para el agregado del cliente.
  const { connectionId, setConnectionId } = useActiveConnection();
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
  // Igual que en Tareas: el consultor propone y edita el plan (canManage), pero
  // marcar una tarea como hecha es del cliente, no de una membership sintetica
  // de consultant_assignment. El backend ya lo exige (updateTaskStatus).
  const canResolveTasks =
    canManage && membership?.accessSource !== "consultant_assignment";
  // Un cliente sin consultor no espera a nadie: decirle "tu consultor está
  // preparando el plan" lo deja mirando una pantalla que no va a cambiar sola.
  const { isAutonomous } = useAssignedConsultant(organization?.id ?? null);

  const [payload, setPayload] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [generatingMarketingTaskId, setGeneratingMarketingTaskId] = useState<string | null>(null);
  const [retryingReviewId, setRetryingReviewId] = useState<string | null>(null);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [completionMilestone, setCompletionMilestone] = useState<Milestone | null>(null);
  const [completionEvidence, setCompletionEvidence] = useState("");
  const [isCompletingMilestone, setIsCompletingMilestone] = useState(false);
  // El cliente ve el camino como mapa; el árbol (para editarlo) queda detrás
  // de un botón para quien puede gestionar el plan.
  const [showEditor, setShowEditor] = useState(false);
  // Mesa del consultor: pestaña abierta y semana de
  // la revisión que se está leyendo.
  // ?vista= abre una pestaña concreta: los avisos de objetivos llevan aqui.
  const initialDeskTab = useSearchParams().get("vista");
  const [deskTab, setDeskTab] = useState<"editor" | "seguimiento" | "objetivos">(
    initialDeskTab === "seguimiento" || initialDeskTab === "objetivos" ? initialDeskTab : "editor",
  );

  const [reviewIndex, setReviewIndex] = useState(0);
  // Hito del que se va a hablar: abre el chat en un modal con el mensaje escrito.
  const [discuss, setDiscuss] = useState<DiscussTopic | null>(null);
  // "Todas las tiendas" con varias tiendas abre la vista general; el camino
  // general (sin tienda) se abre desde ella y se recuerda por organización.
  const [generalFor, setGeneralFor] = useState<string | null>(null);
  // Colapso por fase (A+B): cada fase es una tarjeta plegable con su progreso
  // en la cabecera. Por defecto solo la fase activa arranca abierta; el valor
  // explicito en este mapa gana en cuanto el usuario pliega/despliega una.
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(
    {},
  );
  const organizationId = organization?.id ?? null;
  const marketingAssetsByTask = useMemo(
    () => latestMarketingAssetByTask(payload?.marketing_assets ?? []),
    [payload?.marketing_assets],
  );
  const openMarketingAsset = (asset: CaminoMarketingAsset) => {
    window.location.assign(marketingAssetHref(asset.id));
  };

  const generateMarketingForTask = useCallback(async (task: MilestoneTask) => {
    if (!organizationId || !connectionId) {
      toast.info("Selecciona la tienda de este Camino antes de generar el borrador.");
      return;
    }
    const existingAsset = marketingAssetsByTask.get(task.id);
    if (existingAsset) {
      window.location.assign(marketingAssetHref(existingAsset.id));
      return;
    }
    setGeneratingMarketingTaskId(task.id);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/marketing/drafts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content_type: "campaign",
            channel: "email_klaviyo",
            store_id: connectionId,
            camino_task_id: task.id,
            idempotency_key: `${task.id}:99`,
            brief: `Prepara un borrador de email para esta tarea de Mi Camino: "${task.title}". Usa la descripcion y el hito verificados como contexto. Si faltan oferta, descuento, audiencia o condiciones, no los inventes: indica que debe confirmar el equipo. Deja el contenido en borrador para revision humana; no lo envies ni lo programes.`,
          }),
        },
        180_000,
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      const body = (await response.json()) as { draft?: { id?: string } };
      if (!body.draft?.id) {
        toast.danger("El agente respondió sin devolver un borrador de Marketing.");
        return;
      }
      window.location.assign(`/marketing?section=crear&draft=${encodeURIComponent(body.draft.id)}`);
    } catch (error) {
      toast.danger(error instanceof Error ? error.message : "No se pudo activar el agente de email.");
    } finally {
      setGeneratingMarketingTaskId(null);
    }
  }, [connectionId, marketingAssetsByTask, organizationId]);
  const routesQuery = useCachedQuery<{ routes: CaminoRoute[] }>(
    organizationId && !connectionId ? `/v1/organizations/${organizationId}/strategic-plan/routes` : null,
  );
  const objectivesQuery = useCachedQuery<ObjectivesResponse>(
    organizationId
      ? `/v1/organizations/${organizationId}/objectives${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`
      : null,
  );

  // Crear, activar o borrar un camino cambia las tarjetas de "Todas las tiendas"
  // y la cartera del consultor. Sin esto seguian diciendo "sin camino" hasta que
  // caducaba la cache.
  function refreshRouteViews() {
    if (organizationId) {
      if (connectionId) invalidateCachedQueries(`/v1/organizations/${organizationId}/strategic-plan/routes`);
      else routesQuery.reload();
    }
    invalidateCachedQueries("/v1/consultant/plans");
  }

  // Raton: `distance` para que un clic normal no arrastre. Tactil: NO vale
  // `distance` -- el asa lleva `touch-none`, asi que apoyar el pulgar encima
  // para hacer scroll y moverlo 6px iniciaba un arrastre y la pagina no se
  // movia. `delay` es el gesto de reordenar de una lista movil nativa:
  // mantener pulsado. Por eso van dos sensores y no un PointerSensor.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // `silent`: refresco de fondo tras una mutación -- no toca `isLoading`, así el
  // árbol no se desmonta ni parpadea cada vez que se añade/completa/reordena
  // algo. El loader a pantalla completa queda solo para la carga inicial y el
  // cambio de cliente.
  const loadPlan = useCallback(
    async (silent = false) => {
      if (!organizationId) {
        setPayload(null);
        setError(null);
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/strategic-plan${connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : ""}`,
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
        if (!silent) setIsLoading(false);
      }
    },
    [connectionId, organizationId],
  );

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  async function retryWeeklyReview(planId: string, reviewId: string) {
    if (!organizationId) return;
    setRetryingReviewId(reviewId);
    try {
      const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/strategic-plan/${planId}/weekly-review/retry${query}`,
        { method: "POST" },
      );
      if (!response.ok) {
        toast.danger(await readApiError(response));
        return;
      }
      toast.success("Revisión del Camino completada.");
      await loadPlan(true);
    } catch {
      toast.danger("No se pudo reintentar la revisión. Comprueba la conexión e inténtalo de nuevo.");
    } finally {
      setRetryingReviewId(null);
    }
  }

  async function approveWeeklyLearning(planId: string, reviewId: string, learningIndex: number) {
    if (!organizationId) return;
    const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
    const response = await apiFetch(
      `/v1/organizations/${organizationId}/strategic-plan/${planId}/weekly-review/${reviewId}/learnings/${learningIndex}/approve${query}`,
      { method: "POST" },
    );
    if (!response.ok) throw new Error(await readApiError(response));
  }

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
      void loadPlan(true);
      refreshRouteViews();
      return true;
    } catch {
      setError(
        "No se pudo completar la operación del plan por un error de red. Reintenta.",
      );
      return false;
    }
  }

  async function updatePlanDetails(payload: { name: string; description: string }) {
    if (!organizationId || !plan) return false;
    const saved = await submitPlanMutation(
      `/v1/organizations/${organizationId}/strategic-plan/${plan.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      "Camino actualizado.",
    );
    if (saved) setIsEditingPlan(false);
    return saved;
  }

  async function deletePlan() {
    if (!organizationId || !plan) return;
    await submitPlanMutation(
      `/v1/organizations/${organizationId}/strategic-plan/${plan.id}`,
      { method: "DELETE" },
      "Camino eliminado.",
    );
  }

  async function deletePlanPhase(phase: Phase) {
    if (!organizationId) return;
    await submitPlanMutation(
      `/v1/organizations/${organizationId}/strategic-plan/phases/${phase.id}`,
      { method: "DELETE" },
      "Fase eliminada.",
    );
  }

  async function deletePlanMilestone(milestone: Milestone) {
    if (!organizationId) return;
    await submitPlanMutation(
      `/v1/organizations/${organizationId}/milestones/${milestone.id}`,
      { method: "DELETE" },
      "Hito eliminado.",
    );
  }

  async function updatePlanTask(milestoneId: string, taskId: string, payload: { title: string; description: string; priority: string; dueAt: string }) {
    if (!organizationId) return false;
    const saved = await submitPlanMutation(
      `/v1/organizations/${organizationId}/strategic-plan/milestones/${milestoneId}/tasks/${taskId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      "Tarea actualizada.",
    );
    if (saved) setEditingTaskId(null);
    return saved;
  }

  async function unlinkPlanTask(milestoneId: string, taskId: string) {
    if (!organizationId) return;
    await submitPlanMutation(
      `/v1/organizations/${organizationId}/strategic-plan/milestones/${milestoneId}/tasks/${taskId}`,
      { method: "DELETE" },
      "Tarea quitada del Camino.",
    );
  }

  async function activatePlan(planId: string) {
    if (!organization) return;
    setIsActivating(true);
    try {
      await submitPlanMutation(
        `/v1/organizations/${organization.id}/strategic-plan/${planId}/activate`,
        { method: "POST" },
        "Plan activado.",
      );
    } finally {
      setIsActivating(false);
    }
  }

  async function changeMilestoneStatus(milestoneId: string, status: string, completionNote?: string) {
    if (!organization) return false;
    return submitPlanMutation(
      `/v1/organizations/${organization.id}/milestones/${milestoneId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(completionNote ? { completion_note: completionNote } : {}) }),
      },
      "Estado del hito actualizado.",
    );
  }

  function toggleMilestoneComplete(milestone: Milestone) {
    if (milestone.status === "completed") {
      void changeMilestoneStatus(milestone.id, "in_progress");
      return;
    }
    setCompletionEvidence("");
    setCompletionMilestone(milestone);
  }

  async function confirmMilestoneCompletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completionMilestone) return;
    setIsCompletingMilestone(true);
    try {
      const saved = await changeMilestoneStatus(completionMilestone.id, "completed", completionEvidence.trim());
      if (saved) setCompletionMilestone(null);
    } finally {
      setIsCompletingMilestone(false);
    }
  }

  // Marcar una tarea del plan hecha/pendiente sin salir de Mi Camino: es la
  // misma tabla `tasks` que /tareas, mismo endpoint de estado.
  function toggleTaskDone(task: MilestoneTask) {
    if (!organization) return;
    void submitPlanMutation(
      `/v1/organizations/${organization.id}/tasks/${task.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: task.status === "completed" ? "pending" : "completed",
        }),
      },
      task.status === "completed"
        ? "Tarea reabierta."
        : "Tarea marcada como hecha.",
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
  const weeklyReviews = payload?.weekly_reviews ?? [];
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

  // Salud del plan en cifras, no solo el árbol de fases: para asesorar hace
  // falta saber si el plan avanza, si se está desviando de sus fechas y
  // cuánto trabajo del plan sigue abierto.
  const allMilestones = phases.flatMap(
    (phase) => phase.strategic_plan_milestones,
  );
  const overdueMilestones = allMilestones.filter(
    (milestone) =>
      !["completed", "skipped"].includes(milestone.status) &&
      isPast(milestone.target_date),
  ).length;
  const planTasks = allMilestones.flatMap((milestone) =>
    milestone.milestone_task_links
      .map((link) => link.tasks)
      .filter((task): task is MilestoneTask => task !== null),
  );
  const openPlanTasks = planTasks.filter((task) =>
    ["pending", "in_progress"].includes(task.status),
  ).length;

  // El mapa es lo que ve el cliente, y el consultor ve exactamente lo mismo
  // arriba; debajo conserva siempre el árbol, que es donde construye el plan.
  // El cliente abre el editor con un botón.
  const showMap = Boolean(plan) && phases.length > 0;
  const showDetail = !showMap || showEditor || isConsultantView;
  // El consultor trabaja en pestañas bajo el mapa; el cliente lo ve todo seguido.
  const desk = isConsultantView && Boolean(plan);
  const onTab = (tab: typeof deskTab) => !desk || deskTab === tab;
  const pendingProposals = (weeklyReviews.find((review) => review.output)?.proposals ?? []).filter(
    (proposal) => proposal.status === "pending",
  ).length;

  // Ficha del hito del consultor: todo lo que antes vivía en la fila del árbol.
  function renderDeskMilestone(milestoneId: string) {
    const milestone = allMilestones.find((item) => item.id === milestoneId);
    if (!milestone || !organizationId) return null;
    const isEditing = editingMilestoneId === milestone.id;
    const isAddingTask = addingTaskMilestoneId === milestone.id;
    return (
      <div className={d.hitoActs}>
        <div className={d.row}>
          <Button size="sm" variant={milestone.status === "completed" ? "secondary" : "primary"} onClick={() => toggleMilestoneComplete(milestone)}>
            {milestone.status === "completed" ? "Reabrir" : "Marcar completado"}
          </Button>
          {milestone.status === "pending" ? (
            <Button size="sm" variant="secondary" onClick={() => void changeMilestoneStatus(milestone.id, "in_progress")}>
              Empezar
            </Button>
          ) : null}
          {["pending", "in_progress"].includes(milestone.status) ? (
            <Button size="sm" variant="secondary" onClick={() => void changeMilestoneStatus(milestone.id, "skipped")}>
              Omitir
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => setEditingMilestoneId(isEditing ? null : milestone.id)}>
            {isEditing ? "Cerrar edición" : "Editar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeskTab("objetivos")}>
            Métrica y meta
          </Button>
          {!isAddingTask ? (
            <Button size="sm" variant="ghost" onClick={() => setAddingTaskMilestoneId(milestone.id)}>
              <PlusIcon aria-hidden />
              Tarea
            </Button>
          ) : null}
        </div>
        {milestone.status === "completed" && milestone.completion_evidence ? (
          <p className="text-xs text-muted">Evidencia de cierre: {milestone.completion_evidence}</p>
        ) : null}
        {isEditing ? (
          <NameDescriptionForm
            initialName={milestone.name}
            initialDescription={milestone.description ?? ""}
            initialTargetDate={milestone.target_date ?? ""}
            showTargetDate
            submitLabel="Guardar"
            onCancel={() => setEditingMilestoneId(null)}
            onSubmit={async (payload) => {
              if (await editMilestone(milestone.id, payload)) setEditingMilestoneId(null);
            }}
          />
        ) : null}
        {isAddingTask ? (
          <AddTaskForm
            onCancel={() => setAddingTaskMilestoneId(null)}
            onSubmit={async (payload) => {
              if (await addMilestoneTask(milestone.id, payload)) setAddingTaskMilestoneId(null);
            }}
          />
        ) : null}
        <MilestoneInternalNotes organizationId={organizationId} milestoneId={milestone.id} />
      </div>
    );
  }
  const planCurrency =
    plan?.currency_code ?? plan?.goal?.currency_code ?? organization?.currency_code ?? "EUR";

  async function changePlanCurrency(currencyCode: string) {
    if (!organizationId || !plan) return;
    try {
      const response = await apiFetch(`/v1/organizations/${organizationId}/strategic-plan/${plan.id}/currency`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency_code: currencyCode }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success(`Las cifras del camino se muestran ahora en ${currencyCode}.`);
      await loadPlan(true);
    } catch {
      setError("No se pudo cambiar la moneda del camino. Reintenta.");
    }
  }
  const milestoneOptions = phases.flatMap((phase, pi) =>
    phase.strategic_plan_milestones
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((milestone, mi) => ({ id: milestone.id, label: `Hito ${pi + 1}.${mi + 1} · ${milestone.name}` })),
  );

  const allRoutes = routesQuery.data?.routes ?? [];
  const storeRoutes = allRoutes.filter((route) => route.store_id);
  const multiStore = !connectionId && storeRoutes.length >= 2;
  const showGeneral = generalFor !== null && generalFor === organizationId;

  if (!connectionId && routesQuery.isLoading) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando los caminos de tus tiendas..." />
      </div>
    );
  }

  if (multiStore && !showGeneral) {
    const general = allRoutes.find((route) => !route.store_id && route.plan) ?? null;
    const cards = [...storeRoutes, ...(general ? [general] : [])].map((route) => ({
      key: route.store_id ?? "general",
      title: route.store_name ?? (route.store_id ? "Tienda" : "Camino general"),
      subtitle: route.store_id ? "Tienda Shopify" : "Toda la marca, sin tienda concreta",
      route,
    }));
    return (
      <div className="portal-page">
        <CaminoRoutesView
          variant={isConsultantView ? "consultant" : "client"}
          eyebrow={`Todas las tiendas · ${organization?.display_name ?? ""}`}
          title={isConsultantView ? "Caminos de este cliente" : "Tus caminos"}
          description="Cada tienda tiene su propio camino y su propia meta. Aquí se ve de un vistazo dónde está cada una y cuál necesita atención primero; las metas no se suman porque miden cosas distintas."
          sections={[{ title: null, cards }]}
          openLabel={isConsultantView ? "Abrir el camino" : "Abrir el mapa"}
          onOpen={(route) => (route.connection_id ? setConnectionId(route.connection_id) : setGeneralFor(organizationId))}
          footnote="Primero las tiendas que van tarde. Al abrir una tienda cambia también el selector de tienda de arriba."
        />
      </div>
    );
  }

  return (
    <div className={`portal-page space-y-5 sm:space-y-6 ${desk ? d.desk : d.client}`}>
      {!desk || !plan ? <WorkPageHeader title="Mi camino">Tu objetivo, los hitos para alcanzarlo y el trabajo que toca ahora.</WorkPageHeader> : null}
      <Dialog
        isOpen={Boolean(completionMilestone)}
        onOpenChange={(open) => { if (!open) setCompletionMilestone(null); }}
        title={completionMilestone ? `Verificar hito: ${completionMilestone.name}` : "Verificar hito"}
        isBusy={isCompletingMilestone}
        isDirty={Boolean(completionEvidence)}
        formId="complete-camino-milestone"
        primary={{ label: "Completar hito", busyLabel: "Completando…", disabled: completionEvidence.trim().length < 20 || completionEvidence.trim().length > 2000 || Boolean(completionMilestone?.milestone_task_links.some((link) => link.tasks?.status !== "completed")) }}
      >
        <form id="complete-camino-milestone" className="space-y-4" onSubmit={confirmMilestoneCompletion}>
          <p className="text-sm">Criterio: {completionMilestone?.success_criteria || "Describe qué resultado se ha conseguido y cómo se comprobó."}</p>
          {completionMilestone?.milestone_task_links.some((link) => link.tasks?.status !== "completed") ? (
            <p className="text-sm">Quedan tareas pendientes: {completionMilestone.milestone_task_links.filter((link) => link.tasks?.status !== "completed").map((link) => link.tasks?.title ?? "Tarea sin datos").join(", ")}.</p>
          ) : null}
          <Field label="Evidencia del resultado">
            <Textarea value={completionEvidence} onChange={(event) => setCompletionEvidence(event.target.value)} maxLength={2000} placeholder="Indica el resultado observado y dónde se puede comprobar" />
          </Field>
        </form>
      </Dialog>
      {desk && plan ? (
        <>
          <header className={d.work}>
            <div>
              <h1 className={d.name}>{plan.name}</h1>
              <div className={d.chips}>
                <span className={`${d.chip} ${plan.status === "active" ? d.chipGood : plan.status === "draft" ? d.chipAcc : ""}`}>
                  {displayValue(plan.status)}
                </span>
                <span className={d.chip}>Versión {plan.version}</span>
                {plan.horizon_months ? (
                  <span className={d.chip}>
                    {plan.horizon_months} {plan.horizon_months === 1 ? "mes" : "meses"}
                  </span>
                ) : null}
              </div>
            </div>
            <div className={d.tools}>
              <Select
                className="w-24"
                aria-label="Moneda del camino"
                value={planCurrency}
                onChange={(value) => void changePlanCurrency(value)}
                options={
                  CURRENCY_OPTIONS.some((option) => option.value === planCurrency)
                    ? CURRENCY_OPTIONS
                    : [{ value: planCurrency, label: planCurrency }, ...CURRENCY_OPTIONS]
                }
              />
              <ButtonLink href="/camino/nuevo" variant="secondary">
                Replanificar o nuevo camino
              </ButtonLink>
              {plan.status === "draft" ? (
                <Button type="button" onClick={() => void activatePlan(plan.id)}>
                  Activar camino
                </Button>
              ) : null}
            </div>
          </header>
          {totalMilestones > 0 ? (
            <section className={d.health} aria-label="Salud del camino">
              <div>
                <b>{Math.round((doneMilestones / totalMilestones) * 100)} %</b>
                <span>
                  Progreso · {doneMilestones} de {totalMilestones} hitos
                </span>
              </div>
              <div>
                <b className={d.text}>{activePhase?.name ?? "Ninguna"}</b>
                <span>Fase activa</span>
              </div>
              <div>
                <b className={d.text}>{focusMilestone?.name ?? "Ninguno"}</b>
                <span>Hito en curso{focusMilestone?.target_date ? ` · ${focusMilestone.target_date}` : ""}</span>
              </div>
              <div className={overdueMilestones > 0 ? d.bad : ""}>
                <b>{overdueMilestones}</b>
                <span>Hitos fuera de fecha</span>
              </div>
              <div>
                <b>{openPlanTasks}</b>
                <span>Tareas abiertas · {planTasks.length} en total</span>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
      {multiStore && showGeneral ? (
        <div>
          <Button type="button" variant="secondary" onClick={() => setGeneralFor(null)}>
            ← Todas las tiendas
          </Button>
        </div>
      ) : null}
      {plan?.status === "draft" ? (
        <DraftNotice
          readiness={draftReadiness(phases, plan.goal)}
          canManage={canManage}
          isActivating={isActivating}
          onActivate={() => void activatePlan(plan.id)}
        />
      ) : null}

      {/* Para el cliente lo primero es qué toca hoy; las cifras del plan y el
          árbol vienen después. El consultor abre la pantalla a asesorar, y para
          eso el panel de siempre manda. */}
      {showMap && plan ? (
        <CaminoMap
          startsOn={plan.starts_on}
          planStatus={plan.status}
          goal={plan.goal}
          phases={phases}
          objectives={objectivesQuery.data?.objectives ?? []}
          formatObjective={(value, unit) => formatObjectiveValue(value, unit, planCurrency)}
          variant={desk ? "consultant" : "client"}
          renderMilestoneExtra={desk ? renderDeskMilestone : undefined}
          onDiscuss={setDiscuss}
          review={desk ? null : (weeklyReviews.find((review) => review.output) ?? null)}
          canResolveTasks={canResolveTasks}
          sourceLabels={TASK_SOURCE_LABELS}
          formatGoal={(value) => (plan.goal ? formatPlanGoalValue(value, plan.goal, planCurrency) : String(value))}
          onToggleTask={(task) => toggleTaskDone(task as MilestoneTask)}
          onGenerateMarketingTask={canManage ? (task) => void generateMarketingForTask(task as MilestoneTask) : undefined}
          generatingTaskId={generatingMarketingTaskId}
          marketingAssets={payload?.marketing_assets ?? []}
          onApproveLearning={canManage ? (reviewId, learningIndex) => approveWeeklyLearning(plan.id, reviewId, learningIndex) : undefined}
          renderChangeDecision={(index) => {
            const latest = weeklyReviews.find((review) => review.output);
            const stored = latest?.proposals?.find((proposal) => proposal.proposal_index === index);
            return stored && organizationId ? (
              <CaminoProposalDecision key={stored.id} organizationId={organizationId} planId={plan.id} record={stored} canManage={canManage} onUpdated={() => void loadPlan(true)} />
            ) : null;
          }}
        />
      ) : !isConsultantView && plan ? (
        <ClientNextStep plan={plan} phases={phases} />
      ) : null}

      {plan && payload?.marketing_assets_available === false ? (
        <p className="text-sm text-muted-foreground" role="status">
          No se pudo comprobar ahora el estado de los borradores de Marketing vinculados a las tareas.
        </p>
      ) : null}

      {desk ? (
        <div className={d.tabs} role="tablist" aria-label="Mesa del consultor">
          {(
            [
              ["editor", "Editor del camino"],
              ["seguimiento", "Seguimiento IA"],
              ["objetivos", "Objetivos"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={deskTab === key} onClick={() => setDeskTab(key)}>
              {label}
              {key === "seguimiento" && pendingProposals > 0 ? <span className={d.count}>{pendingProposals}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {canManage && ((showMap && !isConsultantView) || (desk && deskTab === "editor")) ? (
        <div className="space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            {!desk ? (
              <Button type="button" variant="secondary" onClick={() => setShowEditor((open) => !open)}>
                {showEditor ? "Ocultar el editor" : "Editar el camino"}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => setIsEditingPlan((editing) => !editing)}>
              {isEditingPlan ? "Cerrar datos" : "Editar nombre y descripción"}
            </Button>
            {!desk ? <ButtonLink href="/camino/nuevo" variant="secondary">Replanificar o nuevo camino</ButtonLink> : null}
            {plan ? (
              <ConfirmDialog
                trigger={<Button type="button" variant="danger">Eliminar Camino</Button>}
                title="Eliminar Camino completo"
                note="Esta acción no se puede deshacer."
                irreversible
                consequences={[
                  "Se borran el plan, sus fases, hitos, notas, revisiones y decisiones del agente.",
                  "Las tareas y borradores de marketing enlazados se conservan, sin vínculo con este Camino.",
                ]}
                confirmPhrase={plan?.name}
                confirmLabel="Eliminar Camino"
                onConfirm={() => deletePlan()}
              />
            ) : null}
          </div>
          {isEditingPlan && plan ? (
            <NameDescriptionForm
              initialName={plan.name}
              initialDescription={plan.description ?? ""}
              submitLabel="Guardar Camino"
              onCancel={() => setIsEditingPlan(false)}
              onSubmit={async (values) => { await updatePlanDetails(values); }}
            />
          ) : null}
        </div>
      ) : null}

      {plan?.status === "active" && showDetail && onTab("seguimiento") ? (
        <Card title={desk ? undefined : "Revisión del camino"}>
          {desk && weeklyReviews.length > 1 ? (
            <div className={d.weeks} role="group" aria-label="Semana">
              {weeklyReviews.slice(0, 4).map((review, index) => (
                <button
                  key={review.id}
                  type="button"
                  aria-pressed={reviewIndex === index}
                  className={review.status === "failed" ? d.failed : undefined}
                  onClick={() => setReviewIndex(index)}
                >
                  {new Date(review.period_start).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  {review.status === "failed" ? " · falló" : ""}
                </button>
              ))}
            </div>
          ) : null}
          {weeklyReviews.length ? (
            <div className="mt-3 space-y-4">
              {weeklyReviews.slice(0, 4).filter((_, index) => !desk || index === reviewIndex).map((review) => {
                const content = review.output;
                if (review.status !== "succeeded" || !content) return (
                  <article key={review.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-separator bg-surface p-4">
                    <div>
                      <p className="text-sm font-medium">{review.status === "failed" ? "No se pudo generar la revisión del Camino" : "Revisión del Camino en curso"}</p>
                      <p className="mt-1 text-xs text-muted">Semana del {new Date(review.period_start).toLocaleDateString("es-ES")}. El Camino sigue sin cambios.</p>
                    </div>
                    {canManage && review.can_retry && plan ? (
                      <Button size="sm" variant="secondary" onClick={() => void retryWeeklyReview(plan.id, review.id)} disabled={retryingReviewId === review.id}>
                        {retryingReviewId === review.id ? "Reintentando…" : "Reintentar revisión"}
                      </Button>
                    ) : review.status === "running" ? <Badge tone="neutral">En curso</Badge> : null}
                  </article>
                );
                return (
                  <article key={review.id} className="rounded-lg border border-separator bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone={content.goal_progress.status === "on_track" || content.goal_progress.status === "achieved" ? "success" : content.goal_progress.status === "at_risk" || content.goal_progress.status === "blocked" ? "danger" : "neutral"}>
                        {content.goal_progress.status === "on_track" ? "En curso" : content.goal_progress.status === "at_risk" ? "En riesgo" : content.goal_progress.status === "blocked" ? "Bloqueado" : content.goal_progress.status === "achieved" ? "Objetivo logrado" : "Faltan datos"}
                      </Badge>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        {review.trigger_kind === "objective_change" ? <Badge tone="brand">Tras cambiar objetivos</Badge> : null}
                        {new Date(review.created_at).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6">{content.executive_summary}</p>
                    {plan.goal && content.goal_progress.observed_value !== null ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-md bg-surface-subtle px-3 py-2">
                          <p className="text-[11px] text-muted">Medido</p>
                          <p className="text-sm font-semibold">{formatPlanGoalValue(content.goal_progress.observed_value, plan.goal, planCurrency)}</p>
                        </div>
                        {content.goal_progress.comparison_value !== null ? (
                          <div className="rounded-md bg-surface-subtle px-3 py-2">
                            <p className="text-[11px] text-muted">Periodo anterior</p>
                            <p className="text-sm font-semibold">{formatPlanGoalValue(content.goal_progress.comparison_value, plan.goal, planCurrency)}</p>
                          </div>
                        ) : null}
                        {content.goal_progress.expected_value != null ? (
                          <div className="rounded-md bg-surface-subtle px-3 py-2">
                            <p className="text-[11px] text-muted">Ritmo de referencia</p>
                            <p className="text-sm font-semibold">{formatPlanGoalValue(content.goal_progress.expected_value, plan.goal, planCurrency)}</p>
                          </div>
                        ) : null}
                        {content.goal_progress.target_value != null ? (
                          <div className="rounded-md bg-surface-subtle px-3 py-2">
                            <p className="text-[11px] text-muted">Objetivo</p>
                            <p className="text-sm font-semibold">{formatPlanGoalValue(content.goal_progress.target_value, plan.goal, planCurrency)}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <p className="mt-2 text-sm text-muted">{content.goal_progress.explanation}</p>
                    {content.progress.length ? (
                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Avance observado</p>
                        <ul className="mt-2 space-y-2">
                          {content.progress.slice(0, 4).map((item, index) => (
                            <li key={`${review.id}-progress-${index}`} className="text-sm">
                              <span className="font-medium">{item.item}</span>
                              <span className="ml-2 text-muted">{displayValue(item.status)} · {item.evidence}</span>
                            </li>
                          ))}
                          {content.progress.length > 4 ? <li className="text-xs text-muted">+{content.progress.length - 4} más</li> : null}
                        </ul>
                      </div>
                    ) : null}
                    {content.risks.length ? (
                      <div className="mt-4 rounded-md border border-separator px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Riesgos y bloqueos</p>
                        <ul className="mt-2 space-y-2">
                          {content.risks.slice(0, 3).map((risk, index) => (
                            <li key={`${review.id}-risk-${index}`} className="text-sm">
                              <Badge tone={risk.severity === "high" ? "danger" : risk.severity === "medium" ? "warn" : "neutral"}>{displayValue(risk.severity)}</Badge>
                              <span className="ml-2">{risk.detail}</span>
                              <p className="mt-1 text-xs text-muted">Evidencia: {risk.evidence}</p>
                            </li>
                          ))}
                          {content.risks.length > 3 ? <li className="text-xs text-muted">+{content.risks.length - 3} más</li> : null}
                        </ul>
                      </div>
                    ) : null}
                    {content.next_actions.length ? (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Próximas acciones sugeridas</p>
                        <ul className="mt-2 space-y-2">
                          {content.next_actions.slice(0, 3).map((action, index) => (
                            <li key={`${review.id}-action-${index}`} className="text-sm">
                              <span className="font-medium">{action.title}</span>
                              <span className="text-muted"> — {action.rationale} · Responsable: {displayValue(action.owner)} · En {action.due_in_days} días</span>
                            </li>
                          ))}
                          {content.next_actions.length > 3 ? <li className="text-xs text-muted">+{content.next_actions.length - 3} más</li> : null}
                        </ul>
                      </div>
                    ) : null}
                    {content.change_proposals.length ? (
                      <div className="mt-4 rounded-md border border-separator px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Cambios sugeridos · requieren revisión humana</p>
                        <ul className="mt-2 space-y-3">
                          {content.change_proposals.slice(0, 4).map((change, index) => (
                            <li key={`${review.id}-change-${index}`} className="text-sm">
                              <p className="font-medium">{displayValue(change.change)} {displayValue(change.target_type)}{change.target_id ? ` · ${change.target_id}` : ""}</p>
                              <p>{change.description}</p>
                              <p className="text-muted">Motivo: {change.reason}</p>
                              <p className="text-xs text-muted">Evidencia: {change.evidence}</p>
                              {organizationId && plan ? (() => {
                                const stored = review.proposals?.find((proposal) => proposal.proposal_index === index);
                                return stored ? <CaminoProposalDecision key={stored.id} organizationId={organizationId} planId={plan.id} record={stored} canManage={canManage} onUpdated={() => void loadPlan(true)} /> : <p className="mt-2 text-xs text-muted">Esta propuesta es anterior al registro de decisiones y solo puede consultarse.</p>;
                              })() : null}
                            </li>
                          ))}
                          {content.change_proposals.length > 4 ? <li className="text-xs text-muted">+{content.change_proposals.length - 4} más</li> : null}
                        </ul>
                      </div>
                    ) : null}
                    {content.warnings.length ? <p className="mt-2 text-xs text-muted">Límites: {content.warnings.join(" · ")}</p> : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Con la automatización de agentes activa, la primera revisión llega tres días después de activar el Camino y se repite cada tres días.</p>
          )}
        </Card>
      ) : null}

      {plan && totalMilestones > 0 && showDetail && !desk ? (
        <ModuleSummary
          metrics={[
            {
              label: "Progreso del plan",
              value: `${Math.round((doneMilestones / totalMilestones) * 100)}%`,
              hint: `${doneMilestones}/${totalMilestones} hitos`,
            },
            {
              label: "Fase activa",
              value: activePhase?.name ?? "Sin fase activa",
              tone: activePhase ? "default" : "warn",
            },
            {
              label: "Hito en curso",
              value: focusMilestone?.name ?? "Ninguno",
              hint: focusMilestone?.target_date
                ? `Objetivo ${focusMilestone.target_date}`
                : undefined,
            },
            {
              label: "Hitos fuera de fecha",
              value: overdueMilestones.toLocaleString("es-ES"),
              tone: overdueMilestones > 0 ? "danger" : "success",
            },
            {
              label: "Tareas del plan abiertas",
              value: openPlanTasks.toLocaleString("es-ES"),
              hint: `${planTasks.length} vinculadas en total`,
            },
          ]}
        />
      ) : null}

      {/* Los objetivos se ven en el mapa, dentro de su hito. El panel es la
          herramienta para asignarlos y solo sale al editar el camino. */}
      {organizationId && plan && showDetail && onTab("objetivos") ? (
        <ObjectivesPanel
          organizationId={organizationId}
          objectivesQuery={objectivesQuery}
          milestones={milestoneOptions}
          currency={planCurrency}
          canManage={canManage}
          variant={isConsultantView ? "consultant" : "client"}
        />
      ) : null}

      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {isLoading ? (
        <AsyncState status="loading" loadingLabel="Cargando plan..." />
      ) : plan ? (
        showDetail && onTab("editor") ? (
        <>
          <Card
            kicker={desk ? undefined : `v${plan.version}${plan.horizon_months ? ` · ${plan.horizon_months} ${plan.horizon_months === 1 ? "mes" : "meses"}` : ""} · ${displayValue(plan.status)}`}
            title={desk ? "Fases e hitos" : plan.name}
            description={desk ? undefined : (plan.description ?? undefined)}
            actions={desk ? undefined : (
              <div className="flex items-center gap-2">
                {canManage ? (
                  <Select
                    className="w-24"
                    aria-label="Moneda del camino"
                    value={planCurrency}
                    onChange={(value) => void changePlanCurrency(value)}
                    options={
                      CURRENCY_OPTIONS.some((option) => option.value === planCurrency)
                        ? CURRENCY_OPTIONS
                        : [{ value: planCurrency, label: planCurrency }, ...CURRENCY_OPTIONS]
                    }
                  />
                ) : null}
                {plan.status === "draft" && canManage ? (
                  <Button
                    type="button"
                    onClick={() => void activatePlan(plan.id)}
                  >
                    Activar plan
                  </Button>
                ) : null}
              </div>
            )}
          >
            {plan.goal ? (
              <div className="mb-4 rounded-lg border border-separator bg-surface-subtle p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted">Meta del camino</p>
                  {canManage && organizationId && !["archived", "completed"].includes(plan.status) ? (
                    <Button size="sm" variant="ghost" type="button" onClick={() => setIsEditingGoal(true)}>
                      Cambiar meta
                    </Button>
                  ) : null}
                </div>
                {organizationId ? (
                  <GoalTargetDialog
                    isOpen={isEditingGoal}
                    organizationId={organizationId}
                    planId={plan.id}
                    currentTarget={plan.goal.target}
                    label={`${plan.goal.metric_label}${plan.goal.unit === "money" ? ` (${planCurrency})` : plan.goal.unit === "pct" ? " (%)" : ""}`}
                    onClose={() => setIsEditingGoal(false)}
                    onSaved={() => void loadPlan(true)}
                  />
                ) : null}
                <p className="mt-1 text-sm font-semibold">
                  {plan.goal.metric_label}: {plan.goal.baseline === null ? "baseline no disponible" : formatPlanGoalValue(plan.goal.baseline, plan.goal, planCurrency)}
                  {plan.goal.target === null ? " → objetivo sin cuantificar" : ` → ${formatPlanGoalValue(plan.goal.target, plan.goal, planCurrency)}`}
                </p>
                {plan.goal.baseline_window_days ? (
                  <p className="mt-1 text-xs text-muted">
                    Base observada en {plan.goal.baseline_window_days} días{plan.goal.baseline_observed_at ? ` · ${new Date(plan.goal.baseline_observed_at).toLocaleDateString("es-ES")}` : ""}
                    {plan.goal.target_date ? ` · objetivo para ${new Date(`${plan.goal.target_date}T00:00:00`).toLocaleDateString("es-ES")}` : ""}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted">{plan.goal.rationale}</p>
                {plan.goal.assumptions.length ? (
                  <p className="mt-1 text-xs text-muted">Supuestos: {plan.goal.assumptions.join(" · ")}</p>
                ) : null}
                {plan.goal.decision_gates?.length ? (
                  <details className="mt-3 text-sm">
                    <summary>Decisiones condicionadas por datos</summary>
                    <ul className="mt-2 space-y-2">
                      {plan.goal.decision_gates.map((gate, index) => (
                        <li key={`${gate.decision}-${index}`}>
                          <b>{gate.decision}</b><br />Avanzar: {gate.proceed_when}<br />Pausar: {gate.hold_when}<br />Comprobar: {gate.evidence_needed}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}
            {totalMilestones > 0 && !desk ? (
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
            {activePhase && !desk ? (
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
              hint={
                isAutonomous
                  ? "El plan existe pero está vacío: quien lleve la cuenta tiene que añadirle fases, o pedirle a la IA que las proponga."
                  : "Tu consultor todavía está preparando las fases del plan."
              }
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
                    const isAddingMilestone =
                      addingMilestonePhaseId === phase.id;
                    const phaseDone = milestones.filter((m) =>
                      ["completed", "skipped"].includes(m.status),
                    ).length;
                    const phaseOpen =
                      expandedPhases[phase.id] ?? phase.status === "active";
                    return (
                      <SortablePhase key={phase.id} phase={phase}>
                        {(phaseHandle) => (
                          <>
                            <PhaseNode
                              phase={phase}
                              canManage={canManage}
                              isEditing={isEditingPhase}
                              onEdit={() =>
                                setEditingPhaseId(
                                  isEditingPhase ? null : phase.id,
                                )
                              }
                              handleProps={phaseHandle}
                              isOpen={phaseOpen}
                              onToggle={() =>
                                setExpandedPhases((current) => ({
                                  ...current,
                                  [phase.id]: !phaseOpen,
                                }))
                              }
                              doneCount={phaseDone}
                              totalCount={milestones.length}
                            />

                            {isEditingPhase ? (
                              <div className="ml-12 mt-2 space-y-2">
                                <NameDescriptionForm
                                  initialName={phase.name}
                                  initialDescription={phase.description ?? ""}
                                  submitLabel="Guardar"
                                  onCancel={() => setEditingPhaseId(null)}
                                  onSubmit={async (payload) => {
                                    if (await editPhase(phase.id, payload)) setEditingPhaseId(null);
                                  }}
                                />
                                <ConfirmDialog
                                  trigger={<Button size="sm" variant="danger">Eliminar fase</Button>}
                                  title="Eliminar fase"
                                  description="Se elimina con todo lo que contiene:"
                                  consequences={[
                                    "Sus hitos, notas y vínculos del Camino.",
                                    "Las tareas enlazadas siguen disponibles en Tareas, sin vínculo con esta fase.",
                                  ]}
                                  confirmLabel="Eliminar fase"
                                  onConfirm={() => void deletePlanPhase(phase)}
                                />
                              </div>
                            ) : null}

                            {phaseOpen ? (
                              <div
                                id={phasePanelId(phase.id)}
                                className="relative ml-5 mt-3"
                              >
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
                                      {milestones.map(
                                        (milestone, milestoneIndex) => {
                                          const isMilestoneExpanded =
                                            expandedMilestoneId ===
                                            milestone.id;
                                          const isEditingMilestone =
                                            editingMilestoneId === milestone.id;
                                          const isAddingTask =
                                            addingTaskMilestoneId ===
                                            milestone.id;
                                          const tasks =
                                            milestone.milestone_task_links
                                              .map((link) => link.tasks)
                                              .filter(
                                                (task): task is MilestoneTask =>
                                                  Boolean(task),
                                              );
                                          const milestoneMarketingAssets = tasks
                                            .map((task) => marketingAssetsByTask.get(task.id))
                                            .filter((asset): asset is CaminoMarketingAsset => Boolean(asset));
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
                                                    isFocus={
                                                      focusMilestone?.id ===
                                                      milestone.id
                                                    }
                                                    isExpanded={
                                                      isMilestoneExpanded
                                                    }
                                                    onToggleExpand={() =>
                                                      setExpandedMilestoneId(
                                                        isMilestoneExpanded
                                                          ? null
                                                          : milestone.id,
                                                      )
                                                    }
                                                    onToggleComplete={() =>
                                                      toggleMilestoneComplete(
                                                        milestone,
                                                      )
                                                    }
                                                    isEditing={
                                                      isEditingMilestone
                                                    }
                                                    handleProps={
                                                      milestoneHandle
                                                    }
                                                    onAction={(action) => {
                                                      if (action === "start") {
                                                        void changeMilestoneStatus(
                                                          milestone.id,
                                                          "in_progress",
                                                        );
                                                      } else if (
                                                        action === "skip"
                                                      ) {
                                                        void changeMilestoneStatus(
                                                          milestone.id,
                                                          "skipped",
                                                        );
                                                      } else {
                                                        setEditingMilestoneId(
                                                          isEditingMilestone
                                                            ? null
                                                            : milestone.id,
                                                        );
                                                      }
                                                    }}
                                                  />

                                                  {isEditingMilestone ? (
                                                    <div className="ml-11 mt-2 space-y-2">
                                                      <NameDescriptionForm
                                                        initialName={
                                                          milestone.name
                                                        }
                                                        initialDescription={
                                                          milestone.description ??
                                                          ""
                                                        }
                                                        initialTargetDate={
                                                          milestone.target_date ??
                                                          ""
                                                        }
                                                        showTargetDate
                                                        submitLabel="Guardar"
                                                        onCancel={() =>
                                                          setEditingMilestoneId(
                                                            null,
                                                          )
                                                        }
                                                        onSubmit={async (
                                                          payload,
                                                        ) => {
                                                          if (
                                                            await editMilestone(
                                                              milestone.id,
                                                              payload,
                                                            )
                                                          ) {
                                                            setEditingMilestoneId(
                                                              null,
                                                            );
                                                          }
                                                        }}
                                                      />
                                                      <ConfirmDialog
                                                        trigger={<Button size="sm" variant="danger">Eliminar hito</Button>}
                                                        title="Eliminar hito"
                                                        description="Se elimina con todo lo que contiene:"
                                                        consequences={[
                                                          "Sus notas y su vínculo con las tareas.",
                                                          "Las tareas siguen disponibles en Tareas.",
                                                        ]}
                                                        confirmLabel="Eliminar hito"
                                                        onConfirm={() => void deletePlanMilestone(milestone)}
                                                      />
                                                    </div>
                                                  ) : null}

                                                  {isMilestoneExpanded ? (
                                                    <div
                                                      id={milestonePanelId(
                                                        milestone.id,
                                                      )}
                                                      className="ml-11 mt-2 space-y-2"
                                                    >
                                                      {/* La fecha objetivo ya no se repite aqui:
                                      vive en la fila del hito, visible sin
                                      desplegar. */}
                                                      {milestone.description ? (
                                                        <p className="text-xs text-muted">
                                                          {
                                                            milestone.description
                                                          }
                                                        </p>
                                                      ) : null}
                                                      {milestone.status === "completed" && milestone.completion_evidence ? (
                                                        <p className="text-xs text-muted">Evidencia de cierre: {milestone.completion_evidence}</p>
                                                      ) : null}
                                                      {milestoneMarketingAssets.length ? (
                                                        <p className="text-xs text-muted">
                                                          Marketing vinculado: {milestoneMarketingAssets.length} · {milestoneMarketingAssets.map(marketingAssetStatusLabel).join(", ")}
                                                        </p>
                                                      ) : null}
                                                      {tasks.length > 0 ? (
                                                        <ul className="flex flex-wrap gap-1.5">
                                                          {tasks.map(
                                                            (
                                                              task,
                                                              taskIndex,
                                                            ) => (
                                                              <li key={task.id} className="space-y-2">
                                                                <TaskListItem
                                                                  numberLabel={`${phase.position}.${milestoneIndex + 1}.${taskIndex + 1}`}
                                                                  task={task}
                                                                  linkedMarketingAsset={marketingAssetsByTask.get(task.id) ?? null}
                                                                  canManage={canResolveTasks}
                                                                  canEdit={canManage}
                                                                  viewerIsClient={!isConsultantView}
                                                                  onToggleDone={() =>
                                                                    toggleTaskDone(
                                                                      task,
                                                                    )
                                                                  }
                                                                  onEdit={canManage ? () => setEditingTaskId(editingTaskId === task.id ? null : task.id) : undefined}
                                                                  onRemove={canManage ? () => void unlinkPlanTask(milestone.id, task.id) : undefined}
                                                                  onGenerateMarketing={
                                                                    canManage && taskCanGenerateMarketing(task)
                                                                      ? () => void generateMarketingForTask(task)
                                                                      : undefined
                                                                  }
                                                                  isGeneratingMarketing={generatingMarketingTaskId === task.id}
                                                                />
                                                                {editingTaskId === task.id ? (
                                                                  <EditTaskForm
                                                                    task={task}
                                                                    onCancel={() => setEditingTaskId(null)}
                                                                    onSubmit={async (values) => { await updatePlanTask(milestone.id, task.id, values); }}
                                                                  />
                                                                ) : null}
                                                              </li>
                                                            ),
                                                          )}
                                                        </ul>
                                                      ) : null}
                                                      {canManage ? (
                                                        isAddingTask ? (
                                                          <AddTaskForm
                                                            onCancel={() =>
                                                              setAddingTaskMilestoneId(
                                                                null,
                                                              )
                                                            }
                                                            onSubmit={async (
                                                              payload,
                                                            ) => {
                                                              if (
                                                                await addMilestoneTask(
                                                                  milestone.id,
                                                                  payload,
                                                                )
                                                              ) {
                                                                setAddingTaskMilestoneId(
                                                                  null,
                                                                );
                                                              }
                                                            }}
                                                          />
                                                        ) : (
                                                          <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() =>
                                                              setAddingTaskMilestoneId(
                                                                milestone.id,
                                                              )
                                                            }
                                                          >
                                                            <PlusIcon
                                                              aria-hidden
                                                            />
                                                            Tarea
                                                          </Button>
                                                        )
                                                      ) : null}
                                                      {isConsultantView ? (
                                                        <MilestoneInternalNotes
                                                          organizationId={
                                                            organization?.id ??
                                                            ""
                                                          }
                                                          milestoneId={
                                                            milestone.id
                                                          }
                                                        />
                                                      ) : null}
                                                    </div>
                                                  ) : null}
                                                </>
                                              )}
                                            </SortableMilestone>
                                          );
                                        },
                                      )}
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
                                                await addMilestone(
                                                  phase.id,
                                                  payload,
                                                )
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
                                          onClick={() =>
                                            setAddingMilestonePhaseId(phase.id)
                                          }
                                        />
                                      )}
                                    </li>
                                  ) : null}
                                </ol>
                              </div>
                            ) : null}
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
                      onClick={() => setIsAddingPhase(true)}
                    />
                  )}
                </li>
              ) : null}
            </ol>
          </div>
        </>
        ) : null
      ) : error ? null : !canManage ? (
        <EmptyState
          title="Aún no hay un camino"
          hint={
            isAutonomous
              ? "Nadie ha creado todavía el camino de esta tienda. Quien lleve la cuenta puede pedirle una propuesta a la IA."
              : "Tu consultor todavía no ha publicado un plan para esta organización."
          }
        />
      ) : (
        <CaminoCreatePanel
          variant={isConsultantView ? "consultant" : "client"}
          title={
            isConsultantView && organization
              ? `Crea el camino de ${organization.display_name}`
              : connectionId
                ? "Crea el camino de esta tienda"
                : "Crea el camino"
          }
          organizationId={organizationId ?? ""}
          connectionId={connectionId || null}
          defaultCurrency={organization?.currency_code ?? "EUR"}
          catalog={objectivesQuery.data?.catalog ?? []}
          onCreated={() => {
            void loadPlan();
            // El botón de crear está al final de una página larga: se vuelve arriba para ver el camino nacido.
            window.scrollTo({ top: 0 });
            objectivesQuery.reload();
            refreshRouteViews();
          }}
        />
      )}

      <DiscussModal
        organizationId={organizationId}
        title={discuss ? `Hito ${discuss.code} · ${discuss.name}` : null}
        draft={discuss ? discussDraft(discuss, isConsultantView) : ""}
        viewerIsClient={!isConsultantView}
        onClose={() => setDiscuss(null)}
      />
    </div>
  );
}

// --- Vista general de /camino para el consultor (sin cliente activo): el
// camino de cada tienda de su cartera y de sus tiendas propias. ---

type ConsultantPlansResponse = {
  portfolio?: Array<{ organization_id: string; display_name: string; is_own_store?: boolean; health_score: number }>;
  routes?: CaminoRoute[];
};

// Abre el camino de una tienda concreta: la tienda activa se guarda por
// organización y el shell la aplica en cuanto cambia de cliente.
function openStoreCamino(organizationId: string, connectionId: string | null, setOrganizationId: (id: string) => void) {
  try {
    const raw = window.localStorage.getItem(ACTIVE_CONNECTION_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[organizationId] = connectionId ?? "";
    window.localStorage.setItem(ACTIVE_CONNECTION_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* sin almacenamiento: se abre con la tienda por defecto */
  }
  setOrganizationId(organizationId);
}

function ConsultantPlansView() {
  const { setOrganizationId } = useActiveOrganization();
  const plansQuery = useCachedQuery<ConsultantPlansResponse>("/v1/consultant/plans");
  const data = plansQuery.data;

  if (plansQuery.isLoading && !data) {
    return (
      <div className="portal-page">
        <LoadingBlock label="Cargando los caminos de tu cartera..." />
      </div>
    );
  }
  if (plansQuery.error && !data) {
    return (
      <div className="portal-page">
        <ErrorBlock>No se pudieron cargar los caminos. Revisa la conexión e inténtalo de nuevo.</ErrorBlock>
      </div>
    );
  }
  if (!data) return null;

  const orgs = new Map((data.portfolio ?? []).map((row) => [row.organization_id, row]));
  const cards = (data.routes ?? []).map((route) => ({
    key: `${route.organization_id}|${route.store_id ?? ""}`,
    title: orgs.get(route.organization_id)?.display_name ?? "Cliente",
    subtitle: route.store_name ?? (route.store_id ? "Tienda" : "Camino general"),
    route,
    own: Boolean(orgs.get(route.organization_id)?.is_own_store),
  }));

  if (cards.length === 0) {
    return (
      <div className="portal-page">
        <EmptyState title="Aún no tienes clientes asignados" hint="Cuando se te asigne una organización, su camino aparecerá aquí." />
      </div>
    );
  }

  return (
    <div className="portal-page">
      <CaminoRoutesView
        variant="consultant"
        eyebrow="Mi Camino · tu cartera"
        title="Caminos de tus clientes"
        description="Un camino por tienda. Primero lo que va tarde; las metas de cada tienda van por separado porque miden cosas distintas."
        sections={[
          { title: "Clientes", cards: cards.filter((card) => !card.own) },
          { title: "Tus tiendas", cards: cards.filter((card) => card.own) },
        ]}
        openLabel="Abrir el camino"
        onOpen={(route) => openStoreCamino(route.organization_id, route.connection_id, setOrganizationId)}
      />
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
    <PortalShell title="Camino">
      {(bootstrap) => <StrategicPlanRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}

export default function StrategicPlanPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando el camino..." />}>
      <StrategicPlanPageContent />
    </Suspense>
  );
}
