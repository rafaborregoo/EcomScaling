/** Compara el camino vigente con una propuesta nueva de la IA, por nombre de hito. */

export type ComparablePhase = {
  strategic_plan_milestones?: Array<{ name: string; milestone_task_links?: unknown[] }>;
};

export type PlanShape = { phases: number; milestones: string[]; tasks: number };

export type PlanComparison = {
  current: PlanShape;
  proposed: PlanShape;
  kept: string[];
  added: string[];
  removed: string[];
};

const norm = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export function shapeOfPlan(phases: ComparablePhase[]): PlanShape {
  const milestones = phases.flatMap((phase) => phase.strategic_plan_milestones ?? []);
  return {
    phases: phases.length,
    milestones: milestones.map((milestone) => milestone.name),
    tasks: milestones.reduce((sum, milestone) => sum + (milestone.milestone_task_links?.length ?? 0), 0),
  };
}

export function shapeOfProposal(
  phases: Array<{ milestones: Array<{ name: string; tasks?: unknown[] }> }>,
): PlanShape {
  const milestones = phases.flatMap((phase) => phase.milestones);
  return {
    phases: phases.length,
    milestones: milestones.map((milestone) => milestone.name),
    tasks: milestones.reduce((sum, milestone) => sum + (milestone.tasks?.length ?? 0), 0),
  };
}

export function comparePlans(current: PlanShape, proposed: PlanShape): PlanComparison {
  const currentKeys = new Set(current.milestones.map(norm));
  const proposedKeys = new Set(proposed.milestones.map(norm));
  return {
    current,
    proposed,
    kept: proposed.milestones.filter((name) => currentKeys.has(norm(name))),
    added: proposed.milestones.filter((name) => !currentKeys.has(norm(name))),
    removed: current.milestones.filter((name) => !proposedKeys.has(norm(name))),
  };
}
