// Lógica pura de la mesa del Camino (sin React ni UI, para poder probarla en node).

const MONTHS = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre";
const TRAILING_DATE = new RegExp(`\\s+(?:el|antes del|para el|hasta el)\\s+\\d{1,2}\\s+de\\s+(?:${MONTHS})(?:\\s+de\\s+\\d{4})?\\.?\\s*$`, "i");

/**
 * El nombre del hito sin la fecha final. A19 la escribe al generar el camino,
 * pero las fechas reales se calculan desde el día en que se acepta: si entre
 * medias pasan tres días, el nombre dice 13 y el hito vence el 16. La fecha
 * buena es la del hito, que es con la que se calculan también sus tareas.
 */
export function milestoneTitle(name: string) {
  return name.replace(TRAILING_DATE, "").trim() || name;
}

/** «Marca: de qué va» -> título corto y marca aparte. Solo si la marca es breve. */
export function planTitle(name: string) {
  const at = name.indexOf(": ");
  if (at < 1 || at > 30) return { title: name, prefix: null as string | null };
  const rest = name.slice(at + 2).trim();
  return { title: rest.charAt(0).toUpperCase() + rest.slice(1), prefix: name.slice(0, at) };
}

/** Un criterio escrito como texto corrido, en puntos que se puedan comprobar uno a uno. */
export function criteriaList(text: string) {
  return text
    .split(/(?<=[.;])\s+/)
    .map((item) => item.replace(/[.;]\s*$/, "").trim())
    .filter(Boolean);
}

const PRIORITY: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const NO_DATE = "9999-12-31";

/** Primero lo que vence antes; a igual fecha, lo más prioritario. Sin fecha, al final. */
export function byUrgency<T extends { due_at: string | null; priority: string }>(tasks: T[]) {
  const dueKey = (task: T) => task.due_at?.slice(0, 10) ?? NO_DATE;
  return tasks.slice().sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || (PRIORITY[a.priority] ?? 4) - (PRIORITY[b.priority] ?? 4));
}

// ---------------------------------------------------------------------------
// Estado de un hito: la única regla, para la hoja de ruta y para la estructura
// ---------------------------------------------------------------------------

export type MilestoneState = "done" | "skipped" | "late" | "active" | "next" | "locked" | "draft";

export const MILESTONE_STATE_LABEL: Record<MilestoneState, string> = {
  done: "Completado",
  skipped: "Omitido",
  late: "Va tarde",
  active: "En curso",
  next: "Por empezar",
  // Las fases se solapan: un hito pendiente no se cierra aún, pero sus tareas sí se adelantan.
  locked: "Pendiente",
  draft: "Previsto",
};

type StateMilestone = {
  status: string;
  target_date: string | null;
  deadline_date?: string | null;
  milestone_task_links: Array<{ tasks: { status: string } | null }>;
};

export function daysUntil(value: string, today: Date) {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.parse(`${value.slice(0, 10)}T00:00:00Z`) - todayUtc) / 86_400_000);
}

/** «Hoy» en la tienda, no en el navegador: un hito no vence antes de tiempo por la zona de quien mira. */
export function todayIn(timezone: string | null | undefined, now = new Date()) {
  if (!timezone) return now;
  try {
    const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
    return new Date(year!, month! - 1, day!, 12);
  } catch {
    return now;
  }
}

/** La fecha que hace tarde a un hito: la límite si la hay; si no, la objetivo. */
export function closeDate(milestone: Pick<StateMilestone, "target_date" | "deadline_date">) {
  return milestone.deadline_date ?? milestone.target_date;
}

export function hasProgress(milestone: StateMilestone) {
  return milestone.milestone_task_links.some((link) => link.tasks?.status === "completed" || link.tasks?.status === "in_progress");
}

export function milestoneState(milestone: StateMilestone, phaseStatus: string, planStatus: string, today: Date): MilestoneState {
  if (planStatus === "draft") return "draft";
  if (milestone.status === "completed") return "done";
  if (milestone.status === "skipped") return "skipped";
  if (phaseStatus !== "active" && phaseStatus !== "completed") return "locked";
  const close = closeDate(milestone);
  if (close && daysUntil(close, today) < 0) return "late";
  // Con tareas ya hechas el hito está en marcha aunque nadie pulsara «Empezar».
  return milestone.status === "in_progress" || hasProgress(milestone) ? "active" : "next";
}

// ---------------------------------------------------------------------------
// Indicadores: una cifra que se acumula no se lee igual que un ratio
// ---------------------------------------------------------------------------

