import { z } from "zod";

/** F7.11 keeps feasibility contextual; it is not an optimizer or allocator. */
export const CONSTRAINT_RECOMMENDATION_DISPOSITIONS = [
  "CONSTRAINT_RECOMMENDATIONS_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_CONSTRAINT_CANDIDATES",
] as const;
export type ConstraintRecommendationDisposition = (typeof CONSTRAINT_RECOMMENDATION_DISPOSITIONS)[number];

export const CONSTRAINT_RECOMMENDATION_MODES = [
  "PROCEED_WITH_ADAPTATION",
  "REDUCE_SCOPE",
  "REALLOCATE",
  "SUBSTITUTE_MECHANISM",
  "RESEQUENCE",
  "WAIT_PREPARE",
  "BLOCKED_BY_HARD_CONSTRAINT",
  "PROTECT_SUCCESS_CAPACITY",
  "VALIDATE_CONSTRAINT",
] as const;
export type ConstraintRecommendationMode = (typeof CONSTRAINT_RECOMMENDATION_MODES)[number];

export const constraintContextSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  duration: z.string().min(1),
  status: z.string().min(1),
  slack: z.string().min(1),
  granularity: z.string().min(1),
  controllability: z.string().min(1),
  severity: z.string().min(1),
  classification: z.string().min(1),
  evidence: z.array(z.string().min(1)),
  interaction_with: z.array(z.string().min(1)).default([]),
});
export type ConstraintContext = z.input<typeof constraintContextSchema>;

const refs = z.array(z.string().min(1));

export const constraintRecommendationInputSchema = z.object({
  candidate_id: z.string().min(1),
  desired_intervention: z.string().min(1),
  required_resources: refs,
  constraints: z.array(constraintContextSchema),
  binding_constraint: z.string().min(1),
  secondary_constraints: refs,
  latent_constraints: refs,
  expected_outcome: z.string().min(1),
  success_capacity: z.string().min(1),
  business_context: z.string().min(1),
  evidence: refs,
  risk: refs,
  dependencies: refs,
  guardrails: refs,
  current_recommendation: z.string().min(1),
  deferred_action: z.string().min(1),
  activation_trigger: z.string().min(1),
  constraint_effect: z.string().min(1),
  remove_options: refs,
  scope_reduction_options: refs,
  alternative_mechanisms: refs,
  reallocation_options: refs,
  resequencing_options: refs,
  prepare_actions: refs,
  opportunity_cost: refs,
  resource_productivity: refs,
  temporary_workaround: refs,
  resource_substitution: refs,
  cash_path: refs,
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
});
export type ConstraintRecommendationInput = z.input<typeof constraintRecommendationInputSchema>;

