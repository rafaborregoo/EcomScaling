export type MilestoneTaskReadiness = { task_id: string; tasks: { title: string; status: string } | null };

export function assessMilestoneCompletion(links: MilestoneTaskReadiness[], note: string | undefined) {
  const unfinished = links.filter((link) => link.tasks?.status !== "completed")
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