export type IndicatorState = "reached" | "on_track" | "at_risk" | "below" | "no_data" | "stale";

export const INDICATOR_STATE: Record<IndicatorState, { label: string; tone: "success" | "brand" | "warn" | "danger" | "neutral" }> = {
  reached: { label: "Objetivo alcanzado", tone: "success" },
  on_track: { label: "En trayectoria", tone: "brand" },
  at_risk: { label: "En riesgo", tone: "danger" },
  below: { label: "Por debajo del objetivo", tone: "warn" },
  no_data: { label: "Sin datos", tone: "neutral" },
  stale: { label: "Datos desactualizados", tone: "warn" },
};

export type IndicatorObjective = {
  metric_key: string;
  unit: string;
  direction: "up" | "down";
  source: string;
  target_value: number;
  actual_value: number | null;
  progress_pct: number | null;
  status: string;
  period?: string;
  measurement_basis?: string;
  measurement?: { last_sync_at?: string | null; period_label?: string };
};

const ACCUMULATES = new Set(["net_revenue_ex_tax", "net_sales", "net_profit", "orders_count"]);
const FRESH_SYNC_MS = 48 * 60 * 60 * 1000;

/** Lo que se acumula avanza hacia una meta; margen, conversión o ROAS se comparan con un umbral. */
export function accumulates(objective: Pick<IndicatorObjective, "metric_key" | "source">) {
  return objective.source === "manual" || ACCUMULATES.has(objective.metric_key);
}

export function indicatorState(objective: IndicatorObjective, now: Date): IndicatorState {
  if (objective.actual_value === null) return "no_data";
  const sync = objective.measurement?.last_sync_at;
  if (sync && now.getTime() - Date.parse(sync) > FRESH_SYNC_MS) return "stale";
  if (objective.status === "cumplido") return "reached";
  // El ritmo solo se puede juzgar en un mes natural en curso. Una ventana móvil ya está entera.
  if (accumulates(objective) && objective.measurement_basis === "calendar" && objective.period === "monthly") {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return objective.actual_value >= objective.target_value * (now.getDate() / daysInMonth) ? "on_track" : "at_risk";
  }
  return "below";
}

/** Extrapolación lineal del mes en curso. Los primeros días no dicen nada. */
export function monthPace(actual: number, target: number, today: Date) {
  const day = today.getDate();
  if (day < 3 || target <= 0) return null;
  const projected = (actual / day) * new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return { projected, pct: (projected / target) * 100 };
}

/** Distancia al objetivo con su signo: actual menos objetivo. */
export function indicatorGap(objective: Pick<IndicatorObjective, "actual_value" | "target_value">) {
  return objective.actual_value === null ? null : objective.actual_value - objective.target_value;
}

// ---------------------------------------------------------------------------
// Tareas: qué atender primero y cómo filtrarlas
// ---------------------------------------------------------------------------

export type TaskFilter = "open" | "late" | "mine" | "done";

type FilterTask = { status: string; due_at: string | null; assigned_to?: string | null };

const OPEN_TASK = ["pending", "in_progress"];

export function isTaskLate(task: FilterTask, today: Date) {
  return OPEN_TASK.includes(task.status) && task.due_at !== null && daysUntil(task.due_at, today) < 0;
}

/** Qué hacer con una tarea vencida, según si el hito aún deja margen. */
export function lateTaskAdvice(dueAt: string, milestoneClose: string | null, today: Date) {
  const late = -daysUntil(dueAt, today);
  const head = `Venció hace ${late} ${late === 1 ? "día" : "días"}.`;
  return milestoneClose && daysUntil(milestoneClose, today) >= 0
    ? `${head} Aún cabe antes de que cierre el hito: reprográmala, o descártala con motivo si ya no aplica.`
    : `${head} El hito también ha pasado su fecha: decide si se hace, se descarta o se mueve el hito.`;
}

/** Descartadas y canceladas no cuentan como trabajo pendiente ni como hecho. */
export function countableTasks<T extends { status: string }>(tasks: T[]) {
  return tasks.filter((task) => !["ignored", "cancelled"].includes(task.status));
}

export function filterTasks<T extends FilterTask>(tasks: T[], filter: TaskFilter, userId: string, today: Date) {
  if (filter === "done") return tasks.filter((task) => !OPEN_TASK.includes(task.status));
  const open = tasks.filter((task) => OPEN_TASK.includes(task.status));
  if (filter === "late") return open.filter((task) => isTaskLate(task, today));
  if (filter === "mine") return open.filter((task) => task.assigned_to === userId);
  return open;
}