export const constraintRecommendationResultSchema = constraintRecommendationInputSchema.extend({
  feasibility_disposition: z.enum(["FEASIBLE", "FEASIBLE_WITH_ADAPTATION", "WAIT", "BLOCKED", "VALIDATION_REQUIRED"]),
  recommended_mode: z.enum(CONSTRAINT_RECOMMENDATION_MODES),
  constraint_response: z.enum(["remove", "reduce", "replace", "reallocate", "resequence", "delay", "protect", "validate", "none"]),
  timing_fit: z.enum(["NOW", "LATER", "VALIDATION_REQUIRED"]),
  best_feasible_recommendation: z.string().min(1),
  critical_constraint: z.string().min(1),
  minimum_viable_intervention: z.string().nullable(),
  alternative_mechanism: z.string().nullable(),
  enabling_recommendation: z.string().nullable(),
  deferred_action: z.string().min(1),
  activation_trigger: z.string().min(1),
  expected_outcome_adjustment: z.string().min(1),
  feasibility_confidence: z.string().min(1),
  next_constraint_to_monitor: z.string().min(1),
  rationale: refs,
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type ConstraintRecommendationResult = z.infer<typeof constraintRecommendationResultSchema>;

export const constraintRecommendationRunResultSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  disposition: z.enum(CONSTRAINT_RECOMMENDATION_DISPOSITIONS),
  candidate_evaluations: z.array(constraintRecommendationResultSchema),
  primary_priority_candidate_id: z.string().min(1).nullable(),
  reason_codes: refs,
  unresolved_unknowns: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type ConstraintRecommendationRunResult = z.infer<typeof constraintRecommendationRunResultSchema>;

const unique = (values: string[]) => [...new Set(values)];
const normalize = (value: string) => value.trim().toUpperCase();
const isUnknown = (value: string) => ["", "UNKNOWN", "UNAVAILABLE", "UNASSESSED", "NOT_DECLARED"].includes(normalize(value));
const first = (values: string[]) => values[0] ?? null;

function fallback(raw: Partial<ConstraintRecommendationInput>, reasons: string[], unknowns: string[]) {
  const input = {
    candidate_id: typeof raw.candidate_id === "string" ? raw.candidate_id : "invalid-candidate",
    desired_intervention: typeof raw.desired_intervention === "string" ? raw.desired_intervention : "intervention not declared",
  };
  return constraintRecommendationResultSchema.parse({
    ...input,
    required_resources: [], constraints: [], binding_constraint: "UNKNOWN", secondary_constraints: [], latent_constraints: [],
    expected_outcome: "UNKNOWN", success_capacity: "UNKNOWN", business_context: "UNKNOWN", evidence: [], risk: [], dependencies: [], guardrails: [],
    current_recommendation: "Validar las restricciones antes de recomendar una intervención",
    deferred_action: "UNKNOWN", activation_trigger: "UNKNOWN", constraint_effect: "UNKNOWN",
    remove_options: [], scope_reduction_options: [], alternative_mechanisms: [], reallocation_options: [], resequencing_options: [], prepare_actions: [], opportunity_cost: [], resource_productivity: [], temporary_workaround: [], resource_substitution: [], cash_path: [],
    unresolved_unknowns: unique([...unknowns, "constraint_context"]), evidence_refs: [], source_refs: [],
    feasibility_disposition: "VALIDATION_REQUIRED", recommended_mode: "VALIDATE_CONSTRAINT", constraint_response: "validate", timing_fit: "VALIDATION_REQUIRED",
    best_feasible_recommendation: "Validar las restricciones antes de recomendar una intervención", critical_constraint: "UNKNOWN", minimum_viable_intervention: null, alternative_mechanism: null, enabling_recommendation: null,
    expected_outcome_adjustment: "UNKNOWN", feasibility_confidence: "LOW", next_constraint_to_monitor: "UNKNOWN", rationale: unique(reasons), execution_authorized: false, deterministic: true,
  });
}

export function evaluateConstraintRecommendation(raw: ConstraintRecommendationInput): ConstraintRecommendationResult {
  const parsed = constraintRecommendationInputSchema.safeParse(raw);
  if (!parsed.success) return fallback(raw as Partial<ConstraintRecommendationInput>, ["CONSTRAINT.INPUT_SCHEMA_INVALID"], ["input_schema"]);
  const input = parsed.data;
  const rationale: string[] = [];
  const unknowns = [...input.unresolved_unknowns];
  const binding = input.constraints.find((item) => item.name.toLowerCase() === input.binding_constraint.toLowerCase()) ?? null;
  const noMaterialConstraint = input.constraints.length === 0 && ["NONE", "NO CONSTRAINT", "NO MATERIAL CONSTRAINT"].includes(normalize(input.binding_constraint));
  const vagueBinding = !noMaterialConstraint && (isUnknown(input.binding_constraint) || !binding || binding.evidence.length === 0 || ["resources", "capacity", "constraint"].includes(input.binding_constraint.toLowerCase()));
  if (vagueBinding) { rationale.push("CONSTRAINT.BINDING_REQUIRES_VALIDATION"); unknowns.push("binding_constraint"); }
  if (input.evidence.length === 0) { rationale.push("CONSTRAINT.EVIDENCE_MISSING"); unknowns.push("evidence"); }

  const hardBlocked = binding !== null && normalize(binding.type) === "HARD" && ["BLOCKED", "ACTIVE_BLOCK", "NOT_AVAILABLE"].includes(normalize(binding.status));
  const successNotReady = ["NOT_READY", "BLOCKED", "INSUFFICIENT", "NO"].includes(normalize(input.success_capacity));
  const hasTemporaryConstraint = binding !== null && ["TEMPORARY", "SHORT_TERM", "WINDOW"].includes(normalize(binding.duration));
  const expected = input.expected_outcome;
  let mode: ConstraintRecommendationMode = "PROCEED_WITH_ADAPTATION";
  let disposition: "FEASIBLE" | "FEASIBLE_WITH_ADAPTATION" | "WAIT" | "BLOCKED" | "VALIDATION_REQUIRED" = "FEASIBLE";
  let response: "remove" | "reduce" | "replace" | "reallocate" | "resequence" | "delay" | "protect" | "validate" | "none" = "none";
  let timing: "NOW" | "LATER" | "VALIDATION_REQUIRED" = "NOW";
  let best = input.current_recommendation;
  let minimum: string | null = null;
  let alternative: string | null = null;
  let enabling: string | null = null;
  let outcomeAdjustment = expected;

  if (vagueBinding || input.constraints.some((item) => item.evidence.length === 0)) {
    mode = "VALIDATE_CONSTRAINT"; disposition = "VALIDATION_REQUIRED"; timing = "VALIDATION_REQUIRED"; response = "validate";
    best = "Validar qué recurso o condición limita realmente la intervención";
    rationale.push("CONSTRAINT.DO_NOT_ACCEPT_VAGUE_SCARCITY");
  } else if (hardBlocked) {
    mode = "BLOCKED_BY_HARD_CONSTRAINT"; disposition = "BLOCKED"; timing = "LATER"; response = "delay";
    best = input.prepare_actions[0] ?? "Preparar la intervención sin ejecutarla todavía";
    enabling = input.remove_options[0] ?? input.prepare_actions[0] ?? null;
    rationale.push("CONSTRAINT.HARD_BLOCKS_NOW");
  } else if (successNotReady) {
    mode = "PROTECT_SUCCESS_CAPACITY"; disposition = input.scope_reduction_options.length ? "FEASIBLE_WITH_ADAPTATION" : "WAIT"; timing = "LATER"; response = input.scope_reduction_options.length ? "reduce" : "protect";
    minimum = first(input.scope_reduction_options); best = minimum ?? input.prepare_actions[0] ?? "Proteger capacidad de éxito antes de ampliar la demanda";
    outcomeAdjustment = minimum ? `Outcome ajustado al alcance: ${minimum}` : "No ampliar hasta que el sistema pueda absorber el resultado";
    rationale.push("CONSTRAINT.SUCCESS_CAPACITY_NOT_READY");
  } else if (input.reallocation_options.length > 0) {
    mode = "REALLOCATE"; disposition = "FEASIBLE_WITH_ADAPTATION"; response = "reallocate"; enabling = input.reallocation_options[0] ?? null; best = enabling ?? best; rationale.push("CONSTRAINT.REALLOCATE_BEFORE_ADDING_CAPACITY");
  } else if (input.scope_reduction_options.length > 0) {
    mode = "REDUCE_SCOPE"; disposition = "FEASIBLE_WITH_ADAPTATION"; response = "reduce"; minimum = input.scope_reduction_options[0] ?? null; best = minimum ?? best; outcomeAdjustment = `Outcome ajustado al alcance: ${minimum}`; rationale.push("CONSTRAINT.MINIMUM_VIABLE_INTERVENTION");
  } else if (input.alternative_mechanisms.length > 0) {
    mode = "SUBSTITUTE_MECHANISM"; disposition = "FEASIBLE_WITH_ADAPTATION"; response = "replace"; alternative = input.alternative_mechanisms[0] ?? null; best = alternative ?? best; rationale.push("CONSTRAINT.PRESERVE_CAUSAL_MECHANISM");
  } else if (input.resequencing_options.length > 0) {
    mode = "RESEQUENCE"; disposition = "FEASIBLE_WITH_ADAPTATION"; response = "resequence"; best = input.resequencing_options[0] ?? best; rationale.push("CONSTRAINT.RESEQUENCE");
  } else if (hasTemporaryConstraint || input.prepare_actions.length > 0) {
    mode = "WAIT_PREPARE"; disposition = "WAIT"; timing = "LATER"; response = "delay"; best = input.prepare_actions[0] ?? best; rationale.push("CONSTRAINT.WAIT_WITH_PREPARATION");
  } else {
    rationale.push("CONSTRAINT.FEASIBLE_AS_DECLARED");
  }

  const next = input.secondary_constraints[0] ?? input.latent_constraints[0] ?? "No next constraint declared";
  return constraintRecommendationResultSchema.parse({
    ...input, feasibility_disposition: disposition, recommended_mode: mode, constraint_response: response, timing_fit: timing,
    best_feasible_recommendation: best, critical_constraint: input.binding_constraint, minimum_viable_intervention: minimum,
    alternative_mechanism: alternative, enabling_recommendation: enabling, expected_outcome_adjustment: outcomeAdjustment,
    feasibility_confidence: unknowns.length ? "LOWER_CONFIDENCE" : "CONTEXT_SUPPORTED", next_constraint_to_monitor: next,
    unresolved_unknowns: unique(unknowns), rationale: unique(rationale), execution_authorized: false, deterministic: true,
  });
}

export function evaluateConstraintRecommendationSet(input: { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; candidates: ConstraintRecommendationInput[]; evaluated_at: string }): ConstraintRecommendationRunResult {
  const evaluations = input.candidates.map(evaluateConstraintRecommendation);
  const available = evaluations.some((item) => item.feasibility_disposition !== "VALIDATION_REQUIRED");
  return constraintRecommendationRunResultSchema.parse({
    context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id,
    disposition: evaluations.length === 0 ? "NO_CONSTRAINT_CANDIDATES" : available ? "CONSTRAINT_RECOMMENDATIONS_AVAILABLE" : "VALIDATION_REQUIRED",
    candidate_evaluations: evaluations, primary_priority_candidate_id: input.primary_priority_candidate_id,
    reason_codes: unique(evaluations.flatMap((item) => item.rationale)), unresolved_unknowns: unique(evaluations.flatMap((item) => item.unresolved_unknowns)), source_refs: unique(evaluations.flatMap((item) => item.source_refs)), evaluated_at: input.evaluated_at, execution_authorized: false, deterministic: true,
  });
}
