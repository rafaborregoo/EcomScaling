import { z } from "zod";

export const PRIORITIZATION_RUN_STATUSES = [
  "CREATED", "INPUT_INCOMPLETE", "READY", "EVALUATING", "COMPLETED",
  "ABSTAINED", "INVALIDATED", "FAILED",
] as const;
export type PrioritizationRunStatus = (typeof PRIORITIZATION_RUN_STATUSES)[number];

export const DECISION_VALIDITIES = [
  "VALID", "VALID_WITH_LIMITATIONS", "REQUIRES_VALIDATION",
  "INSUFFICIENT_INFORMATION", "NO_VALID_CANDIDATES", "STALE", "INVALID",
] as const;
export type DecisionValidity = (typeof DECISION_VALIDITIES)[number];

export const GATE_RESULTS = ["PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"] as const;
export type GateResult = (typeof GATE_RESULTS)[number];

export const DECISION_EPISTEMIC_STATES = [
  "OBSERVED", "CALCULATED", "ESTIMATED", "INFERRED", "UNKNOWN", "NOT_APPLICABLE",
] as const;
export const DECISION_CONFIDENCES = [
  "SUFFICIENT_TO_DECIDE", "SUFFICIENT_WITH_LIMITATIONS", "VALIDATION_REQUIRED", "INSUFFICIENT", "UNKNOWN",
] as const;
export const DECISION_CLASSIFICATIONS = [
  "immediate_attention", "prioritize", "validate_first", "schedule", "monitor", "defer", "blocked", "exclude",
] as const;

export const PRIORITIZATION_REASON_CODES = [
  "INPUT.MISSING_REQUIRED", "INPUT.CANDIDATE_OUTSIDE_SET", "INPUT.INVALID_REFERENCE",
  "INPUT.TENANT_INVALID", "INPUT.CONTRADICTORY_CONTEXT", "GATE.REQUIRED_UNKNOWN",
  "GATE.HARD_FAIL", "DEPENDENCY.BLOCKED", "EVIDENCE.INSUFFICIENT",
  "DATA.STALE", "DECISION.NO_VALID_CANDIDATES", "DECISION.ABSTAINED",
] as const;
export type PrioritizationReasonCode = (typeof PRIORITIZATION_REASON_CODES)[number] | `${string}.${string}`;

const reference = z.string().min(1);

export const prioritizationCandidateSchema = z.object({
  candidate_id: reference,
  candidate_type: z.enum(["PROBLEM", "CONSTRAINT", "RISK", "OPPORTUNITY", "VALIDATION_NEED"]),
  epistemic_state: z.enum(DECISION_EPISTEMIC_STATES).default("OBSERVED"),
});
export type PrioritizationCandidate = z.input<typeof prioritizationCandidateSchema>;

export const prioritizationGateSchema = z.object({
  gate_id: reference,
  gate_version: z.string().min(1).default("v1"),
  result: z.enum(GATE_RESULTS),
  reason_code: z.string().regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/).optional(),
  applicability_rule_ref: reference.optional(),
  evidence_refs: z.array(reference).default([]),
  evaluated_at: z.string().datetime().optional(),
}).superRefine((gate, ctx) => {
  if (gate.result === "NOT_APPLICABLE" && !gate.applicability_rule_ref) {
    ctx.addIssue({ code: "custom", path: ["applicability_rule_ref"], message: "NOT_APPLICABLE exige una regla de aplicabilidad explícita." });
  }
});
export type PrioritizationGate = z.input<typeof prioritizationGateSchema>;

export const prioritizationRuleTraceSchema = z.object({
  rule_trace_id: reference,
  rule_id: reference,
  rule_version: z.string().min(1),
  rule_type: z.enum(["gate", "dependency", "override", "comparison", "validation", "input", "output"]),
  input_refs: z.array(reference).default([]),
  result: z.unknown(),
  reason_codes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/)).default([]),
  evidence_refs: z.array(reference).default([]),
  deterministic: z.boolean(),
  executed_at: z.string().datetime(),
});
export type PrioritizationRuleTrace = z.infer<typeof prioritizationRuleTraceSchema>;

export const prioritizationInputSchema = z.object({
  prioritization_run_id: reference,
  business_id: reference,
  analysis_snapshot_id: reference,
  created_at: z.string().datetime(),
  decision_as_of: z.string().datetime(),
  schema_version: z.string().min(1),
  decision_policy_version: z.string().min(1),
  diagnostic_refs: z.array(reference).default([]),
  decision_context_ref: reference.nullable().optional(),
  candidate_set_ref: reference.nullable().optional(),
  evaluation_time: z.string().datetime().nullable().optional(),
  candidates: z.array(prioritizationCandidateSchema).default([]),
  gates: z.array(prioritizationGateSchema).default([]),
  candidate_evaluation_refs: z.array(prioritizationCandidateSchema.extend({
    rank: z.number().int().positive().optional(),
  })).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  material_values: z.record(z.string(), z.unknown()).optional(),
  technical_error: z.string().min(1).optional(),
});
export type PrioritizationInput = z.infer<typeof prioritizationInputSchema>;

