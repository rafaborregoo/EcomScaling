/**
 * Resuelve a fecha solo una fecha ISO completa dicha explícitamente en la
 * llamada. Los plazos relativos/ambiguos se conservan en metadata y nunca se
 * convierten en una fecha inventada.
 */
export function explicitCallTaskDueAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return date.toISOString();
}

