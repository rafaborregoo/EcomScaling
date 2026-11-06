"use client";
import { A02Slot } from "@/components/a02-reading";
import type { LearningEdits } from "./learning-decision";
import { MeasurementDetails, type MeasurementInfo } from "./measurement-details";
import { ClosureSummary, type CaminoClosure } from "./closure-summary";
import { DatePicker, Collapsible, CollapsibleContent, CollapsibleTrigger, SearchableSelect, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui";


import { Trash2Icon, UnlinkIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  type ReactElement,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy } from "@dnd-kit/sortable";
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
import { CAMINO_CURRENCIES, CaminoCreatePanel, metricOptions } from "./camino-create-panel";
import { ACTIVE_CONNECTION_STORAGE_KEY } from "@/components/active-connection";
import { CaminoProposalDecision, type StoredCaminoProposal } from "./proposal-decision";
import { useCopilotAsk } from "@/components/copilot-ask";
import { ConsultantCamino, MilestoneEditForm, PlanDanger, PlanSettings } from "./camino-consultant";
import { MILESTONE_STATE_LABEL, milestoneState, milestoneTitle } from "./camino-desk-model";
import { IndicatorCard, IndicatorSummary } from "./indicator-card";
import i from "./camino-indicators.module.css";
import { isPast } from "@/lib/elapsed";
import { latestMarketingAssetByTask, marketingAssetHref, marketingAssetStatusLabel, type CaminoMarketingAsset } from "@/lib/camino-marketing-assets";
import {
  AsyncState,
  Badge,
  Banner,
  Button,
  ButtonLink,
  CheckIcon,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorBlock,
  Field,
  GripVerticalIcon,
  IconChevronDown,
  IconChevronUp,
  Input,
  List,
  LoadingBlock,
  MoreIcon,
  PlusIcon,
  Progress,
  ProgressLabel,
  ProgressValue,
  Select,
  Textarea,
  toast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogConfirmPhrase,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
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
  deadline_date?: string | null;
  measurement_date?: string | null;
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
  /** Moneda en la que se muestra, con su tipo; los importes siguen en currency_code. */
  display_fx?: { from: string; to: string; rate: number; rate_date: string } | null;
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
  replaces_plan_id?: string | null;
  completed_on: string | null;
  strategic_plan_phases: Phase[];
};

type PlanResponse = {
  closures?: CaminoClosure[];
  organization_id: string;
  plan: Plan | null;
  previous_plans?: Array<{ id: string; name: string; version: number; created_at: string }>;
  replan_draft?: { generated_at: string } | null;
  store_timezone?: string | null;
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
  measurement?: MeasurementInfo;
  id: string;
  milestone_id: string | null;
  store_id?: string | null;
  metric_key: string;
  label: string;
  unit: ObjectiveCatalogEntry["unit"];
  direction: "up" | "down";
  source: "shopify" | "meta" | "manual";
  target_value: number;
  period: string;
  measurement_basis?: string;
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
  if (unit === "pct") return `${value.toFixed(1).replace(".", ",")} %`;
  if (unit === "ratio") return `${value.toFixed(2).replace(".", ",")}x`;
  return value.toFixed(0);
}

const CURRENCY_OPTIONS = CAMINO_CURRENCIES.map((code) => ({ value: code, label: code }));

const rateDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const rateNumber = (rate: number) => rate.toLocaleString("es-ES", { maximumFractionDigits: 4 });

/** Enseña el tipo y la fecha antes de confirmar: cambiar de moneda nunca es solo cambiar el símbolo. */
function CurrencyDialog({ organizationId, planId, to, goalTarget, onCancel, onConfirm }: {
  organizationId: string;
  planId: string;
  to: string;
  goalTarget: number | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const quote = useCachedQuery<{ from: string; to: string; quote: { rate: number; rate_date: string } | null }>(
    `/v1/organizations/${organizationId}/strategic-plan/${planId}/currency-quote?to=${to}`,
  );
  const data = quote.data;
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Mostrar el plan en {to}?</AlertDialogTitle>
          <AlertDialogDescription>
            {quote.error
              ? "El BCE no publica un tipo para esta moneda o no se pudo consultar. El camino sigue como está."
              : !data
                ? "Consultando el tipo del BCE…"
                : data.quote
                  ? `Se usa el tipo del BCE del ${rateDate.format(new Date(`${data.quote.rate_date}T00:00:00Z`))}: 1 ${data.from} = ${rateNumber(data.quote.rate)} ${to}.${goalTarget !== null ? ` ${formatObjectiveValue(goalTarget, "money", data.from)} se mostrarán como ${formatObjectiveValue(goalTarget * data.quote.rate, "money", to)}.` : ""} Los importes guardados y las ventas siguen en ${data.from}; ese tipo queda fijo hasta que vuelvas a cambiar la moneda.`
                  : `Las cifras vuelven a mostrarse en ${data.from}, sin conversión.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={!data} onClick={onConfirm}>Cambiar moneda</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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
  locked: "Pendiente",
  pending: "Pendiente",
  active: "En curso",
  completed: "Completada",
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
  // Mismos colores que la etiqueta de dueño de una tarea en la mesa del consultor.
  consultant: "#3d3b3a",
  client: "#bd6940",
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
    node: "border-[var(--nora-purple)] bg-[var(--nora-purple-50)] text-accent",
    row: "border-[var(--nora-purple)] bg-[var(--nora-purple-50)]",
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={ariaLabel}
            className="min-h-8 min-w-8 shrink-0 px-2 pointer-coarse:min-w-11"
          />
        }
      >
        <MoreIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            variant={item.danger ? "destructive" : "default"}
            onSelect={() => onAction(item.id)}
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
        className="z-10 flex shrink-0 items-center justify-center rounded-full border border-[var(--nora-purple)] bg-[var(--nora-purple-50)] text-accent"
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

        {totalCount > 0 ? (
          <Progress
            className="mt-1.5 max-w-56"
            value={doneCount}
            max={totalCount}
            aria-valuetext={`${doneCount} de ${totalCount} hitos completados`}
            aria-label={`Progreso de la fase ${phase.name}`}
          >
            <ProgressLabel>Hitos</ProgressLabel>
            <ProgressValue>{() => `${doneCount} de ${totalCount}`}</ProgressValue>
          </Progress>
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
  phaseStatus,
  planStatus,
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
  phaseStatus: string;
  planStatus: string;
  canManage: boolean;
  isFocus: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleComplete: () => void;
  isEditing: boolean;
  onAction: (action: "start" | "skip" | "edit") => void;
  handleProps?: Record<string, unknown>;
}) {
  const [today] = useState(() => new Date());
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
          isFocus ? "border-[var(--nora-purple)] bg-[var(--nora-purple-50)]" : state.row,
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
              {milestoneTitle(milestone.name)}
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
            {MILESTONE_STATE_LABEL[milestoneState(milestone, phaseStatus, planStatus, today)]}
            {milestone.target_date ? ` · ${new Date(`${milestone.target_date.slice(0, 10)}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "")}` : ""}
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
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Añadir tarea</CardTitle>
      </CardHeader>
      <CardContent>
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
              <DatePicker
                className="mt-2 w-40"
                value={dueAt}
                onChange={(value) => setDueAt(value)}
              />
            </Field>
          </div>
          <div role="group" aria-label="Acciones de la tarea" className="flex flex-wrap items-center gap-2">
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
      </CardContent>
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
    <Card className="mt-2">
      <CardHeader>
        <CardTitle>Editar tarea</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Field label="Título"><Input className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} required /></Field>
          <Field label="Descripción (opcional)"><Textarea className="mt-2 h-20" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <div className="flex flex-wrap gap-3">
            <Field label="Prioridad"><Select className="mt-2" value={priority} onChange={setPriority} options={[
              { value: "low", label: "Baja" }, { value: "medium", label: "Media" }, { value: "high", label: "Alta" }, { value: "urgent", label: "Urgente" },
            ]} /></Field>
            <Field label="Fecha límite"><DatePicker className="mt-2 w-40" value={dueAt} onChange={(value) => setDueAt(value)} /></Field>
          </div>
          <div role="group" aria-label="Acciones de la tarea" className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting || !title.trim()}>{isSubmitting ? "Guardando…" : "Guardar tarea"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function NameDescriptionForm({
  initialName,
  initialDescription,
  initialTargetDate,
  showTargetDate,
  submitLabel,
  title,
  onCancel,
  onSubmit,
}: {
  initialName: string;
  initialDescription: string;
  initialTargetDate?: string;
  showTargetDate?: boolean;
  submitLabel: string;
  /** Cabecera del formulario; sin ella se usa el texto del botón. */
  title?: string;
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
  const formId = useId();

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
    <Dialog
      open
      onOpenChange={(open) => !open && onCancel()}
      busy={isSubmitting}
      dirty={name !== initialName || description !== initialDescription || targetDate !== (initialTargetDate ?? "")}
    >
      <DialogContent>
      <DialogHeader>
        <DialogTitle>{title ?? submitLabel}</DialogTitle>
      </DialogHeader>
        <form id={formId} className="space-y-3" onSubmit={handleSubmit}>
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
              <DatePicker
                className="mt-2 w-40"
                value={targetDate}
                onChange={(value) => setTargetDate(value)}
              />
            </Field>
          ) : null}
        </form>
      <DialogFooter>
        <DialogClose>Cancelar</DialogClose>
        <Button type="submit" form={formId} disabled={isSubmitting || !name.trim()}>
          {isSubmitting ? "Guardando…" : submitLabel}
        </Button>
      </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia>
                <UnlinkIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>¿Quitar la tarea del Camino?</AlertDialogTitle>
              <AlertDialogDescription>
                La tarea se desvinculará de este hito y seguirá disponible en Tareas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onRemove}>Quitar tarea</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

// Borrar un hito o el Camino entero se pide desde dos sitios cada uno (árbol
// de estructura y mesa del Camino): el mismo diálogo de alerta en ambos.
type DeleteDialogProps = {
  name: string;
  trigger: ReactElement<{ onClick?: () => void }>;
  onDelete: () => unknown;
};

function DeleteMilestoneDialog({ name, trigger, onDelete }: DeleteDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-danger/10 text-danger">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Eliminar el hito «{name}»?</AlertDialogTitle>
          <AlertDialogDescription>Se elimina con todo lo que contiene:</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="ui-alert-dialog__list">
          <li>Sus notas y su vínculo con las tareas.</li>
          <li>Las tareas siguen disponibles en Tareas.</li>
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Eliminar hito
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeletePlanDialog({ name, trigger, onDelete }: DeleteDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-danger/10 text-danger">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Eliminar el Camino completo?</AlertDialogTitle>
          <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="ui-alert-dialog__list">
          <li>Se borran el plan, sus fases, hitos, notas, revisiones y decisiones del agente.</li>
          <li>Las tareas y borradores de marketing enlazados se conservan, sin vínculo con este Camino.</li>
        </ul>
        <AlertDialogConfirmPhrase phrase={name} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            Eliminar Camino
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const NO_MILESTONE = "negocio";

function AddObjectiveModal({
  isOpen,
  catalog,
  existing,
  milestones,
  suggestionFor,
  initialMetric,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  catalog: ObjectiveCatalogEntry[];
  existing: Objective[];
  milestones: Array<{ id: string; label: string }>;
  /** Cifra recomendada por el analista de métricas (ADR-0027), si la hay. */
  suggestionFor: (metricKey: string) => { value: number; text: string } | null;
  /** Métrica con la que se abre (si está en el catálogo). */
  initialMetric?: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    metricKey: string;
    targetValue: number;
    period: string;
    milestoneId: string | null;
  }) => Promise<boolean>;
}) {
  const available = catalog;
  const firstMetric =
    (initialMetric && available.some((entry) => entry.key === initialMetric) ? initialMetric : available[0]?.key) ?? "";
  const [metricKey, setMetricKey] = useState(firstMetric);
  // Valor propio para "sin hito": con "" el desplegable enseñaba "Seleccionar..." y
  // parecía obligatorio elegir un hito (y con hito el objetivo no sale en el panel).
  const [milestoneId, setMilestoneId] = useState(NO_MILESTONE);
  const [targetValue, setTargetValue] = useState("");
  const [period, setPeriod] = useState("monthly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const suggestion = suggestionFor(metricKey);
  const alreadySet = existing.some(
    (objective) =>
      objective.metric_key === metricKey &&
      (objective.milestone_id ?? NO_MILESTONE) === milestoneId,
  );

  // Cada apertura arranca en limpio: sin esto, un intento abandonado deja los
  // valores tecleados para la siguiente vez que se abre el modal.
  useEffect(() => {
    if (isOpen) {
      setMetricKey(firstMetric);
      setMilestoneId(NO_MILESTONE);
      setTargetValue("");
      setPeriod("monthly");
    }
  }, [isOpen, firstMetric]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(targetValue);
    if (!metricKey || !Number.isFinite(value) || value < 0) return;
    setIsSubmitting(true);
    const created = await onSubmit({
      metricKey,
      targetValue: value,
      period,
      milestoneId: milestoneId === NO_MILESTONE ? null : milestoneId,
    });
    setIsSubmitting(false);
    if (created) {
      setTargetValue("");
      onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} busy={isSubmitting} dirty={Boolean(targetValue)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir objetivo</DialogTitle>
        </DialogHeader>
        <form id="add-objective-form" className="space-y-4" onSubmit={handleSubmit}>
          <Field label="Métrica">
            <SearchableSelect
              placeholder="Busca una métrica"
              emptyText="No hay ninguna métrica con ese nombre."
              value={metricKey}
              onChange={setMetricKey}
              options={metricOptions(available)}
            />
          </Field>
          <Field label="Hito">
            <SearchableSelect
              aria-label="Hito"
              placeholder="Busca un hito"
              emptyText="No hay ningún hito con ese nombre."
              value={milestoneId}
              onChange={setMilestoneId}
              options={[
                { value: NO_MILESTONE, label: "Sin hito (objetivo del negocio, sale en el panel)" },
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
            <Field label={available.find((entry) => entry.key === metricKey)?.unit === "pct" ? "Valor objetivo (%)" : "Valor objetivo"}>
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
            <Card size="sm"><CardContent className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-prose text-sm leading-snug text-foreground">{suggestion.text}</p>
              {suggestion.value ? (
                <Button variant="secondary" size="sm" type="button" onClick={() => setTargetValue(String(suggestion.value))}>
                  Usar {suggestion.value.toLocaleString("es-ES")}
                </Button>
              ) : null}
            </CardContent></Card>
          ) : null}
        </form>
        <DialogFooter>
          <DialogClose>Cancelar</DialogClose>
          <Button type="submit" form="add-objective-form" disabled={isSubmitting || !metricKey || !targetValue}>{isSubmitting ? "Guardando…" : "Guardar objetivo"}</Button>
        </DialogFooter>
      </DialogContent>
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
  currentTarget: storedTarget,
  rate = 1,
  label,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  organizationId: string;
  planId: string;
  currentTarget: number | null;
  /** Tipo con el que se muestra: lo tecleado se guarda en la moneda original. */
  rate?: number;
  label: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currentTarget = storedTarget === null ? null : Math.round(storedTarget * rate * 100) / 100;
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
          body: JSON.stringify({ target: value / rate, reason: reason.trim() || undefined }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success("Meta cambiada. NORA revisará el Camino y te avisará si propone ajustes.");
      onSaved();
      onClose();
    } catch {
      setError("No se pudo cambiar la meta. Reintenta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} busy={isSubmitting} dirty={target !== (currentTarget === null ? "" : String(currentTarget)) || Boolean(reason)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar la meta</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <DialogClose>Cancelar</DialogClose>
          <Button type="submit" form="goal-target-form" disabled={isSubmitting || target === "" || Number(target) === currentTarget}>{isSubmitting ? "Guardando…" : "Guardar meta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ObjectivesPanel({
  organizationId,
  objectivesQuery,
  milestones,
  currency,
  rate,
  connectionId,
  canManage,
  variant,
}: {
  organizationId: string;
  currency: string;
  /** Tipo con el que se muestran los importes: los guardados no cambian. */
  rate: number;
  connectionId?: string | null;
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
  // ?objetivo=<clave> llega desde el panel ("Fijar objetivo"): abre el alta con
  // esa métrica ya elegida.
  const requestedMetric = useSearchParams().get("objetivo");
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(Boolean(requestedMetric && canManage));
  // Objetivo sugerido por el analista de métricas (ADR-0027): sale de los costes
  // de la tienda y del margen neto objetivo. Vivía en Configuración, que ya no
  // fija objetivos. Solo se pide con el modal abierto.
  const analysisOf = useMetricAnalysis(organizationId, isAdding ? 30 : "all", connectionId);
  const suggestionFor = (metricKey: string) =>
    (metricKey === "roas"
      ? analysisOf("meta_roas")?.suggested_target ?? analysisOf("mer")?.suggested_target
      : metricKey === "cac_blended"
        ? analysisOf("cac_new")?.suggested_target
        : metricKey === "conversion_rate"
          ? analysisOf("conversion")?.suggested_target
          : null) ?? null;
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [savingActualId, setSavingActualId] = useState<string | null>(null);
  const ask = useCopilotAsk();

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
          body: JSON.stringify({
            ...payload,
            targetValue: data?.catalog.find((entry) => entry.key === payload.metricKey)?.unit === "money" ? payload.targetValue / rate : payload.targetValue,
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return false;
      }
      toast.success("Objetivo guardado. NORA revisará el Camino y avisará si propone ajustes.");
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

  async function saveObjectiveChange(id: string, path: string, init: RequestInit, fallback: string, success: string) {
    setSavingActualId(id);
    try {
      const response = await apiFetch(path, { ...init, headers: { "Content-Type": "application/json" } });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success(success);
      load();
    } catch {
      setError(fallback);
    } finally {
      setSavingActualId(null);
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
          <h2 id="business-objectives-title">Indicadores del plan</h2>
          {data?.objectives.length ? <IndicatorSummary objectives={data.objectives} /> : null}
        </div>
        {canManage ? (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setIsAdding(true)}
          >
            <PlusIcon aria-hidden />
            Nuevo objetivo
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
        <div className={i.grid}>
          {data.objectives.map((objective) => (
            <IndicatorCard
              key={objective.id}
              objective={objective}
              format={(value) => formatObjectiveValue(objective.unit === "money" ? value * rate : value, objective.unit, currency).replace(/,00(?=\s|$)/, "")}
              rate={rate}
              milestones={milestones}
              organizationId={organizationId}
              milestoneLabel={
                objective.milestone_id
                  ? (milestoneLabels.get(objective.milestone_id) ?? "Hito de otro camino")
                  : null
              }
              canManage={canManage}
              isRemoving={removingId === objective.id}
              isSaving={savingActualId === objective.id}
              onRemove={() => void removeObjective(objective.id)}
              onSetActual={(value) =>
                void setObjectiveActual(objective.id, value)
              }
              onSetTarget={(value) =>
                void saveObjectiveChange(
                  objective.id,
                  `/v1/organizations/${organizationId}/objectives`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      metricKey: objective.metric_key,
                      targetValue: objective.unit === "money" ? value / rate : value,
                      period: objective.period,
                      storeId: objective.store_id,
                      milestoneId: objective.milestone_id,
                    }),
                  },
                  "No se pudo cambiar el objetivo. Reintenta.",
                  "Objetivo cambiado. NORA revisará el Camino y avisará si propone ajustes.",
                )
              }
              onLink={(milestoneId) =>
                void saveObjectiveChange(
                  objective.id,
                  `/v1/organizations/${organizationId}/objectives/${objective.id}/milestone`,
                  { method: "PATCH", body: JSON.stringify({ milestoneId }) },
                  "No se pudo vincular el indicador. Reintenta.",
                  milestoneId ? "Indicador vinculado al hito." : "Indicador vinculado a todo el plan.",
                )
              }
              onAsk={(question, focusLabel) => ask({ question, focusLabel })}
            />
          ))}
        </div>
      ) : (
        <p className={s.objectiveEmpty}>
          {canManage
            ? "Sin indicadores. Añade el primero con «Nuevo objetivo»."
            : "Todavía no hay indicadores para este negocio."}
        </p>
      )}

      {data ? (
        <AddObjectiveModal
          isOpen={isAdding}
          catalog={data.catalog}
          existing={data.objectives}
          milestones={milestones}
          suggestionFor={suggestionFor}
          initialMetric={requestedMetric}
          onClose={() => {
            setIsAdding(false);
            // Que recargar, volver atrás o cambiar de tienda no lo abra otra vez:
            // con el router, no con history, para que el shell no lo reponga.
            if (requestedMetric) {
              const url = new URL(window.location.href);
              url.searchParams.delete("objetivo");
              router.replace(`${url.pathname}${url.search}`, { scroll: false });
            }
          }}
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
    <Card>
      <CardHeader>
        <CardKicker>Ahora</CardKicker>
        <CardTitle>{step.headline}</CardTitle>
        <CardDescription>{step.detail}</CardDescription>
        <CardAction><div className="flex items-center gap-2">
          <Badge tone={step.tone}>{NEXT_STEP_LABEL[step.tone]}</Badge>
          {step.tasks.length > 0 ? (
            <ButtonLink href="/tareas" variant="secondary">
              Ver mis tareas
            </ButtonLink>
          ) : null}
        </div></CardAction>
      </CardHeader>
      <CardContent>
        {step.tasks.length > 0 ? (
          <List as="ul">
            {step.tasks.map((task) => (
              <List.Item as="li" key={task.id} className="py-2 text-sm">
                {task.title}
              </List.Item>
            ))}
          </List>
        ) : null}
      </CardContent>
    </Card>
  );
}

// --- Contenido principal -----------------------------------------------------

function PlanContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();
  // Tienda activa del selector: el camino se propone para la tienda que el
  // consultor tiene delante, no para el agregado del cliente.
  const { connectionId, setConnectionId, stores } = useActiveConnection();
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
  const [completionAction, setCompletionAction] = useState<"completed" | "skipped">("completed");
  const [completionMode, setCompletionMode] = useState("verify");
  const [isCompletingMilestone, setIsCompletingMilestone] = useState(false);
  // El cliente ve el camino como mapa; el árbol (para editarlo) queda detrás
  // de un botón para quien puede gestionar el plan.
  const [showEditor, setShowEditor] = useState(false);
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
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);
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

  async function approveWeeklyLearning(planId: string, reviewId: string, learningIndex: number, edits?: LearningEdits) {
    if (!organizationId) return;
    const query = connectionId ? `?connectionId=${encodeURIComponent(connectionId)}` : "";
    const response = await apiFetch(
      `/v1/organizations/${organizationId}/strategic-plan/${planId}/weekly-review/${reviewId}/learnings/${learningIndex}/approve${query}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edits ?? {}) },
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

  async function changeMilestoneStatus(milestoneId: string, status: string, completionNote?: string, completionMode?: string) {
    if (!organization) return false;
    return submitPlanMutation(
      `/v1/organizations/${organization.id}/milestones/${milestoneId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, completion_mode: completionMode, ...(completionNote ? { completion_note: completionNote } : {}) }),
      },
      "Estado del hito actualizado.",
    );
  }

  function toggleMilestoneComplete(milestone: Milestone) {
    if (milestone.status === "completed") {
      void changeMilestoneStatus(milestone.id, "in_progress");
      return;
    }
    setCompletionAction("completed");
    setCompletionMode("verify");
    setCompletionEvidence("");
    setCompletionMilestone(milestone);
  }

  function closeByException(milestone: Milestone) {
    setCompletionAction("completed");
    setCompletionMode("exception");
    setCompletionEvidence("");
    setCompletionMilestone(milestone);
  }

  async function confirmMilestoneCompletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completionMilestone) return;
    setIsCompletingMilestone(true);
    try {
      const saved = await changeMilestoneStatus(completionMilestone.id, completionAction, completionEvidence.trim(), completionMode);
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

  function setTaskStatus(taskId: string, status: string, success: string, reason?: string) {
    if (!organization) return Promise.resolve(false);
    return submitPlanMutation(
      `/v1/organizations/${organization.id}/tasks/${taskId}/status`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) },
      success,
    );
  }

  function assignTask(taskId: string, userId: string | null) {
    if (!organization) return;
    void submitPlanMutation(
      `/v1/organizations/${organization.id}/tasks/${taskId}/assignment`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedTo: userId }) },
      userId ? "Responsable principal guardado." : "Tarea sin responsable principal.",
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
    payload2: { name: string; description: string; targetDate: string; deadlineDate?: string; measurementDate?: string; successCriteria?: string; rationale?: string },
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
          ...(payload2.deadlineDate !== undefined ? { deadlineDate: payload2.deadlineDate || null } : {}),
          ...(payload2.measurementDate !== undefined ? { measurementDate: payload2.measurementDate || null } : {}),
          ...(payload2.successCriteria !== undefined ? { successCriteria: payload2.successCriteria || null } : {}),
          ...(payload2.rationale !== undefined ? { rationale: payload2.rationale || null } : {}),
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
  // Consultor y cliente ven la misma mesa (camino-consultant.tsx); solo cambia
  // el texto según quién mira, y las notas internas son solo del consultor.
  const desk = Boolean(plan);

  const amountsCurrency =
    plan?.currency_code ?? plan?.goal?.currency_code ?? organization?.currency_code ?? "EUR";
  const planCurrency = plan?.display_fx?.to ?? amountsCurrency;
  const fxRate = plan?.display_fx?.rate ?? 1;
  const shownObjective = (value: number, unit: ObjectiveCatalogEntry["unit"]) =>
    formatObjectiveValue(unit === "money" ? value * fxRate : value, unit, planCurrency);
  const shownGoal = (value: number) => (plan?.goal ? shownObjective(value, plan.goal.unit) : String(value));

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


  const structureTree = plan ? (
    <>
            <Card>
              <CardHeader>
                <CardKicker>{desk ? undefined : `v${plan.version}${plan.horizon_months ? ` · ${plan.horizon_months} ${plan.horizon_months === 1 ? "mes" : "meses"}` : ""} · ${displayValue(plan.status)}`}</CardKicker>
                <CardTitle>{desk ? "Estructura de fases" : plan.name}</CardTitle>
                <CardDescription>{desk ? "Arrastra fases e hitos para reordenarlos, o usa Espacio y las flechas sobre su asa. Cada fase se abre al cerrar los hitos de la anterior." : (plan.description ?? undefined)}</CardDescription>
                <CardAction>{desk ? undefined : (
                <div className="flex items-center gap-2">
                  {canManage ? (
                    <Select
                      className="w-24"
                      aria-label="Moneda del camino"
                      value={planCurrency}
                      onChange={(value) => setPendingCurrency(value === planCurrency ? null : value)}
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
              )}</CardAction>
              </CardHeader>
              <CardContent>
                {plan.goal && !desk ? (
                  <Card size="sm" className="mb-4"><CardContent>
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
                        rate={fxRate}
                        label={`${plan.goal.metric_label}${plan.goal.unit === "money" ? ` (${planCurrency})` : plan.goal.unit === "pct" ? " (%)" : ""}`}
                        onClose={() => setIsEditingGoal(false)}
                        onSaved={() => void loadPlan(true)}
                      />
                    ) : null}
                    <p className="mt-1 text-sm font-semibold">
                      {plan.goal.metric_label}: {plan.goal.baseline === null ? "baseline no disponible" : shownGoal(plan.goal.baseline)}
                      {plan.goal.target === null ? " → objetivo sin cuantificar" : ` → ${shownGoal(plan.goal.target)}`}
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
                      <Collapsible className="mt-3 text-sm">
                        <CollapsibleTrigger>Decisiones condicionadas por datos<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
                        <CollapsibleContent>
                        <ul className="mt-2 space-y-2">
                          {plan.goal.decision_gates.map((gate, index) => (
                            <li key={`${gate.decision}-${index}`}>
                              <b>{gate.decision}</b><br />Avanzar: {gate.proceed_when}<br />Pausar: {gate.hold_when}<br />Comprobar: {gate.evidence_needed}
                            </li>
                          ))}
                        </ul>
                      </CollapsibleContent>
                      </Collapsible>
                    ) : null}
                  </CardContent></Card>
                ) : null}
                {totalMilestones > 0 && !desk ? (
                  <Progress value={doneMilestones} max={totalMilestones} aria-valuetext={`${doneMilestones} de ${totalMilestones} hitos`}>
                    <ProgressLabel>Progreso del plan</ProgressLabel>
                    <ProgressValue>{() => `${doneMilestones} de ${totalMilestones} hitos`}</ProgressValue>
                  </Progress>
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
              </CardContent>
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
                                  <AlertDialog>
                                    <AlertDialogTrigger render={<Button size="sm" variant="destructive">Eliminar fase</Button>} />
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogMedia className="bg-danger/10 text-danger">
                                          <Trash2Icon />
                                        </AlertDialogMedia>
                                        <AlertDialogTitle>¿Eliminar la fase «{phase.name}»?</AlertDialogTitle>
                                        <AlertDialogDescription>Se elimina con todo lo que contiene:</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <ul className="ui-alert-dialog__list">
                                        <li>Sus hitos, notas y vínculos del Camino.</li>
                                        <li>Las tareas enlazadas siguen disponibles en Tareas, sin vínculo con esta fase.</li>
                                      </ul>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction variant="destructive" onClick={() => deletePlanPhase(phase)}>
                                          Eliminar fase
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
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
                                                      phaseStatus={phase.status}
                                                      planStatus={plan.status}
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
                                                          setCompletionEvidence(""); setCompletionAction("skipped"); setCompletionMilestone(milestone);
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
                                                        <DeleteMilestoneDialog
                                                          name={milestone.name}
                                                          trigger={<Button size="sm" variant="destructive">Eliminar hito</Button>}
                                                          onDelete={() => deletePlanMilestone(milestone)}
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
  ) : null;

  // Igual que el servidor (assessMilestoneCompletion): solo bloquean las tareas abiertas.
  const completionPending = (completionMilestone?.milestone_task_links ?? []).filter(
    (link) => !link.tasks || link.tasks.status === "pending" || link.tasks.status === "in_progress" || link.tasks.status === "proposed",
  );
  const evidenceLength = completionEvidence.trim().length;
  const completionDialog = (
        <Dialog open={Boolean(completionMilestone)} onOpenChange={(open) => { if (!open) setCompletionMilestone(null); }} busy={isCompletingMilestone} dirty={Boolean(completionEvidence)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{`${completionAction === "skipped" ? "Omitir hito" : completionMode === "exception" ? "Cerrar por excepción" : "Verificar hito"}${completionMilestone ? `: ${completionMilestone.name}` : ""}`}</DialogTitle>
            </DialogHeader>
            <form id="complete-camino-milestone" className="space-y-4" onSubmit={confirmMilestoneCompletion}>
              <p className="text-sm">Criterio: {completionMilestone?.success_criteria || "Describe qué resultado se ha conseguido y cómo se comprobó."}</p>
              {completionPending.length ? (
                <p className="text-sm">{completionAction === "completed" && completionMode === "verify" ? "Para verificar faltan estas tareas" : "Estas tareas seguirán abiertas"}: {completionPending.map((link) => link.tasks?.title ?? "Tarea sin datos").join(", ")}.</p>
              ) : null}
              <Field label="Tipo de cierre"><Select value={completionAction === "skipped" ? "skipped" : completionMode} onChange={(value) => { setCompletionAction(value === "skipped" ? "skipped" : "completed"); setCompletionMode(value === "exception" ? "exception" : "verify"); }} options={[{ value: "verify", label: "Verificar resultado" }, { value: "exception", label: "Cerrar por excepción (no acredita el resultado)" }, { value: "skipped", label: "Omitir hito con motivo" }]} /></Field>
              <p className="text-sm text-muted">Los objetivos asociados se comprobarán con datos al verificar. Una excepción o una omisión no acreditan que el objetivo se haya logrado.</p>
              <Field label="Evidencia del resultado o motivo del cierre">
                <Textarea value={completionEvidence} onChange={(event) => setCompletionEvidence(event.target.value)} maxLength={2000} placeholder="Indica el resultado observado y dónde se puede comprobar" />
              </Field>
              {evidenceLength < 20 ? (
                <p className="text-sm text-muted" aria-live="polite">
                  Escribe al menos 20 caracteres para poder completarlo ({evidenceLength}/20).
                </p>
              ) : null}
            </form>
            <DialogFooter>
              <DialogClose>Cancelar</DialogClose>
              <Button type="submit" form="complete-camino-milestone" disabled={isCompletingMilestone || evidenceLength < 20 || evidenceLength > 2000 || (completionAction === "completed" && completionMode === "verify" && completionPending.length > 0)}>{isCompletingMilestone ? "Guardando…" : completionAction === "skipped" ? "Omitir hito" : completionMode === "exception" ? "Cerrar por excepción" : "Completar hito"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  );

  const currencyDialog = organizationId && plan && pendingCurrency ? (
    <CurrencyDialog
      organizationId={organizationId}
      planId={plan.id}
      to={pendingCurrency}
      goalTarget={plan.goal?.unit === "money" ? plan.goal.target : null}
      onCancel={() => setPendingCurrency(null)}
      onConfirm={() => {
        void changePlanCurrency(pendingCurrency);
        setPendingCurrency(null);
      }}
    />
  ) : null;

  const discussModal = (
        <DiscussModal
          organizationId={organizationId}
          title={discuss ? `Hito ${discuss.code} · ${discuss.name}` : null}
          draft={discuss ? discussDraft(discuss, isConsultantView) : ""}
          viewerIsClient={!isConsultantView}
          onClose={() => setDiscuss(null)}
        />
  );

  // Mesa del consultor: rediseño propio (camino-consultant.tsx). Mutaciones y
  // formularios siguen aquí y se le pasan como callbacks y render props.
  if (desk && plan) {
    if (isLoading) {
      return (
        <div className="portal-page">
          <AsyncState status="loading" loadingLabel="Cargando plan..." />
        </div>
      );
    }
    const findMilestone = (milestoneId: string) => allMilestones.find((milestone) => milestone.id === milestoneId) ?? null;
    return (
      <div className={`portal-page ${d.desk}`}>
        {organizationId ? <A02Slot spot="camino" organizationId={organizationId} connectionId={connectionId} /> : null}
        {completionDialog}
        {currencyDialog}
        <ClosureSummary closures={payload?.closures ?? []} completed={plan?.status === "completed"} />
        {multiStore && showGeneral ? (
          <div>
            <Button type="button" variant="secondary" onClick={() => setGeneralFor(null)}>
              Todas las tiendas
            </Button>
          </div>
        ) : null}
        {plan.status === "draft" ? (
          <DraftNotice readiness={draftReadiness(phases, plan.goal)} canManage={canManage} isActivating={isActivating} onActivate={() => void activatePlan(plan.id)} />
        ) : null}
        {error ? <ErrorBlock onRetry={() => void loadPlan()}>{error}</ErrorBlock> : null}
        {payload?.marketing_assets_available === false ? (
          <p className="text-sm text-muted" role="status">
            No se pudo comprobar ahora el estado de los borradores de Marketing vinculados a las tareas.
          </p>
        ) : null}
        <ConsultantCamino
          plan={plan}
          phases={phases}
          organizationName={organization?.display_name ?? "El cliente"}
          viewerIsClient={!isConsultantView}
          replanDraft={payload?.replan_draft ?? null}
          storeName={stores?.find((store) => store.connectionId === connectionId)?.label ?? null}
          objectives={objectivesQuery.data?.objectives ?? []}
          reviews={weeklyReviews}
          marketingAssets={payload?.marketing_assets ?? []}
          formatGoal={shownGoal}
          formatObjective={shownObjective}
          canResolveTasks={canResolveTasks}
          canManage={canManage}
          currentUserId={bootstrap.user.id}
          generatingTaskId={generatingMarketingTaskId}
          retryingReviewId={retryingReviewId}
          onActivate={() => void activatePlan(plan.id)}
          isActivating={isActivating}
          onToggleTask={(task) => toggleTaskDone(task as MilestoneTask)}
          onDiscardTask={(task, reason) => setTaskStatus(task.id, "ignored", "Tarea descartada.", reason)}
          onReopenTask={(task) => void setTaskStatus(task.id, "pending", "Tarea recuperada.")}
          onAssignTask={(task, userId) => assignTask(task.id, userId)}
          onGenerateMarketingTask={(task) => void generateMarketingForTask(task as MilestoneTask)}
          onStartMilestone={(milestoneId) => changeMilestoneStatus(milestoneId, "in_progress")}
          onCompleteMilestone={(milestoneId) => {
            const milestone = findMilestone(milestoneId);
            if (milestone) toggleMilestoneComplete(milestone);
          }}
          onCloseByException={(milestoneId) => {
            const milestone = findMilestone(milestoneId);
            if (milestone) closeByException(milestone);
          }}
          onReopenMilestone={(milestoneId) => changeMilestoneStatus(milestoneId, "in_progress")}
          onSkipMilestone={async (milestoneId) => { const milestone = findMilestone(milestoneId); if (milestone) { setCompletionEvidence(""); setCompletionAction("skipped"); setCompletionMilestone(milestone); } }}
          onRemoveTask={(milestoneId, taskId) => unlinkPlanTask(milestoneId, taskId)}
          onDiscuss={setDiscuss}
          onChangeGoal={() => setIsEditingGoal(true)}
          onRetryReview={(reviewId) => void retryWeeklyReview(plan.id, reviewId)}
          onApproveLearning={(reviewId, learningIndex, edits) => approveWeeklyLearning(plan.id, reviewId, learningIndex, edits)}
          onProposalUpdated={() => void loadPlan(true)}
          organizationId={organizationId ?? ""}
          connectionId={connectionId}
          currency={amountsCurrency}
          storeTimezone={payload?.store_timezone ?? null}
          renderMilestoneEditor={(milestoneId, close) => {
            const milestone = findMilestone(milestoneId);
            if (!milestone) return null;
            return (
              <MilestoneEditForm
                milestone={milestone}
                onCancel={close}
                onSubmit={async (values) => {
                  if (await editMilestone(milestone.id, values)) close();
                }}
                deleteControl={
                  <DeleteMilestoneDialog
                    name={milestone.name}
                    trigger={<Button size="sm" variant="ghost">Eliminar hito</Button>}
                    onDelete={() => deletePlanMilestone(milestone)}
                  />
                }
              />
            );
          }}
          renderAddTask={(milestoneId, close) => (
            <AddTaskForm
              onCancel={close}
              onSubmit={async (values) => {
                if (await addMilestoneTask(milestoneId, values)) close();
              }}
            />
          )}
          renderTaskEditor={(milestoneId, taskId, close) => {
            const task = findMilestone(milestoneId)?.milestone_task_links.find((link) => link.tasks?.id === taskId)?.tasks;
            if (!task) return null;
            return (
              <EditTaskForm
                task={task}
                onCancel={close}
                onSubmit={async (values) => {
                  if (await updatePlanTask(milestoneId, taskId, values)) close();
                }}
              />
            );
          }}
          renderNotes={(milestoneId) => (organizationId && isConsultantView ? <MilestoneInternalNotes organizationId={organizationId} milestoneId={milestoneId} /> : null)}
          objectivesSlot={
            organizationId ? (
              <ObjectivesPanel
                organizationId={organizationId}
                objectivesQuery={objectivesQuery}
                milestones={milestoneOptions}
                currency={planCurrency}
                rate={fxRate}
                connectionId={connectionId}
                canManage={canManage}
                variant="consultant"
              />
            ) : null
          }
          settingsSlot={
            <PlanSettings
              name={plan.name}
              description={plan.description}
              version={plan.version}
              horizonMonths={plan.horizon_months}
              startsOn={plan.starts_on}
              timezone={payload?.store_timezone ?? null}
              previousPlans={payload?.previous_plans ?? []}
              organizationId={organizationId ?? ""}
              planId={plan.id}
              replacesPlan={Boolean(plan.replaces_plan_id)}
              currencyNote={
                plan.display_fx
                  ? `Se muestra en ${plan.display_fx.to}: 1 ${plan.display_fx.from} = ${rateNumber(plan.display_fx.rate)} ${plan.display_fx.to}, tipo BCE del ${rateDate.format(new Date(`${plan.display_fx.rate_date}T00:00:00Z`))}. Los importes guardados siguen en ${plan.display_fx.from}`
                  : "Convierte con el tipo del BCE del día, sin tocar los importes guardados"
              }
              onEdit={() => setIsEditingPlan(true)}
              editForm={
                isEditingPlan ? (
                  <NameDescriptionForm
                    title="Editar nombre y descripción"
                    initialName={plan.name}
                    initialDescription={plan.description ?? ""}
                    submitLabel="Guardar camino"
                    onCancel={() => setIsEditingPlan(false)}
                    onSubmit={async (values) => {
                      await updatePlanDetails(values);
                    }}
                  />
                ) : null
              }
              currencyControl={
                <Select
                  className="w-24"
                  aria-label="Moneda del camino"
                  value={planCurrency}
                  onChange={(value) => setPendingCurrency(value === planCurrency ? null : value)}
                  options={
                    CURRENCY_OPTIONS.some((option) => option.value === planCurrency)
                      ? CURRENCY_OPTIONS
                      : [{ value: planCurrency, label: planCurrency }, ...CURRENCY_OPTIONS]
                  }
                />
              }
            />
          }
          structureSlot={structureTree}
          dangerSlot={
            <PlanDanger
              deleteControl={
                <DeletePlanDialog
                  name={plan.name}
                  trigger={<Button type="button" size="sm" variant="destructive">Eliminar camino</Button>}
                  onDelete={() => deletePlan()}
                />
              }
            />
          }
        />
        {organizationId && plan.goal ? (
          <GoalTargetDialog
            isOpen={isEditingGoal}
            organizationId={organizationId}
            planId={plan.id}
            currentTarget={plan.goal.target}
            rate={fxRate}
            label={`${plan.goal.metric_label}${plan.goal.unit === "money" ? ` (${planCurrency})` : plan.goal.unit === "pct" ? " (%)" : ""}`}
            onClose={() => setIsEditingGoal(false)}
            onSaved={() => void loadPlan(true)}
          />
        ) : null}
        {discussModal}
      </div>
    );
  }

  return (
    <div className={`portal-page space-y-5 sm:space-y-6 ${d.client}`}>
      <WorkPageHeader title="Mi camino">Tu objetivo, los hitos para alcanzarlo y el trabajo que toca ahora.</WorkPageHeader>
      {organizationId ? <A02Slot spot="camino" organizationId={organizationId} connectionId={connectionId} /> : null}
      {completionDialog}
        {currencyDialog}
      <ClosureSummary closures={payload?.closures ?? []} completed={plan?.status === "completed"} />
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
          formatObjective={shownObjective}
          variant="client"
          hasConsultant={!isAutonomous}
          onDiscuss={setDiscuss}
          review={weeklyReviews.find((review) => review.output) ?? null}
          canResolveTasks={canResolveTasks}
          sourceLabels={TASK_SOURCE_LABELS}
          formatGoal={shownGoal}
          onToggleTask={(task) => toggleTaskDone(task as MilestoneTask)}
          onGenerateMarketingTask={canManage ? (task) => void generateMarketingForTask(task as MilestoneTask) : undefined}
          generatingTaskId={generatingMarketingTaskId}
          marketingAssets={payload?.marketing_assets ?? []}
          onApproveLearning={canManage ? (reviewId, learningIndex, edits) => approveWeeklyLearning(plan.id, reviewId, learningIndex, edits) : undefined}
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

      {canManage && showMap && !isConsultantView ? (
        <div className="space-y-3">
          <div role="group" aria-label="Acciones del plan" className="flex flex-wrap items-center gap-2 ml-auto">
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
              <DeletePlanDialog
                name={plan.name}
                trigger={<Button type="button" variant="destructive">Eliminar Camino</Button>}
                onDelete={() => deletePlan()}
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

      {plan?.status === "active" && showDetail ? (
        <Card>
          <CardHeader>
            <CardTitle>{desk ? undefined : "Revisión del camino"}</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyReviews.length ? (
              <div className="mt-3 space-y-4">
                {weeklyReviews.slice(0, 4).map((review) => {
                  const content = review.output;
                  if (review.status !== "succeeded" || !content) return (
                    <Item key={review.id} role="article" variant="outline">
                      <ItemContent>
                        <ItemTitle>{review.status === "failed" ? "No se pudo generar la revisión del Camino" : "Revisión del Camino en curso"}</ItemTitle>
                        <ItemDescription>Semana del {new Date(review.period_start).toLocaleDateString("es-ES")}. El Camino sigue sin cambios.</ItemDescription>
                      </ItemContent>
                      {canManage && review.can_retry && plan ? (
                        <Button size="sm" variant="secondary" onClick={() => void retryWeeklyReview(plan.id, review.id)} disabled={retryingReviewId === review.id}>
                          {retryingReviewId === review.id ? "Reintentando…" : "Reintentar revisión"}
                        </Button>
                      ) : review.status === "running" ? <Badge tone="neutral">En curso</Badge> : null}
                    </Item>
                  );
                  return (
                    <Card key={review.id} role="article"><CardContent>
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
                            <p className="text-sm font-semibold">{shownGoal(content.goal_progress.observed_value)}</p>
                          </div>
                          {content.goal_progress.comparison_value !== null ? (
                            <div className="rounded-md bg-surface-subtle px-3 py-2">
                              <p className="text-[11px] text-muted">Periodo anterior</p>
                              <p className="text-sm font-semibold">{shownGoal(content.goal_progress.comparison_value)}</p>
                            </div>
                          ) : null}
                          {content.goal_progress.expected_value != null ? (
                            <div className="rounded-md bg-surface-subtle px-3 py-2">
                              <p className="text-[11px] text-muted">Ritmo de referencia</p>
                              <p className="text-sm font-semibold">{shownGoal(content.goal_progress.expected_value)}</p>
                            </div>
                          ) : null}
                          {content.goal_progress.target_value != null ? (
                            <div className="rounded-md bg-surface-subtle px-3 py-2">
                              <p className="text-[11px] text-muted">Objetivo</p>
                              <p className="text-sm font-semibold">{shownGoal(content.goal_progress.target_value)}</p>
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
                        <Card size="sm" className="mt-4"><CardContent>
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
                        </CardContent></Card>
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
                        <Card size="sm" className="mt-4"><CardContent>
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
                        </CardContent></Card>
                      ) : null}
                      {content.warnings.length ? <p className="mt-2 text-xs text-muted">Límites: {content.warnings.join(" · ")}</p> : null}
                    </CardContent></Card>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Con la automatización de agentes activa, la primera revisión llega tres días después de activar el Camino y se repite cada tres días.</p>
            )}
          </CardContent>
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
      {organizationId && plan && showDetail ? (
        <ObjectivesPanel
          organizationId={organizationId}
          objectivesQuery={objectivesQuery}
          milestones={milestoneOptions}
          currency={planCurrency}
          rate={fxRate}
          connectionId={connectionId}
          canManage={canManage}
          variant={isConsultantView ? "consultant" : "client"}
        />
      ) : null}

      {error ? <ErrorBlock onRetry={() => void loadPlan()}>{error}</ErrorBlock> : null}

      {isLoading ? (
        <AsyncState status="loading" loadingLabel="Cargando plan..." />
      ) : plan ? (
        showDetail ? structureTree : null
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

      {discussModal}
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
