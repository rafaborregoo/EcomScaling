type Task = {
  title: string;
  target_offset_days: number;
  priority: "low" | "medium" | "high" | "urgent";
  owner?: "client" | "consultant" | "shared";
  effort_hours?: number | null;
  cadence?: string;
};

type Phase = { milestones: Array<{ name: string; target_offset_days: number; tasks?: Task[] }> };

const priorityWeight = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
const cadenceDays: Record<string, number> = { semanal: 7, quincenal: 14, mensual: 30 };

/** The proposal gives work estimates, but not the team's available hours. */
export function summarizeCaminoOperations(phases: Phase[], windowDays = 14) {
  const tasks = phases.flatMap((phase) => phase.milestones.flatMap((milestone) =>
    (milestone.tasks ?? []).map((task) => ({ ...task, milestone: milestone.name, milestoneDay: milestone.target_offset_days })),
  ));
  const upcoming = tasks.filter((task) => task.target_offset_days <= windowDays)
    .sort((a, b) => a.target_offset_days - b.target_offset_days || priorityWeight[a.priority] - priorityWeight[b.priority]);
  let estimatedHours = 0;
  let withoutEstimate = 0;
  let scheduledOccurrences = 0;
  for (const task of tasks) {
    if (task.target_offset_days > windowDays) continue;
    const step = cadenceDays[task.cadence ?? ""];
    const lastDay = Math.min(windowDays, task.milestoneDay);
    const count = step ? Math.max(1, Math.floor((lastDay - task.target_offset_days) / step) + 1) : 1;
    scheduledOccurrences += count;
    if (typeof task.effort_hours === "number" && Number.isFinite(task.effort_hours)) estimatedHours += task.effort_hours * count;
    else withoutEstimate += count;
  }
  return {
    next: upcoming.slice(0, 3),
    dueTaskCount: upcoming.length,
    scheduledOccurrences,
    estimatedHours: Math.round(estimatedHours * 10) / 10,
    withoutEstimate,
    capacityKnown: false as const,
  };
}
