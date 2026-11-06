// Lógica pura de la ruta mensual del Camino (sin React ni UI, para poder probarla en node).

export type MonthlyTarget = { month: number; period?: string; target_value: number | null; rationale: string; seasonal_baseline?: number | null };
export type RouteMilestone = { name: string; date: string | null };

/** Desde dónde se cuentan los meses: el mes real guardado o, en planes antiguos, la fecha de inicio. */
export function routeStart(startDate: string, targets: MonthlyTarget[]) {
  const first = targets.find((target) => target.month === 1)?.period;
  return first ? `${first}-01` : startDate;
}

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

/** Lo que pide la ruta para el mes natural de `today`; null si ese mes no tiene cifra. */
export function monthlyTargetFor(startDate: string, targets: MonthlyTarget[], today: Date) {
  const month = Date.UTC(today.getFullYear(), today.getMonth(), 1);
  return targets.find((target) => target.target_value !== null && calendarMonth(startDate, target.month)?.getTime() === month) ?? null;
}

/** Ventas del mes natural de `today` según la serie diaria; null si no trae ningún día de ese mes. */
export function monthToDate(daily: Array<{ date: string; net_sales: number }>, today: Date) {
  const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const days = daily.filter((day) => day.date.startsWith(prefix));
  return days.length ? days.reduce((sum, day) => sum + day.net_sales, 0) : null;
}

/** Ventas por mes natural desde `fromDate`: el primer mes de un camino también empieza a mitad. */
export function salesByMonth(daily: Array<{ date: string; net_sales: number }>, fromDate: string) {
  const months = new Map<string, number>();
  for (const day of daily) {
    if (day.date.slice(0, 10) < fromDate.slice(0, 10)) continue;
    const key = day.date.slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + day.net_sales);
  }
  return months;
}
