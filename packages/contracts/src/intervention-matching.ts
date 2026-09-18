import { z } from "zod";

export const INTERVENTION_MATCHING_DISPOSITIONS = [
  "MATCHED",
  "INSUFFICIENT_EVIDENCE",
  "NO_CAUSAL_MATCH",
] as const;
export type InterventionMatchingDisposition =
  (typeof INTERVENTION_MATCHING_DISPOSITIONS)[number];

export const INTERVENTION_MATCHING_RUN_DISPOSITIONS = [
  "MATCHES_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_MATCHES",
] as const;
export type InterventionMatchingRunDisposition =
  (typeof INTERVENTION_MATCHING_RUN_DISPOSITIONS)[number];

const refs = z.array(z.string().min(1));
const triState = z.enum(["TRUE", "FALSE", "UNKNOWN"]);

export const interventionMatchingInputSchema = z.object({
  candidate_id: z.string().min(1),
  problem_refs: refs,
  candidate_problem_refs: refs,
  driver_refs: refs,
  candidate_driver_refs: refs,
  cause_refs: refs,
  candidate_cause_refs: refs,
  mechanism_refs: refs,
  candidate_mechanism_refs: refs,
  lever_refs: refs,
  candidate_lever_refs: refs,
  causal_coherence: triState,
  supporting_signal_refs: refs,
  disconfirming_signal_refs: refs,
  discriminating_evidence_refs: refs,
  functional_type: z.string().min(1).optional(),
  intervention_family: z.string().min(1).optional(),
  scope_refs: refs,
  temporal_horizon: z.string().min(1).optional(),
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
});
export type InterventionMatchingInput = z.input<
  typeof interventionMatchingInputSchema
>;

const causalChainSchema = z.object({
  problem_refs: refs,
  driver_refs: refs,
  cause_refs: refs,
  mechanism_refs: refs,
  lever_refs: refs,
});

export const interventionMatchingResultSchema = z.object({
  candidate_id: z.string().min(1),
  disposition: z.enum(INTERVENTION_MATCHING_DISPOSITIONS),
  causal_chain: causalChainSchema,
  functional_type: z.string().min(1).optional(),
  intervention_family: z.string().min(1).optional(),
  supporting_signal_refs: refs,
  disconfirming_signal_refs: refs,
  discriminating_evidence_refs: refs,
  scope_refs: refs,
  temporal_horizon: z.string().min(1).optional(),
  reason_codes: refs,
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
  selected: z.literal(false),
  deterministic: z.literal(true),
});
export type InterventionMatchingResult = z.infer<
  typeof interventionMatchingResultSchema
>;

export const interventionMatchingRunResultSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  disposition: z.enum(INTERVENTION_MATCHING_RUN_DISPOSITIONS),
  candidate_evaluations: z.array(interventionMatchingResultSchema),
  matched_candidate_ids: refs,
  selected_candidate_id: z.null(),
  reason_codes: refs,
  unresolved_unknowns: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  deterministic: z.literal(true),
});
export type InterventionMatchingRunResult = z.infer<
  typeof interventionMatchingRunResultSchema
>;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function intersection(left: string[], right: string[]): string[] {
  return left.filter((value) => right.includes(value));
}

function result(
  input: InterventionMatchingInput,
  disposition: InterventionMatchingDisposition,
  reasonCodes: string[],
  unresolvedUnknowns = input.unresolved_unknowns,
): InterventionMatchingResult {
  return interventionMatchingResultSchema.parse({
    candidate_id: input.candidate_id,
    disposition,
    causal_chain: {
      problem_refs: intersection(input.problem_refs, input.candidate_problem_refs),
      driver_refs: intersection(input.driver_refs, input.candidate_driver_refs),
      cause_refs: intersection(input.cause_refs, input.candidate_cause_refs),
      mechanism_refs: intersection(input.mechanism_refs, input.candidate_mechanism_refs),
      lever_refs: intersection(input.lever_refs, input.candidate_lever_refs),
    },
    ...(input.functional_type ? { functional_type: input.functional_type } : {}),
    ...(input.intervention_family ? { intervention_family: input.intervention_family } : {}),
    supporting_signal_refs: unique(input.supporting_signal_refs),
    disconfirming_signal_refs: unique(input.disconfirming_signal_refs),
    discriminating_evidence_refs: unique(input.discriminating_evidence_refs),
    scope_refs: unique(input.scope_refs),
    ...(input.temporal_horizon ? { temporal_horizon: input.temporal_horizon } : {}),
    reason_codes: unique(reasonCodes),
    unresolved_unknowns: unique(unresolvedUnknowns),
    evidence_refs: unique(input.evidence_refs),
    source_refs: unique(input.source_refs),
    selected: false,
    deterministic: true,
  });
}

