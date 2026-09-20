import { z } from "zod";

/** F7.18 comprime el razonamiento en decision-support; no ejecuta ni autoriza. */
export const RECOMMENDATION_COMMUNICATION_DISPOSITIONS = [
  "COMMUNICATION_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_RECOMMENDATION_CONTEXT",
] as const;
export type RecommendationCommunicationDisposition = (typeof RECOMMENDATION_COMMUNICATION_DISPOSITIONS)[number];

const refs = z.array(z.string().min(1));
const text = z.string().min(1);

export const recommendationCommunicationInputSchema = z.object({
  context_id: text, business_id: text, decision_cycle_id: text,
  recommendation: text, reason: text, why_now: text, what_not_to_do: refs,
  expected_outcome: text, main_risk: text, main_uncertainty: text,
  priority_role: text, recommendation_strength: text, scope: text, stage: text,
  value_type: text, temporary_or_structural: text, audience: text, user_need: text,
  confidence_language: text, fact_evidence: refs, inference_evidence: refs,
  strongest_evidence: refs, conflicting_evidence: refs, success_signal: text,
  invalidating_condition: text, next_decision: text, sequence: refs, dependencies: refs,
  constraints: refs, current_priority: text, current_bottleneck: text,
  evidence_quality: text, current_confidence: text, commitment_scope: text,
  commitment_magnitude: text, commitment_velocity: text, commitment_duration: text,
  source_refs: refs, unresolved_unknowns: refs,
});
export type RecommendationCommunicationInput = z.input<typeof recommendationCommunicationInputSchema>;

export const recommendationCommunicationResultSchema = z.object({
  context_id: text, business_id: text, decision_cycle_id: text,
  disposition: z.enum(RECOMMENDATION_COMMUNICATION_DISPOSITIONS),
  primary_recommendation: text, reason: text, why_now: text, what_not_to_do: refs,
  expected_outcome: text, main_risk: text, main_uncertainty: text,
  priority_role: text, recommendation_strength: text, scope: text,
  recommendation_stage: text, value_type: text, temporary_or_structural: text,
  audience: text, user_need: text, confidence_language: text, fact_evidence: refs,
  inference_evidence: refs, strongest_evidence: refs, conflicting_evidence: refs,
  success_signal: text, invalidating_condition: text, next_decision: text,
  sequence: refs, dependencies: refs, constraints: refs, commitment_scope: text,
  commitment_magnitude: text, commitment_velocity: text, commitment_duration: text,
  action_implication: text, quality_flags: refs, unresolved_unknowns: refs,
  reason_codes: refs, source_refs: refs, evaluated_at: z.string().datetime(),
  execution_authorized: z.literal(false), deterministic: z.literal(true),
});
export type RecommendationCommunicationResult = z.infer<typeof recommendationCommunicationResultSchema>;

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const normalized = (value: string) => value.trim().toUpperCase();
const unknown = (value: string) => ["", "UNKNOWN", "UNAVAILABLE", "NOT_ASSESSED"].includes(normalized(value));

function refsFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function fallback(raw: Partial<RecommendationCommunicationInput>, evaluatedAt: string): RecommendationCommunicationResult {
  return recommendationCommunicationResultSchema.parse({
    context_id: typeof raw.context_id === "string" ? raw.context_id : "invalid-context",
    business_id: typeof raw.business_id === "string" ? raw.business_id : "invalid-business",
    decision_cycle_id: typeof raw.decision_cycle_id === "string" ? raw.decision_cycle_id : "invalid-cycle",
    disposition: "VALIDATION_REQUIRED", primary_recommendation: typeof raw.recommendation === "string" ? raw.recommendation : "UNKNOWN",
    reason: "Validar la recomendación antes de comunicarla.", why_now: "UNKNOWN", what_not_to_do: [], expected_outcome: "UNKNOWN",
    main_risk: "UNKNOWN", main_uncertainty: "UNKNOWN", priority_role: "PRIMARY", recommendation_strength: "VALIDATION_REQUIRED",
    scope: "UNKNOWN", recommendation_stage: "GATHER_EVIDENCE", value_type: "UNKNOWN", temporary_or_structural: "UNKNOWN",
    audience: "CONSULTANT", user_need: "DECISION", confidence_language: "La evidencia no permite una comunicación concluyente.",
    fact_evidence: [], inference_evidence: [], strongest_evidence: [], conflicting_evidence: [], success_signal: "UNKNOWN",
    invalidating_condition: "UNKNOWN", next_decision: "Validar el contexto antes de decidir.", sequence: [], dependencies: [], constraints: [],
    commitment_scope: "NARROW", commitment_magnitude: "LOW", commitment_velocity: "SLOW", commitment_duration: "SHORT",
    action_implication: "Validar antes de comprometer o ejecutar; la comunicación no autoriza ejecución.", quality_flags: ["COMMUNICATION.INPUT_SCHEMA_INVALID"],
    unresolved_unknowns: ["input_schema"], reason_codes: ["COMMUNICATION.INPUT_SCHEMA_INVALID"], source_refs: refsFrom(raw.source_refs),
    evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true,
  });
}

