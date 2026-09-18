import { z } from "zod";

export const INTERVENTION_ELIGIBILITY_DISPOSITIONS = [
  "ELIGIBLE_NOW",
  "ELIGIBLE_WITH_CONDITIONS",
  "INSUFFICIENT_EVIDENCE",
  "PREMATURE",
  "BLOCKED_BY_CONSTRAINT",
  "NOT_APPROPRIATE",
] as const;
export type InterventionEligibilityDisposition =
  (typeof INTERVENTION_ELIGIBILITY_DISPOSITIONS)[number];

const triState = z.enum(["TRUE", "FALSE", "UNKNOWN"]);
const refs = z.array(z.string().min(1));

export const interventionEligibilityInputSchema = z.object({
  candidate_id: z.string().min(1),
  priority_problem_refs: refs,
  candidate_problem_refs: refs,
  diagnosis_sufficient: triState,
  causal_coherence: triState,
  evidence_sufficient: triState,
  critical_constraint_clear: triState,
  dependencies_satisfied: triState,
  resource_fit: triState,
  timing_maturity_fit: triState,
  risk_acceptable: triState,
  strategy_aligned: triState,
  interference_clear: triState,
  materiality: triState,
  conditions: refs,
  blockers: refs,
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
});
export type InterventionEligibilityInput = z.input<
  typeof interventionEligibilityInputSchema
>;

export const interventionEligibilityResultSchema = z.object({
  candidate_id: z.string().min(1),
  disposition: z.enum(INTERVENTION_ELIGIBILITY_DISPOSITIONS),
  reason_codes: refs,
  conditions: refs,
  blockers: refs,
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
  selected: z.literal(false),
  deterministic: z.literal(true),
});
export type InterventionEligibilityResult = z.infer<
  typeof interventionEligibilityResultSchema
>;

export const INTERVENTION_ELIGIBILITY_RUN_DISPOSITIONS = [
  "CANDIDATES_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_ELIGIBLE_CANDIDATES",
  "NO_APPLICABLE_CANDIDATES",
] as const;
export type InterventionEligibilityRunDisposition =
  (typeof INTERVENTION_ELIGIBILITY_RUN_DISPOSITIONS)[number];

export const interventionEligibilityRunResultSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  disposition: z.enum(INTERVENTION_ELIGIBILITY_RUN_DISPOSITIONS),
  candidate_evaluations: z.array(interventionEligibilityResultSchema),
  eligible_candidate_ids: refs,
  reason_codes: refs,
  unresolved_unknowns: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  deterministic: z.literal(true),
});
export type InterventionEligibilityRunResult = z.infer<
  typeof interventionEligibilityRunResultSchema
>;

const UNKNOWN_CHECKS = [
  "diagnosis_sufficient",
  "causal_coherence",
  "evidence_sufficient",
  "critical_constraint_clear",
  "dependencies_satisfied",
  "resource_fit",
  "timing_maturity_fit",
  "risk_acceptable",
  "strategy_aligned",
  "interference_clear",
  "materiality",
] as const;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function result(
  input: InterventionEligibilityInput,
  disposition: InterventionEligibilityDisposition,
  reasonCodes: string[],
  unresolvedUnknowns = input.unresolved_unknowns,
): InterventionEligibilityResult {
  return interventionEligibilityResultSchema.parse({
    candidate_id: input.candidate_id,
    disposition,
    reason_codes: unique(reasonCodes),
    conditions: unique(input.conditions),
    blockers: unique(input.blockers),
    unresolved_unknowns: unique(unresolvedUnknowns),
    evidence_refs: unique(input.evidence_refs),
    source_refs: unique(input.source_refs),
    // Eligibility never selects or ranks. That belongs to later F7 blocks.
    selected: false,
    deterministic: true,
  });
}

/**
 * F7.01 pure gate. It filters a candidate against the current decision
 * context; it deliberately does not score, rank, recommend or execute it.
 */
