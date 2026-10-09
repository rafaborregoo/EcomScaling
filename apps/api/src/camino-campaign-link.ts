/**
 * Una campaña que entra en el calendario mientras existe un Camino abierto se
 * convierte también en una tarea de ese Camino, colgada del hito que le toca,
 * para que el equipo la vaya completando una a una desde el mapa.
 */

export type LinkableMilestone = { id: string; target_date: string | null; position?: number | null };

/**
 * Hito al que pertenece una fecha: el primero cuya fecha límite es igual o
 * posterior (la campaña ayuda a cerrarlo); si la campaña cae después de todos,
 * el último hito con fecha; sin fechas, el primero.
 */
export function pickMilestoneForDate(milestones: LinkableMilestone[], date: string): string | null {
  if (!milestones.length) return null;
  const dated = milestones
    .filter((milestone): milestone is LinkableMilestone & { target_date: string } => Boolean(milestone.target_date))
    .map((milestone) => ({ id: milestone.id, day: milestone.target_date.slice(0, 10) }))
    .sort((a, b) => a.day.localeCompare(b.day));
  if (!dated.length) return milestones[0]!.id;
  const day = date.slice(0, 10);
  return (dated.find((milestone) => milestone.day >= day) ?? dated.at(-1)!).id;
}
