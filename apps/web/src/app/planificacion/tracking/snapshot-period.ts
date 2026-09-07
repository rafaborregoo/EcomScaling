/**
 * Periodos y variación de los snapshots de tracking.
 *
 * Un snapshot es la foto de un periodo cerrado, y la clave de unicidad en la
 * base es `(organización, periodo, inicio, fin, tienda)`: si los límites se
 * calculan mal, capturar dos veces la misma semana crea dos filas en vez de
 * actualizar una, y el histórico deja de poder compararse consigo mismo.
 */

export type SnapshotPeriod = "weekly" | "monthly";

export type PeriodBounds = { start: string; end: string };

const pad = (value: number) => String(value).padStart(2, "0");
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * El último periodo **cerrado**, no el que está corriendo.
 *
 * Capturar la semana en curso da una foto a medias que mañana ya es mentira, y
 * como la clave incluye las fechas, cada captura del mismo lunes iría pisando
 * la anterior con cifras distintas. Se cierra siempre el periodo anterior:
 * la semana pasada (lunes a domingo) o el mes pasado completo.
 */
export function lastClosedPeriod(
  period: SnapshotPeriod,
  now: Date = new Date(),
): PeriodBounds {
  if (period === "monthly") {
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(firstOfThisMonth.getTime() - 86_400_000);
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { start: isoDay(start), end: isoDay(end) };
  }
  // Lunes de esta semana; el domingo anterior cierra la semana pasada.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = today.getDay() || 7; // domingo = 7, no 0
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - weekday + 1);
  const end = new Date(thisMonday.getTime() - 86_400_000);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { start: isoDay(start), end: isoDay(end) };
}

/** Días que cubre el periodo, para pedirle a las métricas la ventana correcta. */
export function periodDays(bounds: PeriodBounds): number {
  const start = Date.parse(`${bounds.start}T00:00:00`);
  const end = Date.parse(`${bounds.end}T00:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

export type SnapshotRow = {
  id: string;
  period_start: string;
  period_end: string;
  net_sales: number | null;
  roas: number | null;
  net_profit: number | null;
};

/**
 * Variación de cada snapshot contra el inmediatamente anterior **en el tiempo**.
 *
 * El backend devuelve los snapshots en un orden que no está garantizado, y
 * comparar contra "la fila de al lado" en vez de contra el periodo anterior da
 * porcentajes que parecen correctos y no lo son.
 */
export function withDeltas<T extends SnapshotRow>(
  rows: T[],
): Array<T & { salesDelta: number | null }> {
  const byDate = [...rows].sort((a, b) =>
    b.period_start.localeCompare(a.period_start),
  );
  return byDate.map((row, index) => {
    const previous = byDate[index + 1];
    const current = row.net_sales;
    const before = previous?.net_sales;
    const comparable =
      current != null && before != null && before !== 0
        ? ((current - before) / Math.abs(before)) * 100
        : null;
    return { ...row, salesDelta: comparable };
  });
}
