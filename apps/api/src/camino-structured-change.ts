type Row = Record<string, unknown>;
/** Only explicit supported fields can become executable. Capture before from the reviewed plan. */
export function captureCaminoChange(proposal: Row, plan: Row) {
  const patch = proposal.structured_change as Row | null | undefined;
  if (proposal.change !== "edit" || !patch) return { ...proposal, structured_change: null };
  const field = patch.field;
  let before: unknown;
  if (proposal.target_type === "goal" && field === "target" && typeof patch.value === "number" && Number.isFinite(patch.value)) {
    before = (plan.goal as Row | null)?.target;
  } else if (proposal.target_type === "milestone" && ["name", "description", "target_date"].includes(String(field)) && typeof patch.value === "string") {
    const milestones = ((plan.strategic_plan_phases ?? []) as Row[]).flatMap((p) => (p.strategic_plan_milestones ?? []) as Row[]);
    const milestone = milestones.find((m) => m.id === proposal.target_id && !["completed", "skipped"].includes(String(m.status)));
    if (!milestone || (field === "name" && (!patch.value.trim() || patch.value.length > 255)) || patch.value.length > 2000)
      return { ...proposal, structured_change: null };
    before = milestone[String(field)];
  } else return { ...proposal, structured_change: null };
  if (before === undefined) return { ...proposal, structured_change: null };
  return { ...proposal, structured_change: { field, value: patch.value, before } };
}

const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
export function currentReviewOutput(output: unknown, snapshot: unknown, goal: unknown, measuredAt?: string) {
  if (!output || typeof output !== "object") return null;
  const data = output as Row;
  const fresh = !measuredAt || (Number.isFinite(Date.parse(measuredAt)) && Date.now() - Date.parse(measuredAt) <= 8 * 86_400_000);
  if (fresh && snapshot && canonical(snapshot) === canonical(goal)) return output;
  return { ...data, goal_progress: { status: "insufficient_data", observed_value: null, comparison_value: null,
    expected_value: null, target_value: null, explanation: "La lectura ha caducado, la meta ha cambiado o esta revisión anterior no conserva su criterio. Espera a una nueva medición." } };
}
