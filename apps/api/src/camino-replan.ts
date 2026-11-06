import type { CaminoPlanOutput } from "@e-nora/ai";
import { recurrenceDates } from "./camino-recurrence.js";
import type { PlanInput } from "./strategic-plans.js";

/**
 * Reglas de la replanificación, sin base de datos ni modelo: qué cambia una
 * propuesta frente al Camino vigente, qué impide confirmarla y cómo queda la
 * versión final con las decisiones del usuario. La IA propone; lo que se aplica
 * sale siempre de aquí, y se recalcula al confirmar.
 */

export const REPLAN_SCOPES = ["dates", "margin", "tasks", "goals", "strategy", "resources"] as const;
export type ReplanScope = (typeof REPLAN_SCOPES)[number];
export type ReplanDecision = "accept" | "keep";
export type ReplanChangeKind = "added" | "modified" | "rescheduled" | "moved" | "kept" | "retired" | "conflict";

export type CurrentTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  source: string;
  owner_role: string | null;
  kind: string | null;
  track: string | null;
  cadence: string | null;
  effort_hours: number | null;
  definition_of_done: string | null;
  rationale: string | null;
  evidence: unknown[];
};
export type CurrentMilestone = {
  id: string;
  name: string;
  description: string | null;
  success_criteria: string | null;
  rationale: string | null;
  status: string;
  target_date: string | null;
  deadline_date: string | null;
  measurement_date: string | null;
  tasks: CurrentTask[];
};
type Goal = NonNullable<PlanInput["goal"]>;
export type CurrentPlan = {
  id: string;
  name: string;
  version: number;
  status: string;
  currency_code: string | null;
  starts_on: string | null;
  created_at: string;
  goal: Goal | null;
  phases: Array<{ name: string; milestones: CurrentMilestone[] }>;
};
/** Campos que una persona ha fijado a mano. `*` = el elemento entero es suyo. */
export type ManualDecisions = { milestones: Record<string, string[]>; tasks: Record<string, string[]>; goal: boolean };
export type Restriction = { metric_key: string; label: string; target_value: number; unit: string; period: string | null };

export type ReplanChange = {
  id: string;
  kind: ReplanChangeKind;
  entity: "goal" | "month" | "milestone" | "task";
  source_id: string | null;
  label: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  /** Toca una decisión manual: sin respuesta se conserva. */
  protected: boolean;
  /** El usuario no pidió cambiar esto: se conserva salvo que lo acepte. */
  out_of_scope: boolean;
  /** Bloquea confirmar hasta que el usuario responda. */
  must_decide: boolean;
  /** El sistema no admite aceptarlo. */
  locked: boolean;
  decision: ReplanDecision;
};
export type ReplanBlocker = { code: string; message: string; change_id?: string };
export type ReplanMonth = { period: string; current: number | null; proposed: number | null; final: number | null; actual: number | null };
export type ReplanAnalysis = {
  changes: ReplanChange[];
  blockers: ReplanBlocker[];
  warnings: string[];
  route: ReplanMonth[];
  counts: {
    current: { phases: number; milestones: number; tasks: number; completed: number; open: number };
    final: { phases: number; milestones: number; open_tasks: number; inherited_completed: number };
    changes: Record<ReplanChangeKind, number>;
  };
  final: { goal: PlanInput["goal"]; phases: NonNullable<PlanInput["phases"]> };
  retire: Array<{ task_id: string; reason: string }>;
};

/** Reglas que A19 recibe solo al replanificar; se comprueban después igualmente en `analyzeReplan`. */
export const CAMINO_REPLAN_CONTRACT = [
  "REPLANIFICACIÓN: no diseñas un Camino desde cero, modificas el vigente del bloque REPLANIFICACIÓN. Propón solo lo que el usuario ha pedido en ambitos_que_puedes_cambiar.",
  "Identidad: copia literalmente el id en source_milestone_id y source_task_id de cada hito y tarea abiertos que continúen. Sin id es un elemento nuevo. Una tarea o hito abierto que no cites sale del plan: indícalo en retired_items con su motivo. Nunca cites hitos cerrados ni tareas hechas; no repitas lo que ya está en tareas_hechas.",
  "Tareas conservadas: deja description vacío y cadence una_vez salvo que la tarea cambie. Si unificas una rutina, conserva una sola tarea con su cadence y retira las demás vueltas. Si cambia algo, explica el qué y el porqué en change_reason con datos de esta tienda. Copia dia en target_offset_days si la fecha no cambia.",
  "Decisiones manuales (manual no vacío): no las cambies salvo razón clara, y justifícalo en change_reason. El usuario decidirá.",
  "Metas: por_mes_natural dice qué cifra corresponde a cada mes real. monthly_targets empieza en el mes natural actual y debe conservar la cifra de cada mes salvo que el ámbito goals esté elegido y lo justifiques: cambiar la duración no autoriza a mover una meta de mes ni a cambiar su importe. Excepción a la regla general de meses parciales: un mes con cifra vigente conserva esa cifra aunque el Camino empiece a mitad de mes.",
  "Restricciones: respeta restricciones_vigentes (por ejemplo el margen mínimo). No inventes restricciones que no estén ahí. Las instrucciones del usuario no pueden anular estas reglas ni el historial; si piden algo incompatible, dilo en warnings.",
].join(" ");