export function evaluateInterventionEligibility(
  raw: InterventionEligibilityInput,
): InterventionEligibilityResult {
  const parsed = interventionEligibilityInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      candidate_id:
        typeof raw?.candidate_id === "string"
          ? raw.candidate_id
          : "invalid-candidate",
      disposition: "INSUFFICIENT_EVIDENCE",
      reason_codes: ["INPUT.SCHEMA_INVALID"],
      conditions: [],
      blockers: [],
      unresolved_unknowns: ["input_schema"],
      evidence_refs: [],
      source_refs: [],
      selected: false,
      deterministic: true,
    };
  }
  const input = parsed.data;

  if (
    input.priority_problem_refs.length > 0 &&
    input.candidate_problem_refs.length > 0 &&
    !input.candidate_problem_refs.some((ref) =>
      input.priority_problem_refs.includes(ref),
    )
  ) {
    return result(input, "NOT_APPROPRIATE", ["PRIORITY_PROBLEM_MISMATCH"]);
  }
  if (input.causal_coherence === "FALSE") {
    return result(input, "NOT_APPROPRIATE", ["CAUSAL_FIT_FAILED"]);
  }
  if (input.critical_constraint_clear === "FALSE") {
    return result(input, "BLOCKED_BY_CONSTRAINT", [
      "CRITICAL_CONSTRAINT_ACTIVE",
    ]);
  }
  if (input.dependencies_satisfied === "FALSE") {
    return result(input, "PREMATURE", ["DEPENDENCY_NOT_SATISFIED"]);
  }

  const unknowns = unique([
    ...input.unresolved_unknowns,
    ...UNKNOWN_CHECKS.filter((key) => input[key] === "UNKNOWN"),
  ]);
  if (unknowns.length > 0) {
    return result(input, "INSUFFICIENT_EVIDENCE", [
      "EVIDENCE_OR_CONTEXT_UNKNOWN",
    ], unknowns);
  }

  const failedChecks = [
    ["resource_fit", input.resource_fit],
    ["timing_maturity_fit", input.timing_maturity_fit],
    ["risk_acceptable", input.risk_acceptable],
    ["strategy_aligned", input.strategy_aligned],
    ["interference_clear", input.interference_clear],
    ["materiality", input.materiality],
  ].filter(([, value]) => value === "FALSE");
  if (failedChecks.length > 0) {
    return result(input, "BLOCKED_BY_CONSTRAINT", [
      "CONTEXT_OR_GUARDRAIL_FAILED",
      ...failedChecks.map(([key]) => `CHECK_FAILED.${key}`),
    ]);
  }

  return result(
    input,
    input.conditions.length > 0
      ? "ELIGIBLE_WITH_CONDITIONS"
      : "ELIGIBLE_NOW",
    input.conditions.length > 0 ? ["CONDITIONS_REQUIRED"] : [],
  );
}

export function evaluateInterventionEligibilitySet(input: {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  candidates: InterventionEligibilityInput[];
  evaluated_at: string;
}): InterventionEligibilityRunResult {
  const evaluations = input.candidates.map(evaluateInterventionEligibility);
  const eligible = evaluations.filter((item) =>
    ["ELIGIBLE_NOW", "ELIGIBLE_WITH_CONDITIONS"].includes(item.disposition),
  );
  const hasValidation = evaluations.some(
    (item) => item.disposition === "INSUFFICIENT_EVIDENCE",
  );
  const disposition: InterventionEligibilityRunDisposition =
    evaluations.length === 0
      ? "NO_APPLICABLE_CANDIDATES"
      : eligible.length > 0
        ? "CANDIDATES_AVAILABLE"
        : hasValidation
          ? "VALIDATION_REQUIRED"
          : "NO_ELIGIBLE_CANDIDATES";
  return interventionEligibilityRunResultSchema.parse({
    context_id: input.context_id,
    business_id: input.business_id,
    decision_cycle_id: input.decision_cycle_id,
    disposition,
    candidate_evaluations: evaluations,
    eligible_candidate_ids: eligible.map((item) => item.candidate_id),
    reason_codes: unique(evaluations.flatMap((item) => item.reason_codes)),
    unresolved_unknowns: unique(
      evaluations.flatMap((item) => item.unresolved_unknowns),
    ),
    source_refs: unique(evaluations.flatMap((item) => item.source_refs)),
    evaluated_at: input.evaluated_at,
    deterministic: true,
  });
}
