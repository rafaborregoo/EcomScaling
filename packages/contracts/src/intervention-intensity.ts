import { z } from "zod";

export const INTERVENTION_INTENSITY_MODES = ["INCREASE", "MAINTAIN", "DECREASE", "STOP_INCREASING"] as const;
export type InterventionIntensityMode = (typeof INTERVENTION_INTENSITY_MODES)[number];
export const INTERVENTION_INTENSITY_RUN_DISPOSITIONS = ["INTENSITY_PROFILES_AVAILABLE", "VALIDATION_REQUIRED", "NO_INTENSITY_CANDIDATES"] as const;
export type InterventionIntensityRunDisposition = (typeof INTERVENTION_INTENSITY_RUN_DISPOSITIONS)[number];
const refs = z.array(z.string().min(1));

export const interventionIntensityInputSchema = z.object({
  candidate_id: z.string().min(1), selected_intervention: z.string().min(1), confidence: z.string().min(1), evidence_strength: z.string().min(1), downside: refs, reversibility: refs, cost_of_error: refs, headroom: refs, opportunity_size: refs, marginal_economics: refs, system_capacity: refs, guardrails: refs, guardrail_status: z.enum(["PASS", "FAIL", "UNKNOWN"]), business_mode: z.string().min(1), feedback_speed: z.string().min(1), observability: z.enum(["READY", "PARTIAL", "POOR", "UNKNOWN"]), data_quality: z.string().min(1), heterogeneity: refs, time_window: z.string().min(1), current_exposure: z.string().min(1), current_marginal_response: z.enum(["IMPROVING", "HOLDING", "DETERIORATING", "UNKNOWN"]), saturation_status: z.enum(["LOW", "EMERGING", "MATERIAL", "UNKNOWN"]), current_bottlenecks: refs, aggregate_exposure: refs, change_load: z.string().min(1), concentration_risk: z.string().min(1), success_capacity: refs, absolute_exposure: z.string().min(1), existing_evidence: refs, historical_response: refs, current_limiter: z.string().min(1), target_scope: z.string().min(1), magnitude: z.string().min(1), scope: z.string().min(1), velocity: z.string().min(1), duration: z.string().min(1), bet_size: z.string().min(1), minimum_effective_exposure: z.string().min(1), maximum_safe_exposure: z.string().min(1), ramp_logic: refs, observation_requirement: z.string().min(1), escalation_condition: refs, reduction_condition: refs, strategic_meaning_shift: z.string().min(1), temporary_or_steady_state: z.enum(["TEMPORARY", "REPEATED", "PERMANENT", "UNKNOWN"]), unresolved_unknowns: refs, evidence_refs: refs, source_refs: refs,
});
export type InterventionIntensityInput = z.input<typeof interventionIntensityInputSchema>;

export const interventionIntensityResultSchema = interventionIntensityInputSchema.extend({
  recommended_mode: z.enum(INTERVENTION_INTENSITY_MODES), rationale: refs,
  decision_path: z.object({ why_this_size: refs, limiter: refs, next_observation: refs, if_improves: refs, if_deteriorates: refs, if_capacity_tightens: refs, handoff: refs }),
  execution_authorized: z.literal(false), deterministic: z.literal(true),
});
export type InterventionIntensityResult = z.infer<typeof interventionIntensityResultSchema>;
export const interventionIntensityRunResultSchema = z.object({ context_id: z.string().min(1), business_id: z.string().min(1), decision_cycle_id: z.string().min(1), disposition: z.enum(INTERVENTION_INTENSITY_RUN_DISPOSITIONS), candidate_evaluations: z.array(interventionIntensityResultSchema), primary_priority_candidate_id: z.string().min(1).nullable(), reason_codes: refs, unresolved_unknowns: refs, source_refs: refs, evaluated_at: z.string().datetime(), execution_authorized: z.literal(false), deterministic: z.literal(true) });
export type InterventionIntensityRunResult = z.infer<typeof interventionIntensityRunResultSchema>;
const unique = (values: string[]) => [...new Set(values)];

function fallback(raw: Partial<InterventionIntensityInput>, reasons: string[], unknowns: string[]): InterventionIntensityResult {
  const candidateId = typeof raw.candidate_id === "string" ? raw.candidate_id : "invalid-candidate";
  return interventionIntensityResultSchema.parse({ candidate_id: candidateId, selected_intervention: typeof raw.selected_intervention === "string" ? raw.selected_intervention : "intervention not defined", confidence: "UNKNOWN", evidence_strength: "UNKNOWN", downside: [], reversibility: [], cost_of_error: [], headroom: [], opportunity_size: [], marginal_economics: [], system_capacity: [], guardrails: [], guardrail_status: "UNKNOWN", business_mode: "UNKNOWN", feedback_speed: "UNKNOWN", observability: "UNKNOWN", data_quality: "UNKNOWN", heterogeneity: [], time_window: "UNKNOWN", current_exposure: "UNKNOWN", current_marginal_response: "UNKNOWN", saturation_status: "UNKNOWN", current_bottlenecks: [], aggregate_exposure: [], change_load: "UNKNOWN", concentration_risk: "UNKNOWN", success_capacity: [], absolute_exposure: "UNKNOWN", existing_evidence: [], historical_response: [], current_limiter: "UNKNOWN", target_scope: "UNKNOWN", magnitude: "UNKNOWN", scope: "UNKNOWN", velocity: "UNKNOWN", duration: "UNKNOWN", bet_size: "UNKNOWN", minimum_effective_exposure: "UNKNOWN", maximum_safe_exposure: "UNKNOWN", ramp_logic: [], observation_requirement: "UNKNOWN", escalation_condition: [], reduction_condition: [], strategic_meaning_shift: "UNKNOWN", temporary_or_steady_state: "UNKNOWN", unresolved_unknowns: unique(unknowns), evidence_refs: [], source_refs: [], recommended_mode: "MAINTAIN", rationale: unique(reasons), decision_path: { why_this_size: [], limiter: [], next_observation: [], if_improves: [], if_deteriorates: [], if_capacity_tightens: [], handoff: [] }, execution_authorized: false, deterministic: true });
}

