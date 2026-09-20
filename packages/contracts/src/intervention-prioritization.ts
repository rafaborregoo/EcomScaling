import { z } from "zod";

export const INTERVENTION_PRIORITY_LEVELS = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
export type InterventionPriorityLevel = (typeof INTERVENTION_PRIORITY_LEVELS)[number];
export const INTERVENTION_PRIORITY_TIERS = ["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"] as const;
export type InterventionPriorityTier = (typeof INTERVENTION_PRIORITY_TIERS)[number];
export const INTERVENTION_PRIORITIZATION_DISPOSITIONS = [
  "PRIORITY_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_PRIORIZABLE_CANDIDATES",
] as const;
export type InterventionPrioritizationDisposition =
  (typeof INTERVENTION_PRIORITIZATION_DISPOSITIONS)[number];

const refs = z.array(z.string().min(1));
const level = z.enum(INTERVENTION_PRIORITY_LEVELS);
const triState = z.enum(["TRUE", "FALSE", "UNKNOWN"]);

export const interventionPrioritizationInputSchema = z.object({
  candidate_id: z.string().min(1),
  matched_disposition: z.enum(["MATCHED", "INSUFFICIENT_EVIDENCE", "NO_CAUSAL_MATCH"]),
  eligibility_disposition: z.enum([
    "ELIGIBLE_NOW",
    "ELIGIBLE_WITH_CONDITIONS",
    "INSUFFICIENT_EVIDENCE",
    "PREMATURE",
    "BLOCKED_BY_CONSTRAINT",
    "NOT_APPROPRIATE",
  ]),
  bottleneck_relation: z.enum(["BOTTLENECK", "ROOT_CAUSE", "SYMPTOM", "SECONDARY", "UNKNOWN"]),
  active_damage: triState,
  expected_impact: level,
  evidence_quality: level,
  urgency: level,
  time_to_value: z.enum(["FAST", "MEDIUM", "SLOW", "UNKNOWN"]),
  effort: level,
  risk: level,
  reversibility: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  dependency_status: z.enum(["READY", "BLOCKED", "UNKNOWN"]),
  learning_value: level,
  resource_fit: triState,
  guardrail_status: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  strategic_fit: level,
  intervention_state: z.enum(["IDEA", "TEST", "VALIDATED", "SCALED", "FAILING", "UNKNOWN"]),
  problem_refs: refs,
  dependency_refs: refs,
  conditions: refs,
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
});
export type InterventionPrioritizationInput = z.input<typeof interventionPrioritizationInputSchema>;

