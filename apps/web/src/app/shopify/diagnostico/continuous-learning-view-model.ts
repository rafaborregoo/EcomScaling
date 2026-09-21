export type ContinuousLearningRun = { block_code?: string; experience_id?: string; status?: string; classification?: string; confidence?: string; gate?: boolean; rationale?: string[]; learning?: string[]; next_evidence_needed?: string[]; unresolved_unknowns?: string[] };
const list = (value: string[] | undefined) => (value ?? []).filter(Boolean);
export function continuousLearningViewModel(runs: ContinuousLearningRun[]) {
  const latest = new Map<string, ContinuousLearningRun>();
  for (const run of runs) if (run.block_code && !latest.has(run.block_code)) latest.set(run.block_code, run);
  const items = [...latest.values()].sort((a, b) => String(a.block_code).localeCompare(String(b.block_code), undefined, { numeric: true }));
  return { items, ready: items.filter((item) => item.gate).length, waiting: items.filter((item) => item.status === "WAITING_FOR_EVIDENCE").length, review: items.filter((item) => item.status === "REVIEW_REQUIRED").length, blocked: items.filter((item) => item.status === "BLOCKED").length, rationale: list(items[0]?.rationale), nextEvidence: list(items[0]?.next_evidence_needed) };
}
export function continuousLearningTone(value: string) { return value === "POSITIVE" || value === "READY" ? "success" as const : ["NEGATIVE", "BLOCKED", "INCONCLUSIVE"].includes(value) ? "warn" as const : "neutral" as const; }
