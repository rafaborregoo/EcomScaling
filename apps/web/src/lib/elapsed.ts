/**
 * "Cuánto hace" y "está por venir": las dos preguntas que hace cada tira de
 * resumen de módulo (última llamada, sincronización más vieja, tarea más
 * antigua abierta, silencio más largo en un chat).
 *
 * Viven aquí, fuera de los componentes, porque `Date.now()` no es puro y
 * llamarlo directamente en el cuerpo de un render lo marca
 * `react-hooks/purity`. Mismo patrón que `isTaskOverdue` en /tareas.
 */

const DAY_MS = 86_400_000;

/** Días completos transcurridos desde `value`. `null` si no hay fecha válida. */
export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.floor((Date.now() - parsed) / DAY_MS);
}

/** `value` está en el futuro (o es ahora mismo). */
export function isUpcoming(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && parsed >= Date.now();
}

/** `value` ya pasó. */
export function isPast(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && parsed < Date.now();
}

/** `value` cae dentro de los próximos `days` días (incluye lo ya vencido). */
export function isWithinNextDays(
  value: string | null | undefined,
  days: number,
): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && parsed <= Date.now() + days * DAY_MS;
}

/** `value` cae dentro de los últimos `days` días. */
export function isWithinLastDays(
  value: string | null | undefined,
  days: number,
): boolean {
  const elapsed = daysSince(value);
  return elapsed !== null && elapsed >= 0 && elapsed < days;
}

/** Fecha más antigua de la lista, ignorando huecos. ISO ordena bien como texto. */
export function oldest(
  values: Array<string | null | undefined>,
): string | null {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null
  );
}

/** «hace 5 min», «hace 3 h», «hace 2 d». `null` sin fecha válida. */
export function timeAgo(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - parsed) / 60_000));
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}
