import type { CaminoPlanOutput } from "@e-nora/ai";

/** Applies explicit human edits to a proposal without rewriting the AI output. */
export function adjustCaminoProposal(
  proposal: CaminoPlanOutput,
  horizonMonths: number,
  goalTarget: number | null,
): CaminoPlanOutput {
  const oldHorizonMonths = proposal.horizon_months ?? Math.max(
    1,
    Math.ceil(Math.max(
      proposal.goal?.target_offset_days ?? 0,
      ...proposal.phases.flatMap((phase) => phase.milestones.map((milestone) => milestone.target_offset_days)),
    ) / 30),
  );
  const newHorizonDays = horizonMonths * 30;
  const scaleDay = (day: number) => Math.min(newHorizonDays, Math.max(1, Math.round(day * horizonMonths / oldHorizonMonths)));

  return {
    ...proposal,
    horizon_months: horizonMonths,
    ...(proposal.goal ? { goal: { ...proposal.goal, target: goalTarget, target_offset_days: scaleDay(proposal.goal.target_offset_days) } } : {}),
    phases: proposal.phases.map((phase) => ({
      ...phase,
      milestones: phase.milestones.map((milestone) => ({
        ...milestone,
        target_offset_days: scaleDay(milestone.target_offset_days),
      })),
    })),
  };
}
