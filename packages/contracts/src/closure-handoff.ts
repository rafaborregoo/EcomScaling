import { z } from "zod";

/** F8.16: cierre operacional, handoff y resultado observado. */
export const CLOSURE_STATES = ["COMPLETED", "CLOSURE_READY", "CLOSING", "CLOSED"] as const;
export const CLOSURE_VERIFICATION_STATES = ["VERIFIED", "PARTIALLY_VERIFIED", "FAILED", "INCONCLUSIVE", "UNKNOWN"] as const;
export const CLOSURE_OUTCOMES = ["SUCCESS", "PARTIAL_SUCCESS", "FAILED", "ABORTED", "ROLLED_BACK", "INCONCLUSIVE", "NOT_EXECUTED"] as const;
export const CLOSURE_QUALITIES = ["CLEAN", "WITH_RESIDUALS", "DEGRADED", "INCONCLUSIVE"] as const;
export const HANDOFF_STATES = ["NOT_REQUIRED", "REQUESTED", "ACCEPTED", "REJECTED", "FAILED", "COMPLETE"] as const;
export const OUTCOME_MATURITIES = ["EARLY", "MATURE", "INCOMPLETE"] as const;

const text = z.string().min(1);
const refs = z.array(text);

export const closureHandoffInputSchema = z.object({
  organization_id: text,
  intervention_id: text,
  recommendation_id: text,
  output_id: text,
  expected_state: text,
  actual_state: text,
  active_actions: z.number().int().nonnegative(),
  critical_unknown: z.boolean(),
  verification_status: z.enum(CLOSURE_VERIFICATION_STATES),
  open_critical_incident: z.boolean(),
  recovery_active: z.boolean(),
  cleanup_complete: z.boolean(),
  residual_risk_known: z.boolean(),
  residual_risk_accepted: z.boolean(),
  residual_risk_owner: text.nullable(),
  handoff_required: z.boolean(),
  handoff_status: z.enum(HANDOFF_STATES),
  task_summary: z.object({ total: z.number().int().nonnegative(), completed: z.number().int().nonnegative(), active: z.number().int().nonnegative(), blocked: z.number().int().nonnegative() }),
  source_refs: refs,
  known_unknowns: refs,
  close_requested: z.boolean(),
});
export type ClosureHandoffInput = z.input<typeof closureHandoffInputSchema>;

export const closureHandoffResultSchema = z.object({
  organization_id: text,
  intervention_id: text,
  recommendation_id: text,
  output_id: text,
  closure_state: z.enum(CLOSURE_STATES),
  closure_gate: z.boolean(),
  operational_outcome: z.enum(CLOSURE_OUTCOMES),
  verification_status: z.enum(CLOSURE_VERIFICATION_STATES),
  closure_quality: z.enum(CLOSURE_QUALITIES),
  outcome_maturity: z.enum(OUTCOME_MATURITIES),
  final_state_snapshot: z.object({ expected: text, actual: text }),
  handoff_status: z.enum(HANDOFF_STATES),
  blockers: refs,
  unresolved_unknowns: refs,
  learning_package: z.object({ recommendation_id: text, intervention_id: text, expected_state: text, actual_state: text, operational_outcome: z.enum(CLOSURE_OUTCOMES), verification_status: z.enum(CLOSURE_VERIFICATION_STATES), known_unknowns: refs, source_refs: refs }),
  evaluated_at: z.string().datetime({ offset: true }),
  deterministic: z.literal(true),
});
export type ClosureHandoffResult = z.infer<typeof closureHandoffResultSchema>;

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