export function evaluateInterventionIntensity(raw: InterventionIntensityInput): InterventionIntensityResult {
  const parsed = interventionIntensityInputSchema.safeParse(raw);
  if (!parsed.success) return fallback(raw as Partial<InterventionIntensityInput>, ["INPUT.SCHEMA_INVALID"], ["input_schema"]);
  const input = parsed.data; const unknowns = [...input.unresolved_unknowns]; const reasons: string[] = [];
  if (input.guardrail_status === "UNKNOWN") { unknowns.push("guardrails"); reasons.push("GUARDRAIL.CONTEXT_UNKNOWN"); }
  if (input.observability === "UNKNOWN" || input.observability === "POOR") { unknowns.push("observability"); reasons.push("OBSERVABILITY.LIMITED"); }
  if (input.current_marginal_response === "UNKNOWN") { unknowns.push("marginal_economics"); reasons.push("ECONOMICS.MARGINAL_UNKNOWN"); }
  if (input.saturation_status === "UNKNOWN") { unknowns.push("saturation"); reasons.push("SATURATION.UNKNOWN"); }
  let mode: InterventionIntensityMode = "MAINTAIN";
  if (input.guardrail_status === "FAIL" || input.saturation_status === "MATERIAL" || input.current_marginal_response === "DETERIORATING") { mode = "DECREASE"; reasons.push(input.guardrail_status === "FAIL" ? "GUARDRAIL.INTENSITY_LIMIT" : "INTENSITY.MARGINAL_RESPONSE_DETERIORATING"); }
  else if (input.current_marginal_response === "HOLDING" && input.observability === "READY" && input.guardrail_status === "PASS" && input.saturation_status === "LOW" && input.confidence !== "LOW") { mode = "INCREASE"; reasons.push("INTENSITY.EVIDENCE_GATED_INCREASE"); }
  else if (input.current_marginal_response === "IMPROVING" && input.guardrail_status === "PASS" && input.observability === "READY") { mode = "INCREASE"; reasons.push("INTENSITY.MARGINAL_RESPONSE_SUPPORTS_INCREASE"); }
  else if (input.saturation_status === "EMERGING" || input.observability === "PARTIAL" || input.guardrail_status === "UNKNOWN") { mode = "STOP_INCREASING"; reasons.push("INTENSITY.OBSERVE_BEFORE_MORE_EXPOSURE"); }
  else if (input.observability === "UNKNOWN" || input.current_marginal_response === "UNKNOWN" || input.saturation_status === "UNKNOWN") { mode = "STOP_INCREASING"; reasons.push("INTENSITY.UNKNOWN_REMAINS"); }
  else reasons.push("INTENSITY.MAINTAIN_STEADY_STATE");
  if (unknowns.length && mode === "INCREASE") { mode = "STOP_INCREASING"; reasons.push("INTENSITY.UNKNOWN_REMAINS"); }
  return interventionIntensityResultSchema.parse({ ...input, recommended_mode: mode, rationale: unique(reasons), unresolved_unknowns: unique(unknowns), decision_path: { why_this_size: [input.magnitude, input.scope, input.velocity, input.duration], limiter: [input.current_limiter, ...input.current_bottlenecks], next_observation: [input.observation_requirement], if_improves: input.escalation_condition, if_deteriorates: input.reduction_condition, if_capacity_tightens: input.success_capacity, handoff: input.ramp_logic }, execution_authorized: false, deterministic: true });
}

export function evaluateInterventionIntensitySet(input: { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; candidates: InterventionIntensityInput[]; evaluated_at: string }): InterventionIntensityRunResult {
  const evaluations = input.candidates.map(evaluateInterventionIntensity);
  return interventionIntensityRunResultSchema.parse({ context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: evaluations.length === 0 ? "NO_INTENSITY_CANDIDATES" : evaluations.some((item) => item.unresolved_unknowns.length === 0) ? "INTENSITY_PROFILES_AVAILABLE" : "VALIDATION_REQUIRED", candidate_evaluations: evaluations, primary_priority_candidate_id: input.primary_priority_candidate_id, reason_codes: unique(evaluations.flatMap((item) => item.rationale)), unresolved_unknowns: unique(evaluations.flatMap((item) => item.unresolved_unknowns)), source_refs: unique(evaluations.flatMap((item) => item.source_refs)), evaluated_at: input.evaluated_at, execution_authorized: false, deterministic: true });
}
