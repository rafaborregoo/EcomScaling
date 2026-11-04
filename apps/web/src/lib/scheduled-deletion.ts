// Un solo texto para "cuándo se borra esto": cada pantalla decía "30 días" fijo,
// aunque quedasen dos, o aunque la fecha hubiera pasado hace un mes.

const DAY_MS = 24 * 60 * 60 * 1000;

export function scheduledDeletionLabel(
  scheduledPurgeAt: string | null | undefined,
  now: Date = new Date(),
): string {
  const purgeAt = scheduledPurgeAt ? new Date(scheduledPurgeAt) : null;
  if (!purgeAt || Number.isNaN(purgeAt.getTime())) return "Borrado pendiente";

  const days = Math.ceil((purgeAt.getTime() - now.getTime()) / DAY_MS);
  // La purga pasa de madrugada: una fecha vencida se cumple en la próxima pasada.
  if (days <= 0) return "Se borra esta noche";

  const date = purgeAt.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
  });
  return `Se borra en ${days} ${days === 1 ? "día" : "días"} (${date})`;
}
