import { z } from "zod";

/**
 * Fase 9: continuous learning. 9.21 is intentionally absent: the canonical
 * implementation index marks it as a non-existent block.
 */
export const F9_BLOCK_CODES = [
  "9.00", "9.01", "9.03", "9.04", "9.05", "9.06", "9.07", "9.08", "9.09", "9.10", "9.11", "9.12",
  "9.13", "9.14", "9.15", "9.16", "9.17", "9.18", "9.19", "9.20", "9.22", "9.23", "9.24", "9.25",
  "9.26", "9.27", "9.28", "9.29", "9.30", "9.31", "9.32", "9.33", "9.34", "9.35", "9.36", "9.37",
  "9.38", "9.39", "9.40", "9.41",
] as const;
export type F9BlockCode = typeof F9_BLOCK_CODES[number];

export const LEARNING_CLASSIFICATIONS = ["POSITIVE", "NEGATIVE", "NEUTRAL", "INCONCLUSIVE", "MIXED"] as const;
export const LEARNING_STATUSES = ["READY", "WAITING_FOR_EVIDENCE", "BLOCKED", "REVIEW_REQUIRED"] as const;
export const LEARNING_CONFIDENCE = ["LOW", "MEDIUM", "HIGH"] as const;

const text = z.string().min(1);
const refs = z.array(text);
const json = z.record(z.string(), z.unknown());

export const learningExperienceInputSchema = z.object({
  organization_id: text,
  block_code: z.enum(F9_BLOCK_CODES),
  experience_id: text,
  intervention_id: text.nullable(),
  recommendation_id: text.nullable(),
  output_id: text.nullable(),
  business_context: json,
  problem_state: json,
  decision_context: json,
  planned_execution: json,
  actual_execution: json,
  environment: json,
  constraints: z.array(json),
  observation_window: z.object({ start: text.nullable(), end: text.nullable(), horizon: text }),
  expected_outcome: json,
  observed_outcome: json,
  evidence: z.object({
    measurement_quality: z.enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"]),
    attribution_strength: z.enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"]),
    evidence_strength: z.enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"]),
    sample_sufficient: z.boolean(),
    confounders: refs,
    source_refs: refs,
  }),
  source_refs: refs,
  unresolved_unknowns: refs,
});
export type LearningExperienceInput = z.input<typeof learningExperienceInputSchema>;

export const learningAssessmentSchema = z.object({
  organization_id: text,
  block_code: z.enum(F9_BLOCK_CODES),
  experience_id: text,
  status: z.enum(LEARNING_STATUSES),
  classification: z.enum(LEARNING_CLASSIFICATIONS),
  confidence: z.enum(LEARNING_CONFIDENCE),
  gate: z.boolean(),
  rationale: refs,
  learning: refs,
  next_evidence_needed: refs,
  unresolved_unknowns: refs,
  source_refs: refs,
  input_fingerprint: text,
  evaluated_at: z.string().datetime({ offset: true }),
  deterministic: z.literal(true),
});
export type LearningAssessment = z.infer<typeof learningAssessmentSchema>;

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];
const hasEvidence = (input: LearningExperienceInput) => input.evidence.measurement_quality !== "UNKNOWN"
  && input.evidence.attribution_strength !== "UNKNOWN"
  && input.evidence.evidence_strength !== "UNKNOWN"
  && input.evidence.sample_sufficient;

