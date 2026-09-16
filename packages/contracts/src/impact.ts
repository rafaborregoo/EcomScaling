import { z } from "zod";

export const IMPACT_VALUE_TYPES = [
  "REVENUE", "GROSS_PROFIT", "CONTRIBUTION", "OPERATING_PROFIT", "CASH",
  "WORKING_CAPITAL", "CUSTOMER_LIFETIME_VALUE", "INVENTORY", "OPERATIONAL_CAPACITY",
  "STRATEGIC_VALUE", "OPTIONALITY", "RESILIENCE", "LEARNING", "REPUTATION", "RISK_EXPOSURE",
] as const;
export const IMPACT_TYPES = ["PROTECT", "RECOVER", "UNLOCK", "ENABLE", "RISK_REDUCTION"] as const;
export const IMPACT_VALUE_STATES = ["REALIZED", "POTENTIAL", "RECOVERABLE", "IRRECOVERABLE"] as const;
export const IMPACT_EVIDENCE_BASES = ["MEASURED", "INFERRED", "POTENTIAL", "UNKNOWN"] as const;
export const IMPACT_ASSESSMENTS = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;

const ref = z.string().min(1);
const date = z.string().datetime();
const confidence = z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

const magnitude = z.object({
  absolute_value: z.number().nonnegative().nullable(),
  currency: z.string().min(1).nullable(),
  relative_share: z.number().min(0).max(1).nullable(),
  business_relative_materiality: z.enum(IMPACT_ASSESSMENTS),
});

const baseline = z.object({
  type: z.enum(["HISTORICAL_NORMAL", "FORECAST", "MATCHED_COHORT", "CONTROL", "EXPECTED_TRAJECTORY", "SEASONALLY_ADJUSTED"]),
  reference: ref,
  counterfactual_method: z.enum(["HISTORICAL_NORMAL", "FORECAST", "MATCHED_COHORT", "CONTROL", "EXPECTED_TRAJECTORY", "NONE"]),
  confidence,
});

const exposure = z.object({
  dimension: z.enum(["REVENUE", "CONTRIBUTION", "ORDERS", "CUSTOMERS", "TRAFFIC", "GEOGRAPHY", "DEVICE", "PRODUCT", "CHANNEL", "SUPPLIER", "PAYMENT"]),
  share: z.number().min(0).max(1).nullable(),
  unit_count: z.number().nonnegative().nullable(),
  value_density: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  source_refs: z.array(ref).min(1),
});

const incrementality = z.object({
  gross_value: z.number().nonnegative().nullable(),
  incremental_value: z.number().nonnegative().nullable(),
  cannibalization: z.enum(["NONE", "POSSIBLE", "MATERIAL", "UNKNOWN"]),
  substitution: z.enum(["NONE", "PARTIAL", "MATERIAL", "UNKNOWN"]),
  recapture: z.enum(["NONE", "PARTIAL", "MATERIAL", "UNKNOWN"]),
  counterfactual_present: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.incremental_value !== null && !value.counterfactual_present) ctx.addIssue({ code: "custom", message: "incrementality_requires_counterfactual" });
});

const scenarios = z.object({
  best: z.number().nonnegative().nullable(),
  base: z.number().nonnegative().nullable(),
  downside: z.number().nonnegative().nullable(),
  upside: z.number().nonnegative().nullable(),
  currency: z.string().min(1).nullable(),
});

export const decisionImpactInputSchema = z.object({
  assessment_id: ref,
  business_id: ref,
  candidate_ref: ref,
  as_of: date,
  value_type: z.enum(IMPACT_VALUE_TYPES),
  impact_type: z.enum(IMPACT_TYPES),
  value_state: z.enum(IMPACT_VALUE_STATES),
  evidence_basis: z.enum(IMPACT_EVIDENCE_BASES),
  magnitude,
  baseline: baseline.nullable(),
  exposure: z.array(exposure).min(1),
  recoverability: z.enum(["RECOVERABLE", "PARTIAL", "IRRECOVERABLE", "UNKNOWN"]),
  incrementality,
  scenarios,
  confidence: z.object({ diagnosis: confidence, impact: confidence, attribution: confidence, assumption_sensitivity: z.array(ref) }),
  assumptions: z.array(ref),
  explanation: z.object({ what_value: ref, mechanism: ref, whose_value: ref, horizon: ref, what_wait_changes: ref, uncertainty: ref }),
  source_refs: z.array(ref).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type DecisionImpactInput = z.infer<typeof decisionImpactInputSchema>;
export type DecisionImpactInputLike = z.input<typeof decisionImpactInputSchema>;

export const decisionImpactResultSchema = decisionImpactInputSchema.extend({
  input_fingerprint: ref,
  evaluated_at: date,
  impact_assessment: z.enum(IMPACT_ASSESSMENTS),
  unresolved_unknowns: z.array(ref),
  reason_codes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/)),
});
export type DecisionImpactResult = z.infer<typeof decisionImpactResultSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([key]) => !["metadata", "assessment_id", "as_of"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function fingerprintDecisionImpactInput(input: unknown): string {
  let hash = 2166136261;
  for (const char of canonical(input)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function evaluateDecisionImpact(raw: DecisionImpactInputLike): DecisionImpactResult {
  const parsed = decisionImpactInputSchema.safeParse(raw);
  if (!parsed.success) throw new Error("impact_input_invalid");
  const input = parsed.data;
  const unknowns: string[] = [];
  const reasons: string[] = [];
  if (input.baseline === null) { unknowns.push("baseline"); reasons.push("BASELINE.MISSING"); }
  if (input.magnitude.absolute_value === null) { unknowns.push("absolute_value"); reasons.push("MAGNITUDE.ABSOLUTE_UNKNOWN"); }
  if (!input.incrementality.counterfactual_present) { unknowns.push("incrementality"); reasons.push("INCREMENTALITY.COUNTERFACTUAL_MISSING"); }
  if (input.recoverability === "UNKNOWN") { unknowns.push("recoverability"); reasons.push("RECOVERY.UNKNOWN"); }
  if (input.confidence.attribution === "UNKNOWN") { unknowns.push("attribution"); reasons.push("ATTRIBUTION.UNKNOWN"); }
  if (input.evidence_basis === "INFERRED" || input.evidence_basis === "POTENTIAL") reasons.push("EVIDENCE.INFERRED_OR_POTENTIAL");
  let assessment: (typeof IMPACT_ASSESSMENTS)[number] = input.magnitude.business_relative_materiality;
  if (assessment !== "UNKNOWN" && input.baseline === null) assessment = "UNKNOWN";
  const result = decisionImpactResultSchema.parse({
    ...input,
    input_fingerprint: fingerprintDecisionImpactInput(input),
    evaluated_at: new Date().toISOString(),
    impact_assessment: assessment,
    unresolved_unknowns: [...new Set(unknowns)],
    reason_codes: [...new Set(reasons)],
  });
  return result;
}
