"use client";
import { LearningDecision, type LearningEdits } from "./learning-decision";
import { MeasurementDetails, type MeasurementInfo } from "./measurement-details";
import { DatePicker, Collapsible, CollapsibleContent, CollapsibleTrigger, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, IconChevronDown, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Select, ToggleGroup, ToggleGroupItem } from "@/components/ui";

import { SkipForwardIcon, UnlinkIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { displayValue } from "@/lib/display-labels";
import { useCachedQuery } from "@/lib/use-cached-query";
import { useCopilotAsk } from "@/components/copilot-ask";
import {
  Badge,
  Button,
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
  ButtonLink,
  CheckIcon,
  Field,
  Input,
  Textarea,
  MessageSquareIcon,
  MoreIcon,
  PlusIcon,
  Progress,
  RetryIcon,
  SparklesIcon,
  toast,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui";
import { latestMarketingAssetByTask, marketingAssetHref, marketingAssetStatusLabel, type CaminoMarketingAsset } from "@/lib/camino-marketing-assets";
import { MILESTONE_STATE_LABEL, byUrgency, closeDate, countableTasks, criteriaList, daysUntil, filterTasks, hasProgress, isTaskLate, lateTaskAdvice, milestoneState, milestoneTitle, monthPace, planTitle, todayIn, type MilestoneState, type TaskFilter } from "./camino-desk-model";
import { splitCriterion } from "./next-step";
import { PlanVersionDrawer } from "./camino-replan";
import { milestonesInMonth, monthToDate, monthlyTargetFor, routeStart, salesByMonth, type MonthlyTarget } from "./monthly-route-model";
import { TRACK_LABELS, TRACK_ORDER, cadenceLabel, growthRoutines, trackLabel } from "./task-tracks";
import { formatEffort, taskWantsEmailDraft, type PlanTaskMeta } from "./plan-task-meta";
import { CaminoProposalDecision, type StoredCaminoProposal } from "./proposal-decision";
import { taskOwnerLabel } from "./task-owner";
import type { DiscussTopic } from "./camino-map";
import c from "./camino-consultant.module.css";

/**
 * Mi Camino: la misma mesa para el cliente y su consultor.
 *
 * Cada pestaña responde a una pregunta. Hoja de ruta: qué hago ahora. Ruta
 * económica: si el plan tiene sentido. Indicadores: cómo van las cifras.
 * Configuración: administrar el plan. Seguimiento IA: qué propone la IA. Lo
 * técnico (criterios, razones, cálculos, medición) se abre bajo demanda.
 *
 * Solo pinta lo que trae el plan; los cambios los hace page.tsx (mutaciones y
 * formularios), que se pasan aquí como callbacks y render props.
 */

// ---------------------------------------------------------------------------
// Tipos (estructurales: page.tsx pasa los suyos, que traen más campos)
// ---------------------------------------------------------------------------

export type ConsultantTask = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  source: string;
  categories?: string[];
  created_by_origin?: "consultant" | "client" | null;
  /** A quién está asignada: el consultor puede cerrar las suyas, no las del cliente. */
  assigned_to?: string | null;
  assignee_name?: string | null;
  assignee_origin?: "consultant" | "client" | null;
  ignored_reason?: string | null;
  plan_meta?: PlanTaskMeta | null;
};

export type ConsultantMilestone = {
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
  completion_kind?: string | null;
  verification_snapshot?: { open_tasks?: Array<{ title: string }> } | null;
  milestone_task_links: Array<{ tasks: ConsultantTask | null }>;
};

export type ConsultantPhase = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  status: string;
  strategic_plan_milestones: ConsultantMilestone[];
};

type GoalUnit = "money" | "pct" | "count" | "ratio";

export type ConsultantGoal = {
  metric_key?: string;
  metric_label: string;
  unit: GoalUnit;
  baseline: number | null;
  target: number | null;
  target_date?: string;
  baseline_window_days?: number;
  baseline_observed_at?: string;
  rationale: string;
  assumptions: string[];
  decision_gates?: Array<{ decision: string; proceed_when: string; hold_when: string; evidence_needed: string }>;
  confidence: "low" | "medium" | "high";
  monthly_targets?: MonthlyTarget[];
  measured_from?: string;
};

export type ConsultantPlan = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  horizon_months?: number | null;
  starts_on: string | null;
  replaces_plan_id?: string | null;
  goal?: ConsultantGoal | null;
};

export type ConsultantObjective = {
  measurement?: MeasurementInfo;
  id: string;
  milestone_id: string | null;
  label: string;
  unit: "money" | "pct" | "count" | "ratio" | "number";
  direction: "up" | "down";
  source: string;
  metric_key?: string;
  target_value: number;
  actual_value: number | null;
  progress_pct: number | null;
  status: string;
};

export type ConsultantReview = {
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
    goal_progress: MeasurementInfo & {
      baseline_value?: number | null;
      status: string;
      explanation: string;
      observed_value: number | null;
      comparison_value: number | null;
      expected_value?: number | null;
      target_value?: number | null;
    };
    progress: Array<{ item: string; status: string; evidence: string }>;
    risks: Array<{ severity: string; detail: string; evidence: string }>;
    learnings?: Array<{ title: string; learning: string; evidence: string; applies_to: string; confidence: string; decision?: string }>;
    next_actions: Array<{ priority: string; title: string; rationale: string; owner: string; due_in_days: number }>;
    change_proposals: Array<{ change: string; target_type: string; target_id: string | null; description: string; reason: string; evidence: string }>;
    warnings: string[];
  } | null;
};

type Economics = {
  months: Array<{ month: string; orders: number; revenue: number | null; profit: number | null; margin_pct: number | null; in_progress: boolean }>;
  costs: { month: string | null; partial: boolean; items: Array<{ key: string; label: string; amount: number | null; included: boolean; note: string | null }> };
  currency_compatible: boolean;
  confidence: { level: "low" | "medium" | "high"; signals: Array<{ key: string; label: string; state: "ok" | "warn" | "missing"; detail: string }> };
};

export type DeskTab = "ruta" | "meta" | "seguimiento" | "objetivos" | "estructura";