/** Pure F9 gate. It never turns an operational success into causal learning. */
export function evaluateContinuousLearning(raw: LearningExperienceInput, evaluatedAt = new Date().toISOString()): LearningAssessment {
  const parsed = learningExperienceInputSchema.safeParse(raw);
  if (!parsed.success) {
    return learningAssessmentSchema.parse({
      organization_id: typeof (raw as Partial<LearningExperienceInput>).organization_id === "string" ? raw.organization_id : "invalid-organization",
      block_code: F9_BLOCK_CODES.includes((raw as Partial<LearningExperienceInput>).block_code as F9BlockCode) ? raw.block_code : "9.41",
      experience_id: "invalid-experience", status: "BLOCKED", classification: "INCONCLUSIVE", confidence: "LOW", gate: false,
      rationale: ["input_schema"], learning: [], next_evidence_needed: ["Completar el contrato de experiencia"], unresolved_unknowns: ["input_schema"], source_refs: [], input_fingerprint: "invalid", evaluated_at: evaluatedAt, deterministic: true,
    });
  }
  const input = parsed.data;
  const rationale: string[] = [];
  const unknowns = [...input.unresolved_unknowns];
  const nextEvidence = [...unknowns];
  const evidenceReady = hasEvidence(input);
  const outcome = String(input.observed_outcome.classification ?? "INCONCLUSIVE").toUpperCase();
  const classification = LEARNING_CLASSIFICATIONS.includes(outcome as typeof LEARNING_CLASSIFICATIONS[number]) ? outcome as typeof LEARNING_CLASSIFICATIONS[number] : "INCONCLUSIVE";
  if (!input.business_context || Object.keys(input.business_context).length === 0) { unknowns.push("business_context"); rationale.push("Falta contexto de negocio relevante."); }
  if (!input.actual_execution || Object.keys(input.actual_execution).length === 0) { unknowns.push("actual_execution"); rationale.push("Falta ejecución real; no se puede separar estrategia de ejecución."); }
  if (!evidenceReady) { rationale.push("La evidencia no alcanza el umbral mínimo de medición, atribución, fuerza o muestra."); nextEvidence.push("Completar medición, atribución, fuerza de evidencia y suficiencia muestral."); }
  if (input.evidence.confounders.length) { rationale.push("Existen confusores declarados; no se deben ocultar bajo el promedio."); nextEvidence.push("Resolver o acotar confusores antes de promover learning."); }
  if (classification === "INCONCLUSIVE") rationale.push("INCONCLUSIVE se conserva separado de NEUTRAL: falta evidencia, no hay prueba de ausencia de efecto.");
  if (classification === "MIXED") rationale.push("El resultado tiene efectos divergentes; se conserva la heterogeneidad por métrica, segmento u horizonte.");
  if (classification === "POSITIVE" && input.evidence.attribution_strength === "UNKNOWN") { rationale.push("Un outcome positivo de negocio sin atribución suficiente no prueba que la intervención funcionó."); }
  const gate = evidenceReady && unknowns.length === 0 && classification !== "INCONCLUSIVE";
  const status = gate ? (classification === "MIXED" ? "REVIEW_REQUIRED" : "READY") : (!evidenceReady || classification === "INCONCLUSIVE") ? "WAITING_FOR_EVIDENCE" : "BLOCKED";
  const confidence = gate && input.evidence.evidence_strength === "HIGH" && input.evidence.attribution_strength === "HIGH" ? "HIGH" : gate ? "MEDIUM" : "LOW";
  const learning = gate ? [`Resultado ${classification} sobre una experiencia trazable; reutilizarlo solo dentro de su contexto y límites.`] : [];
  return learningAssessmentSchema.parse({
    organization_id: input.organization_id, block_code: input.block_code, experience_id: input.experience_id, status, classification, confidence, gate,
    rationale: unique(rationale), learning, next_evidence_needed: unique(nextEvidence), unresolved_unknowns: unique(unknowns), source_refs: unique([...input.source_refs, ...input.evidence.source_refs]),
    input_fingerprint: fingerprintLearningInput(input), evaluated_at: evaluatedAt, deterministic: true,
  });
}

export function fingerprintLearningInput(input: LearningExperienceInput): string {
  return `f9:${input.organization_id}:${input.block_code}:${input.experience_id}:${input.output_id ?? "none"}:${input.observation_window.start ?? "none"}:${input.observation_window.end ?? "none"}`;
}
