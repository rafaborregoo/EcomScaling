import { z } from "zod";

/** F8.03: transforma una recomendación en un plan verificable, nunca en una ejecución. */
export const EXECUTION_PLAN_STATUSES = ["DRAFT", "READY", "READY_WITH_APPROVAL", "BLOCKED", "INVALID"] as const;
export const EXECUTION_ACTION_STATUSES = ["PLANNED", "READY", "BLOCKED", "WAITING", "COMPLETED", "SKIPPED"] as const;
export const EXECUTION_DEPENDENCY_TYPES = ["HARD", "SOFT", "EXTERNAL", "TEMPORAL"] as const;
export const EXECUTION_PLAN_MODES = ["STATIC", "ADAPTIVE", "HYBRID"] as const;
export const EXECUTION_CHECKPOINT_KINDS = ["TECHNICAL", "BUSINESS", "HUMAN"] as const;

const text = z.string().min(1);
const refs = z.array(text);
const actionSchema = z.object({
  id: text, title: text, target: text, change: text, expected_result: text, rationale: text, owner: text,
  current_state: text, desired_state: text, status: z.enum(EXECUTION_ACTION_STATUSES), reversible: z.boolean(), requires_approval: z.boolean(),
});

export const executionPlanInputSchema = z.object({
  context_id: text, business_id: text, decision_cycle_id: text, recommendation_id: text,
  execution_intent: text, objective: text,
  scope: z.object({ in_scope: refs, out_of_scope: refs, constraints: refs }),
  actions: z.array(actionSchema).min(1),
  dependencies: z.array(z.object({ from_action_id: text, to_action_id: text, type: z.enum(EXECUTION_DEPENDENCY_TYPES), reason: text })),
  preconditions: refs, postconditions: refs, invariants: refs,
  checkpoints: z.array(z.object({ id: text, kind: z.enum(EXECUTION_CHECKPOINT_KINDS), description: text, required: z.boolean() })),
  milestones: z.array(z.object({ id: text, action_ids: z.array(text), description: text })),
  rollout: z.object({ mode: z.enum(EXECUTION_PLAN_MODES), phases: refs, shadow: z.boolean(), canary: z.boolean() }),
  temporal_controls: z.object({ observation_window: text, cooldown: text, cadence: text, execution_window: text, maintenance_window: text }),
  budgets: z.object({ max_actions: z.number().int().positive(), max_changes: z.number().int().nonnegative(), max_retries: z.number().int().nonnegative(), max_loss: text }),
  success_criteria: refs, failure_criteria: refs, stop_criteria: refs, hold_criteria: refs, continue_criteria: refs, scale_criteria: refs, rollback_criteria: refs,
  mode: z.enum(EXECUTION_PLAN_MODES), environment: z.enum(["TEST", "STAGING", "PRODUCTION", "UNKNOWN"]),
  approval: z.object({ required: z.boolean(), status: z.enum(["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"]), approved_scope: text.nullable() }),
  source_refs: refs, unresolved_unknowns: refs,
});
export type ExecutionPlanInput = z.input<typeof executionPlanInputSchema>;

export const executionPlanResultSchema = z.object({
  context_id: text, business_id: text, decision_cycle_id: text, recommendation_id: text, plan_version: z.number().int().positive(),
  plan_status: z.enum(EXECUTION_PLAN_STATUSES), execution_intent: text, objective: text,
  ordered_action_ids: z.array(text), parallel_groups: z.array(z.array(text)), critical_path: z.array(text), bottlenecks: refs,
  validation: z.object({ coherence: z.enum(["PASS", "FAIL"]), completeness: z.enum(["PASS", "FAIL"]), dependencies: z.enum(["PASS", "FAIL"]), authorization: z.enum(["PASS", "REQUIRED", "FAIL"]), approval: z.enum(["PASS", "REQUIRED", "FAIL"]), rollback: z.enum(["PASS", "FAIL"]), readiness: z.enum(["PASS", "BLOCKED"]) }),
  blockers: refs, warnings: refs, unresolved_unknowns: refs, source_refs: refs,
  execution_authorized: z.literal(false), evaluated_at: z.string().datetime(), deterministic: z.literal(true),
});
export type ExecutionPlanResult = z.infer<typeof executionPlanResultSchema>;

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function fallback(raw: Partial<ExecutionPlanInput>, evaluatedAt: string): ExecutionPlanResult {
  return executionPlanResultSchema.parse({ context_id: typeof raw.context_id === "string" ? raw.context_id : "invalid-context", business_id: typeof raw.business_id === "string" ? raw.business_id : "invalid-business", decision_cycle_id: typeof raw.decision_cycle_id === "string" ? raw.decision_cycle_id : "invalid-cycle", recommendation_id: typeof raw.recommendation_id === "string" ? raw.recommendation_id : "unknown-recommendation", plan_version: 1, plan_status: "INVALID", execution_intent: typeof raw.execution_intent === "string" ? raw.execution_intent : "UNKNOWN", objective: typeof raw.objective === "string" ? raw.objective : "UNKNOWN", ordered_action_ids: [], parallel_groups: [], critical_path: [], bottlenecks: [], validation: { coherence: "FAIL", completeness: "FAIL", dependencies: "FAIL", authorization: "FAIL", approval: "FAIL", rollback: "FAIL", readiness: "BLOCKED" }, blockers: ["input_schema"], warnings: [], unresolved_unknowns: ["input_schema"], source_refs: Array.isArray(raw.source_refs) ? raw.source_refs.filter((item): item is string => typeof item === "string") : [], execution_authorized: false, evaluated_at: evaluatedAt, deterministic: true });
}

