import { z } from "zod";

export const INTERVENTION_TEST_EXECUTE_MODES = [
  "FIX",
  "DIRECT_EXECUTION",
  "TEST",
  "PILOT",
  "GATHER_EVIDENCE",
  "WAIT_OBSERVE",
  "DO_NOT_PROCEED",
] as const;
export type InterventionTestExecuteMode = (typeof INTERVENTION_TEST_EXECUTE_MODES)[number];
export const INTERVENTION_TEST_EXECUTE_DISPOSITIONS = ["DECISIONS_AVAILABLE", "VALIDATION_REQUIRED", "NO_DECISION_CANDIDATES"] as const;
export type InterventionTestExecuteRunDisposition = (typeof INTERVENTION_TEST_EXECUTE_DISPOSITIONS)[number];

const refs = z.array(z.string().min(1));
const tri = z.enum(["YES", "NO", "UNKNOWN"]);
const context = z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

export const interventionTestExecuteInputSchema = z.object({
  candidate_id: z.string().min(1),
  candidate_intervention: z.string().min(1),
  known_defect: z.enum(["CONFIRMED", "NOT_CONFIRMED", "UNKNOWN"]),
  evidence_strength: z.string().min(1),
  evidence_sufficiency: z.enum(["SUFFICIENT", "INSUFFICIENT", "UNKNOWN"]),
  remaining_uncertainty: refs,
  decision_relevance: tri,
  downside: refs,
  reversibility: refs,
  blast_radius: refs,
  cost_of_error: refs,
  cost_of_delay: refs,
  value_of_learning: refs,
  measurement_capability: z.enum(["READY", "PARTIAL", "MISSING", "UNKNOWN"]),
  traffic_volume: z.string().min(1),
  resources: refs,
  existing_evidence: refs,
  context_similarity: context,
  guardrails: refs,
  guardrail_status: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNKNOWN"]),
  current_experiments: refs,
  business_priority: refs,
  economics_screen: z.enum(["PLAUSIBLE", "UNCLEAR", "IMPOSSIBLE"]),
  testability: z.enum(["HIGH", "PARTIAL", "LOW", "UNKNOWN"]),
  implementation_fidelity: z.enum(["READY", "PARTIAL", "UNKNOWN"]),
  contamination: refs,
  segment_relevance: refs,
  primary_outcome: z.string().min(1),
  guardrail_outcomes: refs,
  measurement_requirement: z.string().min(1),
  hypothesis: z.string().min(1),
  learning_question: z.string().min(1),
  decision_after_result: refs,
  exposure_mode: z.string().min(1),
  pilot_scope: z.string().min(1),
  observation_requirement: z.string().min(1),
  observation_state: z.enum(["MATURE", "IMMATURE", "NOT_APPLICABLE", "UNKNOWN"]),
  evidence_reuse: z.string().min(1),
  transferability_caveat: z.string().min(1),
  experiment_cost: z.string().min(1),
  experimentability: z.enum(["HIGH", "PARTIAL", "LOW", "UNKNOWN"]),
  execution_uncertainty: z.enum(["LOW", "MATERIAL", "UNKNOWN"]),
  intervention_scale: z.enum(["SMALL", "MATERIAL", "LARGE", "UNKNOWN"]),
  experiment_type: z.enum(["COMPONENT", "PACKAGE", "OBSERVATIONAL", "NOT_APPLICABLE"]),
  sequence_handoff: refs,
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
});
export type InterventionTestExecuteInput = z.input<typeof interventionTestExecuteInputSchema>;