/**
 * F7.02 pure causal matching. It exposes plausible candidates and their
 * causal chain; it never ranks, selects, authorizes or executes one.
 */
export function evaluateInterventionMatching(
  raw: InterventionMatchingInput,
): InterventionMatchingResult {
  const parsed = interventionMatchingInputSchema.safeParse(raw);
  if (!parsed.success) {
    return result(
      {
        ...(raw as Partial<InterventionMatchingInput>),
        candidate_id:
          typeof raw?.candidate_id === "string"
            ? raw.candidate_id
            : "invalid-candidate",
        problem_refs: [],
        candidate_problem_refs: [],
        driver_refs: [],
        candidate_driver_refs: [],
        cause_refs: [],
        candidate_cause_refs: [],
        mechanism_refs: [],
        candidate_mechanism_refs: [],
        lever_refs: [],
        candidate_lever_refs: [],
        causal_coherence: "UNKNOWN",
        supporting_signal_refs: [],
        disconfirming_signal_refs: [],
        discriminating_evidence_refs: [],
        scope_refs: [],
        unresolved_unknowns: ["input_schema"],
        evidence_refs: [],
        source_refs: [],
      } as InterventionMatchingInput,
      "INSUFFICIENT_EVIDENCE",
      ["INPUT.SCHEMA_INVALID"],
      ["input_schema"],
    );
  }
  const input = parsed.data;
  const problemMatch = intersection(input.problem_refs, input.candidate_problem_refs);
  if (input.problem_refs.length === 0) {
    return result(input, "INSUFFICIENT_EVIDENCE", ["PROBLEM.UNKNOWN"], [
      ...input.unresolved_unknowns,
      "problem_refs",
    ]);
  }
  if (input.candidate_problem_refs.length > 0 && problemMatch.length === 0) {
    return result(input, "NO_CAUSAL_MATCH", ["PROBLEM.MISMATCH"]);
  }
  if (input.causal_coherence === "FALSE") {
    return result(input, "NO_CAUSAL_MATCH", ["CAUSAL_FIT_FAILED"]);
  }
  const unknowns = unique([
    ...input.unresolved_unknowns,
    ...(input.causal_coherence === "UNKNOWN" ? ["causal_coherence"] : []),
    ...(input.candidate_mechanism_refs.length === 0 ? ["mechanism_refs"] : []),
    ...(input.candidate_lever_refs.length === 0 ? ["controllable_lever_refs"] : []),
  ]);
  if (unknowns.length > 0) {
    return result(input, "INSUFFICIENT_EVIDENCE", [
      "MATCHING.CAUSAL_STORY_INCOMPLETE",
    ], unknowns);
  }
  return result(input, "MATCHED", ["MATCHING.CAUSAL_FIT_SUPPORTED"]);
}

export function evaluateInterventionMatchingSet(input: {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  candidates: InterventionMatchingInput[];
  evaluated_at: string;
}): InterventionMatchingRunResult {
  const evaluations = input.candidates.map(evaluateInterventionMatching);
  const matched = evaluations.filter((item) => item.disposition === "MATCHED");
  const hasValidation = evaluations.some(
    (item) => item.disposition === "INSUFFICIENT_EVIDENCE",
  );
  const disposition: InterventionMatchingRunDisposition =
    evaluations.length === 0
      ? "NO_MATCHES"
      : matched.length > 0
        ? "MATCHES_AVAILABLE"
        : hasValidation
          ? "VALIDATION_REQUIRED"
          : "NO_MATCHES";
  return interventionMatchingRunResultSchema.parse({
    context_id: input.context_id,
    business_id: input.business_id,
    decision_cycle_id: input.decision_cycle_id,
    disposition,
    candidate_evaluations: evaluations,
    matched_candidate_ids: matched.map((item) => item.candidate_id),
    selected_candidate_id: null,
    reason_codes: unique(evaluations.flatMap((item) => item.reason_codes)),
    unresolved_unknowns: unique(
      evaluations.flatMap((item) => item.unresolved_unknowns),
    ),
    source_refs: unique(evaluations.flatMap((item) => item.source_refs)),
    evaluated_at: input.evaluated_at,
    deterministic: true,
  });
}
