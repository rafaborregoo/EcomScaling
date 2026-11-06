import { anchorCaminoMonths, caminoCalendarHorizonDays, caminoCalendarMonthsTouched, type CaminoPlanOutput } from "@e-nora/ai";

/**
 * Applies explicit human edits to a proposal without rewriting the AI output.
 *
 * Las fechas del Camino son de calendario (Black Friday, Navidad, Reyes...): al
 * cambiar el plazo NO se reescalan, porque un hito de Black Friday no puede
 * acabar en enero. Un plazo mas corto deja fuera los hitos que ya no caben; uno
 * mas largo no inventa trabajo, y los meses añadidos quedan sin objetivo hasta
 * replanificar.
 */
export function adjustCaminoProposal(
  proposal: CaminoPlanOutput,
  horizonMonths: number,
  goalTarget: number | null,
  referenceDate = new Date(),
): CaminoPlanOutput {
  const newHorizonDays = caminoCalendarHorizonDays(referenceDate, horizonMonths);
  const checkpointMonths = caminoCalendarMonthsTouched(referenceDate, newHorizonDays);
  const clampDay = (day: number) => Math.min(newHorizonDays, Math.max(1, day));
  // La meta puede ser el mes pico y no el ultimo: al cambiarla se sustituye el
  // punto mensual que la llevaba; si ese mes ya no cabe, el ultimo.
  const goalMonthIndex = (() => {
    const targets = proposal.goal?.monthly_targets ?? [];
    const match = targets.findIndex((checkpoint) => checkpoint.target_value === proposal.goal?.target);
    return match >= 0 && match < checkpointMonths ? match : checkpointMonths - 1;
  })();
  const adjustedGoal = proposal.goal ? {
    ...proposal.goal,
    target: goalTarget,
    target_offset_days: clampDay(proposal.goal.target_offset_days),
    ...(proposal.goal.monthly_targets?.length ? {
      monthly_targets: Array.from({ length: checkpointMonths }, (_, index) => {
        const source = proposal.goal!.monthly_targets![index];
        if (!source) {
          return {
            month: index + 1,
            target_value: null,
            rationale: "Mes añadido al ampliar el plazo: sin objetivo propio. Replanifica el Camino para definirlo.",
          };
        }
        return { ...source, month: index + 1, target_value: index === goalMonthIndex ? goalTarget : source.target_value };
      }),
    } : {}),
  } : null;

  return anchorCaminoMonths({
    ...proposal,
    horizon_months: horizonMonths,
    ...(adjustedGoal ? { goal: adjustedGoal } : {}),
    phases: proposal.phases
      .map((phase) => ({
        ...phase,
        milestones: phase.milestones
          .filter((milestone) => milestone.target_offset_days <= newHorizonDays)
          .map((milestone) => ({
            ...milestone,
            tasks: milestone.tasks.map((task) => ({
              ...task,
              target_offset_days: Math.min(milestone.target_offset_days, task.target_offset_days),
            })),
          })),
      }))
      .filter((phase) => phase.milestones.length > 0),
  }, referenceDate);
}
