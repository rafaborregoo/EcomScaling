import type { CaminoPlanOutput } from "@e-nora/ai";

/**
 * Segunda fase del Camino: A19 decide la estrategia (fases, hitos, fechas y un
 * borrador de tareas) y el detallador redacta, hito a hito, la guía de cada
 * tarea con la metodología de E-NORA. Aquí vive la parte pura: qué se le pide
 * por cada hito y cómo se integra lo que devuelve sin romper el plan.
 */

type Milestone = CaminoPlanOutput["phases"][number]["milestones"][number];
export type CaminoTask = Milestone["tasks"][number];

export type DetailTarget = {
  key: string;
  phaseIndex: number;
  milestoneIndex: number;
  phaseName: string;
  milestone: Milestone;
};


export function detailTargets(proposal: CaminoPlanOutput): DetailTarget[] {
  return proposal.phases.flatMap((phase, phaseIndex) =>
    phase.milestones.map((milestone, milestoneIndex) => ({
      key: `${phaseIndex}.${milestoneIndex}`,
      phaseIndex,
      milestoneIndex,
      phaseName: phase.name,
      milestone,
    })),
  );
}

/** Lo que el detallador necesita del plan: el hito en su contexto, no el plan entero. */
export function detailerBrief(proposal: CaminoPlanOutput, target: DetailTarget) {
  return {
    plan: proposal.plan_name,
    horizonte_meses: proposal.horizon_months,
    diagnostico: proposal.diagnosis,
    objetivo: proposal.goal
      ? { metrica: proposal.goal.metric_label, baseline: proposal.goal.baseline, target: proposal.goal.target }
      : null,
    fases: proposal.phases.map((phase) => ({ nombre: phase.name, hitos: phase.milestones.map((milestone) => milestone.name) })),
    fase_actual: target.phaseName,
    hito: {
      nombre: target.milestone.name,
      descripcion: target.milestone.description,
      exito: target.milestone.success_metric,
      por_que_ahora: target.milestone.rationale,
      dia_objetivo: target.milestone.target_offset_days,
      borrador_de_tareas: target.milestone.tasks.map((task) => ({
        titulo: task.title,
        descripcion: task.description,
        dia: task.target_offset_days,
        prioridad: task.priority,
        owner: task.owner,
        kind: task.kind,
        track: task.track,
        cadence: task.cadence,
      })),
    },
  };
}

/**
 * ¿Respeta lo que A19 decidio? El detallador puede fundir pasos de puesta a
 * punto, pero no puede perder una tarea de temporada o de crecimiento, ni una
 * rutina con cadencia: si falta alguna se descarta su resultado y el hito
 * conserva el borrador.
 */
export function keepsDraftCommitments(draft: CaminoTask[], detailed: CaminoTask[]): boolean {
  const count = (tasks: CaminoTask[], test: (task: CaminoTask) => boolean) => tasks.filter(test).length;
  const checks: Array<(task: CaminoTask) => boolean> = [
    (task) => task.track === "temporada",
    (task) => task.track === "crecimiento",
    (task) => task.cadence !== "una_vez",
  ];
  return checks.every((check) => count(detailed, check) >= count(draft, check));
}

/** Ajusta lo devuelto a las reglas del plan: cada tarea dentro del hito. No hay tope de tareas. */
export function fitDetailedTasks(tasks: CaminoTask[], milestone: Milestone): CaminoTask[] {
  return tasks.map((task) => ({
    ...task,
    target_offset_days: Math.max(1, Math.min(milestone.target_offset_days, Math.trunc(task.target_offset_days))),
  }));
}

/**
 * Sustituye las tareas de cada hito que el detallador resolvió. Un hito sin
 * resultado (fallo del modelo, salida inválida o vacía) conserva el borrador
 * de A19: el Camino nunca queda peor que antes de detallarlo.
 */
export function mergeDetailedTasks(
  proposal: CaminoPlanOutput,
  results: ReadonlyMap<string, CaminoTask[] | null>,
): { proposal: CaminoPlanOutput; detailed: number } {
  let detailed = 0;
  const phases = proposal.phases.map((phase, phaseIndex) => ({
    ...phase,
    milestones: phase.milestones.map((milestone, milestoneIndex) => {
      const tasks = results.get(`${phaseIndex}.${milestoneIndex}`);
      // Una tarea que continúa otra conserva su id y su historia: reescribirla los perdería.
      if (!tasks?.length || milestone.tasks.some((task) => task.source_task_id) || !keepsDraftCommitments(milestone.tasks, tasks)) return milestone;
      detailed += 1;
      return { ...milestone, tasks: fitDetailedTasks(tasks, milestone) };
    }),
  }));
  return { proposal: { ...proposal, phases }, detailed };
}