export function evaluateClosureHandoff(raw: ClosureHandoffInput, evaluatedAt = new Date().toISOString()): ClosureHandoffResult {
  const parsed = closureHandoffInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fallback = raw as Partial<ClosureHandoffInput>;
    return closureHandoffResultSchema.parse({
      organization_id: typeof fallback.organization_id === "string" ? fallback.organization_id : "invalid-organization",
      intervention_id: typeof fallback.intervention_id === "string" ? fallback.intervention_id : "invalid-intervention",
      recommendation_id: typeof fallback.recommendation_id === "string" ? fallback.recommendation_id : "unknown-recommendation",
      output_id: typeof fallback.output_id === "string" ? fallback.output_id : "unknown-output",
      closure_state: "COMPLETED", closure_gate: false, operational_outcome: "INCONCLUSIVE", verification_status: "UNKNOWN", closure_quality: "INCONCLUSIVE", outcome_maturity: "INCOMPLETE",
      final_state_snapshot: { expected: "UNKNOWN", actual: "UNKNOWN" }, handoff_status: "FAILED", blockers: ["input_schema"], unresolved_unknowns: ["input_schema"],
      learning_package: { recommendation_id: "unknown-recommendation", intervention_id: "invalid-intervention", expected_state: "UNKNOWN", actual_state: "UNKNOWN", operational_outcome: "INCONCLUSIVE", verification_status: "UNKNOWN", known_unknowns: ["input_schema"], source_refs: [] }, evaluated_at: evaluatedAt, deterministic: true,
    });
  }
  const input = parsed.data;
  const blockers: string[] = [];
  if (input.active_actions > 0) blockers.push("active_actions");
  if (input.critical_unknown) blockers.push("critical_unknown");
  if (input.verification_status === "UNKNOWN") blockers.push("verification_unknown");
  if (input.open_critical_incident) blockers.push("open_critical_incident");
  if (input.recovery_active) blockers.push("recovery_active");
  if (!input.cleanup_complete) blockers.push("cleanup_incomplete");
  if (!input.residual_risk_known) blockers.push("residual_risk_unknown");
  if (input.residual_risk_known && !input.residual_risk_accepted && input.residual_risk_owner == null) blockers.push("residual_risk_without_owner");
  if (input.handoff_required && !["ACCEPTED", "COMPLETE"].includes(input.handoff_status)) blockers.push("handoff_not_accepted");
  const gate = blockers.length === 0 && input.close_requested;
  const partiallyExecuted = input.task_summary.total > 0 && input.task_summary.completed < input.task_summary.total;
  const operationalOutcome = input.active_actions > 0 ? "INCONCLUSIVE" : input.task_summary.total === 0 ? "NOT_EXECUTED" : input.verification_status === "FAILED" ? "FAILED" : input.verification_status === "PARTIALLY_VERIFIED" || partiallyExecuted ? "PARTIAL_SUCCESS" : input.verification_status === "INCONCLUSIVE" ? "INCONCLUSIVE" : "SUCCESS";
  const quality = blockers.includes("residual_risk_unknown") || input.critical_unknown ? "INCONCLUSIVE" : blockers.length ? "DEGRADED" : input.residual_risk_known && !input.residual_risk_accepted ? "WITH_RESIDUALS" : "CLEAN";
  const closureState = gate ? "CLOSED" : input.close_requested && blockers.length === 0 ? "CLOSURE_READY" : "COMPLETED";
  const unknowns = unique([...input.known_unknowns, ...(!input.residual_risk_known ? ["residual_risk"] : []), ...(input.verification_status === "UNKNOWN" ? ["verification"] : [])]);
  return closureHandoffResultSchema.parse({
    organization_id: input.organization_id, intervention_id: input.intervention_id, recommendation_id: input.recommendation_id, output_id: input.output_id,
    closure_state: closureState, closure_gate: gate, operational_outcome: operationalOutcome, verification_status: input.verification_status, closure_quality: quality,
    outcome_maturity: input.verification_status === "VERIFIED" && gate ? "MATURE" : "INCOMPLETE", final_state_snapshot: { expected: input.expected_state, actual: input.actual_state }, handoff_status: input.handoff_status,
    blockers: unique(blockers), unresolved_unknowns: unknowns, learning_package: { recommendation_id: input.recommendation_id, intervention_id: input.intervention_id, expected_state: input.expected_state, actual_state: input.actual_state, operational_outcome: operationalOutcome, verification_status: input.verification_status, known_unknowns: unknowns, source_refs: input.source_refs }, evaluated_at: evaluatedAt, deterministic: true,
  });
}
