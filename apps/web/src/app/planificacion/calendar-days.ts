/**
 * Claves de día del calendario, en hora LOCAL.
 *
 * El calendario pintaba las celdas con `startOfDay(fecha).toISOString()` y
 * colocaba los items con `starts_at.slice(0, 10)`. La primera convierte a UTC:
 * la medianoche local del 6 de septiembre en España son las 22:00 del día 5,
 * así que la celda rotulada "dom 6" tenía la clave "2026-09-05" y una acción
 * del día 6 caía en la celda del 7.
 *
 * Es decir: en cualquier huso al este de Greenwich, TODAS las acciones se
 * pintaban un día tarde. Y no había forma de notarlo salvo contar los días a
 * mano, porque el calendario se ve perfectamente normal.
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** Día local de una fecha, como `YYYY-MM-DD`. */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Día local en el que cae un instante ISO. Tiene que casar con `localDayKey`. */
export function itemDayKey(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : localDayKey(parsed);
}

/**
 * Agrupa acciones por el día local en el que caen. Una sola pasada: el
 * calendario lo llamaba dentro del render por cada celda.
 */
export function groupByLocalDay<T extends { starts_at: string }>(
  items: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = itemDayKey(item.starts_at);
    if (!key) continue;
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}
