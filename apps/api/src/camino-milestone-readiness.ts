export type MilestoneTaskReadiness = { task_id: string; tasks: { title: string; status: string } | null };

// Solo bloquean las tareas abiertas: una ignorada, cancelada o aún propuesta ya
// no se va a hacer y, si contara, el hito no podría cerrarse nunca.
const OPEN_TASK = ["pending", "in_progress", "proposed"];

export function assessMilestoneCompletion(links: MilestoneTaskReadiness[], note: string | undefined) {
  const unfinished = links.filter((link) => !link.tasks || OPEN_TASK.includes(link.tasks.status))
    .map((link) => link.tasks?.title ?? `Tarea ${link.task_id}`);
  const evidence = note?.trim() ?? "";
  return {
    ready: unfinished.length === 0 && evidence.length >= 20 && evidence.length <= 2000,
    unfinished,
    evidence,
    needsEvidence: evidence.length < 20,
    evidenceTooLong: evidence.length > 2000,
  };
}