export function evaluateRecommendationCommunication(raw: RecommendationCommunicationInput, evaluatedAt = new Date().toISOString()): RecommendationCommunicationResult {
  const parsed = recommendationCommunicationInputSchema.safeParse(raw);
  if (!parsed.success) return fallback(raw as Partial<RecommendationCommunicationInput>, evaluatedAt);
  const input = parsed.data;
  const unknowns = [...input.unresolved_unknowns];
  for (const field of ["recommendation", "reason", "why_now", "expected_outcome", "main_uncertainty", "success_signal", "next_decision"] as const) if (unknown(input[field])) unknowns.push(field);
  if (unknowns.length > input.unresolved_unknowns.length) {
    return recommendationCommunicationResultSchema.parse({
      ...input, disposition: "VALIDATION_REQUIRED", primary_recommendation: input.recommendation,
      reason: input.reason, why_now: input.why_now, expected_outcome: "Validar la tesis antes de comunicar un outcome.",
      recommendation_stage: "GATHER_EVIDENCE", commitment_scope: "NARROW", commitment_magnitude: "LOW", commitment_velocity: "SLOW", commitment_duration: "SHORT",
      action_implication: "La comunicación señala la decisión pendiente; no autoriza ejecución.", quality_flags: ["COMMUNICATION.CONTEXT_INCOMPLETE"],
      unresolved_unknowns: unique(unknowns), reason_codes: ["COMMUNICATION.DECISION_CONTEXT_UNKNOWN"], evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true,
    });
  }
  const precisionFlags = /\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*x\b|guaranteed|garantizado|en \d+ d[ií]as/i.test(input.expected_outcome)
    ? ["COMMUNICATION.FALSE_PRECISION_REVIEW"] : [];
  const conditionalOutcome = precisionFlags.length ? `If the mechanism is correct, ${input.expected_outcome.replace(/\bguaranteed\b/gi, "the expected").replace(/\bgarantizado\b/gi, "el esperado")}` : input.expected_outcome;
  return recommendationCommunicationResultSchema.parse({
    context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id,
    disposition: "COMMUNICATION_AVAILABLE", primary_recommendation: input.recommendation, reason: input.reason, why_now: input.why_now,
    what_not_to_do: input.what_not_to_do, expected_outcome: conditionalOutcome, main_risk: input.main_risk, main_uncertainty: input.main_uncertainty,
    priority_role: input.priority_role, recommendation_strength: input.recommendation_strength, scope: input.scope, recommendation_stage: input.stage,
    value_type: input.value_type, temporary_or_structural: input.temporary_or_structural, audience: input.audience, user_need: input.user_need,
    confidence_language: input.confidence_language, fact_evidence: input.fact_evidence, inference_evidence: input.inference_evidence,
    strongest_evidence: input.strongest_evidence, conflicting_evidence: input.conflicting_evidence, success_signal: input.success_signal,
    invalidating_condition: input.invalidating_condition, next_decision: input.next_decision, sequence: input.sequence, dependencies: input.dependencies,
    constraints: input.constraints, commitment_scope: input.commitment_scope, commitment_magnitude: input.commitment_magnitude,
    commitment_velocity: input.commitment_velocity, commitment_duration: input.commitment_duration,
    action_implication: "La comunicación aclara la próxima decisión; no autoriza ejecución ni sustituye factibilidad o guardrails.",
    quality_flags: precisionFlags, unresolved_unknowns: [], reason_codes: [], source_refs: input.source_refs,
    evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true,
  });
}