export const interventionTestExecuteResultSchema = interventionTestExecuteInputSchema.extend({
  recommended_mode: z.enum(INTERVENTION_TEST_EXECUTE_MODES),
  rationale: refs,
  decision_path: z.object({
    why_now: refs,
    why_not_direct: refs,
    why_not_test: refs,
    preconditions: refs,
    after_result: refs,
    handoff: refs,
  }),
  outcome_interpretation: z.object({
    positive: refs,
    negative: refs,
    inconclusive: refs,
    business_significance: refs,
    full_funnel: refs,
    incrementality: refs,
  }),
  reason_codes: refs,
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type InterventionTestExecuteResult = z.infer<typeof interventionTestExecuteResultSchema>;

export const interventionTestExecuteRunResultSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  disposition: z.enum(INTERVENTION_TEST_EXECUTE_DISPOSITIONS),
  candidate_evaluations: z.array(interventionTestExecuteResultSchema),
  primary_priority_candidate_id: z.string().min(1).nullable(),
  reason_codes: refs,
  unresolved_unknowns: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type InterventionTestExecuteRunResult = z.infer<typeof interventionTestExecuteRunResultSchema>;

function unique(values: string[]) { return [...new Set(values)]; }

function fallback(raw: Partial<InterventionTestExecuteInput>, reasons: string[], unknowns: string[]): InterventionTestExecuteResult {
  const candidateId = typeof raw.candidate_id === "string" ? raw.candidate_id : "invalid-candidate";
  const text = (value: unknown, fallbackValue: string) => typeof value === "string" && value.length > 0 ? value : fallbackValue;
  return interventionTestExecuteResultSchema.parse({
    candidate_id: candidateId,
    candidate_intervention: text(raw.candidate_intervention, "intervention not defined"),
    known_defect: "UNKNOWN", evidence_strength: "UNKNOWN", evidence_sufficiency: "UNKNOWN", remaining_uncertainty: unique(unknowns), decision_relevance: "UNKNOWN", downside: [], reversibility: [], blast_radius: [], cost_of_error: [], cost_of_delay: [], value_of_learning: [], measurement_capability: "UNKNOWN", traffic_volume: "UNKNOWN", resources: [], existing_evidence: [], context_similarity: "UNKNOWN", guardrails: [], guardrail_status: "UNKNOWN", urgency: "UNKNOWN", current_experiments: [], business_priority: [], economics_screen: "UNCLEAR", testability: "UNKNOWN", implementation_fidelity: "UNKNOWN", contamination: [], segment_relevance: [], primary_outcome: "outcome not defined", guardrail_outcomes: [], measurement_requirement: "measurement not defined", hypothesis: "hypothesis not defined", learning_question: "learning question not defined", decision_after_result: [], exposure_mode: "UNKNOWN", pilot_scope: "UNKNOWN", observation_requirement: "UNKNOWN", observation_state: "UNKNOWN", evidence_reuse: "UNKNOWN", transferability_caveat: "UNKNOWN", experiment_cost: "UNKNOWN", experimentability: "UNKNOWN", execution_uncertainty: "UNKNOWN", intervention_scale: "UNKNOWN", experiment_type: "NOT_APPLICABLE", sequence_handoff: [], unresolved_unknowns: unique(unknowns), evidence_refs: [], source_refs: [], recommended_mode: "GATHER_EVIDENCE", rationale: unique(reasons), decision_path: { why_now: [], why_not_direct: [], why_not_test: [], preconditions: [], after_result: [], handoff: [] }, outcome_interpretation: { positive: [], negative: [], inconclusive: [], business_significance: [], full_funnel: [], incrementality: [] }, reason_codes: unique(reasons), execution_authorized: false, deterministic: true,
  });
}

export function evaluateInterventionTestExecute(raw: InterventionTestExecuteInput): InterventionTestExecuteResult {
  const parsed = interventionTestExecuteInputSchema.safeParse(raw);
  if (!parsed.success) return fallback(raw as Partial<InterventionTestExecuteInput>, ["INPUT.SCHEMA_INVALID"], ["input_schema"]);
  const input = parsed.data;
  const unknowns = [...input.unresolved_unknowns];
  const reasons: string[] = [];
  if (input.known_defect === "UNKNOWN") { unknowns.push("known_defect"); reasons.push("DEFECT.STATUS_UNKNOWN"); }
  if (input.decision_relevance === "UNKNOWN") { unknowns.push("decision_relevance"); reasons.push("DECISION.RELEVANCE_UNKNOWN"); }
  if (input.guardrail_status === "UNKNOWN") { unknowns.push("guardrails"); reasons.push("GUARDRAIL.CONTEXT_UNKNOWN"); }
  if (input.measurement_capability === "UNKNOWN" || input.measurement_capability === "MISSING") { unknowns.push("measurement_capability"); reasons.push("MEASUREMENT.NOT_READY"); }
  if (input.testability === "UNKNOWN") { unknowns.push("testability"); reasons.push("EXPERIMENTABILITY.UNKNOWN"); }
  if (input.context_similarity === "LOW") reasons.push("EVIDENCE.TRANSFERABILITY_LIMITED");
  if (input.contamination.length) reasons.push("EXPERIMENT.CONTAMINATION_PRESENT");
  if (input.implementation_fidelity !== "READY") reasons.push("EXPERIMENT.FIDELITY_NOT_READY");

  let recommendedMode: InterventionTestExecuteMode = "GATHER_EVIDENCE";
  if (input.known_defect === "CONFIRMED") {
    recommendedMode = "FIX";
    reasons.push("DEFECT.FIX_DIRECTLY");
  } else if (input.economics_screen === "IMPOSSIBLE") {
    recommendedMode = "DO_NOT_PROCEED";
    reasons.push("ECONOMICS.PLAUSIBLE_VALUE_MISSING");
  } else if (input.guardrail_status === "FAIL") {
    recommendedMode = "DO_NOT_PROCEED";
    reasons.push("GUARDRAIL.PRE_TEST_FAILED");
  } else if (input.observation_state === "IMMATURE" && !["HIGH", "CRITICAL"].includes(input.urgency)) {
    recommendedMode = "WAIT_OBSERVE";
    reasons.push("OBSERVATION.WINDOW_IMMATURE");
  } else if (input.decision_relevance === "NO" && input.guardrail_status === "PASS" && input.evidence_sufficiency === "SUFFICIENT") {
    recommendedMode = "DIRECT_EXECUTION";
    reasons.push("DECISION.NO_MATERIAL_LEARNING");
  } else if (input.measurement_capability === "MISSING" || input.measurement_capability === "UNKNOWN") {
    recommendedMode = "GATHER_EVIDENCE";
    reasons.push("MEASUREMENT.IMPROVE_BEFORE_INTERVENING");
  } else if (input.current_experiments.length || input.contamination.length) {
    recommendedMode = "GATHER_EVIDENCE";
    reasons.push("EXPERIMENT.CONTEXT_CONTAMINATED");
  } else if (input.decision_relevance === "YES" && ["HIGH", "PARTIAL"].includes(input.testability) && input.evidence_sufficiency !== "SUFFICIENT" && input.guardrail_status === "PASS") {
    recommendedMode = input.intervention_scale === "LARGE" || input.execution_uncertainty === "MATERIAL" ? "PILOT" : "TEST";
    reasons.push(recommendedMode === "PILOT" ? "DECISION.PILOT_BEFORE_SCALE" : "DECISION.TEST_LEARNING_VALUE");
  } else if (input.evidence_sufficiency === "SUFFICIENT" && input.guardrail_status === "PASS" && input.reversibility.length > 0) {
    recommendedMode = "DIRECT_EXECUTION";
    reasons.push("EVIDENCE.SUFFICIENT_FOR_REVERSIBLE_ACTION");
  }
  if (unknowns.length && !["FIX", "DO_NOT_PROCEED"].includes(recommendedMode)) reasons.push("DECISION.UNKNOWN_REMAINS");

  const whyNotDirect = recommendedMode === "DIRECT_EXECUTION" ? [] : ["evidence or risk context does not justify untested full execution"];
  const whyNotTest = ["FIX", "DIRECT_EXECUTION", "DO_NOT_PROCEED", "WAIT_OBSERVE"].includes(recommendedMode) ? ["a controlled test is not the governing next mode"] : [];
  const positive = input.decision_after_result;
  const negative = input.guardrail_outcomes;
  const inconclusive = [input.observation_requirement, ...input.remaining_uncertainty];
  return interventionTestExecuteResultSchema.parse({
    ...input,
    recommended_mode: recommendedMode,
    rationale: unique(reasons),
    decision_path: { why_now: [input.candidate_intervention], why_not_direct: whyNotDirect, why_not_test: whyNotTest, preconditions: [input.measurement_requirement, ...input.guardrails], after_result: input.decision_after_result, handoff: input.sequence_handoff },
    outcome_interpretation: { positive, negative, inconclusive, business_significance: [input.primary_outcome, ...input.guardrail_outcomes], full_funnel: input.guardrail_outcomes, incrementality: input.value_of_learning },
    unresolved_unknowns: unique(unknowns),
    reason_codes: unique(reasons),
    execution_authorized: false,
    deterministic: true,
  } as unknown as InterventionTestExecuteResult);
}

export function evaluateInterventionTestExecuteSet(input: { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; candidates: InterventionTestExecuteInput[]; evaluated_at: string }): InterventionTestExecuteRunResult {
  const evaluations = input.candidates.map(evaluateInterventionTestExecute);
  return interventionTestExecuteRunResultSchema.parse({ context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: evaluations.length === 0 ? "NO_DECISION_CANDIDATES" : evaluations.some((item) => item.recommended_mode !== "GATHER_EVIDENCE" || item.unresolved_unknowns.length === 0) ? "DECISIONS_AVAILABLE" : "VALIDATION_REQUIRED", candidate_evaluations: evaluations, primary_priority_candidate_id: input.primary_priority_candidate_id, reason_codes: unique(evaluations.flatMap((item) => item.rationale)), unresolved_unknowns: unique(evaluations.flatMap((item) => item.unresolved_unknowns)), source_refs: unique(evaluations.flatMap((item) => item.source_refs)), evaluated_at: input.evaluated_at, execution_authorized: false, deterministic: true });
}