export const interventionPrioritizationResultSchema = z.object({
  candidate_id: z.string().min(1),
  priority_tier: z.enum(INTERVENTION_PRIORITY_TIERS).optional(),
  reason_codes: refs,
  conditions: refs,
  dependency_refs: refs,
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type InterventionPrioritizationResult = z.infer<typeof interventionPrioritizationResultSchema>;

export const interventionPrioritizationRunResultSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  disposition: z.enum(INTERVENTION_PRIORITIZATION_DISPOSITIONS),
  candidate_evaluations: z.array(interventionPrioritizationResultSchema),
  primary_priority_candidate_id: z.string().min(1).nullable(),
  ordered_candidate_ids: refs,
  reason_codes: refs,
  unresolved_unknowns: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type InterventionPrioritizationRunResult = z.infer<typeof interventionPrioritizationRunResultSchema>;

const COMPARISON_FIELDS = [
  "bottleneck_relation",
  "active_damage",
  "expected_impact",
  "evidence_quality",
  "urgency",
  "time_to_value",
  "effort",
  "risk",
  "reversibility",
  "dependency_status",
  "resource_fit",
  "guardrail_status",
  "strategic_fit",
] as const;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function result(
  input: InterventionPrioritizationInput,
  tier: InterventionPriorityTier | undefined,
  reasonCodes: string[],
  unresolvedUnknowns = input.unresolved_unknowns,
): InterventionPrioritizationResult {
  return interventionPrioritizationResultSchema.parse({
    candidate_id: input.candidate_id,
    ...(tier ? { priority_tier: tier } : {}),
    reason_codes: unique(reasonCodes),
    conditions: unique(input.conditions),
    dependency_refs: unique(input.dependency_refs),
    unresolved_unknowns: unique(unresolvedUnknowns),
    evidence_refs: unique(input.evidence_refs),
    source_refs: unique(input.source_refs),
    execution_authorized: false,
    deterministic: true,
  });
}

function isPrioritizable(input: InterventionPrioritizationInput): boolean {
  return input.matched_disposition === "MATCHED" &&
    ["ELIGIBLE_NOW", "ELIGIBLE_WITH_CONDITIONS"].includes(input.eligibility_disposition);
}

function unknowns(input: InterventionPrioritizationInput): string[] {
  const values = COMPARISON_FIELDS.filter((field) =>
    input[field] === "UNKNOWN" || input[field] === undefined,
  ).map((field) => `${input.candidate_id}:${field}`);
  return unique([...input.unresolved_unknowns, ...values]);
}

function ordinal(value: string, order: readonly string[]): number {
  return order.indexOf(value);
}

const HIGH_FIRST = ["LOW", "MEDIUM", "HIGH"] as const;
const LOW_FIRST = ["HIGH", "MEDIUM", "LOW"] as const;
const RELATION_FIRST = ["SYMPTOM", "SECONDARY", "ROOT_CAUSE", "BOTTLENECK"] as const;
const SPEED_FIRST = ["SLOW", "MEDIUM", "FAST"] as const;

function comparisonValue(
  input: InterventionPrioritizationInput,
  field: typeof COMPARISON_FIELDS[number],
): number | null {
  if (input[field] === "UNKNOWN") return null;
  if (field === "bottleneck_relation") return ordinal(input[field], RELATION_FIRST);
  if (field === "time_to_value") return ordinal(input[field], SPEED_FIRST);
  if (field === "active_damage") return input[field] === "TRUE" ? 1 : 0;
  if (field === "resource_fit") return input[field] === "TRUE" ? 1 : 0;
  if (field === "guardrail_status") return input[field] === "PASS" ? 1 : 0;
  if (field === "dependency_status") return input[field] === "READY" ? 1 : 0;
  if (field === "effort" || field === "risk") return ordinal(input[field], LOW_FIRST);
  return ordinal(input[field], HIGH_FIRST);
}

function dominates(left: InterventionPrioritizationInput, right: InterventionPrioritizationInput): boolean {
  let strictlyBetter = false;
  for (const field of COMPARISON_FIELDS) {
    const a = comparisonValue(left, field);
    const b = comparisonValue(right, field);
    if (a === null || b === null || a < b) return false;
    if (a > b) strictlyBetter = true;
  }
  return strictlyBetter;
}

/**
 * F7.03 qualitative comparison. It can expose one primary priority only when
 * a candidate dominates the other eligible matches. No numeric score or
 * execution permission is created; a trade-off remains VALIDATION_REQUIRED.
 */
export function evaluateInterventionPrioritizationSet(input: {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  candidates: InterventionPrioritizationInput[];
  evaluated_at: string;
}): InterventionPrioritizationRunResult {
  const parsedCandidates = input.candidates.map((raw) => {
    const parsed = interventionPrioritizationInputSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  });
  if (parsedCandidates.some((candidate) => candidate === null)) {
    return interventionPrioritizationRunResultSchema.parse({
      context_id: input.context_id,
      business_id: input.business_id,
      decision_cycle_id: input.decision_cycle_id,
      disposition: "VALIDATION_REQUIRED",
      candidate_evaluations: [],
      primary_priority_candidate_id: null,
      ordered_candidate_ids: [],
      reason_codes: ["INPUT.SCHEMA_INVALID", "PRIORITY.ABSTAINED"],
      unresolved_unknowns: ["input_schema"],
      source_refs: [],
      evaluated_at: input.evaluated_at,
      execution_authorized: false,
      deterministic: true,
    });
  }
  const candidates = parsedCandidates as InterventionPrioritizationInput[];
  const evaluations = candidates.map((candidate) => {
    if (candidate.guardrail_status === "FAIL") return result(candidate, "DO_NOT_DO", ["GUARDRAIL.CRITICAL_FAIL"]);
    if (!isPrioritizable(candidate)) return result(candidate, "DO_NOT_DO", ["UPSTREAM.NOT_PRIORIZABLE"]);
    if (candidate.dependency_status === "BLOCKED") return result(candidate, "LATER", ["DEPENDENCY.BLOCKED"]);
    const unresolved = unknowns(candidate);
    return unresolved.length
      ? result(candidate, undefined, ["EVIDENCE.OR_CONTEXT_UNKNOWN"], unresolved)
      : result(candidate, undefined, ["PRIORITY.READY_FOR_COMPARISON"]);
  });
  const eligible = candidates.filter((candidate) => isPrioritizable(candidate) && candidate.guardrail_status === "PASS" && candidate.dependency_status === "READY");
  const complete = eligible.filter((candidate) => unknowns(candidate).length === 0);
  const unresolved = unique(evaluations.flatMap((evaluation) => evaluation.unresolved_unknowns));
  const sourceRefs = unique(evaluations.flatMap((evaluation) => evaluation.source_refs));

  if (candidates.some((candidate) => candidate.guardrail_status === "FAIL")) {
    return interventionPrioritizationRunResultSchema.parse({
      context_id: input.context_id,
      business_id: input.business_id,
      decision_cycle_id: input.decision_cycle_id,
      disposition: "PRIORITY_AVAILABLE",
      candidate_evaluations: evaluations,
      primary_priority_candidate_id: null,
      ordered_candidate_ids: [],
      reason_codes: ["GUARDRAIL.CRITICAL_FAIL", "PRIORITY.NO_AUTHORIZED_PRIMARY"],
      unresolved_unknowns: unresolved,
      source_refs: sourceRefs,
      evaluated_at: input.evaluated_at,
      execution_authorized: false,
      deterministic: true,
    });
  }
  if (eligible.length === 0) {
    return interventionPrioritizationRunResultSchema.parse({
      context_id: input.context_id,
      business_id: input.business_id,
      decision_cycle_id: input.decision_cycle_id,
      disposition: "NO_PRIORIZABLE_CANDIDATES",
      candidate_evaluations: evaluations,
      primary_priority_candidate_id: null,
      ordered_candidate_ids: [],
      reason_codes: unique([...evaluations.flatMap((evaluation) => evaluation.reason_codes), "PRIORITY.NO_PRIORIZABLE_CANDIDATES"]),
      unresolved_unknowns: unresolved,
      source_refs: sourceRefs,
      evaluated_at: input.evaluated_at,
      execution_authorized: false,
      deterministic: true,
    });
  }
  if (complete.length !== eligible.length) {
    return interventionPrioritizationRunResultSchema.parse({
      context_id: input.context_id,
      business_id: input.business_id,
      decision_cycle_id: input.decision_cycle_id,
      disposition: "VALIDATION_REQUIRED",
      candidate_evaluations: evaluations,
      primary_priority_candidate_id: null,
      ordered_candidate_ids: [],
      reason_codes: unique([...evaluations.flatMap((evaluation) => evaluation.reason_codes), "PRIORITY.UNKNOWN_BLOCKS_COMPARISON", "PRIORITY.ABSTAINED"]),
      unresolved_unknowns: unresolved,
      source_refs: sourceRefs,
      evaluated_at: input.evaluated_at,
      execution_authorized: false,
      deterministic: true,
    });
  }
  const winner = complete.find((candidate) => complete.every((other) => candidate === other || dominates(candidate, other))) ??
    (complete.length === 1 ? complete[0] : undefined);
  if (!winner) {
    return interventionPrioritizationRunResultSchema.parse({
      context_id: input.context_id,
      business_id: input.business_id,
      decision_cycle_id: input.decision_cycle_id,
      disposition: "VALIDATION_REQUIRED",
      candidate_evaluations: evaluations,
      primary_priority_candidate_id: null,
      ordered_candidate_ids: [],
      reason_codes: ["PRIORITY.TRADE_OFF_UNRESOLVED", "PRIORITY.ABSTAINED"],
      unresolved_unknowns: unresolved,
      source_refs: sourceRefs,
      evaluated_at: input.evaluated_at,
      execution_authorized: false,
      deterministic: true,
    });
  }
  const finalEvaluations = evaluations.map((evaluation) => {
    const source = candidates.find((candidate) => candidate.candidate_id === evaluation.candidate_id)!;
    if (source.candidate_id === winner.candidate_id) return { ...evaluation, priority_tier: "NOW" as const, reason_codes: unique([...evaluation.reason_codes, "PRIORITY.PRIMARY_NOW"]) };
    if (evaluation.priority_tier === "DO_NOT_DO") return evaluation;
    return { ...evaluation, priority_tier: "LATER" as const, reason_codes: unique([...evaluation.reason_codes, "PRIORITY.LOWER_RELATIVE_PRIORITY"]) };
  });
  return interventionPrioritizationRunResultSchema.parse({
    context_id: input.context_id,
    business_id: input.business_id,
    decision_cycle_id: input.decision_cycle_id,
    disposition: "PRIORITY_AVAILABLE",
    candidate_evaluations: finalEvaluations,
    primary_priority_candidate_id: winner.candidate_id,
    ordered_candidate_ids: [winner.candidate_id, ...candidates.filter((candidate) => candidate.candidate_id !== winner.candidate_id).map((candidate) => candidate.candidate_id)],
    reason_codes: ["PRIORITY.PRIMARY_AVAILABLE"],
    unresolved_unknowns: unresolved,
    source_refs: sourceRefs,
    evaluated_at: input.evaluated_at,
    execution_authorized: false,
    deterministic: true,
  });
}
