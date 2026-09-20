import { z } from "zod";

export const INTERVENTION_IMPACT_DISPOSITIONS = [
  "SUPPORTED_QUALITATIVE",
  "POTENTIAL_ONLY",
  "VALIDATION_REQUIRED",
  "NO_VALID_IMPACT",
] as const;
export type InterventionImpactDisposition = (typeof INTERVENTION_IMPACT_DISPOSITIONS)[number];
export const INTERVENTION_IMPACT_RUN_DISPOSITIONS = [
  "IMPACTS_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_IMPACT_CANDIDATES",
] as const;
export type InterventionImpactRunDisposition = (typeof INTERVENTION_IMPACT_RUN_DISPOSITIONS)[number];

const refs = z.array(z.string().min(1));
const qualitative = z.enum(["LIMITED", "MODERATE", "MATERIAL", "POTENTIALLY_HIGH", "UNKNOWN"]);

export const interventionImpactInputSchema = z.object({
  candidate_id: z.string().min(1),
  priority_tier: z.enum(["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"]).optional(),
  primary_effect: z.string().min(1),
  mechanism_refs: refs,
  leading_indicator_refs: refs,
  business_outcome_refs: refs,
  economic_outcome_refs: refs,
  scope: z.string().min(1),
  magnitude_qualitative: qualitative,
  magnitude_value: z.number().finite().nullable(),
  magnitude_unit: z.string().min(1).nullable(),
  time_to_signal: z.string().min(1),
  time_to_full_value: z.string().min(1),
  durability: z.enum(["TRANSIENT", "ONGOING", "DURABLE", "REPEATABLE", "UNKNOWN"]),
  estimate_basis: z.enum(["DETERMINISTIC", "OBSERVED", "MODELED", "SPECULATIVE", "UNKNOWN"]),
  quantitative_support: z.boolean(),
  incrementality: z.enum(["INCREMENTAL", "ATTRIBUTED_ONLY", "MIXED", "UNKNOWN"]),
  counterfactual_present: z.boolean(),
  secondary_effects: refs,
  negative_effects: refs,
  tradeoffs: refs,
  assumptions: refs,
  guardrail_refs: refs,
  guardrail_status: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
});
export type InterventionImpactInput = z.input<typeof interventionImpactInputSchema>;

