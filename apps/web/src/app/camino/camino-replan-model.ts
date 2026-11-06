// Lógica pura de la replanificación en pantalla. Las reglas viven en el servidor: aquí solo se presenta.

export const REPLAN_SCOPE_OPTIONS = [
  { key: "dates", title: "Cambiar fechas", hint: "Nuevas fechas para hitos y tareas pendientes", phrase: "fechas" },
  { key: "margin", title: "Proteger margen", hint: "Reducir el riesgo de incumplir la rentabilidad mínima", phrase: "margen" },
  { key: "tasks", title: "Reorganizar tareas", hint: "Redistribuir el trabajo futuro y quitar lo redundante", phrase: "tareas" },
  { key: "goals", title: "Ajustar objetivos", hint: "Proponer otras metas, con su justificación", phrase: "objetivos" },
  { key: "strategy", title: "Revisar estrategia", hint: "Replantear acciones, campañas y prioridades", phrase: "estrategia" },
  { key: "resources", title: "Cambiar recursos", hint: "Responsables y capacidad de ejecución", phrase: "recursos" },
] as const;

export const DEFAULT_REPLAN_SCOPES: string[] = ["dates", "margin", "tasks", "goals", "strategy"];
export const REPLAN_BRIEF_LIMIT = 2000;

export type ReplanChangeKind = "added" | "modified" | "rescheduled" | "moved" | "kept" | "retired" | "conflict";
export type ReplanDecision = "accept" | "keep";
export type ReplanChange = {
  id: string;
  kind: ReplanChangeKind;
  entity: "goal" | "month" | "milestone" | "task";
  source_id: string | null;
  label: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  protected: boolean;
  out_of_scope: boolean;
  must_decide: boolean;
  locked: boolean;
  decision: ReplanDecision;
};

export const KIND_LABEL: Record<ReplanChangeKind, string> = {
  added: "Añadido",
  modified: "Modificado",
  rescheduled: "Reprogramado",
  moved: "Movido",
  kept: "Conservado",
  retired: "Retirado del plan",
  conflict: "Conflicto",
};

const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}` : (items[0] ?? ""));
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function replanRequestSummary(scopes: string[], months: number) {
  const phrases = REPLAN_SCOPE_OPTIONS.filter((option) => scopes.includes(option.key)).map((option) => option.phrase);
  if (!phrases.length) return "Elige al menos un ámbito de cambio.";
  return `La IA revisará ${list(phrases)} durante los próximos ${plural(months, "mes", "meses")}. Se conservarán las tareas completadas y las decisiones manuales. Ningún cambio se aplicará sin tu confirmación.`;
}

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Inicio, final exclusivo y si el primer y el último mes son parciales. */
export function replanDates(start: string, months: number) {
  const base = new Date(`${start}T00:00:00Z`);
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(base.getUTCDate(), lastDay));
  return { start, end: target.toISOString().slice(0, 10), lastDay: addDays(target.toISOString().slice(0, 10), -1), partial: base.getUTCDate() !== 1 };
}

export const validMonths = (value: number) => Number.isInteger(value) && value >= 1 && value <= 12;

/** Lo que pide atención: conflictos, decisiones manuales, objetivos y lo que el usuario no pidió cambiar. */
export const needsAttention = (change: ReplanChange) => change.kind === "conflict" || change.protected || change.out_of_scope || change.entity === "goal" || change.entity === "month";

export function undecided(changes: ReplanChange[], decisions: Record<string, ReplanDecision>) {
  return changes.filter((change) => change.must_decide && !change.locked && !decisions[change.id]);
}

/** Qué decide el usuario en esta fila: lo que acepta y lo que conserva dicho según el cambio. */
export function decisionLabels(change: ReplanChange) {
  if (change.kind === "added" || (change.kind === "conflict" && change.source_id === null && change.entity !== "goal" && change.entity !== "month")) {
    return { accept: "Añadir", keep: "No añadir" };
  }
  if (change.kind === "retired" || change.after === null) return { accept: "Retirar", keep: "Conservar" };
  return { accept: "Aceptar cambio", keep: "Mantener original" };
}

const FIELD_LABEL: Record<string, string> = {
  name: "Nombre",
  title: "Título",
  success_criteria: "Criterio",
  target_date: "Fecha",
  due_at: "Fecha",
  phase: "Fase",
  milestone: "Hito",
  priority: "Prioridad",
  cadence: "Repetición",
  owner: "Responsable",
  status: "Estado",
};

const shortDate = (value: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));

function cell(value: unknown, money: (value: number) => string): string {
  if (value === null || value === undefined || value === "") return "sin dato";
  if (typeof value === "number") return money(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return shortDate(value);
  return String(value);
}

/** «Fecha: 20 nov 2026 → 25 nov 2026», campo a campo, para no enseñar el plan duplicado. */
export function describeChange(change: ReplanChange, money: (value: number) => string): string[] {
  const { before, after } = change;
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
  if (!isRecord(before) && !isRecord(after)) {
    if (before === null && after === null) return [];
    return [`${cell(before, money)} → ${cell(after, money)}`];
  }
  const fields = [...new Set([...Object.keys(isRecord(before) ? before : {}), ...Object.keys(isRecord(after) ? after : {})])];
  return fields.map((field) => {
    const left = isRecord(before) ? before[field] : undefined;
    const right = isRecord(after) ? after[field] : undefined;
    const label = FIELD_LABEL[field] ?? field;
    if (left === undefined) return `${label}: ${cell(right, money)}`;
    if (right === undefined) return `${label}: ${cell(left, money)}`;
    return `${label}: ${cell(left, money)} → ${cell(right, money)}`;
  });
}

const monthName = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
export const periodLabel = (period: string) => {
  const text = monthName.format(new Date(`${period}-01T00:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
};
