/**
 * Qué falta para activar un camino en borrador.
 *
 * Un borrador se pinta entero, con fases e hitos con fecha, y el cliente cree
 * que su camino ya corre. Esta lista le dice qué hay y qué conviene mirar antes
 * de pulsar «Activar»: no bloquea nada, solo nombra lo que falta.
 */

export type ReadinessMilestone = {
  target_date: string | null;
  milestone_task_links: Array<{ tasks: unknown | null }>;
};

export type ReadinessPhase = {
  strategic_plan_milestones: ReadinessMilestone[];
};

export type DraftReadiness = {
  phases: number;
  milestones: number;
  tasks: number;
  undated: number;
  withoutTasks: number;
  hasGoalTarget: boolean;
};

export function draftReadiness(
  phases: ReadinessPhase[],
  goal: { target: number | null } | null | undefined,
): DraftReadiness {
  const milestones = phases.flatMap((phase) => phase.strategic_plan_milestones);
  const taskCount = (milestone: ReadinessMilestone) =>
    milestone.milestone_task_links.filter((link) => link.tasks).length;
  return {
    phases: phases.length,
    milestones: milestones.length,
    tasks: milestones.reduce((sum, milestone) => sum + taskCount(milestone), 0),
    undated: milestones.filter((milestone) => !milestone.target_date).length,
    withoutTasks: milestones.filter((milestone) => taskCount(milestone) === 0).length,
    hasGoalTarget: goal?.target != null,
  };
}
