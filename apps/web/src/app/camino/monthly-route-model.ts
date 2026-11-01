// Lógica pura de la ruta mensual del Camino (sin React ni UI, para poder probarla en node).

export type MonthlyTarget = { month: number; target_value: number | null; rationale: string; seasonal_baseline?: number | null };
export type RouteMilestone = { name: string; date: string | null };

export function calendarMonth(startDate: string, month: number) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(start)) return null;
  const date = new Date(start);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + month - 1, 1));
}

/** Hitos del mes natural que usa la revisión del objetivo del Camino. */
export function milestonesInMonth(startDate: string, month: number, milestones: RouteMilestone[]): RouteMilestone[] {
  const period = calendarMonth(startDate, month);
  if (!period) return [];
  const from = period.getTime();
  const to = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1)).getTime();
  return milestones.filter((milestone) => {
    const at = milestone.date ? Date.parse(`${milestone.date.slice(0, 10)}T00:00:00Z`) : NaN;
    return Number.isFinite(at) && at >= from && at < to;
  });
}