export const prioritizationEvaluationSchema = z.object({
  candidate_id: reference,
  candidate_type: z.enum(["PROBLEM", "CONSTRAINT", "RISK", "OPPORTUNITY", "VALIDATION_NEED"]),
  epistemic_state: z.enum(DECISION_EPISTEMIC_STATES).default("OBSERVED"),
  rank: z.number().int().positive().optional(),
  priority_tier: z.string().min(1).optional(),
  classification: z.enum(DECISION_CLASSIFICATIONS).optional(),
  decision_confidence: z.enum(DECISION_CONFIDENCES).default("UNKNOWN"),
  why_now: z.string().min(1).optional(),
  why_before: z.string().min(1).optional(),
  primary_drivers: z.array(z.string()).default([]),
  counterarguments: z.array(z.string()).default([]),
  uncertainty: z.array(z.string()).default([]),
  what_would_change_priority: z.array(z.string()).default([]),
});
export type PrioritizationEvaluation = z.infer<typeof prioritizationEvaluationSchema>;

export const prioritizationResultSchema = z.object({
  prioritization_run_id: reference,
  business_id: reference,
  analysis_snapshot_id: reference,
  created_at: z.string().datetime(),
  decision_as_of: z.string().datetime(),
  completed_at: z.string().datetime().nullable().optional(),
  schema_version: z.string().min(1),
  decision_policy_version: z.string().min(1),
  input_fingerprint: reference,
  run_status: z.enum(PRIORITIZATION_RUN_STATUSES),
  decision_validity: z.enum(DECISION_VALIDITIES),
  candidate_evaluation_refs: z.array(prioritizationEvaluationSchema).optional(),
  ranking_result_ref: reference.optional(),
  portfolio_result_ref: reference.optional(),
  decision_explanation_ref: reference.optional(),
  unresolved_unknowns: z.array(reference).default([]),
  abstention_reason_codes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/)).default([]),
  rule_trace_refs: z.array(reference),
  source_lineage_refs: z.array(reference),
  gates: z.array(prioritizationGateSchema).default([]),
  warnings: z.array(reference).default([]),
}).superRefine((result, ctx) => {
  if (result.run_status === "ABSTAINED" && result.abstention_reason_codes.length === 0) {
    ctx.addIssue({ code: "custom", path: ["abstention_reason_codes"], message: "ABSTAINED exige reason codes." });
  }
  if (result.run_status === "FAILED" && result.decision_validity !== "INVALID") {
    ctx.addIssue({ code: "custom", path: ["decision_validity"], message: "FAILED no puede exponerse como una decisión utilizable." });
  }
  if (result.run_status === "COMPLETED" && (result.rule_trace_refs.length === 0 || result.source_lineage_refs.length === 0)) {
    ctx.addIssue({ code: "custom", path: ["rule_trace_refs"], message: "COMPLETED exige trazabilidad y lineage." });
  }
});
export type PrioritizationResult = z.infer<typeof prioritizationResultSchema>;

