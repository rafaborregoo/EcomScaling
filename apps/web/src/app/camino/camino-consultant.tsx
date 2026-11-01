"use client";
import { LearningDecision, type LearningEdits } from "./learning-decision";
import { MeasurementDetails, type MeasurementInfo } from "./measurement-details";
import { DatePicker, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown, Accordion, AccordionContent, AccordionItem, AccordionTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, ToggleGroup, ToggleGroupItem } from "@/components/ui";

import { SkipForwardIcon, UnlinkIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { displayValue } from "@/lib/display-labels";
import {
  Button,
  ButtonLink,
  CheckIcon,
  Field,
  Input,
  Textarea,
  MessageSquareIcon,
  MoreIcon,
  PlusIcon,
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
import { splitCriterion } from "./next-step";
import { milestonesInMonth, type MonthlyTarget } from "./monthly-route-model";
import { TRACK_LABELS, TRACK_ORDER, cadenceLabel, growthRoutines, trackLabel } from "./task-tracks";
import { formatEffort, taskWantsEmailDraft, type PlanTaskMeta } from "./plan-task-meta";
import { CaminoProposalDecision, type StoredCaminoProposal } from "./proposal-decision";
import type { DiscussTopic } from "./camino-map";
import c from "./camino-consultant.module.css";

/**
 * Mi Camino del cliente, visto por su consultor.
 *
 * Una mesa de trabajo, no el mapa del cliente: arriba cómo va el camino en
 * cinco cifras, debajo la hoja de ruta entera (todas las fases y sus hitos a
 * la vista) y, al elegir un hito, su ficha con las tareas y las acciones del
 * consultor. Lo que no se toca a diario (meta y ruta económica, seguimiento de
 * la IA, objetivos, estructura) vive en pestañas para no alargar la página.
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
  completed_at: string | null;
  completion_evidence?: string | null;
  completion_kind?: string | null;
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
};

export type ConsultantPlan = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  horizon_months?: number | null;
  starts_on: string | null;
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

const DAY_MS = 86_400_000;
const CLOSED = ["completed", "skipped"];
const OPEN_TASK = ["pending", "in_progress"];

const byPosition = <T extends { position: number }>(items: T[]) => items.slice().sort((a, b) => a.position - b.position);
const dayMonth = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" });

function asDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

function shortDate(value: string | null | undefined) {
  return value ? dayMonth.format(asDate(value)).replace(".", "") : "";
}

function daysUntil(value: string, today: Date) {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((asDate(value).getTime() - todayUtc) / DAY_MS);
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("es-ES")} ${n === 1 ? one : many}`;
}

function tasksOf(milestone: ConsultantMilestone) {
  return milestone.milestone_task_links.map((link) => link.tasks).filter((task): task is ConsultantTask => task !== null);
}

function isTaskLate(task: ConsultantTask, today: Date) {
  return OPEN_TASK.includes(task.status) && task.due_at !== null && daysUntil(task.due_at, today) < 0;
}

type MilestoneState = "done" | "skipped" | "late" | "active" | "next" | "locked" | "draft";

const STATE_LABEL: Record<MilestoneState, string> = {
  done: "Completado",
  skipped: "Omitido",
  late: "Va tarde",
  active: "En curso",
  next: "Por empezar",
  locked: "Bloqueado",
  draft: "Previsto",
};

function milestoneState(milestone: ConsultantMilestone, phase: ConsultantPhase, planStatus: string, today: Date): MilestoneState {
  if (planStatus === "draft") return "draft";
  if (milestone.status === "completed") return "done";
  if (milestone.status === "skipped") return "skipped";
  if (phase.status !== "active" && phase.status !== "completed") return "locked";
  if (milestone.target_date && daysUntil(milestone.target_date, today) < 0) return "late";
  // Con tareas ya hechas el hito está en marcha aunque nadie pulsara «Empezar».
  return milestone.status === "in_progress" || hasProgress(milestone) ? "active" : "next";
}

function hasProgress(milestone: ConsultantMilestone) {
  return tasksOf(milestone).some((task) => task.status === "completed" || task.status === "in_progress");
}

const SOURCE_LABEL: Record<string, string> = {
  ai_consultant: "Propuesta por la IA",
  consulting_call: "De una llamada",
  alert: "De una alerta",
  manual: "Añadida a mano",
  system: "Sistema",
};

const OWNER_COUNT: Record<string, [string, string]> = {
  client: ["del cliente", "del cliente"],
  shared: ["compartida", "compartidas"],
  consultant: ["tuya", "tuyas"],
};

// La misma mesa vista por el cliente: las "tuyas" son las suyas.
const OWNER_COUNT_CLIENT: Record<string, [string, string]> = {
  client: ["tuya", "tuyas"],
  shared: ["compartida", "compartidas"],
  consultant: ["del consultor", "del consultor"],
};

const PHASE_LABEL: Record<string, string> = { active: "En curso", completed: "Completada" };

const OWNER: Record<string, { label: string; cls: string }> = {
  client: { label: "Cliente", cls: c.ownClient },
  consultant: { label: "Consultor", cls: c.ownConsultant },
  shared: { label: "Compartida", cls: c.ownShared },
};

function ownerOf(task: ConsultantTask): keyof typeof OWNER | null {
  if (task.plan_meta?.owner_role) return task.plan_meta.owner_role;
  return task.created_by_origin ?? null;
}

const GOAL_STATUS: Record<string, { label: string; cls: string }> = {
  on_track: { label: "En camino", cls: c.toneGood },
  achieved: { label: "Meta lograda", cls: c.toneGood },
  at_risk: { label: "En riesgo", cls: c.toneBad },
  blocked: { label: "Bloqueado", cls: c.toneBad },
};

const CONFIDENCE: Record<string, string> = { low: "Confianza baja", medium: "Confianza media", high: "Confianza alta" };

function Bar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "terra" | "red" }) {
  return (
    <span className={c.bar} aria-hidden="true">
      <i className={c[`bar_${tone}`]} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

function LockGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <rect x="3.5" y="7" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ActionMenu({
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
  onGenerateMarketingTask,
  onStartMilestone,
  onCompleteMilestone,
  onReopenMilestone,
  onSkipMilestone,
  onRemoveTask,
  onDiscuss,
  onChangeGoal,
  onRetryReview,
  onApproveLearning,
  onProposalUpdated,
  organizationId,
  renderMilestoneEditor,
  renderAddTask,
  renderTaskEditor,
  renderNotes,
  objectivesSlot,
  structureSlot,
  settingsSlot,
}: {
  plan: ConsultantPlan;
  phases: ConsultantPhase[];
  organizationName: string;
  /** El cliente ve la misma mesa; cambia el texto según quién mira. */
  viewerIsClient?: boolean;
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
  onGenerateMarketingTask: (task: ConsultantTask) => void;
  onStartMilestone: (milestoneId: string) => Promise<unknown>;
  onCompleteMilestone: (milestoneId: string) => void;
  onReopenMilestone: (milestoneId: string) => Promise<unknown>;
  onSkipMilestone: (milestoneId: string) => Promise<unknown>;
  onRemoveTask: (milestoneId: string, taskId: string) => Promise<unknown>;
  onDiscuss: (topic: DiscussTopic) => void;
  onChangeGoal: () => void;
  onRetryReview: (reviewId: string) => void;
  onApproveLearning: (reviewId: string, learningIndex: number, edits?: LearningEdits) => Promise<void>;
  onProposalUpdated: () => void;
  organizationId: string;
  renderMilestoneEditor: (milestoneId: string, close: () => void) => ReactNode;
  renderAddTask: (milestoneId: string, close: () => void) => ReactNode;
  renderTaskEditor: (milestoneId: string, taskId: string, close: () => void) => ReactNode;
  renderNotes: (milestoneId: string) => ReactNode;
  objectivesSlot: ReactNode;
  structureSlot: ReactNode;
  settingsSlot: ReactNode;
}) {
  const [today] = useState(() => new Date());
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
          milestone,
          phase,
          code: `${pi + 1}.${mi + 1}`,
          state: milestoneState(milestone, phase, plan.status, today),
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

  const summary =
    plan.status === "draft"
      ? viewerIsClient
        ? "Es un borrador: aún no está activo."
        : "Es un borrador: el cliente aún no lo sigue. Revisa las fases y actívalo cuando esté listo."
      : !activePhase
        ? closedMilestones === stops.length && stops.length > 0
          ? "Recorrido cerrado. El resultado del objetivo se comprueba por separado."
          : "Ninguna fase está en curso."
        : `${viewerIsClient ? "Estás" : `${organizationName} está`} en la fase ${activePhase.position} de ${phases.length}, «${activePhase.name}».`;

  const tabs: Array<{ key: DeskTab; label: string; count?: number }> = [
    { key: "ruta", label: "Hoja de ruta" },
    { key: "meta", label: "Meta y ruta económica" },
    { key: "seguimiento", label: "Seguimiento IA", count: pendingProposals },
    { key: "objetivos", label: "Objetivos" },
    { key: "estructura", label: "Estructura y ajustes" },
  ];

  function pick(stop: Stop) {
    go("ruta", stop.milestone.id);
  }

  return (
    <div className={c.root}>
      {/* ---------- cabecera ---------- */}
      <header className={c.head}>
        <div className={c.headMain}>
          <p className={`${c.eyebrow} client-sr-title`}>
            <span>Mi Camino</span>
            <span>{organizationName}</span>
            {storeName ? <span>{storeName}</span> : null}
          </p>
          <h1 className={c.title}>{plan.name}</h1>
          <div className={c.chips}>
            <span className={`${c.pill} ${plan.status === "active" ? c.pillGood : plan.status === "draft" ? c.pillWarn : ""}`}>
              {plan.status === "active" ? "Activo" : displayValue(plan.status)}
            </span>
            <span className={c.pill}>Versión {plan.version}</span>
            {plan.horizon_months ? <span className={c.pill}>{plural(plan.horizon_months, "mes", "meses")}</span> : null}
            {plan.starts_on ? <span className={c.pill}>Desde el {shortDate(plan.starts_on)}</span> : null}
          </div>
          <p className={c.lead}>{summary}</p>
        </div>
        <div className={c.headActs}>
          {plan.status === "draft" ? (
            <Button onClick={onActivate} disabled={isActivating}>
              {isActivating ? "Activando…" : "Activar camino"}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => go("estructura")}>
            Estructura y ajustes
          </Button>
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
          <Roadmap phases={phases} stops={stops} selectedId={selected?.milestone.id ?? null} focusId={focus?.milestone.id ?? null} today={today} planStatus={plan.status} goal={goal} formatGoal={formatGoal} onPick={pick} />
          {selected ? (
            <MilestoneDesk
              key={selected.milestone.id}
              stop={selected}
              today={today}
              planStatus={plan.status}
              isFocus={selected.milestone.id === focus?.milestone.id}
              objectives={objectives.filter((objective) => objective.milestone_id === selected.milestone.id)}
              formatObjective={formatObjective}
              canResolveTasks={canResolveTasks}
              canManage={canManage}
              currentUserId={currentUserId}
              marketingByTask={marketingByTask}
              generatingTaskId={generatingTaskId}
              onToggleTask={onToggleTask}
              onGenerateMarketingTask={onGenerateMarketingTask}
              onStart={() => onStartMilestone(selected.milestone.id)}
              onComplete={() => onCompleteMilestone(selected.milestone.id)}
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
            <p className={c.empty}>Este camino aún no tiene hitos. Añádelos en «Estructura y ajustes».</p>
          )}
          <Tracks tasks={allTasks} />
        </>
      ) : null}

      {tab === "meta" ? <GoalDesk goal={goal} startsOn={plan.starts_on} stops={stops} observed={observed} formatGoal={formatGoal} canManage={canManage} onChangeGoal={onChangeGoal} today={today} /> : null}

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
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hoja de ruta: todas las fases y sus hitos a la vista
// ---------------------------------------------------------------------------

function Roadmap({
  phases,
  stops,
  selectedId,
  focusId,
  today,
  planStatus,
  goal,
  formatGoal,
  onPick,
}: {
  phases: ConsultantPhase[];
  stops: Stop[];
  selectedId: string | null;
  focusId: string | null;
  today: Date;
  planStatus: string;
  goal: ConsultantGoal | null;
  formatGoal: (value: number) => string;
  onPick: (stop: Stop) => void;
}) {
  if (!phases.length) return null;
  return (
    <section className={c.roadmap} aria-label="Hoja de ruta">
      <div className={c.track} style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(232px, 1fr)) minmax(168px, 0.6fr)` }}>
        {phases.map((phase, index) => {
          const own = stops.filter((stop) => stop.phase.id === phase.id);
          const closed = own.filter((stop) => CLOSED.includes(stop.milestone.status)).length;
          const state = planStatus === "draft" ? "draft" : phase.status === "completed" ? "done" : phase.status === "active" ? "active" : "locked";
          return (
            <div key={phase.id} className={`${c.phase} ${c[`phase_${state}`]}`}>
              <div className={c.phaseHead}>
                <span className={c.phaseNum}>{state === "done" ? <CheckIcon aria-hidden /> : index + 1}</span>
                <div className={c.phaseText}>
                  <span className={c.phaseKicker}>
                    Fase {index + 1} · {state === "draft" ? "Prevista" : (PHASE_LABEL[phase.status] ?? "Bloqueada")}
                  </span>
                  <h3 className={c.clamp2}>{phase.name}</h3>
                </div>
              </div>
              <div className={c.phaseProg}>
                <Bar value={own.length ? (closed / own.length) * 100 : 0} tone={state === "done" ? "green" : "blue"} />
                <span>
                  {closed}/{own.length} hitos
                </span>
              </div>
              <ol className={c.stops}>
                {own.map((stop) => {
                  const tasks = tasksOf(stop.milestone);
                  const done = tasks.filter((task) => task.status === "completed").length;
                  const days = stop.milestone.target_date ? daysUntil(stop.milestone.target_date, today) : null;
                  return (
                    <li key={stop.milestone.id}>
                      <button
                        type="button"
                        className={`${c.stop} task-lift ${c[`st_${stop.state}`]} ${stop.milestone.id === selectedId ? c.stopOn : ""}`}
                        aria-pressed={stop.milestone.id === selectedId}
                        onClick={() => onPick(stop)}
                      >
                        <span className={c.stopTop}>
                          <span className={c.code}>{stop.code}</span>
                          {stop.milestone.id === focusId ? <span className={c.now}>Ahora</span> : null}
                          <span className={c.stopState}>
                            {stop.state === "locked" ? <LockGlyph /> : null}
                            {stop.state === "late" && days !== null ? `${-days} d tarde` : STATE_LABEL[stop.state]}
                          </span>
                        </span>
                        <span className={`${c.stopName} ${c.clamp3}`}>{stop.milestone.name}</span>
                        <span className={c.stopFoot}>
                          <Bar value={tasks.length ? (done / tasks.length) * 100 : 0} tone={stop.state === "done" ? "green" : stop.state === "late" ? "red" : "blue"} />
                          <span>
                            {done}/{tasks.length}
                          </span>
                          {stop.milestone.target_date ? <span className={c.stopDate}>{shortDate(stop.milestone.target_date)}</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {own.length === 0 ? <li className={c.stopEmpty}>Sin hitos</li> : null}
              </ol>
            </div>
          );
        })}
        <div className={c.finish}>
          <span className={c.finishFlag} aria-hidden="true">
            <svg viewBox="0 0 16 16" width="14" height="14">
              <path d="M3.5 14V2.5M3.5 3h8l-1.8 2.8L11.5 8.5h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </span>
          <span className={c.phaseKicker}>Meta</span>
          <strong>{goal?.target != null ? formatGoal(goal.target) : "Sin cifra"}</strong>
          <span className={c.clamp3}>{goal?.metric_label ?? "El camino no tiene meta cuantificada"}</span>
          {goal?.target_date ? <span className={c.stopDate}>{shortDate(goal.target_date)}</span> : null}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ficha del hito: lo que hay que lograr, sus tareas y las acciones
// ---------------------------------------------------------------------------

function MilestoneDesk({
  stop,
  today,
  planStatus,
  isFocus,
  objectives,
  formatObjective,
  canResolveTasks,
  canManage,
  currentUserId,
  marketingByTask,
  generatingTaskId,
  onToggleTask,
  onGenerateMarketingTask,
  onStart,
  onComplete,
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
  isFocus: boolean;
  objectives: ConsultantObjective[];
  formatObjective: (value: number, unit: ConsultantObjective["unit"]) => string;
  canResolveTasks: boolean;
  canManage: boolean;
  currentUserId: string;
  marketingByTask: Map<string, CaminoMarketingAsset>;
  generatingTaskId: string | null;
  onToggleTask: (task: ConsultantTask) => void;
  onGenerateMarketingTask: (task: ConsultantTask) => void;
  onStart: () => Promise<unknown>;
  onComplete: () => void;
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
  const { milestone, phase, code, state } = stop;
  const [editing, setEditing] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [skipOpen, setSkipOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "all">("all");

  const { text, criterion: descriptionCriterion } = splitCriterion(milestone.description);
  const criterion = milestone.success_criteria?.trim() || descriptionCriterion;
  const tasks = tasksOf(milestone);
  const done = tasks.filter((task) => task.status === "completed").length;
  const open = tasks.filter((task) => OPEN_TASK.includes(task.status));
  const shown = filter === "open" ? open : tasks;
  const days = milestone.target_date ? daysUntil(milestone.target_date, today) : null;
  const owners = (["client", "shared", "consultant"] as const)
    .map((owner) => ({ owner, n: open.filter((task) => ownerOf(task) === owner).length }))
    .filter((entry) => entry.n > 0);

  const closed = CLOSED.includes(milestone.status);
  const locked = state === "locked";
  const draft = planStatus === "draft";
  const canChangeStatus = canManage && !draft && !locked;

  const due =
    state === "done"
      ? milestone.completed_at
        ? `Completado el ${shortDate(milestone.completed_at)}`
        : "Completado"
      : state === "skipped"
        ? "Omitido"
        : milestone.target_date
          ? days! < 0
            ? `Vencía el ${shortDate(milestone.target_date)} · ${plural(-days!, "día", "días")} de retraso`
            : days === 0
              ? "Vence hoy"
              : `Vence el ${shortDate(milestone.target_date)} · quedan ${plural(days!, "día", "días")}`
          : "Sin fecha objetivo";

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  const menu = [
    ...(canManage ? [{ id: "edit", label: "Editar nombre, descripción y fecha" }] : []),
    { id: "objectives", label: "Métricas y objetivos del hito" },
    ...(canChangeStatus && !closed ? [{ id: "skip", label: "Omitir hito", danger: true }] : []),
  ];

  return (
    <section id="camino-ficha" className={c.desk} aria-labelledby={`ficha-${milestone.id}`}>
      <p className="sr-only" role="status">
        Hito {code} seleccionado: {milestone.name}
      </p>
      <div className={c.deskHead}>
        <div className={c.deskTitle}>
          <span className={c.deskKicker}>
            <span className={c.code}>Hito {code}</span>
            <span>Fase {code.split(".")[0]} · {phase.name}</span>
          </span>
          <h2 id={`ficha-${milestone.id}`}>{milestone.name}</h2>
          <span className={c.deskMeta}>
            <span className={`${c.state} ${c[`st_${state}`]}`}>
              {locked ? <LockGlyph /> : null}
              {STATE_LABEL[state]}
            </span>
            <span className={state === "late" ? c.textBad : undefined}>{due}</span>
            {isFocus ? <span className={c.now}>Hito de ahora</span> : null}
          </span>
        </div>
        <div className={c.deskActs}>
          {canChangeStatus && milestone.status === "pending" && !hasProgress(milestone) ? (
            <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => void run("start", onStart)}>
              {busy === "start" ? "Empezando…" : "Empezar hito"}
            </Button>
          ) : null}
          {canChangeStatus && !closed ? (
            <Button size="sm" disabled={busy !== null || open.length > 0} onClick={onComplete} title={open.length ? "Se completa cuando todas sus tareas están hechas" : undefined}>
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
            onAction={(id) => (id === "edit" ? setEditing(true) : id === "objectives" ? onOpenObjectives() : setSkipOpen(true))}
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
      {canChangeStatus && !closed && open.length ? (
        <p className={c.readiness}>
          Para completarlo {open.length === 1 ? "falta" : "faltan"} {plural(open.length, "tarea", "tareas")}. Al cerrarlo se pide la evidencia del resultado.
        </p>
      ) : null}
      {locked ? <p className={c.readiness}>Se abre cuando termine la fase anterior. Puedes preparar sus tareas desde ya.</p> : null}
      {editing ? <div className={c.inline}>{renderEditor(() => setEditing(false))}</div> : null}

      <div className={c.deskGrid}>
        <div className={c.deskCol}>
          {text ? <p className={c.deskDesc}>{text}</p> : null}
          {milestone.status === "completed" && milestone.completion_evidence ? (
            <div className={`${c.note} ${c.noteGood}`}>
              <span className={c.noteL}>{milestone.completion_kind === "exception" ? "Cierre por excepción" : milestone.completion_kind ? "Resultado verificado" : "Cierre anterior sin verificación estructurada"}</span>
              <p>{milestone.completion_evidence}</p>
            </div>
          ) : null}
          {milestone.rationale?.trim() ? (
            <div className={c.note}>
              <span className={c.noteL}>Por qué ahora</span>
              <p>{milestone.rationale}</p>
            </div>
          ) : null}
          <div className={c.note}>
            <span className={c.noteL}>Cómo sabremos que está hecho</span>
            {criterion ? <p>{criterion}</p> : <p className={c.muted}>Sin criterio escrito. Añádelo al editar el hito.</p>}
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
            <button type="button" className={buttonVariants({ variant: "link" })} onClick={onOpenObjectives}>
              {objectives.length ? "Ver objetivos" : "Añadir una métrica a este hito"}
            </button>
          </div>
          <div className={c.notes}>{notes}</div>
        </div>

        <div className={c.deskCol}>
          <div className={c.taskHead}>
            <div>
              <h3>Tareas</h3>
              <span className={c.muted}>
                {done} de {tasks.length} hechas
                {owners.length ? " · abiertas: " : ""}
                {owners.map((entry, index) => (
                  <span key={entry.owner}>
                    {index ? ", " : ""}
                    {entry.n} {(viewerIsClient ? OWNER_COUNT_CLIENT : OWNER_COUNT)[entry.owner]![entry.n === 1 ? 0 : 1]}
                  </span>
                ))}
              </span>
            </div>
            <div className={c.taskTools}>
              {open.length && open.length !== tasks.length ? (
                <ToggleGroup aria-label="Qué tareas ver" value={filter} onValueChange={setFilter}>
                  <ToggleGroupItem value="all">Todas</ToggleGroupItem>
                  <ToggleGroupItem value="open">Abiertas</ToggleGroupItem>
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
          <Bar value={tasks.length ? (done / tasks.length) * 100 : 0} tone={state === "late" ? "red" : "green"} />
          {!canResolveTasks ? (
            <p className={c.hint}>
              {viewerIsClient
                ? "Tú cierras las tareas que tienes asignadas; el resto las marca el responsable de la tienda."
                : "Las tareas del cliente y las compartidas las marca el cliente; tú cierras las que tienes asignadas."}
            </p>
          ) : null}
          {addingTask ? <div className={c.inline}>{renderAddTask(() => setAddingTask(false))}</div> : null}
          {shown.length ? (
            <ul className={c.tasks}>
              {shown.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  canTick={(canResolveTasks || (Boolean(task.assigned_to) && task.assigned_to === currentUserId)) && !draft && !locked}
                  canManage={canManage}
                  asset={marketingByTask.get(task.id) ?? null}
                  generating={generatingTaskId === task.id}
                  onToggle={() => onToggleTask(task)}
                  onGenerate={() => onGenerateMarketingTask(task)}
                  onEdit={() => setEditingTaskId(task.id)}
                  onRemove={() => onRemoveTask(task.id)}
                  editor={editingTaskId === task.id ? renderTaskEditor(task.id, () => setEditingTaskId(null)) : null}
                />
              ))}
            </ul>
          ) : (
            <p className={c.empty}>{tasks.length ? "No quedan tareas abiertas." : "Este hito no tiene tareas todavía."}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function TaskRow({
  task,
  today,
  canTick,
  canManage,
  asset,
  generating,
  onToggle,
  onGenerate,
  onEdit,
  onRemove,
  editor,
}: {
  task: ConsultantTask;
  today: Date;
  canTick: boolean;
  canManage: boolean;
  asset: CaminoMarketingAsset | null;
  generating: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  onEdit: () => void;
  onRemove: () => Promise<unknown>;
  editor: ReactNode;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const isDone = task.status === "completed";
  const late = isTaskLate(task, today);
  const owner = ownerOf(task);
  const meta = task.plan_meta;
  const track = [trackLabel(meta?.track), cadenceLabel(meta?.cadence)].filter(Boolean).join(" · ");
  const effort = formatEffort(meta?.effort_hours);
  const hasHow = Boolean(task.description?.trim() || meta?.definition_of_done || meta?.rationale || meta?.evidence?.length);
  const tickable = canTick && ["pending", "in_progress", "completed"].includes(task.status);

  return (
    <li className={`${c.task} task-lift ${isDone ? c.taskDone : ""} ${late ? c.taskLate : ""}`}>
      <button
        type="button"
        className={c.tick}
        aria-pressed={isDone}
        aria-label={isDone ? `Reabrir: ${task.title}` : `Marcar hecha: ${task.title}`}
        title={tickable ? undefined : "No la puedes marcar tú"}
        disabled={!tickable}
        onClick={onToggle}
      >
        {isDone ? <CheckIcon aria-hidden /> : null}
      </button>
      <div className={c.taskBody}>
        <span className={c.taskTitle}>{task.title}</span>
        <span className={c.taskMeta}>
          {owner && OWNER[owner] ? <span className={`${c.owner} ${OWNER[owner].cls}`}>{OWNER[owner].label}</span> : null}
          {track ? <span>{track}</span> : null}
          {effort ? <span>{effort}</span> : null}
          {task.priority === "urgent" ? <span className={c.textBad}>Urgente</span> : task.priority === "high" ? <span className={c.textWarn}>Prioridad alta</span> : null}
          {task.source !== "strategic_plan" ? <span>{SOURCE_LABEL[task.source] ?? displayValue(task.source)}</span> : null}
          {asset ? <span className={c.textBlue}>Email · {marketingAssetStatusLabel(asset)}</span> : null}
        </span>
        {hasHow ? (
          <Collapsible className={c.how}>
            <CollapsibleTrigger>Cómo hacerlo<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
            <CollapsibleContent>
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
        ) : null}
        {editor ? <div className={c.inline}>{editor}</div> : null}
      </div>
      <div className={c.taskSide}>
        <span className={`${c.due} ${late ? c.textBad : ""}`}>{task.due_at ? (late ? `Vencida ${shortDate(task.due_at)}` : shortDate(task.due_at)) : ""}</span>
        {asset ? (
          <a className={c.chipLink} href={marketingAssetHref(asset.id)}>
            Abrir borrador
          </a>
        ) : canManage && taskWantsEmailDraft(task) && !isDone ? (
          <button type="button" className={c.chipLink} disabled={generating} onClick={onGenerate}>
            {generating ? "Preparando…" : "Borrador de email"}
          </button>
        ) : null}
        {canManage ? (
          <ActionMenu
            label={`Más acciones de la tarea: ${task.title}`}
            items={[
              { id: "edit", label: "Editar tarea" },
              { id: "remove", label: "Quitar del camino", danger: true },
            ]}
            onAction={(id) => (id === "edit" ? onEdit() : setRemoveOpen(true))}
          />
        ) : null}
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
// Trabajo por carril
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
  return (
    <section className={c.panel} aria-labelledby="carriles">
      <div className={c.panelHead}>
        <h3 id="carriles">Trabajo por carril</h3>
        <span className={c.muted}>Todas las tareas del camino, según para qué sirven</span>
      </div>
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
    </section>
  );
}

// ---------------------------------------------------------------------------
// Meta y ruta económica
// ---------------------------------------------------------------------------

function calendarMonth(startDate: string, month: number) {
  const start = asDate(startDate);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + month - 1, 1));
}

function GoalDesk({
  goal,
  startsOn,
  stops,
  observed,
  formatGoal,
  canManage,
  onChangeGoal,
  today,
}: {
  goal: ConsultantGoal | null;
  startsOn: string | null;
  stops: Stop[];
  observed: number | null;
  formatGoal: (value: number) => string;
  canManage: boolean;
  onChangeGoal: () => void;
  today: Date;
}) {
  if (!goal) {
    return <p className={c.empty}>Este camino no tiene meta. Se fija al crear o replanificar el camino.</p>;
  }
  const short = (value: number) => formatGoal(value).replace(/,00(?=\s|$)/, "");
  const growth = goal.baseline && goal.target ? Math.round((goal.target / goal.baseline - 1) * 100) : null;
  const targets = goal.monthly_targets ?? [];
  const start = startsOn ?? today.toISOString().slice(0, 10);
  const max = Math.max(1, goal.baseline ?? 0, ...targets.map((target) => target.target_value ?? 0));
  const thisMonth = Date.UTC(today.getFullYear(), today.getMonth(), 1);
  // Un camino que empieza a mitad de mes acaba a mitad de mes: el primer y el
  // último tramo son parciales y compararlos con un mes entero engaña.
  const midMonthStart = asDate(start).getUTCDate() !== 1;
  const isPartial = (month: number) => midMonthStart && (month === 1 || month === targets.length);

  return (
    <div className={c.goalGrid}>
      <section className={c.panel} aria-labelledby="meta-camino">
        <div className={c.panelHead}>
          <h3 id="meta-camino">Meta del camino</h3>
          {canManage ? (
            <Button variant="secondary" size="sm" onClick={onChangeGoal}>
              Cambiar meta
            </Button>
          ) : null}
        </div>
        <p className={c.muted}>{goal.metric_label}</p>
        <div className={c.goalFlow}>
          <div>
            <span className={c.noteL}>Punto de partida</span>
            <b>{goal.baseline !== null ? short(goal.baseline) : "—"}</b>
            <span className={c.muted}>
              {goal.baseline_window_days ? `Media de ${goal.baseline_window_days} días` : "Ritmo reciente"}
            </span>
          </div>
          <span className={c.goalArrow} aria-hidden="true">
            {growth !== null ? `${growth >= 0 ? "+" : ""}${growth} %` : ""}
          </span>
          <div>
            <span className={c.noteL}>Meta</span>
            <b className={c.textTerra}>{goal.target !== null ? short(goal.target) : "Sin cuantificar"}</b>
            <span className={c.muted}>{goal.target_date ? `Para el ${shortDate(goal.target_date)}` : ""}</span>
          </div>
          <div>
            <span className={c.noteL}>Medido</span>
            <b>{observed !== null ? short(observed) : "—"}</b>
            <span className={c.muted}>{observed !== null ? "Última revisión" : "Aún sin medir"}</span>
          </div>
        </div>
        <span className={c.pill}>{CONFIDENCE[goal.confidence] ?? "Confianza sin indicar"}</span>
        {goal.rationale ? (
          <div className={c.note}>
            <span className={c.noteL}>Por qué esta meta</span>
            <p>{goal.rationale}</p>
          </div>
        ) : null}
        {goal.assumptions.length ? (
          <Collapsible className={c.more}>
            <CollapsibleTrigger>Supuestos de la meta ({goal.assumptions.length})<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
            <CollapsibleContent>
            <ul className={c.bullets}>
              {goal.assumptions.map((assumption, index) => (
                <li key={index}>{assumption}</li>
              ))}
            </ul>
          </CollapsibleContent>
          </Collapsible>
        ) : null}
        {goal.decision_gates?.length ? (
          <Collapsible className={c.more}>
            <CollapsibleTrigger>Decisiones que dependen de los datos ({goal.decision_gates.length})<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
            <CollapsibleContent>
            <ul className={c.gates}>
              {goal.decision_gates.map((gate, index) => (
                <li key={index}>
                  <b>{gate.decision}</b>
                  <span>
                    <em className={c.textGreen}>Avanzar</em> {gate.proceed_when}
                  </span>
                  <span>
                    <em className={c.textBad}>Pausar</em> {gate.hold_when}
                  </span>
                  <span>
                    <em>Comprobar</em> {gate.evidence_needed}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
          </Collapsible>
        ) : null}
      </section>

      {targets.length ? (
        <section className={c.panel} aria-labelledby="ruta-economica">
          <div className={c.panelHead}>
            <h3 id="ruta-economica">Ruta económica mes a mes</h3>
            <span className={c.muted}>La línea discontinua es el punto de partida</span>
          </div>
          <div className={c.cols} role="img" aria-label={targets.map((target) => `Mes ${target.month}: ${target.target_value === null ? "sin cifra" : formatGoal(target.target_value)}`).join(", ")}>
            {goal.baseline !== null ? (
              <span className={c.plot} aria-hidden="true">
                <i style={{ bottom: `${(goal.baseline / max) * 100}%` }} />
              </span>
            ) : null}
            {targets.map((target) => {
              const month = calendarMonth(start, target.month);
              const isGoal = goal.target !== null && target.target_value === goal.target;
              const isNow = month.getTime() === thisMonth;
              return (
                <div key={target.month} className={c.col}>
                  <span className={c.colV}>{target.target_value === null ? "—" : short(target.target_value)}</span>
                  <span className={c.colTrack}>
                    <i className={isGoal ? c.colGoal : isNow ? c.colNow : isPartial(target.month) ? c.colPartial : ""} style={{ height: `${target.target_value === null ? 0 : Math.max(3, (target.target_value / max) * 100)}%` }} />
                  </span>
                  <span className={`${c.colL} ${isNow ? c.colLNow : ""}`}>{monthShort.format(month).replace(".", "")}</span>
                </div>
              );
            })}
          </div>
          <Accordion multiple className={c.months}>
            {targets.map((target) => {
              const month = calendarMonth(start, target.month);
              const inMonth = milestonesInMonth(start, target.month, stops.map((stop) => ({ name: `${stop.code} ${stop.milestone.name}`, date: stop.milestone.target_date })));
              const change = target.target_value !== null && goal.baseline ? Math.round((target.target_value / goal.baseline - 1) * 100) : null;
              const partial = isPartial(target.month);
              const label = monthYear.format(month);
              return (
                <AccordionItem key={target.month} value={String(target.month)}>
                  <AccordionTrigger className={c.monthTrigger}>
                      <span>
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                        {partial ? <span className={c.partial}>Mes parcial</span> : null}
                      </span>
                      <b>{target.target_value === null ? "Sin cifra" : short(target.target_value)}</b>
                      {change !== null && !partial ? (
                        <span className={change >= 0 ? c.textGreen : c.textBad}>
                          {change >= 0 ? "+" : ""}
                          {change} %
                        </span>
                      ) : (
                        <span />
                      )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p>{target.rationale}</p>
                    {inMonth.length ? <p className={c.muted}>Hitos del mes: {inMonth.map((milestone) => milestone.name).join(" · ")}</p> : null}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
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
  const [saving, setSaving] = useState(false);

  return (
    <form
      className={c.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
          await onSubmit({ name: name.trim(), description: description.trim(), targetDate, successCriteria: criteria.trim(), rationale: rationale.trim() });
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
        <Field label="Fecha objetivo">
          <DatePicker value={targetDate} onChange={(value) => setTargetDate(value)} />
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
// Ajustes del camino (pestaña Estructura)
// ---------------------------------------------------------------------------

export function PlanSettings({
  name,
  description,
  currencyControl,
  editForm,
  onEdit,
  deleteControl,
}: {
  name: string;
  description: string | null;
  currencyControl: ReactNode;
  editForm: ReactNode;
  onEdit: () => void;
  deleteControl: ReactNode;
}) {
  return (
    <section className={c.panel} aria-labelledby="ajustes-camino">
      <div className={c.panelHead}>
        <h3 id="ajustes-camino">Ajustes del camino</h3>
      </div>
      <div className={c.settings}>
        <div className={c.setRow}>
          <div>
            <b>Nombre y descripción</b>
            <span className={c.muted}>{name}</span>
            {description ? <span className={`${c.muted} ${c.clamp2}`}>{description}</span> : null}
          </div>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            Editar
          </Button>
        </div>
        {editForm ? <div className={c.inline}>{editForm}</div> : null}
        <div className={c.setRow}>
          <div>
            <b>Moneda de las cifras</b>
            <span className={c.muted}>Solo cambia cómo se muestran los importes del camino</span>
          </div>
          {currencyControl}
        </div>
        <div className={c.setRow}>
          <div>
            <b>Replanificar</b>
            <span className={c.muted}>Crea una versión nueva del camino con la IA o una plantilla; esta queda en el historial</span>
          </div>
          <ButtonLink href="/camino/nuevo" variant="secondary" size="sm">
            Replanificar
          </ButtonLink>
        </div>
        <div className={`${c.setRow} ${c.setDanger}`}>
          <div>
            <b>Eliminar el camino</b>
            <span className={c.muted}>Borra fases, hitos, notas y revisiones. Las tareas se conservan en Tareas.</span>
          </div>
          {deleteControl}
        </div>
      </div>
    </section>
  );
}
