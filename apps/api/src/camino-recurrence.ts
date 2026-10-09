/**
 * El ciclo de crecimiento se repite: una rutina semanal "revisar ROAS contra el
 * equilibrio y mover presupuesto" es una tarea por semana hasta la fecha del
 * hito, no una sola. A19 la escribe una vez con su cadencia y aqui se expande
 * al crear el Camino, para que cada vez sea una tarea que se completa y se ve.
 */

export const CAMINO_CADENCE_DAYS: Record<string, number> = { semanal: 7, quincenal: 14, mensual: 30 };
// Defensa, no regla: el limite real es la fecha del hito. 60 = una rutina semanal durante mas de un año.
const MAX_OCCURRENCES = 60;
const DAY_MS = 86_400_000;

/** Fechas (YYYY-MM-DD) de cada vez que toca la tarea: la primera es la propia. */
export function recurrenceDates(
  dueAt: string | null | undefined,
  cadence: string | null | undefined,
  until: string | null | undefined,
): string[] {
  if (!dueAt) return [];
  const step = cadence ? CAMINO_CADENCE_DAYS[cadence] : undefined;
  const first = Date.parse(dueAt);
  const end = until ? Date.parse(until) : NaN;
  if (!step || !Number.isFinite(first) || !Number.isFinite(end)) return [dueAt.slice(0, 10)];
  const dates: string[] = [];
  for (let at = first; at <= end && dates.length < MAX_OCCURRENCES; at += step * DAY_MS) {
    dates.push(new Date(at).toISOString().slice(0, 10));
  }
  return dates.length ? dates : [dueAt.slice(0, 10)];
}

/** "Revisar ROAS" -> "Revisar ROAS (2/4)"; una sola vez no lleva sufijo. */
export function occurrenceTitle(title: string, index: number, total: number): string {
  return total > 1 ? `${title.slice(0, 245)} (${index + 1}/${total})` : title;
}