export type PrioritizationInputLike = z.input<typeof prioritizationInputSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["metadata", "technical_error", "prioritization_run_id", "created_at", "evaluation_time"].includes(key))
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Huella estable de los campos decisionales; metadata de transporte no entra. */
export function fingerprintPrioritizationInput(input: unknown): string {
  let hash = 2166136261;
  for (const char of canonical(input)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function trace(input: PrioritizationInput, now: string, reason: string): PrioritizationRuleTrace {
  return {
    rule_trace_id: `${input.prioritization_run_id}:input`,
    rule_id: "P0.INPUT_VALIDATION",
    rule_version: input.schema_version,
    rule_type: "input",
    input_refs: [input.analysis_snapshot_id, ...input.diagnostic_refs],
    result: reason,
    reason_codes: [reason],
    evidence_refs: [input.analysis_snapshot_id],
    deterministic: true,
    executed_at: now,
  };
}

/**
 * P0 valida la ejecución y prepara el contenedor. No calcula prioridad final:
 * ese trabajo pertenece a P1-P10 y no puede colarse como score por defecto.
 */
export function evaluatePrioritizationRun(raw: PrioritizationInputLike): PrioritizationResult {
  const now = new Date().toISOString();
  const parsed = prioritizationInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fallback = raw as Partial<PrioritizationInput>;
    return {
      prioritization_run_id: fallback.prioritization_run_id ?? "invalid-run",
      business_id: fallback.business_id ?? "invalid-business",
      analysis_snapshot_id: fallback.analysis_snapshot_id ?? "unknown-snapshot",
      created_at: fallback.created_at ?? now,
      decision_as_of: fallback.decision_as_of ?? now,
      schema_version: fallback.schema_version ?? "p0.v1",
      decision_policy_version: fallback.decision_policy_version ?? "unknown",
      input_fingerprint: fingerprintPrioritizationInput(raw),
      run_status: "INPUT_INCOMPLETE",
      decision_validity: "INSUFFICIENT_INFORMATION",
      unresolved_unknowns: ["input_schema"],
      abstention_reason_codes: ["INPUT.MISSING_REQUIRED"],
      rule_trace_refs: [`${fallback.prioritization_run_id ?? "invalid-run"}:input`],
      source_lineage_refs: [],
      gates: [],
      warnings: ["INPUT.SCHEMA_INVALID"],
    };
  }
  const input = parsed.data;
  const fingerprint = fingerprintPrioritizationInput(input);
  const base = {
    prioritization_run_id: input.prioritization_run_id,
    business_id: input.business_id,
    analysis_snapshot_id: input.analysis_snapshot_id,
    created_at: input.created_at,
    decision_as_of: input.decision_as_of,
    schema_version: input.schema_version,
    decision_policy_version: input.decision_policy_version,
    input_fingerprint: fingerprint,
    // P0 solo valida el conjunto; las evaluaciones pertenecen a P1-P10.
    candidate_evaluation_refs: undefined,
    ranking_result_ref: undefined,
    portfolio_result_ref: undefined,
    decision_explanation_ref: undefined,
    rule_trace_refs: [`${input.prioritization_run_id}:input`],
    source_lineage_refs: [input.analysis_snapshot_id],
    gates: input.gates,
    warnings: [] as string[],
  };
  if (input.technical_error) {
    return prioritizationResultSchema.parse({ ...base, run_status: "FAILED", decision_validity: "INVALID", unresolved_unknowns: [], abstention_reason_codes: [], warnings: ["ENGINE.TECHNICAL_FAILURE"] });
  }
  const missing: string[] = [];
  if (!input.decision_context_ref) missing.push("decision_context");
  if (!input.candidate_set_ref) missing.push("candidate_set");
  if (!input.evaluation_time) missing.push("evaluation_time");
  const unknownGates = input.gates.filter((gate) => gate.result === "UNKNOWN").map((gate) => gate.gate_id);
  if (unknownGates.length) {
    return prioritizationResultSchema.parse({ ...base, run_status: "INPUT_INCOMPLETE", decision_validity: "INSUFFICIENT_INFORMATION", unresolved_unknowns: unknownGates, abstention_reason_codes: ["GATE.REQUIRED_UNKNOWN"], warnings: [] });
  }
  const failedGates = input.gates.filter((gate) => gate.result === "FAIL");
  if (failedGates.length) {
    return prioritizationResultSchema.parse({ ...base, run_status: "ABSTAINED", decision_validity: "REQUIRES_VALIDATION", unresolved_unknowns: [], abstention_reason_codes: ["GATE.HARD_FAIL", "DECISION.ABSTAINED"], warnings: failedGates.map((gate) => `GATE_FAILED:${gate.gate_id}`) });
  }
  if (missing.length) {
    return prioritizationResultSchema.parse({ ...base, run_status: "INPUT_INCOMPLETE", decision_validity: "INSUFFICIENT_INFORMATION", unresolved_unknowns: missing, abstention_reason_codes: ["INPUT.MISSING_REQUIRED"] });
  }
  const candidateIds = new Set(input.candidates.map((candidate) => candidate.candidate_id));
  if (input.candidate_evaluation_refs.some((candidate) => !candidateIds.has(candidate.candidate_id))) {
    return prioritizationResultSchema.parse({ ...base, run_status: "ABSTAINED", decision_validity: "NO_VALID_CANDIDATES", unresolved_unknowns: [], abstention_reason_codes: ["INPUT.CANDIDATE_OUTSIDE_SET", "DECISION.ABSTAINED"] });
  }
  if (input.candidates.length === 0) {
    return prioritizationResultSchema.parse({ ...base, run_status: "ABSTAINED", decision_validity: "NO_VALID_CANDIDATES", unresolved_unknowns: [], abstention_reason_codes: ["DECISION.NO_VALID_CANDIDATES", "DECISION.ABSTAINED"] });
  }
  return prioritizationResultSchema.parse({ ...base, run_status: "READY", decision_validity: "VALID_WITH_LIMITATIONS", unresolved_unknowns: [], abstention_reason_codes: [], rule_trace_refs: [`${input.prioritization_run_id}:input`] });
}
