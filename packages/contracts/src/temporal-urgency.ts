import { z } from "zod";

export const TEMPORAL_ASSESSMENTS = ["TIME_CRITICAL", "TIME_SENSITIVE", "NOT_TIME_SENSITIVE", "UNKNOWN"] as const;
export const TEMPORAL_CONFIDENCES = ["SUFFICIENT_TO_ASSESS", "SUFFICIENT_WITH_LIMITATIONS", "VALIDATION_REQUIRED", "INSUFFICIENT", "UNKNOWN"] as const;
const ref = z.string().min(1);
const date = z.string().datetime();

const dependency = z.object({
  dependency_id: ref,
  relation: z.enum(["MUST_FINISH_BEFORE", "UNLOCKS", "CONCURRENT_WITH"]),
  predecessor_ref: ref,
  successor_ref: ref,
  slack_days: z.number().nonnegative().nullable(),
  source_refs: z.array(ref).default([]),
});

export const temporalUrgencyInputSchema = z.object({
  assessment_id: ref,
  business_id: ref,
  candidate_ref: ref,
  as_of: date,
  current_state: z.enum(["NO_DAMAGE", "AT_RISK", "DAMAGING", "RECOVERING", "OPPORTUNITY", "UNKNOWN"]),
  trajectory: z.enum(["STABLE", "LINEAR_DETERIORATION", "ACCELERATING", "THRESHOLD_OR_CLIFF", "COMPOUNDING", "TEMPORARY_WINDOW", "UNKNOWN"]),
  time_to_damage: z.object({ earliest_days: z.number().nonnegative().nullable(), base_days: z.number().nonnegative().nullable(), latest_days: z.number().nonnegative().nullable() }).nullable(),
  damage_velocity: z.enum(["NONE", "SLOW", "MODERATE", "FAST", "ACCELERATING", "UNKNOWN"]),
  cost_of_delay: z.enum(["NONE", "LOW", "MATERIAL", "SEVERE", "UNKNOWN"]),
  intervention_window: z.object({ opens_at: date.nullable(), closes_at: date.nullable() }).nullable(),
  decision_deadline: z.object({ at: date, type: z.enum(["HARD", "SOFT", "ARTIFICIAL"]), source_refs: z.array(ref).default([]) }).nullable(),
  time_to_irreversibility_days: z.number().nonnegative().nullable(),
  decision_lead_time_days: z.number().nonnegative().nullable(),
  execution_lead_time_days: z.number().nonnegative().nullable(),
  result_latency_days: z.number().nonnegative().nullable(),
  recoverability: z.enum(["RECOVERABLE", "PARTIAL", "PERSISTENT", "UNKNOWN"]),
  reversibility: z.enum(["REVERSIBLE", "PARTIAL", "IRREVERSIBLE", "UNKNOWN"]),
  temporal_dependencies: z.array(dependency).default([]),
  evidence_as_of: date.nullable(),
  freshness_requirement_hours: z.number().positive().nullable(),
  source_refs: z.array(ref).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type TemporalUrgencyInput = z.infer<typeof temporalUrgencyInputSchema>;
export type TemporalUrgencyInputLike = z.input<typeof temporalUrgencyInputSchema>;

export const temporalUrgencyResultSchema = temporalUrgencyInputSchema.extend({
  input_fingerprint: ref,
  evaluated_at: date,
  total_response_time_days: z.number().nonnegative().nullable(),
  temporal_assessment: z.enum(TEMPORAL_ASSESSMENTS),
  temporal_confidence: z.enum(TEMPORAL_CONFIDENCES),
  unresolved_unknowns: z.array(ref),
  reason_codes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/)),
  explanation: z.object({ why_time_matters: z.string().min(1), what_happens_if_wait: z.string().min(1), timing_uncertainty: z.string().min(1) }),
}).superRefine((result, ctx) => {
  if (result.temporal_assessment === "TIME_CRITICAL" && result.reason_codes.length === 0) ctx.addIssue({ code: "custom", path: ["reason_codes"], message: "TIME_CRITICAL exige fundamento." });
});
export type TemporalUrgencyResult = z.infer<typeof temporalUrgencyResultSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([key]) => !["metadata", "assessment_id", "as_of"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function fingerprintTemporalUrgencyInput(input: unknown): string {
  let hash = 2166136261;
  for (const char of canonical(input)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function evaluateTemporalUrgency(raw: TemporalUrgencyInputLike): TemporalUrgencyResult {
  const parsed = temporalUrgencyInputSchema.safeParse(raw);
  if (!parsed.success) throw new Error("temporal_urgency_input_invalid");
  const input = parsed.data;
  const unknowns: string[] = [];
  const reasons: string[] = [];
  const responseParts = [input.decision_lead_time_days, input.execution_lead_time_days, input.result_latency_days];
  const total = responseParts.every((part) => part !== null) ? responseParts.reduce((sum, part) => sum + (part ?? 0), 0) : null;
  if (total === null) unknowns.push("total_response_time");
  let assessment: (typeof TEMPORAL_ASSESSMENTS)[number] = "UNKNOWN";
  let confidence: (typeof TEMPORAL_CONFIDENCES)[number] = "SUFFICIENT_WITH_LIMITATIONS";
  const asOf = new Date(input.as_of).getTime();
  const responseDeadline = total === null ? null : asOf + total * 86_400_000;
  if (input.decision_deadline?.type === "HARD" && responseDeadline !== null) {
    if (new Date(input.decision_deadline.at).getTime() <= responseDeadline) { assessment = "TIME_CRITICAL"; reasons.push("DEADLINE.HARD_WITHIN_RESPONSE"); }
    else { assessment = "TIME_SENSITIVE"; reasons.push("DEADLINE.HARD_RELEVANT"); }
  } else if (input.intervention_window?.closes_at && responseDeadline !== null) {
    if (new Date(input.intervention_window.closes_at).getTime() <= responseDeadline) { assessment = "TIME_CRITICAL"; reasons.push("WINDOW.CLOSES_BEFORE_RESPONSE"); }
    else if (input.trajectory !== "UNKNOWN") { assessment = "TIME_SENSITIVE"; reasons.push("WINDOW.OPEN_WITH_LIMITED_SLACK"); }
  } else if (input.time_to_irreversibility_days !== null && total !== null && input.time_to_irreversibility_days <= total) {
    assessment = "TIME_CRITICAL"; reasons.push("IRREVERSIBILITY.WITHIN_RESPONSE");
  } else {
    unknowns.push("timing");
    confidence = "INSUFFICIENT";
    reasons.push("TIME.UNKNOWN");
  }
  const stale = input.evidence_as_of && input.freshness_requirement_hours !== null && (asOf - new Date(input.evidence_as_of).getTime()) > input.freshness_requirement_hours * 3_600_000;
  if (stale) { confidence = "VALIDATION_REQUIRED"; reasons.push("EVIDENCE.STALE"); unknowns.push("evidence_freshness"); }
  if (input.trajectory === "UNKNOWN") unknowns.push("trajectory");
  if (unknowns.length && confidence === "SUFFICIENT_WITH_LIMITATIONS") confidence = "VALIDATION_REQUIRED";
  const waitText = assessment === "UNKNOWN" ? "No se puede afirmar qué ocurre al esperar sin una ventana o deadline soportado." : assessment === "TIME_CRITICAL" ? "La ventana o el deadline se cruza con el tiempo total de respuesta." : "Esperar consume margen temporal aunque todavía exista una ventana.";
  return temporalUrgencyResultSchema.parse({ ...input, input_fingerprint: fingerprintTemporalUrgencyInput(input), evaluated_at: new Date().toISOString(), total_response_time_days: total, temporal_assessment: assessment, temporal_confidence: confidence, unresolved_unknowns: [...new Set(unknowns)], reason_codes: [...new Set(reasons)], explanation: { why_time_matters: assessment === "UNKNOWN" ? "El timing decisional no está suficientemente observado." : "El valor de la decisión depende de una ventana temporal explícita.", what_happens_if_wait: waitText, timing_uncertainty: unknowns.length ? `Pendiente: ${[...new Set(unknowns)].join(", ")}.` : "No se declaró incertidumbre temporal adicional." } });
}