/** `?vista=` de los avisos y enlaces: los nombres viejos siguen abriendo su pestaña. Sin vista, la hoja de ruta. */
export function deskTabFrom(value: string | null): DeskTab {
  if (value === "seguimiento" || value === "objetivos" || value === "meta") return value;
  if (value === "editor" || value === "estructura") return "estructura";
  return "ruta";
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const CLOSED = ["completed", "skipped"];
const OPEN_TASK = ["pending", "in_progress"];

const byPosition = <T extends { position: number }>(items: T[]) => items.slice().sort((a, b) => a.position - b.position);
const dayMonth = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" });

function asDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

function shortDate(value: string | null | undefined) {
  return value ? dayMonth.format(asDate(value)).replace(".", "") : "";
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("es-ES")} ${n === 1 ? one : many}`;
}

function tasksOf(milestone: ConsultantMilestone) {
  return milestone.milestone_task_links.map((link) => link.tasks).filter((task): task is ConsultantTask => task !== null);
}

const SOURCE_LABEL: Record<string, string> = {
  ai_consultant: "Propuesta por la IA",
  consulting_call: "De una llamada",
  alert: "De una alerta",
  manual: "Añadida a mano",
  system: "Sistema",
};

const PHASE_LABEL: Record<string, string> = { active: "En curso", completed: "Completada" };

const OWNER: Record<string, string> = { client: "Cliente", consultant: "Consultor" };

const TASK_FILTERS: Array<{ value: TaskFilter; label: string }> = [
  { value: "open", label: "Pendientes" },
  { value: "late", label: "Vencidas" },
  { value: "mine", label: "Mías" },
  { value: "done", label: "Cerradas" },
];

const GOAL_STATUS: Record<string, { label: string; cls: string }> = {
  on_track: { label: "En camino", cls: c.toneGood },
  achieved: { label: "Meta lograda", cls: c.toneGood },
  at_risk: { label: "En riesgo", cls: c.toneBad },
  blocked: { label: "Bloqueado", cls: c.toneBad },
};

const CONFIDENCE: Record<string, string> = { low: "confianza baja", medium: "confianza media", high: "confianza alta" };
const DATA_LEVEL: Record<string, string> = { low: "baja", medium: "media", high: "alta" };
const DATA_LEVEL_TONE: Record<string, "success" | "warn" | "danger"> = { high: "success", medium: "warn", low: "danger" };
const SIGNAL_MARK: Record<string, string> = { ok: "Cubierto", warn: "Incompleto", missing: "Falta" };
const SIGNAL_TONE: Record<string, "success" | "warn" | "danger"> = { ok: "success", warn: "warn", missing: "danger" };

function Bar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "terra" | "red" }) {
  return (
    <span className={c.bar} aria-hidden="true">
      <i className={c[`bar_${tone}`]} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export function ActionMenu({
  label,
  items,
  onAction,
}: {
  label: string;
  items: Array<{ id: string; label: string; danger?: boolean }>;
  onAction: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" aria-label={label} className={c.dots} />}>
        <MoreIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map((item) => (
          <DropdownMenuItem key={item.id} variant={item.danger ? "destructive" : "default"} onSelect={() => onAction(item.id)}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

type Stop = { milestone: ConsultantMilestone; phase: ConsultantPhase; code: string; state: MilestoneState };

export function ConsultantCamino({
  plan,
  phases: rawPhases,
  organizationName,
  viewerIsClient = false,
  replanDraft = null,
  storeName,
  objectives,
  reviews,
  marketingAssets,
  formatGoal,
  formatObjective,
  canResolveTasks,
  canManage,
  currentUserId,
  generatingTaskId,
  retryingReviewId,
  onActivate,
  isActivating,
  onToggleTask,
  onDiscardTask,
  onReopenTask,
  onAssignTask,
  onGenerateMarketingTask,
  onStartMilestone,
  onCompleteMilestone,
  onCloseByException,
  onReopenMilestone,
  onSkipMilestone,
  onRemoveTask,
  onDiscuss,
  onChangeGoal,
  onRetryReview,
  onApproveLearning,
  onProposalUpdated,
  organizationId,
  connectionId,
  currency,
  storeTimezone,
  renderMilestoneEditor,
  renderAddTask,
  renderTaskEditor,
  renderNotes,
  objectivesSlot,
  structureSlot,
  settingsSlot,
  dangerSlot,
}: {
  plan: ConsultantPlan;
  phases: ConsultantPhase[];
  organizationName: string;
  /** El cliente ve la misma mesa; cambia el texto según quién mira. */
  viewerIsClient?: boolean;
  /** Propuesta de A19 sin revisar: el Camino no cambia hasta confirmarla. */
  replanDraft?: { generated_at: string } | null;
  storeName: string | null;
  objectives: ConsultantObjective[];
  reviews: ConsultantReview[];
  marketingAssets: CaminoMarketingAsset[];
  formatGoal: (value: number) => string;
  formatObjective: (value: number, unit: ConsultantObjective["unit"]) => string;
  canResolveTasks: boolean;
  canManage: boolean;
  currentUserId: string;
  generatingTaskId: string | null;
  retryingReviewId: string | null;
  onActivate: () => void;
  isActivating: boolean;
  onToggleTask: (task: ConsultantTask) => void;
  onDiscardTask: (task: ConsultantTask, reason: string) => Promise<unknown>;
  onReopenTask: (task: ConsultantTask) => void;
  onAssignTask: (task: ConsultantTask, userId: string | null) => void;
  onGenerateMarketingTask: (task: ConsultantTask) => void;
  onStartMilestone: (milestoneId: string) => Promise<unknown>;
  onCompleteMilestone: (milestoneId: string) => void;
  onCloseByException: (milestoneId: string) => void;
  onReopenMilestone: (milestoneId: string) => Promise<unknown>;
  onSkipMilestone: (milestoneId: string) => Promise<unknown>;
  onRemoveTask: (milestoneId: string, taskId: string) => Promise<unknown>;
  onDiscuss: (topic: DiscussTopic) => void;
  onChangeGoal: () => void;
  onRetryReview: (reviewId: string) => void;
  onApproveLearning: (reviewId: string, learningIndex: number, edits?: LearningEdits) => Promise<void>;
  onProposalUpdated: () => void;
  organizationId: string;
  connectionId: string | null;
  /** Moneda de los importes guardados: las ventas solo se comparan con la meta si coincide. */
  currency: string;
  /** Las fechas se leen en la hora de la tienda. */
  storeTimezone: string | null;
  renderMilestoneEditor: (milestoneId: string, close: () => void) => ReactNode;
  renderAddTask: (milestoneId: string, close: () => void) => ReactNode;
  renderTaskEditor: (milestoneId: string, taskId: string, close: () => void) => ReactNode;
  renderNotes: (milestoneId: string) => ReactNode;
  objectivesSlot: ReactNode;
  structureSlot: ReactNode;
  settingsSlot: ReactNode;
  dangerSlot: ReactNode;
}) {
  const [today] = useState(() => todayIn(storeTimezone));
  const copilot = useCopilotAsk();
  const askAi = (question: string, focusLabel: string) => copilot({ question, focusLabel });
  // La sección y el hito abiertos viven en la URL (?vista=&hito=).
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = deskTabFrom(params.get("vista"));
  const selectedId = params.get("hito");

  function go(next: DeskTab, milestoneId?: string) {
    const query = new URLSearchParams(params);
    if (next === "ruta") query.delete("vista");
    else query.set("vista", next);
    if (milestoneId) query.set("hito", milestoneId);
    else query.delete("hito");
    const search = query.toString();
    router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
  }

  const phases = useMemo(() => byPosition(rawPhases), [rawPhases]);
  const stops = useMemo<Stop[]>(
    () =>
      phases.flatMap((phase, pi) =>
        byPosition(phase.strategic_plan_milestones).map((milestone, mi) => ({
          milestone: { ...milestone, name: milestoneTitle(milestone.name) },
          phase,
          code: `${pi + 1}.${mi + 1}`,
          state: milestoneState(milestone, phase.status, plan.status, today),
        })),
      ),
    [phases, plan.status, today],
  );

  // El hito "de ahora": el que está en curso en la fase activa o, si ninguno ha
  // arrancado, el primero abierto. Es el que se abre al entrar.
  const activePhase = phases.find((phase) => phase.status === "active") ?? null;
  const focus =
    stops.find((stop) => stop.phase.id === activePhase?.id && stop.milestone.status === "in_progress") ??
    stops.find((stop) => stop.phase.id === activePhase?.id && !CLOSED.includes(stop.milestone.status)) ??
    null;
  const selected = stops.find((stop) => stop.milestone.id === selectedId) ?? focus ?? stops[0] ?? null;

  const allTasks = stops.flatMap((stop) => tasksOf(stop.milestone));
  const closedMilestones = stops.filter((stop) => CLOSED.includes(stop.milestone.status)).length;
  const marketingByTask = useMemo(() => latestMarketingAssetByTask(marketingAssets), [marketingAssets]);

  const latest = reviews.find((review) => review.status !== "running" && review.output) ?? null;
  const pendingProposals = (latest?.proposals ?? []).filter((proposal) => proposal.status === "pending").length;
  const goal = plan.goal ?? null;
  const observed = latest?.output?.goal_progress.observed_value ?? null;
  // Ventas reales contra la meta, desde que empezó el camino.
  const salesDays = plan.starts_on ? Math.min(3650, Math.max(31, daysUntil(today.toISOString(), asDate(plan.starts_on)) + 2)) : 31;
  const sales = useCachedQuery<{ daily: Array<{ date: string; net_sales: number }>; currency_code?: string | null }>(
    goal?.metric_key === "net_sales"
      ? `/v1/organizations/${organizationId}/shopify/metrics?days=${salesDays}${connectionId ? `&connectionId=${encodeURIComponent(connectionId)}` : ""}`
      : null,
  );
  const salesData = sales.data && sales.data.currency_code === currency ? sales.data.daily : null;
  const monthSales = salesData ? monthToDate(salesData, today) : null;
  const monthActuals = useMemo(() => (salesData ? salesByMonth(salesData, plan.goal?.measured_from ?? plan.starts_on ?? "0000") : null), [salesData, plan.starts_on]);
  const heading = planTitle(plan.name);
  const margins = objectives.filter((objective) => objective.metric_key === "net_margin_pct");
  const margin = margins.find((objective) => !objective.milestone_id) ?? margins[0] ?? null;
  const economics = useCachedQuery<Economics>(tab === "meta" && goal ? `/v1/organizations/${organizationId}/strategic-plan/${plan.id}/economics` : null);
  const assignees = useCachedQuery<{ assignees: Array<{ id: string; name: string }> }>(tab === "ruta" && canManage ? `/v1/organizations/${organizationId}/task-assignees` : null);

  // Con una fase en curso lo dice la hoja de ruta; esto cubre los demás estados.
  const summary =
    plan.status === "draft"
      ? viewerIsClient
        ? "Es un borrador: aún no está activo."
        : "Es un borrador: el cliente aún no lo sigue. Revisa las fases y actívalo cuando esté listo."
      : !activePhase
        ? closedMilestones === stops.length && stops.length > 0
          ? "Recorrido cerrado. El resultado del objetivo se comprueba por separado."
          : "Ninguna fase está en curso."
        : null;

  const tabs: Array<{ key: DeskTab; label: string; count?: number }> = [
    { key: "ruta", label: "Hoja de ruta" },
    { key: "meta", label: "Ruta económica" },
    { key: "objetivos", label: "Indicadores" },
    { key: "estructura", label: "Configuración" },
    { key: "seguimiento", label: "Seguimiento IA", count: pendingProposals },
  ];

  function pick(stop: Stop) {
    go("ruta", stop.milestone.id);
  }

  function setMarginObjective() {
    const query = new URLSearchParams(params);
    query.set("vista", "objetivos");
    query.set("objetivo", "net_margin_pct");
    query.delete("hito");
    router.push(`${pathname}?${query.toString()}`, { scroll: false });
  }

  return (
    <div className={c.root}>
      {replanDraft && canManage ? (
        <Alert>
          <AlertTitle>A19 ha preparado una propuesta para replanificar este Camino</AlertTitle>
          <AlertDescription>Revisa qué cambia y decide qué aceptas. Tu Camino no cambia hasta que confirmes.</AlertDescription>
          <AlertAction>
            <ButtonLink href="/camino/nuevo?replan=1&revisar=1" size="sm">Revisar propuesta</ButtonLink>
          </AlertAction>
        </Alert>
      ) : null}
      {/* ---------- cabecera ---------- */}
      <header className={c.head}>
        <div className={c.headMain}>
          <p className={`${c.eyebrow} client-sr-title`}>
            <span>Mi Camino</span>
            <span>{organizationName}</span>
            {storeName ? <span>{storeName}</span> : null}
          </p>
          <h1 className={c.title}>{heading.title}</h1>
          <div className={c.chips}>
            <span className={`${c.pill} ${plan.status === "active" ? c.pillGood : plan.status === "draft" ? c.pillWarn : ""}`}>
              {plan.status === "active" ? "En curso" : displayValue(plan.status)}
            </span>
            {heading.prefix ? <span className={c.muted}>{heading.prefix}</span> : null}
          </div>
          {summary ? <p className={c.lead}>{summary}</p> : null}
        </div>
        <div className={c.headSide}>
          {goal ? (
            <GoalStrip
              goal={goal}
              startsOn={plan.starts_on}
              today={today}
              monthSales={monthSales}
              observed={observed}
              margin={margin}
              formatGoal={formatGoal}
              formatObjective={formatObjective}
              onSetMargin={canManage ? setMarginObjective : null}
              compact={tab === "estructura"}
            />
          ) : null}
          {plan.status === "draft" ? (
            <Button onClick={onActivate} disabled={isActivating}>
              {isActivating ? "Activando…" : "Activar camino"}
            </Button>
          ) : null}
        </div>
      </header>

      <nav className={c.tabs} role="tablist" aria-label="Secciones del camino">
        {tabs.map((item) => (
          <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} onClick={() => go(item.key)}>
            {item.label}
            {item.count ? <span className={c.count}>{item.count}</span> : null}
          </button>
        ))}
      </nav>

      {tab === "ruta" ? (
        <>
          <Roadmap phases={phases} stops={stops} selected={selected} today={today} planStatus={plan.status} onPick={pick} />
          {selected ? (
            <MilestoneDesk
              key={selected.milestone.id}
              stop={selected}
              today={today}
              planStatus={plan.status}
              objectives={objectives.filter((objective) => objective.milestone_id === selected.milestone.id)}
              formatObjective={formatObjective}
              canResolveTasks={canResolveTasks}
              canManage={canManage}
              currentUserId={currentUserId}
              marketingByTask={marketingByTask}
              generatingTaskId={generatingTaskId}
              assignees={assignees.data?.assignees ?? []}
              onToggleTask={onToggleTask}
              onDiscardTask={onDiscardTask}
              onReopenTask={onReopenTask}
              onAssignTask={onAssignTask}
              onAskAi={askAi}
              onGenerateMarketingTask={onGenerateMarketingTask}
              onStart={() => onStartMilestone(selected.milestone.id)}
              onComplete={() => onCompleteMilestone(selected.milestone.id)}
              onCloseByException={() => onCloseByException(selected.milestone.id)}
              onReopen={() => onReopenMilestone(selected.milestone.id)}
              onSkip={() => onSkipMilestone(selected.milestone.id)}
              onRemoveTask={(taskId) => onRemoveTask(selected.milestone.id, taskId)}
              onDiscuss={onDiscuss}
              onOpenObjectives={() => go("objetivos")}
              renderEditor={(close) => renderMilestoneEditor(selected.milestone.id, close)}
              renderAddTask={(close) => renderAddTask(selected.milestone.id, close)}
              renderTaskEditor={(taskId, close) => renderTaskEditor(selected.milestone.id, taskId, close)}
              notes={renderNotes(selected.milestone.id)}
              viewerIsClient={viewerIsClient}
            />
          ) : (
            <p className={c.empty}>Este camino aún no tiene hitos. Añádelos en «Configuración».</p>
          )}
          <Tracks tasks={allTasks} />
        </>
      ) : null}

      {tab === "meta" ? <GoalDesk goal={goal} startsOn={plan.starts_on} stops={stops} observed={observed} monthActuals={monthActuals} margin={margin} economics={economics.data ?? null} economicsFailed={Boolean(economics.error)} formatGoal={formatGoal} formatObjective={formatObjective} canManage={canManage} onChangeGoal={onChangeGoal} onAskAi={askAi} today={today} /> : null}

      {tab === "seguimiento" ? (
        <ReviewDesk
          reviews={reviews}
          planStatus={plan.status}
          formatGoal={goal ? formatGoal : null}
          canManage={canManage}
          retryingReviewId={retryingReviewId}
          onRetry={onRetryReview}
          onApproveLearning={onApproveLearning}
          organizationId={organizationId}
          planId={plan.id}
          onProposalUpdated={onProposalUpdated}
        />
      ) : null}

      {tab === "objetivos" ? <div className={`${c.slot} ${c.blueAccent}`}>{objectivesSlot}</div> : null}

      {tab === "estructura" ? (
        <div className={c.slot}>
          {settingsSlot}
          {structureSlot}
          {dangerSlot}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meta: cómo va el mes y si se protege el margen
// ---------------------------------------------------------------------------

function GoalStrip({
  goal,
  startsOn,
  today,
  monthSales,
  observed,
  margin,
  formatGoal,
  formatObjective,
  onSetMargin,
  compact,
}: {
  goal: ConsultantGoal;
  startsOn: string | null;
  today: Date;
  monthSales: number | null;
  observed: number | null;
  margin: ConsultantObjective | null;
  formatGoal: (value: number) => string;
  formatObjective: (value: number, unit: ConsultantObjective["unit"]) => string;
  onSetMargin: (() => void) | null;
  compact: boolean;
}) {
  const route = startsOn ? monthlyTargetFor(routeStart(startsOn, goal.monthly_targets ?? []), goal.monthly_targets ?? [], today) : null;
  const target = route?.target_value ?? goal.target;
  if (target === null) return null;
  const short = (value: number) => formatGoal(value).replace(/,00(?=\s|$)/, "");
  const actual = monthSales ?? observed;
  const pct = monthSales !== null && target > 0 ? (monthSales / target) * 100 : null;
  const reached = margin?.status === "cumplido";
  const period = margin?.measurement?.period_label?.split(" · ")[0];
  return (
    <section className={`${c.goalStrip} ${compact ? c.goalCompact : ""}`} aria-label="Meta del camino">
      <div className={c.goalCell}>
        {/* La etiqueta de A19 ya trae el mes («Ventas netas Shopify durante noviembre de 2026»). */}
        <span className={c.noteL}>{route && goal.metric_key === "net_sales" ? `${monthLong.format(Date.UTC(today.getFullYear(), today.getMonth(), 1))} · Ventas netas` : goal.metric_label}</span>
        <strong>
          {actual !== null ? short(actual) : "—"} <small>de {short(target)}</small>
        </strong>
        {pct !== null ? <Bar value={pct} tone={pct >= 100 ? "green" : "blue"} /> : null}
        <span className={c.muted}>
          {pct === null
            ? actual !== null ? "Según la última revisión" : "Aún sin medir"
            : pct >= 100 ? "Meta del mes alcanzada" : `${Math.round(pct)} % · faltan ${short(target - monthSales!)}`}
        </span>
      </div>
      <div className={c.goalCell}>
        <span className={c.noteL}>
          {margin?.label ?? "Margen neto"}
          {period ? ` · ${period}` : ""}
        </span>
        {margin ? (
          <>
            <strong>
              {margin.actual_value !== null ? formatObjective(margin.actual_value, margin.unit) : "—"} <small>meta ≥ {formatObjective(margin.target_value, margin.unit)}</small>
            </strong>
            <span className={margin.actual_value === null ? c.muted : reached ? c.textGreen : c.textBad}>
              {margin.actual_value === null ? "Sin datos fiables" : reached ? "En la meta" : "Por debajo de la meta"}
            </span>
          </>
        ) : (
          <>
            <strong>—</strong>
            {onSetMargin ? (
              <button type="button" className={c.linkBtn} onClick={onSetMargin}>
                Fijar objetivo de margen
              </button>
            ) : (
              <span className={c.muted}>Sin objetivo</span>
            )}
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hoja de ruta: las fases en una línea y los hitos de la fase elegida
// ---------------------------------------------------------------------------

function Roadmap({
  phases,
  stops,
  selected,
  today,
  planStatus,
  onPick,
}: {
  phases: ConsultantPhase[];
  stops: Stop[];
  selected: Stop | null;
  today: Date;
  planStatus: string;
  onPick: (stop: Stop) => void;
}) {
  if (!phases.length) return null;
  const current = selected?.phase ?? phases[0]!;
  const currentIndex = phases.findIndex((phase) => phase.id === current.id);
  const inPhase = stops.filter((stop) => stop.phase.id === current.id);
  const closedHere = inPhase.filter((stop) => CLOSED.includes(stop.milestone.status)).length;
  return (
    <section className={c.roadmap} aria-label="Hoja de ruta">
      <ol className={c.steps}>
        {phases.map((phase, index) => {
          const own = stops.filter((stop) => stop.phase.id === phase.id);
          const closed = own.filter((stop) => CLOSED.includes(stop.milestone.status)).length;
          const late = own.flatMap((stop) => tasksOf(stop.milestone)).filter((task) => isTaskLate(task, today)).length;
          const state = planStatus === "draft" ? "draft" : phase.status === "completed" ? "done" : phase.status === "active" ? "active" : "locked";
          // Al elegir una fase se abre lo primero que quede por hacer en ella.
          const entry = own.find((stop) => !CLOSED.includes(stop.milestone.status)) ?? own[0];
          return (
            <li key={phase.id}>
              <button type="button" className={`${c.step} ${c[`step_${state}`]}`} aria-pressed={phase.id === current.id} disabled={!entry} onClick={() => entry && onPick(entry)}>
                <span className={c.phaseNum}>{state === "done" ? <CheckIcon aria-hidden /> : index + 1}</span>
                <span className={c.stepText}>
                  <b className={c.clamp2}>{phase.name}</b>
                  <small>
                    {state === "draft" ? "Prevista" : (PHASE_LABEL[phase.status] ?? "Pendiente")}
                    {own.length ? ` · ${closed}/${own.length} hitos` : " · Sin hitos"}
                    {late ? <span className={c.textBad}> · {plural(late, "vencida", "vencidas")}</span> : null}
                  </small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {inPhase.length ? (
        <div className={c.phaseRow}>
          <div className={c.phaseBar}>
            <h2>Hitos de la fase {currentIndex + 1}</h2>
            <span className={c.muted}>
              {closedHere} de {plural(inPhase.length, "completado", "completados")}
            </span>
          </div>
          <ol className={c.stops}>
            {inPhase.map((stop) => {
              const tasks = countableTasks(tasksOf(stop.milestone));
              const done = tasks.filter((task) => task.status === "completed").length;
              const stopClose = closeDate(stop.milestone);
              const days = stopClose ? daysUntil(stopClose, today) : null;
              const isOn = stop.milestone.id === selected?.milestone.id;
              return (
                <li key={stop.milestone.id}>
                  <button type="button" className={`${c.stop} ${c[`st_${stop.state}`]} ${isOn ? c.stopOn : ""}`} aria-pressed={isOn} onClick={() => onPick(stop)}>
                    <span className={c.stopTop}>
                      <span className={c.code}>{stop.code}</span>
                      <span className={c.stopState}>{stop.state === "late" && days !== null ? `${-days} d tarde` : MILESTONE_STATE_LABEL[stop.state]}</span>
                    </span>
                    <span className={`${c.stopName} ${c.clamp3}`}>{stop.milestone.name}</span>
                    <span className={c.stopFoot}>
                      {[`${done}/${tasks.length} tareas`, shortDate(stopClose)].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ficha del hito: qué falta por hacer; el porqué, bajo demanda
// ---------------------------------------------------------------------------

function MilestoneDesk({
  stop,
  today,
  planStatus,
  objectives,
  formatObjective,
  canResolveTasks,
  canManage,
  currentUserId,
  marketingByTask,
  generatingTaskId,
  assignees,
  onToggleTask,
  onDiscardTask,
  onReopenTask,
  onAssignTask,
  onAskAi,
  onGenerateMarketingTask,
  onStart,
  onComplete,
  onCloseByException,
  onReopen,
  onSkip,
  onRemoveTask,
  onDiscuss,
  onOpenObjectives,
  renderEditor,
  renderAddTask,
  renderTaskEditor,
  notes,
  viewerIsClient,
}: {
  stop: Stop;
  today: Date;
  planStatus: string;
  objectives: ConsultantObjective[];
  formatObjective: (value: number, unit: ConsultantObjective["unit"]) => string;
  canResolveTasks: boolean;
  canManage: boolean;
  currentUserId: string;
  marketingByTask: Map<string, CaminoMarketingAsset>;
  generatingTaskId: string | null;
  assignees: Array<{ id: string; name: string }>;
  onToggleTask: (task: ConsultantTask) => void;
  onDiscardTask: (task: ConsultantTask, reason: string) => Promise<unknown>;
  onReopenTask: (task: ConsultantTask) => void;
  onAssignTask: (task: ConsultantTask, userId: string | null) => void;
  onAskAi: (question: string, focusLabel: string) => void;
  onGenerateMarketingTask: (task: ConsultantTask) => void;
  onStart: () => Promise<unknown>;
  onComplete: () => void;
  onCloseByException: () => void;
  onReopen: () => Promise<unknown>;
  onSkip: () => Promise<unknown>;
  onRemoveTask: (taskId: string) => Promise<unknown>;
  onDiscuss: (topic: DiscussTopic) => void;
  onOpenObjectives: () => void;
  renderEditor: (close: () => void) => ReactNode;
  renderAddTask: (close: () => void) => ReactNode;
  renderTaskEditor: (taskId: string, close: () => void) => ReactNode;
  notes: ReactNode;
  viewerIsClient: boolean;
}) {
  const { milestone, code, state } = stop;
  const [editing, setEditing] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("open");
  const [discardingTask, setDiscardingTask] = useState<ConsultantTask | null>(null);

  const { text, criterion: descriptionCriterion } = splitCriterion(milestone.description);
  const criterion = milestone.success_criteria?.trim() || descriptionCriterion;
  const criteria = criterion ? criteriaList(criterion) : [];
  const tasks = tasksOf(milestone);
  const counted = countableTasks(tasks);
  const done = counted.filter((task) => task.status === "completed").length;
  const open = byUrgency(tasks.filter((task) => OPEN_TASK.includes(task.status)));
  const lateTasks = open.filter((task) => isTaskLate(task, today)).length;
  const countOf = (value: TaskFilter) => filterTasks(tasks, value, currentUserId, today).length;
  const shown = filter === "done" ? filterTasks(tasks, "done", currentUserId, today) : filterTasks(open, filter, currentUserId, today);
  const next = open[0] ?? null;
  const nextDays = next?.due_at ? daysUntil(next.due_at, today) : null;
  const nextReason = next?.due_at
    ? nextDays! < 0
      ? `Venció el ${shortDate(next.due_at)}`
      : nextDays === 0
        ? "Vence hoy"
        : `Vence el ${shortDate(next.due_at)}, es la siguiente en fecha`
    : "Es la primera tarea pendiente";
  const closeAt = closeDate(milestone);
  const days = closeAt ? daysUntil(closeAt, today) : null;

  const closed = CLOSED.includes(milestone.status);
  const locked = state === "locked";
  const draft = planStatus === "draft";
  const canChangeStatus = canManage && !draft && !locked;
  const tickHint = draft
    ? "Se marca cuando el camino esté activo"
    : viewerIsClient
      ? "La marca el responsable de la tienda"
      : "La marca el cliente";

  const due =
    state === "done"
      ? milestone.completed_at
        ? `Completado el ${shortDate(milestone.completed_at)}`
        : "Completado"
      : state === "skipped"
        ? "Omitido"
        : closeAt
          ? days! < 0
            ? `Vencía el ${shortDate(closeAt)} · ${plural(-days!, "día", "días")} de retraso`
            : days === 0
              ? "Vence hoy"
              : `Vence el ${shortDate(closeAt)} · quedan ${plural(days!, "día", "días")}`
          : "Sin fecha objetivo";
  const dates = [
    milestone.target_date ? `Objetivo: ${shortDate(milestone.target_date)}` : null,
    milestone.deadline_date ? `Límite: ${shortDate(milestone.deadline_date)}` : null,
    milestone.measurement_date ? `Medición: ${shortDate(milestone.measurement_date)}` : null,
  ].filter(Boolean);
  const openAtClose = milestone.verification_snapshot?.open_tasks ?? [];

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  const menu = [
    ...(canManage ? [{ id: "edit", label: "Editar nombre, descripción y fechas" }] : []),
    { id: "objectives", label: "Métricas y objetivos del hito" },
    ...(canChangeStatus && !closed && open.length ? [{ id: "exception", label: "Cerrar por excepción" }] : []),
    ...(canChangeStatus && !closed ? [{ id: "skip", label: "Omitir hito", danger: true }] : []),
  ];
  const onMenu = (id: string) => {
    if (id === "edit") setEditing(true);
    else if (id === "objectives") onOpenObjectives();
    else if (id === "exception") onCloseByException();
    else setSkipOpen(true);
  };

  const row = (task: ConsultantTask) => (
    <TaskRow
      key={task.id}
      task={task}
      today={today}
      canTick={(canResolveTasks || (Boolean(task.assigned_to) && task.assigned_to === currentUserId)) && !draft}
      tickHint={tickHint}
      canManage={canManage}
      viewerIsClient={viewerIsClient}
      currentUserId={currentUserId}
      asset={marketingByTask.get(task.id) ?? null}
      generating={generatingTaskId === task.id}
      milestoneClose={closeAt}
      assignees={assignees}
      onToggle={() => onToggleTask(task)}
      onDiscard={() => setDiscardingTask(task)}
      onReopen={() => onReopenTask(task)}
      onAssign={(userId) => onAssignTask(task, userId)}
      onAskAi={onAskAi}
      onGenerate={() => onGenerateMarketingTask(task)}
      onEdit={() => setEditingTaskId(task.id)}
      onRemove={() => onRemoveTask(task.id)}
      editor={editingTaskId === task.id ? renderTaskEditor(task.id, () => setEditingTaskId(null)) : null}
    />
  );

  return (
    <section id="camino-ficha" className={c.desk} aria-labelledby={`ficha-${milestone.id}`}>
      <p className="sr-only" role="status">
        Hito {code} seleccionado: {milestone.name}
      </p>
      <div className={c.deskHead}>
        <div className={c.deskTitle}>
          <span className={c.deskKicker}>
            <span>Fase {code.split(".")[0]} · Hito {code}</span>
            <span className={`${c.state} ${c[`st_${state}`]}`}>{MILESTONE_STATE_LABEL[state]}</span>
          </span>
          <h2 id={`ficha-${milestone.id}`}>{milestone.name}</h2>
          {text ? <p className={`${c.deskLead} ${c.clamp2}`}>{text}</p> : null}
        </div>
        <div className={c.deskActs}>
          {canChangeStatus && milestone.status === "pending" && !hasProgress(milestone) ? (
            <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void run("start", onStart)}>
              {busy === "start" ? "Empezando…" : "Empezar hito"}
            </Button>
          ) : null}
          {/* Solo aparece cuando se puede usar: lo que falta ya lo dice el contador. */}
          {canChangeStatus && !closed && !open.length ? (
            <Button size="sm" disabled={busy !== null} onClick={onComplete}>
              Completar hito
            </Button>
          ) : null}
          {canChangeStatus && closed ? (
            <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void run("reopen", onReopen)}>
              {busy === "reopen" ? "Reabriendo…" : "Reabrir hito"}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onDiscuss({ code, name: milestone.name, targetDate: milestone.target_date, doneTasks: done, totalTasks: tasks.length, late: state === "late" })
            }
          >
            <MessageSquareIcon aria-hidden />
            {viewerIsClient ? "Escribir al consultor" : "Escribir al cliente"}
          </Button>
          <ActionMenu
            label={`Más acciones del hito ${code}`}
            items={menu}
            onAction={onMenu}
          />
          <AlertDialog open={skipOpen} onOpenChange={setSkipOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <SkipForwardIcon />
                </AlertDialogMedia>
                <AlertDialogTitle>¿Omitir el hito {code}?</AlertDialogTitle>
                <AlertDialogDescription>El hito se da por cerrado sin hacerse.</AlertDialogDescription>
              </AlertDialogHeader>
              <ul className="ui-alert-dialog__list">
                <li>
                  {open.length
                    ? `Sus ${plural(open.length, "tarea abierta sigue", "tareas abiertas siguen")} en Tareas, sin cerrar.`
                    : "No tiene tareas abiertas."}
                </li>
                <li>Si es el último hito abierto de la fase, la fase se completa y se abre la siguiente.</li>
                <li>Se puede reabrir después.</li>
              </ul>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("skip", onSkip)}>Omitir hito</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className={c.deskProgress}>
        <div className={c.deskProgressTop}>
          <span className={state === "late" ? c.textBad : undefined}>{due}</span>
          {counted.length ? (
            <span>
              {done} de {plural(counted.length, "tarea", "tareas")}
              {lateTasks ? <b className={c.textBad}> · {plural(lateTasks, "vencida", "vencidas")}</b> : null}
            </span>
          ) : null}
        </div>
        <Bar value={counted.length ? (done / counted.length) * 100 : 0} tone={state === "done" ? "green" : state === "late" ? "red" : "blue"} />
      </div>

      {locked ? <p className={c.readiness}>Este hito se cierra cuando termine la fase anterior. Sus tareas ya se pueden adelantar.</p> : null}
      {editing ? <div className={c.inline}>{renderEditor(() => setEditing(false))}</div> : null}
      {milestone.status === "completed" && milestone.completion_evidence ? (
        <div className={`${c.note} ${c.noteGood}`}>
          <span className={c.noteL}>{milestone.completion_kind === "exception" ? "Cierre por excepción" : milestone.completion_kind ? "Resultado verificado" : "Cierre anterior sin verificación estructurada"}</span>
          <p>{milestone.completion_evidence}</p>
          {openAtClose.length ? <p className={c.muted}>Se cerró con tareas abiertas: {openAtClose.map((task) => task.title).join(" · ")}</p> : null}
        </div>
      ) : null}

      {next && !closed && !locked ? (
        <div className={`${c.nextUp} ${nextDays !== null && nextDays < 0 ? c.nextLate : ""}`}>
          <span className={c.noteL}>Tu próxima prioridad</span>
          <b>{next.title}</b>
          <span className={c.muted}>{nextReason}</span>
        </div>
      ) : null}

      <div className={c.taskHead}>
        <h3>Tareas</h3>
        <div className={c.taskTools}>
          {tasks.length ? (
            <ToggleGroup aria-label="Qué tareas ver" value={filter} onValueChange={setFilter}>
              {TASK_FILTERS.filter((item) => item.value === "open" || item.value === filter || countOf(item.value) > 0).map((item) => (
                <ToggleGroupItem key={item.value} value={item.value}>
                  {item.label} {countOf(item.value)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
          {canManage && !addingTask ? (
            <Button variant="secondary" size="sm" onClick={() => setAddingTask(true)}>
              <PlusIcon aria-hidden />
              Tarea
            </Button>
          ) : null}
        </div>
      </div>
      {addingTask ? <div className={c.inline}>{renderAddTask(() => setAddingTask(false))}</div> : null}
      {discardingTask ? <DiscardTaskDialog task={discardingTask} onClose={() => setDiscardingTask(null)} onDiscard={(reason) => onDiscardTask(discardingTask, reason)} /> : null}
      {shown.length ? (
        <ul className={c.tasks}>{shown.map(row)}</ul>
      ) : (
        <p className={c.empty}>{tasks.length ? "No hay tareas en esta vista." : "Este hito no tiene tareas todavía."}</p>
      )}

      <Collapsible className={`${c.more} ${c.details}`}>
        <CollapsibleTrigger>
          Contexto y criterios del hito
          <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={c.detail}>
            {dates.length ? (
              <>
                <span className={c.noteL}>Fechas</span>
                <p>{dates.join(" · ")}</p>
              </>
            ) : null}
            <span className={c.noteL}>Criterios de éxito</span>
            {criteria.length > 1 ? (
              <ul className={c.bullets}>
                {criteria.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className={criteria.length ? undefined : c.muted}>{criteria[0] ?? "Sin criterio escrito. Añádelo al editar el hito."}</p>
            )}
            {objectives.map((objective) => {
              const reached = objective.status === "cumplido";
              return (
                <div key={objective.id} className={c.meter}>
                  <span className={c.meterTop}>
                    <b>
                      {objective.actual_value !== null ? formatObjective(objective.actual_value, objective.unit) : "—"}{" "}
                      <small>
                        meta {objective.direction === "down" ? "≤" : "≥"} {formatObjective(objective.target_value, objective.unit)}
                      </small>
                    </b>
                    <span className={`${c.tone} ${reached ? c.toneGood : ""}`}>
                      {objective.progress_pct === null ? "Sin datos aún" : reached ? "Meta alcanzada" : `${Math.round(objective.progress_pct)} %`}
                    </span>
                  </span>
                  {objective.progress_pct !== null ? <Bar value={objective.progress_pct} tone={reached ? "green" : "blue"} /> : null}
                  <span className={c.muted}>{objective.label}</span>
                  <MeasurementDetails measurement={objective.measurement} source={objective.source} />
                </div>
              );
            })}
            {milestone.rationale?.trim() ? (
              <>
                <span className={c.noteL}>Por qué ahora</span>
                <p>{milestone.rationale}</p>
              </>
            ) : null}
            {text.length > 160 ? (
              <>
                <span className={c.noteL}>Qué se busca</span>
                <p>{text}</p>
              </>
            ) : null}
            {notes ? (
              <>
                <span className={c.noteL}>Notas internas</span>
                {notes}
              </>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function DiscardTaskDialog({ task, onClose, onDiscard }: { task: ConsultantTask; onClose: () => void; onDiscard: (reason: string) => Promise<unknown> }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} busy={saving} dirty={Boolean(reason)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar «{task.title}»</DialogTitle>
          <DialogDescription>Deja de contar como pendiente y no bloquea el cierre del hito. Se puede recuperar.</DialogDescription>
        </DialogHeader>
        <form
          id="descartar-tarea"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            try {
              await onDiscard(reason.trim());
              onClose();
            } finally {
              setSaving(false);
            }
          }}
        >
          <Field label="Motivo" hint="Mínimo 10 caracteres. Queda visible en la tarea.">
            <Textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} required />
          </Field>
        </form>
        <DialogFooter>
          <DialogClose>Cancelar</DialogClose>
          <Button type="submit" form="descartar-tarea" disabled={saving || reason.trim().length < 10}>
            {saving ? "Descartando…" : "Descartar tarea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskRow({
  task,
  today,
  canTick,
  tickHint,
  canManage,
  viewerIsClient,
  currentUserId,
  asset,
  generating,
  milestoneClose,
  assignees,
  onToggle,
  onDiscard,
  onReopen,
  onAssign,
  onAskAi,
  onGenerate,
  onEdit,
  onRemove,
  editor,
}: {
  task: ConsultantTask;
  today: Date;
  canTick: boolean;
  tickHint: string;
  canManage: boolean;
  viewerIsClient: boolean;
  currentUserId: string;
  asset: CaminoMarketingAsset | null;
  generating: boolean;
  milestoneClose: string | null;
  assignees: Array<{ id: string; name: string }>;
  onToggle: () => void;
  onDiscard: () => void;
  onReopen: () => void;
  onAssign: (userId: string | null) => void;
  onAskAi: (question: string, focusLabel: string) => void;
  onGenerate: () => void;
  onEdit: () => void;
  onRemove: () => Promise<unknown>;
  editor: ReactNode;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isDiscarded = task.status === "ignored";
  const isDone = task.status === "completed";
  const late = isTaskLate(task, today);
  const meta = task.plan_meta;
  const owner = taskOwnerLabel(task, currentUserId, viewerIsClient) ?? OWNER[task.created_by_origin ?? ""] ?? null;
  // En la lista solo qué, quién y cuándo. Lo demás, al abrir la tarea.
  const facts = [
    trackLabel(meta?.track),
    cadenceLabel(meta?.cadence),
    formatEffort(meta?.effort_hours),
    task.priority === "high" ? "Prioridad alta" : null,
    task.source !== "strategic_plan" ? (SOURCE_LABEL[task.source] ?? displayValue(task.source)) : null,
    asset ? `Email · ${marketingAssetStatusLabel(asset)}` : null,
  ].filter(Boolean);
  const canAssign = canManage && meta?.owner_role === "shared" && assignees.length > 0 && OPEN_TASK.includes(task.status);
  const hasDetail = Boolean(facts.length || task.description?.trim() || meta?.definition_of_done || meta?.rationale || meta?.evidence?.length || late || canAssign);
  const tickable = canTick && ["pending", "in_progress", "completed"].includes(task.status);
  const menu = [
    ...(canManage ? [{ id: "edit", label: "Editar tarea" }] : []),
    ...(canTick && OPEN_TASK.includes(task.status) ? [{ id: "discard", label: "Descartar con motivo" }] : []),
    ...(canTick && isDiscarded ? [{ id: "reopen", label: "Recuperar tarea" }] : []),
    ...(canManage ? [{ id: "remove", label: "Quitar del camino", danger: true }] : []),
  ];
  const onMenu = (id: string) => {
    if (id === "edit") onEdit();
    else if (id === "discard") onDiscard();
    else if (id === "reopen") onReopen();
    else setRemoveOpen(true);
  };

  return (
    <li
      className={`${c.task} task-lift ${isDone || isDiscarded ? c.taskDone : ""} ${isDiscarded ? c.taskDiscarded : ""} ${late ? c.taskLate : ""} ${hasDetail ? c.taskOpens : ""}`}
      onClick={(event) => {
        if (hasDetail && !(event.target as HTMLElement).closest("button, a, input, textarea, form, dialog, [role=menu], [role=dialog], [role=alertdialog], [role=listbox], [role=option]")) setExpanded(!expanded);
      }}
    >
      <button
        type="button"
        className={c.tick}
        aria-pressed={isDone}
        aria-label={isDone ? `Reabrir: ${task.title}` : `Marcar hecha: ${task.title}`}
        title={tickable ? undefined : tickHint}
        disabled={!tickable}
        onClick={onToggle}
      >
        {isDone ? <CheckIcon aria-hidden /> : null}
      </button>
      <div className={c.taskBody}>
        {hasDetail ? (
          <Collapsible className={c.how} open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger>
              {task.title}
              <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              {late ? (
                <div className={c.lateHint}>
                  <p>{lateTaskAdvice(task.due_at!, milestoneClose, today)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onAskAi(
                        `La tarea «${task.title}» venció el ${shortDate(task.due_at)}${milestoneClose ? ` y su hito cierra el ${shortDate(milestoneClose)}` : ""}. ¿Cómo la resolverías o a qué fecha la moverías? Si faltan datos, dime cuáles.`,
                        "Tarea vencida",
                      )
                    }
                  >
                    <SparklesIcon aria-hidden />
                    Pedir sugerencia a la IA
                  </Button>
                </div>
              ) : null}
              {canAssign ? (
                <Field className={c.ownerField} label="Responsable principal" hint="Compartida: quien la lleva y responde de ella.">
                  <Select
                    value={task.assigned_to ?? ""}
                    onChange={(value) => onAssign(value || null)}
                    options={[{ value: "", label: "Sin responsable principal" }, ...assignees.map((person) => ({ value: person.id, label: person.name }))]}
                  />
                </Field>
              ) : null}
              {facts.length ? <p className={c.taskFacts}>{facts.join(" · ")}</p> : null}
              {task.description?.trim() ? <p>{task.description}</p> : null}
              {meta?.definition_of_done ? (
                <p>
                  <b>Se da por hecha cuando:</b> {meta.definition_of_done}
                </p>
              ) : null}
              {meta?.rationale ? (
                <p>
                  <b>Por qué:</b> {meta.rationale}
                </p>
              ) : null}
              {meta?.evidence?.length ? (
                <span className={c.evidence}>
                  {meta.evidence.map((item, index) => (
                    <span key={index}>
                      {item.label}: {item.value}
                      {item.period ? ` · ${item.period}` : ""}
                    </span>
                  ))}
                </span>
              ) : null}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <span className={c.taskTitle}>{task.title}</span>
        )}
        {isDiscarded ? <p className={c.muted}>Descartada{task.ignored_reason ? `: ${task.ignored_reason}` : ""}</p> : null}
        {editor ? <div className={c.inline}>{editor}</div> : null}
      </div>
      <div className={c.taskSide}>
        {task.priority === "urgent" && !isDone ? <span className={`${c.urgent} ${c.textBad}`}>Urgente</span> : null}
        {asset ? (
          <a className={c.chipLink} href={marketingAssetHref(asset.id)}>
            Abrir borrador
          </a>
        ) : canManage && taskWantsEmailDraft(task) && !isDone ? (
          <button type="button" className={c.chipLink} disabled={generating} onClick={onGenerate}>
            {generating ? "Preparando…" : "Borrador de email"}
          </button>
        ) : null}
        {owner ? <span className={c.owner}>{owner}</span> : null}
        <span className={`${c.due} ${late ? c.textBad : ""}`}>{task.due_at ? (late ? `Vencida · ${shortDate(task.due_at)}` : shortDate(task.due_at)) : ""}</span>
        <ActionMenu label={`Más acciones de la tarea: ${task.title}`} items={menu} onAction={onMenu} />
        <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogMedia>
                <UnlinkIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>¿Quitar la tarea del Camino?</AlertDialogTitle>
              <AlertDialogDescription>Se desvincula de este hito y sigue disponible en Tareas.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onRemove}>Quitar tarea</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Todo el camino: el trabajo por carril, de todas las fases
// ---------------------------------------------------------------------------

const TRACK_HINT: Record<string, string> = {
  puesta_a_punto: "Se hace una vez",
  temporada: "Preparar cada fecha clave",
  crecimiento: "Rutinas que se repiten",
};

function Tracks({ tasks }: { tasks: ConsultantTask[] }) {
  const byTrack = TRACK_ORDER.map((track) => {
    const list = tasks.filter((task) => task.plan_meta?.track === track);
    return { track, total: list.length, done: list.filter((task) => task.status === "completed").length };
  });
  if (byTrack.every((entry) => entry.total === 0)) return null;
  const routines = growthRoutines(tasks);
  const doneAll = tasks.filter((task) => task.status === "completed").length;
  return (
    <Collapsible className={`${c.panel} ${c.more}`}>
      <CollapsibleTrigger>
        Todo el camino: {doneAll} de {plural(tasks.length, "tarea hecha", "tareas hechas")}
        <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
      </CollapsibleTrigger>
      <CollapsibleContent>
      <div className={c.lanes}>
        {byTrack.map(({ track, total, done }, index) => (
          <div key={track} className={c.lane}>
            <span className={`${c.laneDot} ${c[`lane${index}`]}`} aria-hidden="true" />
            <div>
              <b>{TRACK_LABELS[track]}</b>
              <span className={c.muted}>{TRACK_HINT[track]}</span>
            </div>
            <span className={c.laneNum}>
              {done}
              <small>/{total}</small>
            </span>
            <Bar value={total ? (done / total) * 100 : 0} tone={index === 0 ? "blue" : index === 1 ? "terra" : "green"} />
          </div>
        ))}
      </div>
      {routines.length ? (
        <Collapsible className={c.more}>
          <CollapsibleTrigger>Ver las {routines.length} rutinas de crecimiento<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
          <CollapsibleContent>
          <ul className={c.routines}>
            {routines.map((routine) => (
              <li key={routine.name}>
                <span>{routine.name}</span>
                <span className={c.muted}>
                  {[cadenceLabel(routine.cadence), `${routine.done}/${routine.total}`, routine.nextDue ? `siguiente ${shortDate(routine.nextDue)}` : null].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
        </Collapsible>
      ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Ruta económica
// ---------------------------------------------------------------------------

/** El margen de cada mes con coste completo, y qué entra y qué falta en el cálculo. */
function MarginPanel({ economics, target, formatMoney, formatPct }: { economics: Economics; target: number | null; formatMoney: (value: number) => string; formatPct: (value: number) => string }) {
  const { months, costs } = economics;
  const values = months.flatMap((month) => (month.margin_pct === null ? [] : [month.margin_pct]));
  const top = Math.max(1, target ?? 0, ...values);
  const included = costs.items.filter((item) => item.included);
  const missing = costs.items.filter((item) => !item.included);
  const costMonth = costs.month ? monthYear.format(new Date(`${costs.month}-01T00:00:00Z`)) : null;
  return (
    <section className={c.panel} aria-labelledby="margen-camino">
      <div className={c.panelHead}>
        <div>
          <h3 id="margen-camino">{costs.partial ? "Margen parcial, mes a mes" : "Margen neto, mes a mes"}</h3>
          <span className={c.muted}>Solo se dibuja un mes si todos sus artículos tienen coste</span>
        </div>
        {target !== null ? (
          <span className={c.legend}>
            <span>
              <i className={c.keyBase} aria-hidden="true" /> Objetivo {formatPct(target)}
            </span>
          </span>
        ) : null}
      </div>
      {values.length ? (
        <div className={c.marginCols}>
          {target !== null ? (
            <span className={c.plot} aria-hidden="true">
              <i style={{ bottom: `${(target / top) * 100}%` }} />
            </span>
          ) : null}
          {months.map((month) => {
            const label = monthShort.format(new Date(`${month.month}-01T00:00:00Z`)).replace(".", "");
            const value = month.margin_pct;
            return (
              <div key={month.month} className={c.marginCol} title={value === null ? `${label}: sin coste completo` : `${label}: ${formatPct(value)}`}>
                <span className={c.colV}>{value === null ? "—" : formatPct(value)}</span>
                <span className={c.marginTrack}>{value !== null && value > 0 ? <i style={{ height: `${Math.max(2, (value / top) * 100)}%` }} /> : null}</span>
                <span className={c.colL}>
                  {label}
                  {month.in_progress ? "*" : ""}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={c.empty}>Aún no hay ningún mes con todos los costes para calcular el margen.</p>
      )}
      {values.length && months.some((month) => month.in_progress) ? <p className={c.muted}>* Mes en curso.</p> : null}
      <div className={c.costs}>
        <div>
          <span className={c.noteL}>Incluido{costMonth ? ` en ${costMonth}` : ""}</span>
          {included.length ? (
            <ul>
              {included.map((item) => (
                <li key={item.key}>
                  <span>{item.label}</span>
                  <b>{item.amount !== null ? formatMoney(item.amount) : "—"}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className={c.muted}>Ningún coste medido</p>
          )}
        </div>
        <div>
          <span className={c.noteL}>Falta por incluir</span>
          {missing.length ? (
            <ul>
              {missing.map((item) => (
                <li key={item.key}>
                  <span>{item.label}</span>
                  <span className={c.muted}>{item.note}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={c.muted}>Nada: el margen cuenta todos los costes conocidos</p>
          )}
        </div>
      </div>
    </section>
  );
}

function calendarMonth(startDate: string, month: number) {
  const start = asDate(startDate);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + month - 1, 1));
}

const monthKey = (date: Date) => date.toISOString().slice(0, 7);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
// El razonamiento de A19 lleva a veces el nombre interno de la métrica.
const plainRationale = (text: string) => text.replace(/\brun_rate_3m\b/g, "ritmo de los últimos 3 meses");

function GoalDesk({
  goal,
  startsOn,
  stops,
  observed,
  monthActuals,
  margin,
  economics,
  economicsFailed,
  formatGoal,
  formatObjective,
  canManage,
  onChangeGoal,
  onAskAi,
  today,
}: {
  goal: ConsultantGoal | null;
  startsOn: string | null;
  stops: Stop[];
  observed: number | null;
  monthActuals: Map<string, number> | null;
  margin: ConsultantObjective | null;
  economics: Economics | null;
  economicsFailed: boolean;
  formatGoal: (value: number) => string;
  formatObjective: (value: number, unit: ConsultantObjective["unit"]) => string;
  canManage: boolean;
  onChangeGoal: () => void;
  onAskAi: (question: string, focusLabel: string) => void;
  today: Date;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  if (!goal) {
    return <p className={c.empty}>Este camino no tiene meta. Se fija al crear o replanificar el camino.</p>;
  }
  const short = (value: number) => formatGoal(value).replace(/,00(?=\s|$)/, "");
  const growth = goal.baseline && goal.target ? Math.round((goal.target / goal.baseline - 1) * 100) : null;
  const targets = goal.monthly_targets ?? [];
  const startsAt = startsOn ?? today.toISOString().slice(0, 10);
  const start = routeStart(startsAt, targets);
  const thisMonth = monthKey(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
  const keyOf = (month: number) => monthKey(calendarMonth(start, month));
  const actualOf = (month: number) => monthActuals?.get(keyOf(month)) ?? null;
  const max = Math.max(1, goal.baseline ?? 0, ...targets.map((target) => Math.max(target.target_value ?? 0, actualOf(target.month) ?? 0)));
  // Un camino que empieza a mitad de mes acaba a mitad de mes: el primer y el
  // último tramo son parciales y compararlos con un mes entero engaña.
  const midMonthStart = asDate(startsAt).getUTCDate() !== 1 && !goal.measured_from;
  const isPartial = (month: number) => midMonthStart && (month === 1 || month === targets.length);

  const goalMonth = targets.find((target) => goal.target !== null && target.target_value === goal.target) ?? null;
  const goalActual = goalMonth ? (actualOf(goalMonth.month) ?? observed) : observed;
  const reachedPct = goalActual !== null && goal.target ? Math.round((goalActual / goal.target) * 100) : null;
  const marginGap = margin?.actual_value != null ? margin.actual_value - margin.target_value : null;

  const current = targets.find((target) => target.month === picked) ?? targets.find((target) => keyOf(target.month) === thisMonth) ?? goalMonth ?? targets[0] ?? null;
  const currentActual = current ? actualOf(current.month) : null;
  const currentChange = current?.target_value != null && goal.baseline ? Math.round((current.target_value / goal.baseline - 1) * 100) : null;
  const thisTarget = targets.find((target) => keyOf(target.month) === thisMonth) ?? null;
  const thisActual = thisTarget ? actualOf(thisTarget.month) : null;
  const pace = thisTarget?.target_value && thisActual !== null ? monthPace(thisActual, thisTarget.target_value, today) : null;
  const behind = (pace !== null && pace.pct < 100) || (marginGap !== null && marginGap < 0);
  const measuredAt = goalMonth ? monthLong.format(calendarMonth(start, goalMonth.month)) : null;
  const dateFacts = [goal.target_date ? `Fecha objetivo: ${shortDate(goal.target_date)}` : null, measuredAt ? `Se mide al cerrar ${measuredAt}` : null].filter(Boolean).join(" · ");
  const marginName = economics?.costs.partial ? "Margen parcial" : (margin?.label ?? "Margen neto");
  const goalStatus =
    pace && pace.pct < 100
      ? ({ label: "Por debajo del ritmo", tone: "warn" } as const)
      : marginGap !== null && marginGap < 0
        ? ({ label: "Margen por debajo", tone: "warn" } as const)
        : pace
          ? ({ label: "En ritmo", tone: "success" } as const)
          : null;
  const currentMilestones = current ? milestonesInMonth(start, current.month, stops.map((stop) => ({ name: `${stop.code} ${stop.milestone.name}`, date: stop.milestone.target_date }))) : [];

  return (
    <div className={c.goalStack}>
      <section className={c.panel} aria-labelledby="meta-camino">
        <div className={c.panelHead}>
          <div className={c.goalHeading}>
            <div className={c.goalTitle}>
              <h3 id="meta-camino">{goalMonth ? `Meta de ${monthLong.format(calendarMonth(start, goalMonth.month))}` : "Meta del camino"}</h3>
              {goalStatus ? <Badge tone={goalStatus.tone}>{goalStatus.label}</Badge> : null}
            </div>
            <span className={c.muted}>{[goal.metric_label, dateFacts].filter(Boolean).join(" · ")}</span>
          </div>
          {canManage ? (
            <Button variant="secondary" size="sm" onClick={onChangeGoal}>
              Cambiar meta
            </Button>
          ) : null}
        </div>
        <div className={c.goalSummary}>
          <div className={c.goalHero}>
            <span className={c.noteL}>Actual</span>
            <p className={c.goalHeroValue}>
              <b>{goalActual !== null ? short(Math.round(goalActual)) : "—"}</b>
              <span>{goal.target !== null ? `de ${short(goal.target)}` : "Sin cuantificar"}</span>
            </p>
            {reachedPct !== null ? <Progress value={Math.min(100, reachedPct)} aria-label="Progreso hacia la meta" /> : null}
            <span className={c.muted}>{reachedPct !== null ? `${reachedPct} % alcanzado` : "Aún sin medir"}</span>
          </div>
          <div className={c.goalTiles}>
            {pace ? (
              <div>
                <span className={c.noteL}>Cierre a este ritmo</span>
                <b className={pace.pct < 100 ? c.textBad : undefined}>{short(Math.round(pace.projected))}</b>
                <span className={c.muted}>{Math.round(pace.pct)} % del objetivo del mes</span>
              </div>
            ) : null}
            <div>
              <span className={c.noteL}>{marginName}</span>
              <b className={marginGap !== null && marginGap < 0 ? c.textBad : undefined}>{margin?.actual_value != null ? formatObjective(margin.actual_value, margin.unit) : "—"}</b>
              <span className={c.muted}>
                {margin === null
                  ? "Sin objetivo de margen"
                  : marginGap === null
                    ? `Sin datos fiables. La meta exige ${formatObjective(margin.target_value, margin.unit)}`
                    : `${marginGap >= 0 ? "+" : "−"}${Math.abs(marginGap).toLocaleString("es-ES", { maximumFractionDigits: 1 })} pp del ${formatObjective(margin.target_value, margin.unit)} que exige la meta`}
              </span>
            </div>
            <div>
              <span className={c.noteL}>Referencia</span>
              <b>{goal.baseline !== null ? short(goal.baseline) : "—"}</b>
              <span className={c.muted}>{growth !== null ? `Ritmo mensual · objetivo ${growth >= 0 ? "+" : ""}${growth} %` : "Ritmo mensual reciente"}</span>
            </div>
          </div>
        </div>
        {behind || economics ? (
          <div className={c.goalActions}>
            {behind ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  onAskAi(
                    `${[pace && thisTarget?.target_value ? `Ventas de este mes: ${short(thisActual!)} de ${short(thisTarget.target_value)}.` : null, marginGap !== null && margin ? `Margen: ${formatObjective(margin.actual_value!, margin.unit)} frente a ${formatObjective(margin.target_value, margin.unit)}.` : null].filter(Boolean).join(" ")} ¿Qué explica la desviación? Separa lo que los datos confirman de las hipótesis, y dime qué costes o datos faltan por verificar.`,
                    "Meta económica",
                  )
                }
              >
                <SparklesIcon aria-hidden />
                Analizar la desviación con IA
              </Button>
            ) : null}
            {economics ? (
              <span className={c.goalSolidity}>
                Solidez de los datos
                <Badge tone={DATA_LEVEL_TONE[economics.confidence.level]} className="capitalize">{DATA_LEVEL[economics.confidence.level]}</Badge>
              </span>
            ) : null}
          </div>
        ) : null}
        <Collapsible className={c.more}>
          <CollapsibleTrigger>
            Por qué esta meta y cómo se calcula
            <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className={c.goalDetail}>
              <div className={c.goalWhy}>
                <div className={c.goalBlock}>
                  {goal.rationale ? (
                    <>
                      <h4>Por qué esta cifra</h4>
                      <p>{plainRationale(goal.rationale)}</p>
                    </>
                  ) : null}
                  {goal.assumptions.length ? (
                    <>
                      <h4>Supuestos</h4>
                      <ul className={c.bullets}>
                        {goal.assumptions.map((assumption, index) => (
                          <li key={index}>{plainRationale(assumption)}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
                <div className={c.goalBlock}>
                  {economics ? (
                    <>
                      <h4>Solidez de los datos</h4>
                      <ul className={c.signals}>
                        {economics.confidence.signals.map((signal) => (
                          <li key={signal.key}>
                            <b>{signal.label}</b>
                            <span>{signal.detail}</span>
                            <Badge tone={SIGNAL_TONE[signal.state]}>{SIGNAL_MARK[signal.state]}</Badge>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <h4>Cómo leer estas cifras</h4>
                  <p>La IA propuso esta meta con {CONFIDENCE[goal.confidence] ?? "confianza sin indicar"}. Es su valoración, no una previsión estadística.</p>
                  {pace ? <p>El cierre a este ritmo extrapola lo vendido en lo que va de mes. Tampoco es una previsión.</p> : null}
                </div>
              </div>
              {goal.decision_gates?.length ? (
                <div className={c.goalBlock}>
                  <h4>Decisiones que dependen de los datos</h4>
                  <ul className={c.gates}>
                    {goal.decision_gates.map((gate, index) => (
                      <li key={index}>
                        <b>{gate.decision}</b>
                        <dl className={c.gateRules}>
                          <div>
                            <dt><Badge tone="success">Avanzar</Badge></dt>
                            <dd>{gate.proceed_when}</dd>
                          </div>
                          <div>
                            <dt><Badge tone="warn">Pausar</Badge></dt>
                            <dd>{gate.hold_when}</dd>
                          </div>
                          <div>
                            <dt><Badge tone="neutral">Comprobar</Badge></dt>
                            <dd>{gate.evidence_needed}</dd>
                          </div>
                        </dl>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      {economicsFailed ? <p className={c.empty}>No se pudo cargar la evolución del margen. Vuelve a abrir esta pestaña en un momento.</p> : null}
      {economics ? <MarginPanel economics={economics} target={margin?.target_value ?? null} formatMoney={(value) => formatObjective(value, "money")} formatPct={(value) => formatObjective(value, "pct")} /> : null}

      {targets.length ? (
        <section className={c.panel} aria-labelledby="ruta-economica">
          <div className={c.panelHead}>
            <div>
              <h3 id="ruta-economica">Objetivos mes a mes</h3>
              <span className={c.muted}>Elige un mes para ver por qué se fijó esa cifra</span>
            </div>
            <span className={c.legend}>
              <span>
                <i className={c.keyTarget} aria-hidden="true" /> Objetivo
              </span>
              <span>
                <i className={c.keyActual} aria-hidden="true" /> Ventas reales
              </span>
              {goal.baseline !== null ? (
                <span>
                  <i className={c.keyBase} aria-hidden="true" /> Referencia
                </span>
              ) : null}
            </span>
          </div>
          <div className={c.cols}>
            {goal.baseline !== null ? (
              <span className={c.plot} aria-hidden="true">
                <i style={{ bottom: `${(goal.baseline / max) * 100}%` }} />
              </span>
            ) : null}
            {targets.map((target) => {
              const month = calendarMonth(start, target.month);
              const actual = actualOf(target.month);
              const label = monthYear.format(month);
              const value = target.target_value === null ? "sin cifra" : short(target.target_value);
              return (
                <button
                  key={target.month}
                  type="button"
                  className={`${c.col} ${target.month === current?.month ? c.colOn : ""}`}
                  aria-pressed={target.month === current?.month}
                  aria-label={`${label}: objetivo ${value}${actual !== null ? `, ventas reales ${short(actual)}` : ""}`}
                  title={`Objetivo ${value}${actual !== null ? ` · Ventas reales ${short(actual)}` : ""}`}
                  onClick={() => setPicked(target.month)}
                >
                  <span className={c.colV}>{target.target_value === null ? "—" : short(target.target_value)}</span>
                  <span className={c.colTrack}>
                    <i style={{ height: `${target.target_value === null ? 0 : Math.max(3, (target.target_value / max) * 100)}%` }} />
                    {actual !== null ? <b style={{ height: `${Math.max(2, (actual / max) * 100)}%` }} /> : null}
                  </span>
                  <span className={c.colL}>
                    {monthShort.format(month).replace(".", "")}
                    {isPartial(target.month) ? "*" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          {targets.some((target) => isPartial(target.month)) ? <p className={c.muted}>* Mes parcial. Cada columna es un objetivo, no una previsión.</p> : null}
          {current ? (
            <div className={c.monthDetail}>
              <div className={c.monthHead}>
                <h4>{capitalize(monthYear.format(calendarMonth(start, current.month)))}</h4>
                <b>{current.target_value === null ? "Sin cifra" : short(current.target_value)}</b>
              </div>
              <p className={c.muted}>
                {[
                  currentChange !== null && !isPartial(current.month) ? `${currentChange >= 0 ? "+" : ""}${currentChange} % sobre la referencia` : null,
                  currentActual !== null ? `Ventas reales: ${short(currentActual)}` : null,
                ].filter(Boolean).join(" · ")}
              </p>
              <p>{plainRationale(current.rationale)}</p>
              {currentMilestones.length ? <p className={c.muted}>Hitos del mes: {currentMilestones.map((milestone) => milestone.name).join(" · ")}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seguimiento de la IA (A19)
// ---------------------------------------------------------------------------

const SEVERITY: Record<string, string> = { high: c.sevHigh, medium: c.sevMed, low: c.sevLow };
// Enumerados de la salida de A19 (packages/ai): en castellano, no en la clave.
const CHANGE_LABEL: Record<string, string> = { add: "Añadir", edit: "Cambiar", retire: "Retirar" };
const TARGET_LABEL: Record<string, string> = { phase: "fase", milestone: "hito", goal: "meta" };
const ACTION_OWNER: Record<string, string> = { client: "Cliente", consultant: "Consultor", shared: "Compartida", unknown: "Sin asignar" };

function ReviewDesk({
  reviews,
  planStatus,
  formatGoal,
  canManage,
  retryingReviewId,
  onRetry,
  onApproveLearning,
  organizationId,
  planId,
  onProposalUpdated,
}: {
  reviews: ConsultantReview[];
  planStatus: string;
  formatGoal: ((value: number) => string) | null;
  canManage: boolean;
  retryingReviewId: string | null;
  onRetry: (reviewId: string) => void;
  onApproveLearning: (reviewId: string, learningIndex: number, edits?: LearningEdits) => Promise<void>;
  organizationId: string;
  planId: string;
  onProposalUpdated: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [approved, setApproved] = useState<Set<string>>(() => new Set());
  const [approving, setApproving] = useState<string | null>(null);
  const recent = reviews.slice(0, 6);
  const review = recent[index] ?? null;

  if (planStatus !== "active") {
    return <p className={c.empty}>La IA revisa el camino una vez por semana una vez activado.</p>;
  }
  if (!review) {
    return <p className={c.empty}>Todavía no hay revisiones de la IA. Con la automatización de agentes activa, A19 revisa el camino cada tres días tras la primera semana desde su activación y propone ajustes que decides tú.</p>;
  }
  const out = review.output;
  const status = out ? GOAL_STATUS[out.goal_progress.status] : null;

  return (
    <div className={c.reviewWrap}>
      {recent.length > 1 ? (
        <div className={c.weeks} role="group" aria-label="Revisión">
          {recent.map((item, i) => (
            <button key={item.id} type="button" aria-pressed={i === index} className={item.status === "failed" ? c.weekFailed : undefined} onClick={() => setIndex(i)}>
              {shortDate(item.period_start)}
              {item.status === "failed" ? " · falló" : item.status === "running" ? " · en curso" : ""}
            </button>
          ))}
        </div>
      ) : null}

      {review.status !== "succeeded" || !out ? (
        <div className={c.panel}>
          <div className={c.panelHead}>
            <div>
              <h3>{review.status === "failed" ? "No se pudo generar esta revisión" : "Revisión en curso"}</h3>
              <span className={c.muted}>Semana del {shortDate(review.period_start)}. El camino sigue sin cambios.</span>
            </div>
            {canManage && review.can_retry ? (
              <Button size="sm" variant="secondary" disabled={retryingReviewId === review.id} onClick={() => onRetry(review.id)}>
                <RetryIcon aria-hidden />
                {retryingReviewId === review.id ? "Reintentando…" : "Reintentar"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <section className={`${c.panel} ${c.aiPanel}`} aria-label="Resumen de la revisión">
            <div className={c.panelHead}>
              <span className={c.aiTag}>
                <SparklesIcon aria-hidden /> A19 · del {shortDate(review.period_start)} al {shortDate(review.period_end)}
              </span>
              <span className={c.chips}>
                {review.trigger_kind === "objective_change" ? <span className={c.pill}>Tras cambiar objetivos</span> : null}
                <span className={`${c.tone} ${status?.cls ?? ""}`}>{status?.label ?? "Faltan datos"}</span>
              </span>
            </div>
            <p className={c.aiSummary}>{out.executive_summary}</p>
            {formatGoal && out.goal_progress.observed_value !== null ? (
              <div className={c.tiles}>
                <div>
                  <span>Medido</span>
                  <b>{formatGoal(out.goal_progress.observed_value)}</b>
                </div>
                {out.goal_progress.comparison_value !== null ? (
                  <div>
                    <span>Periodo anterior</span>
                    <b>{formatGoal(out.goal_progress.comparison_value)}</b>
                  </div>
                ) : null}
                {out.goal_progress.expected_value != null ? (
                  <div>
                    <span>Ritmo esperado</span>
                    <b>{formatGoal(out.goal_progress.expected_value)}</b>
                  </div>
                ) : null}
                {out.goal_progress.target_value != null ? (
                  <div>
                    <span>Meta</span>
                    <b className={c.textTerra}>{formatGoal(out.goal_progress.target_value)}</b>
                  </div>
                ) : null}
              </div>
            ) : null}
            {out.goal_progress.explanation ? <p className={c.muted}>{out.goal_progress.explanation}</p> : null}
          </section>

          {out.change_proposals.length ? (
            <section className={`${c.panel} ${c.decidePanel}`} aria-labelledby="cambios">
              <div className={c.panelHead}>
                <h3 id="cambios">Cambios que propone · decides tú</h3>
                <span className={c.muted}>Nada se aplica sin tu decisión</span>
              </div>
              <ol className={c.proposals}>
                {out.change_proposals.map((change, i) => {
                  const stored = review.proposals?.find((proposal) => proposal.proposal_index === i);
                  return (
                    <li key={i}>
                      <span className={c.pill}>
                        {CHANGE_LABEL[change.change] ?? displayValue(change.change)} {TARGET_LABEL[change.target_type] ?? displayValue(change.target_type)}
                      </span>
                      <b>{change.description}</b>
                      <p>{change.reason}</p>
                      <p className={c.muted}>Evidencia: {change.evidence}</p>
                      {stored ? (
                        <CaminoProposalDecision organizationId={organizationId} planId={planId} record={stored} canManage={canManage} onUpdated={onProposalUpdated} />
                      ) : (
                        <p className={c.muted}>Propuesta anterior al registro de decisiones: solo se puede consultar.</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          <div className={c.reviewCols}>
            <section className={c.panel}>
              <div className={c.panelHead}>
                <h3>Próximas acciones</h3>
              </div>
              {out.next_actions.length ? (
                <ul className={c.list}>
                  {out.next_actions.map((action, i) => (
                    <li key={i}>
                      <b>{action.title}</b>
                      <span className={c.muted}>{action.rationale}</span>
                      <span className={c.listMeta}>
                        <span className={c.pill}>{ACTION_OWNER[action.owner] ?? displayValue(action.owner)}</span>
                        <span>en {plural(action.due_in_days, "día", "días")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={c.muted}>No propone acciones nuevas.</p>
              )}
            </section>
            <section className={c.panel}>
              <div className={c.panelHead}>
                <h3>Riesgos y bloqueos</h3>
              </div>
              {out.risks.length ? (
                <ul className={c.list}>
                  {out.risks.map((risk, i) => (
                    <li key={i}>
                      <b>
                        <span className={`${c.sev} ${SEVERITY[risk.severity] ?? ""}`} aria-hidden="true" />
                        {risk.detail}
                      </b>
                      <span className={c.muted}>{risk.evidence}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={c.muted}>Sin riesgos detectados.</p>
              )}
            </section>
            <section className={c.panel}>
              <div className={c.panelHead}>
                <h3>Avance observado</h3>
              </div>
              {out.progress.length ? (
                <ul className={c.list}>
                  {out.progress.map((item, i) => (
                    <li key={i}>
                      <b>{item.item}</b>
                      <span className={c.muted}>
                        {displayValue(item.status)} · {item.evidence}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={c.muted}>Sin avance que reseñar.</p>
              )}
            </section>
          </div>

          {out.learnings?.length ? (
            <section className={c.panel} aria-labelledby="aprendizajes">
              <div className={c.panelHead}>
                <h3 id="aprendizajes">Aprendizajes</h3>
                <span className={c.muted}>Guárdalos en el Conocimiento de la tienda si su alcance es correcto</span>
              </div>
              <ul className={c.list}>
                {out.learnings.map((learning, i) => {
                  const key = `${review.id}:${i}`;
                  return (
                    <li key={key}>
                      <b>{learning.title}</b>
                      <span>{learning.learning}</span>
                      <span className={c.muted}>
                        Aplica a: {learning.applies_to} · {CONFIDENCE[learning.confidence] ?? displayValue(learning.confidence)} · {learning.evidence}
                      </span>
                      {canManage ? <LearningDecision learning={learning} onSave={(edits) => onApproveLearning(review.id, i, edits)} /> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {out.warnings.length ? <p className={c.muted}>Límites de esta revisión: {out.warnings.join(" · ")}</p> : null}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editar un hito: lo que se lee en su ficha, con el mismo nombre que allí
// ---------------------------------------------------------------------------

export type MilestoneEditValues = {
  name: string;
  description: string;
  targetDate: string;
  deadlineDate: string;
  measurementDate: string;
  successCriteria: string;
  rationale: string;
};

export function MilestoneEditForm({
  milestone,
  onCancel,
  onSubmit,
  deleteControl,
}: {
  milestone: ConsultantMilestone;
  onCancel: () => void;
  onSubmit: (values: MilestoneEditValues) => Promise<void>;
  deleteControl: ReactNode;
}) {
  // Los caminos antiguos llevan el criterio pegado a la descripción: al editar
  // se separa y se guarda en su campo.
  const split = splitCriterion(milestone.description);
  const [name, setName] = useState(milestone.name);
  const [description, setDescription] = useState(split.text);
  const [criteria, setCriteria] = useState(milestone.success_criteria?.trim() || split.criterion || "");
  const [rationale, setRationale] = useState(milestone.rationale ?? "");
  const [targetDate, setTargetDate] = useState(milestone.target_date?.slice(0, 10) ?? "");
  const [deadlineDate, setDeadlineDate] = useState(milestone.deadline_date ?? "");
  const [measurementDate, setMeasurementDate] = useState(milestone.measurement_date ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className={c.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
          await onSubmit({ name: name.trim(), description: description.trim(), targetDate, deadlineDate, measurementDate, successCriteria: criteria.trim(), rationale: rationale.trim() });
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className={c.formHead}>
        <h3>Editar el hito</h3>
        {deleteControl}
      </div>
      <div className={c.formGrid}>
        <Field label="Nombre">
          <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
        </Field>
      </div>
      <div className={c.formDates}>
        <Field label="Fecha objetivo" hint="Cuándo quieres conseguirlo">
          <DatePicker value={targetDate} onChange={(value) => setTargetDate(value)} />
        </Field>
        <Field label="Fecha límite" hint="Cuándo debe estar cerrado. Vacía, la objetivo">
          <DatePicker value={deadlineDate} onChange={(value) => setDeadlineDate(value)} />
        </Field>
        <Field label="Fecha de medición" hint="Cuándo se comprueba el resultado">
          <DatePicker value={measurementDate} onChange={(value) => setMeasurementDate(value)} />
        </Field>
      </div>
      <Field label="Qué se busca">
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
      </Field>
      <div className={c.formGrid}>
        <Field label="Por qué ahora">
          <Textarea value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} maxLength={2000} />
        </Field>
        <Field label="Cómo sabremos que está hecho">
          <Textarea value={criteria} onChange={(event) => setCriteria(event.target.value)} rows={3} maxLength={2000} />
        </Field>
      </div>
      <div className={c.formActs}>
        <Button type="submit" size="sm" disabled={saving || !name.trim()}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Configuración del plan
// ---------------------------------------------------------------------------

export function PlanSettings({
  name,
  description,
  version,
  horizonMonths,
  startsOn,
  currencyControl,
  currencyNote,
  timezone,
  previousPlans,
  organizationId,
  planId,
  replacesPlan,
  editForm,
  onEdit,
}: {
  name: string;
  description: string | null;
  version: number;
  horizonMonths?: number | null;
  startsOn: string | null;
  currencyControl: ReactNode;
  currencyNote: string;
  timezone: string | null;
  previousPlans: Array<{ id: string; name: string; version: number; created_at: string }>;
  organizationId: string;
  planId: string;
  replacesPlan: boolean;
  editForm: ReactNode;
  onEdit: () => void;
}) {
  const [openVersion, setOpenVersion] = useState<string | null>(null);
  return (
    <section className={c.panel} aria-labelledby="ajustes-camino">
      <div className={c.panelHead}>
        <h3 id="ajustes-camino">Configuración del plan</h3>
      </div>
      <div className={c.settings}>
        <div className={c.setRow}>
          <div>
            <b>Información general</b>
            <span className={c.muted}>{name}</span>
            {description ? <span className={`${c.muted} ${c.clamp2}`}>{description}</span> : null}
            <span className={c.muted}>
              {[`Versión ${version}`, horizonMonths ? plural(horizonMonths, "mes", "meses") : null, startsOn ? `Desde el ${shortDate(startsOn)}` : null].filter(Boolean).join(" · ")}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Editar
          </Button>
        </div>
        {editForm ? <div className={c.inline}>{editForm}</div> : null}
        <div className={c.setRow}>
          <div>
            <b>Moneda de las cifras</b>
            <span className={c.muted}>{currencyNote}</span>
          </div>
          {currencyControl}
        </div>
        {timezone ? (
          <div className={c.setRow}>
            <div>
              <b>Zona horaria</b>
              <span className={c.muted}>Las fechas se leen en la hora de la tienda: {timezone}</span>
            </div>
          </div>
        ) : null}
        <div className={c.setRow}>
          <div>
            <b>Planificación con IA</b>
            <span className={c.muted}>Pide los cambios, decide cuáles aceptas y confírmalos. Este plan queda en el historial</span>
          </div>
          <ButtonLink href="/camino/nuevo?replan=1" variant="secondary" size="sm">
            Replanificar
          </ButtonLink>
        </div>
        {openVersion ? <PlanVersionDrawer organizationId={organizationId} planId={openVersion} onClose={() => setOpenVersion(null)} /> : null}
        {replacesPlan ? (
          <div className={c.setRow}>
            <div>
              <b>Cambios de esta versión</b>
              <span className={c.muted}>Qué cambió al replanificar y qué decidiste</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setOpenVersion(planId)}>Ver cambios</Button>
          </div>
        ) : null}
        {previousPlans.length ? (
          <div className={c.setRow}>
            <div>
              <b>Versiones anteriores</b>
              {previousPlans.map((previous) => (
                <span key={previous.id} className={c.muted}>
                  Versión {previous.version} · {previous.name} · {shortDate(previous.created_at)}{" "}
                  <Button variant="ghost" size="sm" onClick={() => setOpenVersion(previous.id)}>Ver</Button>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PlanDanger({ deleteControl }: { deleteControl: ReactNode }) {
  return (
    <section className={c.panel} aria-label="Zona de peligro">
      <div className={`${c.setRow} ${c.setDanger}`}>
        <div>
          <b>Eliminar el camino</b>
          <span className={c.muted}>Borra fases, hitos, notas y revisiones. Las tareas se conservan en Tareas.</span>
        </div>
        {deleteControl}
      </div>
    </section>
  );
}