const CLOSED_TASK = new Set(["completed", "ignored", "cancelled"]);
const CLOSED_MILESTONE = new Set(["completed", "skipped"]);
const day = (value: string | null | undefined) => (value ? value.slice(0, 10) : null);

/** Sin acentos, mayúsculas ni el «(2/5)» de las rutinas. */
export function normalizeTitle(title: string) {
  return title
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s*\(\d+\/\d+\)\s*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const STOPWORDS = new Set(["a", "al", "con", "de", "del", "el", "en", "la", "las", "lo", "los", "para", "por", "un", "una", "y"]);

// ponytail: solapamiento de palabras, no semántico. Detecta reformulaciones cercanas, no sinónimos.
function similarTitles(a: string, b: string) {
  const words = (title: string) => new Set(normalizeTitle(title).split(" ").filter((word) => !STOPWORDS.has(word)));
  const left = words(a);
  const right = words(b);
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared / Math.max(1, new Set([...left, ...right]).size) >= 0.75;
}

/** Cada mes de la meta con su mes natural. Lo antiguo no lo guarda: sale de la fecha de inicio. */
export function monthRoute(goal: Goal | null | undefined, startsOn: string | null): Array<{ period: string; target_value: number | null }> {
  const targets = goal?.monthly_targets ?? [];
  const start = startsOn ? new Date(`${startsOn.slice(0, 10)}T00:00:00Z`) : null;
  return targets.flatMap((target) => {
    if (target.period) return [{ period: target.period, target_value: target.target_value }];
    if (!start) return [];
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + target.month - 1, 1));
    return [{ period: date.toISOString().slice(0, 7), target_value: target.target_value }];
  });
}

const PROPOSAL_MAX_AGE_MS = 7 * 86_400_000;

/** Una propuesta caduca si cambia el mes natural o pasan 7 días: sus fechas y metas ya no valen. */
export function proposalExpired(generatedAt: string | null | undefined, now = new Date()) {
  const at = generatedAt ? Date.parse(generatedAt) : NaN;
  if (!Number.isFinite(at)) return true;
  return now.getTime() - at > PROPOSAL_MAX_AGE_MS || new Date(at).toISOString().slice(0, 7) !== now.toISOString().slice(0, 7);
}

/** Quita lo que el modelo se haya inventado: un id que no existe o repetido no llega a revisión. */
export function dropUnknownReferences(proposal: CaminoPlanOutput, known: { milestones: Set<string>; tasks: Set<string> }): CaminoPlanOutput {
  const seen = new Set<string>();
  let dropped = 0;
  const keep = (id: string | null | undefined, valid: Set<string>) => {
    if (!id) return null;
    if (!valid.has(id) || seen.has(id)) {
      dropped += 1;
      return null;
    }
    seen.add(id);
    return id;
  };
  const phases = proposal.phases.map((phase) => ({
    ...phase,
    milestones: phase.milestones.map((milestone) => ({
      ...milestone,
      source_milestone_id: keep(milestone.source_milestone_id, known.milestones),
      tasks: milestone.tasks.map((task) => ({ ...task, source_task_id: keep(task.source_task_id, known.tasks) })),
    })),
  }));
  return { ...proposal, phases, warnings: dropped ? [...proposal.warnings, `La propuesta citaba ${dropped} elementos que no existen o estaban repetidos: se tratan como nuevos.`] : proposal.warnings };
}