export const interventionImpactResultSchema = z.object({
  candidate_id: z.string().min(1),
  priority_tier: z.enum(["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"]).optional(),
  disposition: z.enum(INTERVENTION_IMPACT_DISPOSITIONS),
  primary_effect: z.string().min(1),
  impact_trace: z.object({
    mechanism_refs: refs,
    leading_indicator_refs: refs,
    business_outcome_refs: refs,
    economic_outcome_refs: refs,
  }),
  scope: z.string().min(1),
  magnitude_qualitative: qualitative,
  magnitude_value: z.number().finite().nullable(),
  magnitude_unit: z.string().min(1).nullable(),
  time_to_signal: z.string().min(1),
  time_to_full_value: z.string().min(1),
  durability: z.enum(["TRANSIENT", "ONGOING", "DURABLE", "REPEATABLE", "UNKNOWN"]),
  estimate_basis: z.enum(["DETERMINISTIC", "OBSERVED", "MODELED", "SPECULATIVE", "UNKNOWN"]),
  incrementality: z.enum(["INCREMENTAL", "ATTRIBUTED_ONLY", "MIXED", "UNKNOWN"]),
  counterfactual_present: z.boolean(),
  secondary_effects: refs,
  negative_effects: refs,
  tradeoffs: refs,
  assumptions: refs,
  guardrail_refs: refs,
  reason_codes: refs,
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type InterventionImpactResult = z.infer<typeof interventionImpactResultSchema>;

export const interventionImpactRunResultSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  disposition: z.enum(INTERVENTION_IMPACT_RUN_DISPOSITIONS),
  candidate_evaluations: z.array(interventionImpactResultSchema),
  primary_priority_candidate_id: z.string().min(1).nullable(),
  reason_codes: refs,
  unresolved_unknowns: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type InterventionImpactRunResult = z.infer<typeof interventionImpactRunResultSchema>;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function emptyResult(raw: Partial<InterventionImpactInput>, reasons: string[], unknowns: string[]): InterventionImpactResult {
  const candidateId = typeof raw.candidate_id === "string" ? raw.candidate_id : "invalid-candidate";
  return interventionImpactResultSchema.parse({
    candidate_id: candidateId,
    ...(raw.priority_tier ? { priority_tier: raw.priority_tier } : {}),
    disposition: "VALIDATION_REQUIRED",
    primary_effect: typeof raw.primary_effect === "string" ? raw.primary_effect : "impact not defined",
    impact_trace: { mechanism_refs: [], leading_indicator_refs: [], business_outcome_refs: [], economic_outcome_refs: [] },
    scope: typeof raw.scope === "string" ? raw.scope : "unknown_scope",
    magnitude_qualitative: "UNKNOWN",
    magnitude_value: null,
    magnitude_unit: null,
    time_to_signal: "unknown",
    time_to_full_value: "unknown",
    durability: "UNKNOWN",
    estimate_basis: "UNKNOWN",
    incrementality: "UNKNOWN",
    counterfactual_present: false,
    secondary_effects: [], negative_effects: [], tradeoffs: [], assumptions: [], guardrail_refs: [],
    reason_codes: unique(reasons), unresolved_unknowns: unique(unknowns), evidence_refs: [], source_refs: [],
    execution_authorized: false, deterministic: true,
  });
}

/** F7.04 expected impact: traceable and qualitative by default, never a guarantee. */
export function evaluateInterventionImpact(raw: InterventionImpactInput): InterventionImpactResult {
  const parsed = interventionImpactInputSchema.safeParse(raw);
  if (!parsed.success) return emptyResult(raw as Partial<InterventionImpactInput>, ["INPUT.SCHEMA_INVALID"], ["input_schema"]);
  const input = parsed.data;
  const unknowns = unique([...input.unresolved_unknowns]);
  const reasons: string[] = [];
  if (input.mechanism_refs.length === 0) { unknowns.push("mechanism_refs"); reasons.push("MECHANISM.MISSING"); }
  if (input.leading_indicator_refs.length === 0) { unknowns.push("leading_indicator_refs"); reasons.push("LEADING_INDICATOR.MISSING"); }
  if (input.business_outcome_refs.length === 0) { unknowns.push("business_outcome_refs"); reasons.push("BUSINESS_OUTCOME.MISSING"); }
  if (input.guardrail_status === "FAIL") reasons.push("GUARDRAIL.CONFLICT");
  if (!input.counterfactual_present) { unknowns.push("incrementality"); reasons.push("INCREMENTALITY.COUNTERFACTUAL_MISSING"); }
  if (input.estimate_basis === "SPECULATIVE") reasons.push("EVIDENCE.SPECULATIVE");
  if (input.estimate_basis === "UNKNOWN") { unknowns.push("estimate_basis"); reasons.push("EVIDENCE.BASIS_UNKNOWN"); }
  let magnitudeValue = input.magnitude_value;
  if (magnitudeValue !== null && (!input.quantitative_support || !input.magnitude_unit)) {
    magnitudeValue = null;
    reasons.push("MAGNITUDE.QUANTITATIVE_UNSUPPORTED");
  }
  let disposition: InterventionImpactDisposition = "SUPPORTED_QUALITATIVE";
  if (input.guardrail_status === "FAIL") disposition = "NO_VALID_IMPACT";
  else if (unknowns.some((unknown) => unknown !== "incrementality") || input.magnitude_qualitative === "UNKNOWN" || input.estimate_basis === "UNKNOWN") disposition = "VALIDATION_REQUIRED";
  else if (input.estimate_basis === "SPECULATIVE" || !input.counterfactual_present || input.incrementality !== "INCREMENTAL") disposition = "POTENTIAL_ONLY";
  return interventionImpactResultSchema.parse({
    candidate_id: input.candidate_id,
    ...(input.priority_tier ? { priority_tier: input.priority_tier } : {}),
    disposition,
    primary_effect: input.primary_effect,
    impact_trace: {
      mechanism_refs: unique(input.mechanism_refs),
      leading_indicator_refs: unique(input.leading_indicator_refs),
      business_outcome_refs: unique(input.business_outcome_refs),
      economic_outcome_refs: unique(input.economic_outcome_refs),
    },
    scope: input.scope,
    magnitude_qualitative: input.magnitude_qualitative,
    magnitude_value: magnitudeValue,
    magnitude_unit: magnitudeValue === null ? null : input.magnitude_unit,
    time_to_signal: input.time_to_signal,
    time_to_full_value: input.time_to_full_value,
    durability: input.durability,
    estimate_basis: input.estimate_basis,
    incrementality: input.incrementality,
    counterfactual_present: input.counterfactual_present,
    secondary_effects: unique(input.secondary_effects),
    negative_effects: unique(input.negative_effects),
    tradeoffs: unique(input.tradeoffs),
    assumptions: unique(input.assumptions),
    guardrail_refs: unique(input.guardrail_refs),
    reason_codes: unique(reasons),
    unresolved_unknowns: unique(unknowns),
    evidence_refs: unique(input.evidence_refs),
    source_refs: unique(input.source_refs),
    execution_authorized: false,
    deterministic: true,
  });
}

export function evaluateInterventionImpactSet(input: {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  primary_priority_candidate_id: string | null;
  candidates: InterventionImpactInput[];
  evaluated_at: string;
}): InterventionImpactRunResult {
  const evaluations = input.candidates.map(evaluateInterventionImpact);
  const hasImpact = evaluations.some((evaluation) => ["SUPPORTED_QUALITATIVE", "POTENTIAL_ONLY"].includes(evaluation.disposition));
  const result = {
    context_id: input.context_id,
    business_id: input.business_id,
    decision_cycle_id: input.decision_cycle_id,
    disposition: evaluations.length === 0 ? "NO_IMPACT_CANDIDATES" : hasImpact ? "IMPACTS_AVAILABLE" : "VALIDATION_REQUIRED",
    candidate_evaluations: evaluations,
    primary_priority_candidate_id: input.primary_priority_candidate_id,
    reason_codes: unique(evaluations.flatMap((evaluation) => evaluation.reason_codes)),
    unresolved_unknowns: unique(evaluations.flatMap((evaluation) => evaluation.unresolved_unknowns)),
    source_refs: unique(evaluations.flatMap((evaluation) => evaluation.source_refs)),
    evaluated_at: input.evaluated_at,
    execution_authorized: false as const,
    deterministic: true as const,
  };
  return interventionImpactRunResultSchema.parse(result);
}