function topological(actions: { id: string }[], dependencies: ExecutionPlanInput["dependencies"]): { ordered: string[]; cycle: boolean; parallel: string[][] } {
  const ids = actions.map((action) => action.id); const incoming = new Map(ids.map((id) => [id, 0])); const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  for (const dependency of dependencies) { incoming.set(dependency.to_action_id, (incoming.get(dependency.to_action_id) ?? 0) + 1); outgoing.get(dependency.from_action_id)?.push(dependency.to_action_id); }
  const ordered: string[] = []; const parallel: string[][] = [];
  while (ordered.length < ids.length) { const ready = ids.filter((id) => !ordered.includes(id) && incoming.get(id) === 0); if (!ready.length) return { ordered, cycle: true, parallel }; parallel.push(ready); for (const id of ready) { ordered.push(id); for (const next of outgoing.get(id) ?? []) incoming.set(next, (incoming.get(next) ?? 0) - 1); } }
  return { ordered, cycle: false, parallel };
}

export function evaluateExecutionPlan(raw: ExecutionPlanInput, evaluatedAt = new Date().toISOString()): ExecutionPlanResult {
  const parsed = executionPlanInputSchema.safeParse(raw); if (!parsed.success) return fallback(raw as Partial<ExecutionPlanInput>, evaluatedAt);
  const input = parsed.data; const ids = input.actions.map((action) => action.id); const blockers: string[] = []; const warnings: string[] = [];
  if (new Set(ids).size !== ids.length) blockers.push("duplicate_action_id");
  const idSet = new Set(ids); if (input.dependencies.some((dependency) => !idSet.has(dependency.from_action_id) || !idSet.has(dependency.to_action_id))) blockers.push("orphan_dependency");
  const validDependencies = input.dependencies.filter((dependency) => idSet.has(dependency.from_action_id) && idSet.has(dependency.to_action_id)); const graph = topological(input.actions, validDependencies);
  if (graph.cycle) blockers.push("dependency_cycle");
  if (input.actions.length > input.budgets.max_actions) blockers.push("action_budget_exceeded");
  if (input.actions.filter((action) => !action.reversible).length > input.budgets.max_changes) blockers.push("change_budget_exceeded");
  if (input.unresolved_unknowns.length) blockers.push("unresolved_unknowns");
  if (!input.preconditions.length || !input.postconditions.length || !input.invariants.length) blockers.push("missing_control_conditions");
  if (!input.checkpoints.some((checkpoint) => checkpoint.required)) blockers.push("missing_required_checkpoint");
  const materialApproval = input.actions.some((action) => action.requires_approval) || input.approval.required;
  if (materialApproval && input.approval.status === "REJECTED") blockers.push("approval_rejected");
  const approval = materialApproval && input.approval.status !== "APPROVED" ? "REQUIRED" : "PASS";
  if (input.environment === "UNKNOWN") warnings.push("environment_unknown");
  if (!input.rollout.shadow && input.environment === "PRODUCTION") warnings.push("production_without_shadow");
  const structuralBlockers = new Set(["duplicate_action_id", "orphan_dependency", "dependency_cycle"]);
  const status = [...structuralBlockers].some((item) => blockers.includes(item)) ? "INVALID" : blockers.length ? "BLOCKED" : approval === "REQUIRED" ? "READY_WITH_APPROVAL" : "READY";
  const lengthById = new Map<string, number>(); const parentById = new Map<string, string>();
  for (const id of graph.ordered) {
    const predecessors = validDependencies.filter((dependency) => dependency.to_action_id === id).map((dependency) => dependency.from_action_id).filter((predecessor) => lengthById.has(predecessor));
    const predecessor = predecessors.sort((left, right) => (lengthById.get(right) ?? 0) - (lengthById.get(left) ?? 0))[0];
    lengthById.set(id, (predecessor ? lengthById.get(predecessor) ?? 0 : 0) + 1); if (predecessor) parentById.set(id, predecessor);
  }
  const criticalEnd = [...lengthById.entries()].sort((left, right) => right[1] - left[1])[0]?.[0]; const criticalPath: string[] = [];
  for (let current = criticalEnd; current; current = parentById.get(current)) criticalPath.unshift(current);
  const result = { context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, recommendation_id: input.recommendation_id, plan_version: 1, plan_status: status, execution_intent: input.execution_intent, objective: input.objective, ordered_action_ids: graph.ordered, parallel_groups: graph.parallel, critical_path: criticalPath, bottlenecks: unique([...blockers, ...(graph.parallel.length > 1 ? ["dependency_frontier"] : [])]), validation: { coherence: blockers.includes("dependency_cycle") || blockers.includes("duplicate_action_id") ? "FAIL" : "PASS", completeness: blockers.includes("missing_control_conditions") ? "FAIL" : "PASS", dependencies: blockers.some((item) => item === "orphan_dependency" || item === "dependency_cycle") ? "FAIL" : "PASS", authorization: blockers.includes("approval_rejected") ? "FAIL" : approval, approval: blockers.includes("approval_rejected") ? "FAIL" : approval, rollback: input.rollback_criteria.length ? "PASS" : "FAIL", readiness: blockers.length ? "BLOCKED" : "PASS" }, blockers: unique(blockers), warnings: unique(warnings), unresolved_unknowns: unique(input.unresolved_unknowns), source_refs: input.source_refs, execution_authorized: false as const, evaluated_at: evaluatedAt, deterministic: true as const };
  return executionPlanResultSchema.parse(result);
}