const monthName = (period: string) =>
  new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}-01T00:00:00Z`));

export function endOfMonth(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10);
}

export function analyzeReplan(input: {
  current: CurrentPlan;
  proposal: PlanInput;
  retired?: Array<{ source_id: string; reason: string }> | null;
  manual: ManualDecisions;
  restrictions: Restriction[];
  scopes: string[];
  decisions?: Record<string, ReplanDecision>;
  actuals?: Record<string, number | null>;
  startsOn: string;
}): ReplanAnalysis {
  const { current, proposal, manual, restrictions, startsOn } = input;
  const decisions = input.decisions ?? {};
  const inScope = (...scopes: ReplanScope[]) => scopes.some((scope) => input.scopes.includes(scope));
  const changes: ReplanChange[] = [];
  const blockers: ReplanBlocker[] = [];
  const warnings: string[] = [];
  const retiredReason = new Map((input.retired ?? []).map((item) => [item.source_id, item.reason]));

  const add = (change: Omit<ReplanChange, "decision" | "protected" | "out_of_scope" | "must_decide" | "locked"> & Partial<Pick<ReplanChange, "protected" | "out_of_scope" | "must_decide" | "locked">> & { fallback: ReplanDecision }) => {
    const { fallback, ...rest } = change;
    const locked = rest.locked ?? false;
    const decided = locked ? "keep" : decisions[rest.id];
    const row: ReplanChange = {
      protected: false,
      out_of_scope: false,
      must_decide: false,
      locked,
      ...rest,
      decision: decided ?? (rest.protected || rest.out_of_scope ? "keep" : fallback),
    };
    changes.push(row);
    if (row.must_decide && !decided) {
      blockers.push({ code: "decision_required", message: `Falta decidir: ${row.label}`, change_id: row.id });
    }
    return row;
  };

  // --- Moneda
  const proposedCurrency = proposal.goal?.unit === "money" ? proposal.goal.currency_code : null;
  if (proposedCurrency && current.currency_code && proposedCurrency !== current.currency_code) {
    blockers.push({ code: "currency_mismatch", message: `La propuesta está en ${proposedCurrency} y el Camino en ${current.currency_code}. Genera otra propuesta: los importes no se convierten solos.` });
  }

  // --- Identidad
  const milestones = new Map(current.phases.flatMap((phase) => phase.milestones.map((milestone) => [milestone.id, { milestone, phase: phase.name }] as const)));
  const tasks = new Map(current.phases.flatMap((phase) => phase.milestones.flatMap((milestone) => milestone.tasks.map((task) => [task.id, { task, milestone }] as const))));
  const allTasks = [...tasks.values()].map((entry) => entry.task);
  const openTasks = allTasks.filter((task) => !CLOSED_TASK.has(task.status));
  const doneTasks = allTasks.filter((task) => task.status === "completed");
  const referenced = new Set<string>();
  const reference = (id: string | null | undefined, known: boolean, what: string) => {
    if (!id) return null;
    if (!known) {
      blockers.push({ code: "invalid_reference", message: `La propuesta cita ${what} que no pertenece a este Camino. Genera otra propuesta.` });
      return null;
    }
    if (referenced.has(id)) {
      blockers.push({ code: "duplicate_reference", message: `La propuesta usa dos veces ${what}. Genera otra propuesta.` });
      return null;
    }
    referenced.add(id);
    return id;
  };

  type Node = NonNullable<NonNullable<PlanInput["phases"]>[number]["milestones"]>[number];
  type TaskNode = NonNullable<Node["tasks"]>[number];
  type Slot = { phase: number; node: Node; source: CurrentMilestone | null; key: string; dropped: boolean };
  const slots: Slot[] = [];
  (proposal.phases ?? []).forEach((phase, phaseIndex) => {
    (phase.milestones ?? []).forEach((node, nodeIndex) => {
      const id = reference(node.sourceMilestoneId, milestones.has(node.sourceMilestoneId ?? ""), "un hito");
      slots.push({ phase: phaseIndex, node, source: id ? milestones.get(id)!.milestone : null, key: `${phaseIndex}.${nodeIndex}`, dropped: false });
    });
  });
  // Si el modelo olvidó el id pero el nombre es idéntico, es el mismo elemento.
  for (const slot of slots) {
    if (slot.source) continue;
    const twin = [...milestones.values()].find(({ milestone }) => !referenced.has(milestone.id) && !CLOSED_MILESTONE.has(milestone.status) && normalizeTitle(milestone.name) === normalizeTitle(slot.node.name ?? ""));
    if (twin) {
      referenced.add(twin.milestone.id);
      slot.source = twin.milestone;
    }
  }

  // --- Hitos
  for (const slot of slots) {
    const { node, source } = slot;
    const name = node.name ?? "";
    if (!source) {
      const change = add({
        id: `new:${slot.key}`,
        kind: "added",
        entity: "milestone",
        source_id: null,
        label: name,
        before: null,
        after: { target_date: node.targetDate ?? null },
        reason: node.changeReason ?? node.rationale ?? null,
        out_of_scope: !inScope("strategy", "tasks"),
        fallback: "accept",
      });
      slot.dropped = change.decision === "keep";
      continue;
    }
    if (CLOSED_MILESTONE.has(source.status)) {
      const change = add({
        id: `milestone:${source.id}`,
        kind: "conflict",
        entity: "milestone",
        source_id: source.id,
        label: `${name}: ese hito ya está cerrado y no se reabre`,
        before: { status: source.status },
        after: { target_date: node.targetDate ?? null },
        reason: "Lo cerrado queda en su versión. Acéptalo solo si es trabajo nuevo.",
        fallback: "keep",
      });
      slot.source = null;
      slot.dropped = change.decision === "keep";
      continue;
    }
    const phaseName = milestones.get(source.id)!.phase;
    const newPhase = proposal.phases?.[slot.phase]?.name ?? "";
    const changed: Record<string, [unknown, unknown]> = {};
    if (normalizeTitle(source.name) !== normalizeTitle(name)) changed.name = [source.name, name];
    if (node.successCriteria && (source.success_criteria ?? "").trim() !== node.successCriteria.trim()) changed.success_criteria = [source.success_criteria, node.successCriteria];
    if (day(source.target_date) !== day(node.targetDate)) changed.target_date = [day(source.target_date), day(node.targetDate)];
    if (normalizeTitle(phaseName) !== normalizeTitle(newPhase)) changed.phase = [phaseName, newPhase];
    const fields = Object.keys(changed);
    if (!fields.length) {
      add({ id: `milestone:${source.id}`, kind: "kept", entity: "milestone", source_id: source.id, label: source.name, before: null, after: null, reason: null, fallback: "accept" });
      continue;
    }
    const manualFields = manual.milestones[source.id] ?? [];
    const isProtected = manualFields.some((field) => field === "*" || fields.includes(field));
    const outOfScope =
      (fields.includes("target_date") && !inScope("dates")) ||
      (fields.includes("phase") && !inScope("tasks", "strategy")) ||
      ((fields.includes("name") || fields.includes("success_criteria")) && !inScope("strategy", "tasks"));
    add({
      id: `milestone:${source.id}`,
      kind: isProtected ? "conflict" : fields.length === 1 && fields[0] === "target_date" ? "rescheduled" : fields.length === 1 && fields[0] === "phase" ? "moved" : "modified",
      entity: "milestone",
      source_id: source.id,
      label: isProtected ? `Cambio sobre una decisión manual: ${source.name}` : source.name,
      before: Object.fromEntries(fields.map((field) => [field, changed[field]![0]])),
      after: Object.fromEntries(fields.map((field) => [field, changed[field]![1]])),
      reason: node.changeReason ?? null,
      protected: isProtected,
      out_of_scope: outOfScope,
      fallback: "accept",
    });
  }
  for (const { milestone } of milestones.values()) {
    if (referenced.has(milestone.id) || CLOSED_MILESTONE.has(milestone.status)) continue;
    const manualFields = manual.milestones[milestone.id] ?? [];
    const isProtected = manualFields.length > 0;
    add({
      id: `milestone:${milestone.id}`,
      kind: isProtected ? "conflict" : "retired",
      entity: "milestone",
      source_id: milestone.id,
      label: isProtected ? `La propuesta quita una decisión manual: ${milestone.name}` : milestone.name,
      before: { target_date: day(milestone.target_date) },
      after: null,
      reason: retiredReason.get(milestone.id) ?? null,
      protected: isProtected,
      out_of_scope: !inScope("strategy", "tasks"),
      fallback: "accept",
    });
  }
  const decisionOf = (id: string) => changes.find((change) => change.id === id)?.decision;

  // --- Tareas: enlace por título exacto cuando el modelo olvidó el id
  const twinOf = (title: string) => openTasks.find((task) => !referenced.has(task.id) && normalizeTitle(task.title) === normalizeTitle(title));
  type Placed = { slot: Slot; task: TaskNode; source: { task: CurrentTask; milestone: CurrentMilestone } | null; key: string };
  const placed: Placed[] = [];
  for (const slot of slots) {
    (slot.node.tasks ?? []).forEach((task, index) => {
      const id = reference(task.sourceTaskId, tasks.has(task.sourceTaskId ?? ""), "una tarea");
      placed.push({ slot, task, source: id ? tasks.get(id)! : null, key: `${slot.key}.${index}` });
    });
  }
  for (const item of placed) {
    if (item.source) continue;
    const twin = twinOf(item.task.title ?? "");
    if (twin) {
      referenced.add(twin.id);
      item.source = tasks.get(twin.id)!;
    }
  }

  const finalTasks = new Map<Slot, TaskNode[]>(slots.map((slot) => [slot, []]));
  const pendingPlacement: Array<{ task: TaskNode; preferred: string; due: string | null }> = [];
  const fromCurrent = (task: CurrentTask): TaskNode => ({
    sourceTaskId: task.id,
    title: task.title,
    description: task.description,
    dueAt: task.due_at,
    priority: task.priority,
    owner: task.owner_role,
    kind: task.kind,
    track: task.track,
    cadence: "una_vez",
    effortHours: task.effort_hours,
    definitionOfDone: task.definition_of_done,
    rationale: task.rationale,
    evidence: task.evidence,
  });

  for (const item of placed) {
    const { slot, task, source } = item;
    const title = task.title ?? "";
    if (!source) {
      const twinDone = doneTasks.find((done) => normalizeTitle(done.title) === normalizeTitle(title) || similarTitles(done.title, title));
      const twinOpen = openTasks.find((open) => similarTitles(open.title, title));
      const repeated = twinDone ?? twinOpen;
      const change = add({
        id: `new:${item.key}`,
        kind: repeated ? "conflict" : "added",
        entity: "task",
        source_id: null,
        label: twinDone ? `Repite una tarea ya hecha: ${twinDone.title}` : repeated ? `Posible duplicado de «${repeated.title}»: ${title}` : title,
        before: null,
        after: { title, due_at: day(task.dueAt), milestone: slot.node.name ?? null },
        reason: task.changeReason ?? null,
        out_of_scope: !inScope("tasks", "strategy"),
        fallback: repeated ? "keep" : "accept",
      });
      if (change.decision === "accept" && !slot.dropped) finalTasks.get(slot)!.push(task);
      continue;
    }
    const old = source.task;
    if (CLOSED_TASK.has(old.status)) {
      add({
        id: `task:${old.id}`,
        kind: "conflict",
        entity: "task",
        source_id: old.id,
        label: `${old.title}: ya está cerrada, no se modifica`,
        before: { status: old.status },
        after: { title, due_at: day(task.dueAt) },
        reason: "El historial no se reescribe.",
        locked: true,
        fallback: "keep",
      });
      continue;
    }
    const changed: Record<string, [unknown, unknown]> = {};
    if (normalizeTitle(old.title) !== normalizeTitle(title)) changed.title = [old.title, title];
    if (day(old.due_at) !== day(task.dueAt)) changed.due_at = [day(old.due_at), day(task.dueAt)];
    if ((old.priority ?? "") !== (task.priority ?? old.priority ?? "")) changed.priority = [old.priority, task.priority];
    if (slot.source?.id !== source.milestone.id) changed.milestone = [source.milestone.name, slot.node.name ?? null];
    if (inScope("resources") && task.owner && (old.owner_role ?? null) !== task.owner) changed.owner = [old.owner_role, task.owner];
    // Una rutina consolidada: la tarea sigue y se repite; si no se cuenta, sus vueltas se perderían.
    const repeats = task.cadence && task.cadence !== "una_vez";
    if (repeats) changed.cadence = [old.cadence, task.cadence];
    const fields = Object.keys(changed);
    const hasOwnText = Boolean(task.changeReason && task.description?.trim());
    const merged: TaskNode = {
      ...fromCurrent(old),
      title,
      priority: task.priority ?? old.priority,
      ...(hasOwnText ? { description: task.description, definitionOfDone: task.definitionOfDone || old.definition_of_done } : {}),
      dueAt: task.dueAt ?? old.due_at,
      ...(changed.owner ? { owner: task.owner, reassign: true } : {}),
      ...(repeats ? { cadence: task.cadence } : {}),
    };
    if (!fields.length) {
      add({ id: `task:${old.id}`, kind: "kept", entity: "task", source_id: old.id, label: old.title, before: null, after: null, reason: null, fallback: "accept" });
      finalTasks.get(slot)!.push(fromCurrent(old));
      continue;
    }
    const manualFields = manual.tasks[old.id] ?? [];
    const isProtected = manualFields.some((field) => field === "*" || fields.includes(field));
    const outOfScope =
      (fields.includes("due_at") && !inScope("dates")) ||
      ((fields.includes("title") || fields.includes("priority") || fields.includes("milestone") || fields.includes("cadence")) && !inScope("tasks", "strategy"));
    const change = add({
      id: `task:${old.id}`,
      kind: isProtected ? "conflict" : fields.length === 1 && fields[0] === "due_at" ? "rescheduled" : fields.length === 1 && fields[0] === "milestone" ? "moved" : "modified",
      entity: "task",
      source_id: old.id,
      label: isProtected ? `Cambio sobre una decisión manual: ${old.title}` : old.title,
      before: Object.fromEntries(fields.map((field) => [field, changed[field]![0]])),
      after: Object.fromEntries(fields.map((field) => [field, changed[field]![1]])),
      reason: task.changeReason ?? null,
      protected: isProtected,
      out_of_scope: outOfScope,
      fallback: "accept",
    });
    if (change.decision === "accept") finalTasks.get(slot)!.push(merged);
    else pendingPlacement.push({ task: fromCurrent(old), preferred: source.milestone.id, due: day(old.due_at) });
  }

  const retire: Array<{ task_id: string; reason: string }> = [];
  const defaultRetireReason = `Sale del plan al replanificar la versión ${current.version}.`;
  for (const task of openTasks) {
    if (referenced.has(task.id)) continue;
    const owner = tasks.get(task.id)!.milestone;
    const manualFields = manual.tasks[task.id] ?? [];
    const isManual = task.source !== "strategic_plan" || manualFields.length > 0;
    const milestoneKept = !referenced.has(owner.id) && decisionOf(`milestone:${owner.id}`) === "keep";
    const reason = retiredReason.get(task.id) ?? null;
    const change = add({
      id: `task:${task.id}`,
      kind: isManual ? "conflict" : "retired",
      entity: "task",
      source_id: task.id,
      label: isManual ? `La propuesta quita una tarea manual: ${task.title}` : task.title,
      before: { due_at: day(task.due_at), milestone: owner.name },
      after: null,
      reason,
      protected: isManual,
      out_of_scope: !inScope("tasks", "strategy"),
      fallback: milestoneKept ? "keep" : "accept",
    });
    if (change.decision === "accept") retire.push({ task_id: task.id, reason: (reason ?? defaultRetireReason).slice(0, 500) });
    else pendingPlacement.push({ task: fromCurrent(task), preferred: owner.id, due: day(task.due_at) });
  }

  // --- Versión final: hitos conservados que la propuesta quitaba
  const phases = (proposal.phases ?? []).map((phase) => ({ ...phase, milestones: [] as Node[] }));
  const fromMilestone = (milestone: CurrentMilestone): Node => ({
    sourceMilestoneId: milestone.id,
    name: milestone.name,
    description: milestone.description,
    successCriteria: milestone.success_criteria,
    rationale: milestone.rationale,
    targetDate: day(milestone.target_date),
    deadlineDate: milestone.deadline_date,
    measurementDate: milestone.measurement_date,
    tasks: [],
  });
  const nodeBySource = new Map<string, Node>();
  const bySlot = new Map<Slot, Node>();
  for (const slot of slots) {
    if (slot.dropped) continue;
    const source = slot.source;
    const change = source ? changes.find((item) => item.id === `milestone:${source.id}`) : null;
    const restored = source && change?.kind !== "kept" && change?.decision === "keep";
    const node: Node = source
      ? restored
        ? fromMilestone(source)
        : {
            ...slot.node,
            sourceMilestoneId: source.id,
            // Una fecha límite anterior al nuevo objetivo ya no tendría sentido.
            deadlineDate: source.deadline_date && day(slot.node.targetDate) && source.deadline_date >= day(slot.node.targetDate)! ? source.deadline_date : null,
            measurementDate: source.measurement_date,
          }
      : { ...slot.node, sourceMilestoneId: null };
    phases[slot.phase]!.milestones.push(node);
    bySlot.set(slot, node);
    if (source) nodeBySource.set(source.id, node);
  }
  const placeByDate = (node: Node) => {
    const date = day(node.targetDate);
    const index = phases.findIndex((phase) => phase.milestones.some((other) => date && day(other.targetDate) && day(other.targetDate)! >= date));
    const phase = phases[index >= 0 ? index : phases.length - 1];
    if (!phase) return false;
    phase.milestones.push(node);
    phase.milestones.sort((a, b) => (day(a.targetDate) ?? "9999").localeCompare(day(b.targetDate) ?? "9999"));
    return true;
  };
  for (const { milestone } of milestones.values()) {
    if (referenced.has(milestone.id) || CLOSED_MILESTONE.has(milestone.status) || decisionOf(`milestone:${milestone.id}`) !== "keep") continue;
    const node = fromMilestone(milestone);
    if (placeByDate(node)) nodeBySource.set(milestone.id, node);
  }
  const finalNodes = phases.flatMap((phase) => phase.milestones);
  if (!finalNodes.length) blockers.push({ code: "final_empty", message: "La versión final se queda sin hitos." });

  for (const slot of slots) {
    const node = bySlot.get(slot);
    if (node) node.tasks = finalTasks.get(slot)!;
    else for (const task of finalTasks.get(slot)!) pendingPlacement.push({ task, preferred: "", due: day(task.dueAt) });
  }
  for (const item of pendingPlacement) {
    const node = nodeBySource.get(item.preferred) ?? finalNodes.find((other) => item.due && day(other.targetDate) && day(other.targetDate)! >= item.due) ?? finalNodes[finalNodes.length - 1];
    if (node) (node.tasks ??= []).push(item.task);
  }

  // --- Objetivos: se comparan por mes natural, nunca por índice
  const currentRoute = monthRoute(current.goal, current.starts_on ?? current.created_at);
  const currentByPeriod = new Map(currentRoute.map((month) => [month.period, month.target_value]));
  const proposedMonths = proposal.goal?.monthly_targets ?? [];
  if (proposal.goal && proposedMonths.length && proposedMonths.some((month) => !month.period)) {
    blockers.push({ code: "proposal_without_periods", message: "Esta propuesta no fija sus metas a meses reales. Genera otra." });
  }
  const proposedRoute = monthRoute(proposal.goal, null);
  const proposedByPeriod = new Map(proposedRoute.map((month) => [month.period, month.target_value]));
  const finalByPeriod = new Map(proposedByPeriod);
  const goalsAllowed = inScope("goals");
  const sameMetric = !current.goal || !proposal.goal || current.goal.metric_key === proposal.goal.metric_key;
  let finalGoal: PlanInput["goal"] = proposal.goal ?? current.goal ?? undefined;

  if (current.goal && proposal.goal && !sameMetric) {
    const change = add({
      id: "goal:metric",
      kind: "conflict",
      entity: "goal",
      source_id: null,
      label: `La meta pasa de ${current.goal.metric_label} a ${proposal.goal.metric_label}`,
      before: { metric: current.goal.metric_label, target: current.goal.target },
      after: { metric: proposal.goal.metric_label, target: proposal.goal.target },
      reason: proposal.goal.rationale,
      must_decide: goalsAllowed,
      out_of_scope: !goalsAllowed,
      locked: !goalsAllowed,
      fallback: "keep",
    });
    if (change.decision === "keep") {
      finalGoal = { ...proposal.goal, ...current.goal, ...(proposal.goal.horizon_end_date ? { horizon_end_date: proposal.goal.horizon_end_date } : {}) };
      for (const period of finalByPeriod.keys()) finalByPeriod.set(period, currentByPeriod.get(period) ?? null);
    }
  } else if (current.goal && proposal.goal) {
    for (const [period, before] of currentByPeriod) {
      const after = proposedByPeriod.get(period);
      if (after === undefined) {
        if (before !== null && period >= startsOn.slice(0, 7)) warnings.push(`La meta de ${monthName(period)} queda fuera de la nueva duración.`);
        continue;
      }
      if (before === null || before === after) continue;
      const movedTo = proposedRoute.find((month) => month.period !== period && month.target_value === before && currentByPeriod.get(month.period) !== before);
      const change = add({
        id: `month:${period}`,
        kind: movedTo ? "conflict" : "modified",
        entity: "month",
        source_id: null,
        label: movedTo ? `La meta de ${monthName(period)} se traslada a ${monthName(movedTo.period)}` : `Meta de ${monthName(period)}`,
        before,
        after,
        reason: proposal.goal.monthly_targets?.find((month) => month.period === period)?.rationale ?? null,
        must_decide: Boolean(movedTo) && goalsAllowed,
        protected: manual.goal,
        out_of_scope: !goalsAllowed,
        locked: !goalsAllowed,
        fallback: "keep",
      });
      if (change.decision === "keep") finalByPeriod.set(period, before);
    }
    const lowered = restrictions.find((item) => item.metric_key === proposal.goal!.metric_key && proposal.goal!.target !== null && proposal.goal!.target < item.target_value)
      ?? (current.goal.metric_key === "net_margin_pct" && current.goal.target !== null && proposal.goal.target !== null && proposal.goal.target < current.goal.target
        ? { label: current.goal.metric_label, target_value: current.goal.target }
        : null);
    if (current.goal.target !== proposal.goal.target) {
      const change = add({
        id: "goal:target",
        kind: lowered ? "conflict" : "modified",
        entity: "goal",
        source_id: null,
        label: lowered ? `La meta baja de la restricción de ${lowered.label} (${lowered.target_value})` : `Meta de ${current.goal.metric_label}`,
        before: current.goal.target,
        after: proposal.goal.target,
        reason: proposal.goal.rationale,
        must_decide: Boolean(lowered) && goalsAllowed,
        protected: manual.goal,
        out_of_scope: !goalsAllowed,
        locked: !goalsAllowed,
        fallback: "keep",
      });
      if (change.decision === "keep") finalGoal = { ...proposal.goal, target: current.goal.target };
    }
  } else if (current.goal && !proposal.goal) {
    warnings.push("La propuesta no trae meta: se conserva la vigente.");
    for (const [period, before] of currentByPeriod) if (period >= startsOn.slice(0, 7)) finalByPeriod.set(period, before);
  } else if (proposal.goal) {
    add({ id: "goal:new", kind: "added", entity: "goal", source_id: null, label: `Meta nueva: ${proposal.goal.metric_label}`, before: null, after: proposal.goal.target, reason: proposal.goal.rationale, fallback: "accept" });
  }

  if (finalGoal) {
    const periods = [...finalByPeriod.keys()].sort();
    const rationale = new Map((proposal.goal?.monthly_targets ?? []).map((month) => [month.period, month]));
    const peak = periods.find((period) => finalByPeriod.get(period) === finalGoal!.target);
    const horizonEnd = finalGoal.horizon_end_date;
    finalGoal = {
      ...finalGoal,
      measured_from: `${startsOn.slice(0, 7)}-01`,
      // La fecha de la meta sale de su mes: el 75.000 de noviembre no puede vencer en diciembre.
      ...(peak ? { target_date: horizonEnd && horizonEnd < endOfMonth(peak) ? horizonEnd : endOfMonth(peak) } : {}),
      monthly_targets: periods.map((period, index) => ({
        month: index + 1,
        period,
        target_value: finalByPeriod.get(period) ?? null,
        seasonal_baseline: rationale.get(period)?.seasonal_baseline ?? null,
        rationale: rationale.get(period)?.rationale ?? "Meta conservada de la versión anterior.",
      })),
    };
  }

  const allPeriods = [...new Set([...finalByPeriod.keys(), ...proposedByPeriod.keys()])].sort();
  const route = allPeriods.map((period) => ({
    period,
    current: currentByPeriod.get(period) ?? null,
    proposed: proposedByPeriod.get(period) ?? null,
    final: finalByPeriod.get(period) ?? null,
    actual: input.actuals?.[period] ?? null,
  }));

  const kinds: Record<ReplanChangeKind, number> = { added: 0, modified: 0, rescheduled: 0, moved: 0, kept: 0, retired: 0, conflict: 0 };
  for (const change of changes) kinds[change.kind] += 1;
  const openFinal = finalNodes.reduce(
    (sum, node) => sum + (node.tasks ?? []).reduce((taskSum, task) => taskSum + Math.max(1, recurrenceDates(task.dueAt, task.cadence, node.targetDate).length), 0),
    0,
  );
  return {
    changes,
    blockers,
    warnings,
    route,
    counts: {
      current: {
        phases: current.phases.length,
        milestones: milestones.size,
        tasks: allTasks.length,
        completed: doneTasks.length,
        open: openTasks.length,
      },
      final: { phases: phases.filter((phase) => phase.milestones.length).length, milestones: finalNodes.length, open_tasks: openFinal, inherited_completed: doneTasks.length },
      changes: kinds,
    },
    final: { goal: finalGoal, phases: phases.filter((phase) => phase.milestones.length) },
    retire,
  };
}
