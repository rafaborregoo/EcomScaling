/**
 * Carriles de trabajo del Camino. Escalar una tienda no es una lista lineal:
 * lo que se hace una vez para dejarla lista (puesta a punto), lo que se prepara
 * para cada fecha clave (temporada) y el ciclo de crecimiento que se repite.
 */

export type TaskTrack = "puesta_a_punto" | "temporada" | "crecimiento";

export const TRACK_ORDER: TaskTrack[] = ["puesta_a_punto", "temporada", "crecimiento"];

export const TRACK_LABELS: Record<TaskTrack, string> = {
  puesta_a_punto: "Puesta a punto",
  temporada: "Fechas clave",
  crecimiento: "Crecimiento",
};

const CADENCE_LABELS: Record<string, string> = {
  semanal: "Cada semana",
  quincenal: "Cada 2 semanas",
  mensual: "Cada mes",
};

export function trackLabel(track: string | null | undefined): string | null {
  return track && track in TRACK_LABELS ? TRACK_LABELS[track as TaskTrack] : null;
}

/** Solo las rutinas tienen cadencia visible: "una vez" no se muestra. */
export function cadenceLabel(cadence: string | null | undefined): string | null {
  return cadence ? (CADENCE_LABELS[cadence] ?? null) : null;
}

export function countByTrack(tasks: Array<{ track?: string | null }>): Record<TaskTrack, number> {
  const counts: Record<TaskTrack, number> = { puesta_a_punto: 0, temporada: 0, crecimiento: 0 };
  for (const task of tasks) if (task.track && task.track in counts) counts[task.track as TaskTrack] += 1;
  return counts;
}

/** "Revisar ROAS (2/4)" -> "Revisar ROAS": las vueltas de una rutina comparten nombre. */
export function routineName(title: string): string {
  return title.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
}

export type GrowthTask = {
  title: string;
  status: string;
  due_at: string | null;
  plan_meta?: { track?: string | null; cadence?: string | null } | null;
};

export type GrowthRoutine = { name: string; cadence: string | null; total: number; done: number; nextDue: string | null };

const OPEN = ["pending", "in_progress"];

/** Las tareas de crecimiento agrupadas por rutina, con cuantas vueltas van hechas y la siguiente. */
export function growthRoutines(tasks: GrowthTask[]): GrowthRoutine[] {
  const byName = new Map<string, GrowthRoutine>();
  for (const task of tasks) {
    if (task.plan_meta?.track !== "crecimiento") continue;
    const name = routineName(task.title);
    const routine = byName.get(name) ?? { name, cadence: task.plan_meta.cadence ?? null, total: 0, done: 0, nextDue: null };
    routine.total += 1;
    if (task.status === "completed") routine.done += 1;
    else if (OPEN.includes(task.status) && task.due_at && (!routine.nextDue || task.due_at < routine.nextDue)) routine.nextDue = task.due_at;
    byName.set(name, routine);
  }
  return [...byName.values()];
}
