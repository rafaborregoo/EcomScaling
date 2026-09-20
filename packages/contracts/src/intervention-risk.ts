import { z } from "zod";

export const INTERVENTION_RISK_DISPOSITIONS = [
  "RISK_ACCEPTABLE_WITH_GUARDRAILS",
  "RISK_REQUIRES_MITIGATION",
  "VALIDATION_REQUIRED",
  "DO_NOT_PROCEED",
] as const;
export type InterventionRiskDisposition = (typeof INTERVENTION_RISK_DISPOSITIONS)[number];
export const INTERVENTION_RISK_RUN_DISPOSITIONS = [
  "RISK_ASSESSMENTS_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_RISK_CANDIDATES",
] as const;
export type InterventionRiskRunDisposition = (typeof INTERVENTION_RISK_RUN_DISPOSITIONS)[number];

const refs = z.array(z.string().min(1));
const level = z.enum(["LIMITED", "MODERATE", "MATERIAL", "SEVERE", "EXISTENTIAL", "UNKNOWN"]);
const textList = z.array(z.string().min(1));

const reversibility = z.object({
  can_revert: z.enum(["TRUE", "FALSE", "PARTIAL", "UNKNOWN"]),
  reversal_delay: z.string().min(1),
  reversal_cost: z.string().min(1),
  residual_damage: z.string().min(1),
});
const blastRadius = z.object({ scope: textList, level, concentration: refs, dependencies: refs });
const guardrails = z.object({ hard_veto: z.boolean(), status: z.enum(["PASS", "FAIL", "UNKNOWN"]), refs });
const observability = z.object({ monitoring_available: z.enum(["TRUE", "FALSE", "UNKNOWN"]), detection_speed: z.string().min(1), feedback_loop: z.string().min(1), measurement_quality: z.string().min(1) });
const scenarios = z.object({ downside_case: z.string().min(1), base_case: z.string().min(1), upside_case: z.string().min(1), tail_risk: z.string().min(1) });
const costOfError = z.object({ severity: level, action: level, delay: level, failure: level, rollback: level, residual: level });
const tradeoff = z.object({ accepted: refs, avoided: refs, introduced: refs, transferred: refs });
const quantitativeClaim = z.object({ claim: z.string().min(1), value: z.number().finite(), unit: z.string().min(1), support_refs: refs });

export const interventionRiskInputSchema = z.object({
  candidate_id: z.string().min(1),
  priority_tier: z.enum(["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"]).optional(),
  expected_impact_disposition: z.enum(["SUPPORTED_QUALITATIVE", "POTENTIAL_ONLY", "VALIDATION_REQUIRED", "NO_VALID_IMPACT"]),
  feasibility_disposition: z.enum(["FEASIBLE_NOW", "FEASIBLE_WITH_ADAPTATION", "VALIDATION_REQUIRED", "NOT_FEASIBLE_NOW"]),
  intervention: z.string().min(1), intended_outcome: z.string().min(1), commitment_level: z.string().min(1), exposure: z.string().min(1),
  potential_upside: textList, potential_downside: textList, evidence_strength: z.string().min(1), uncertainty: textList,
  reversibility_profile: reversibility, blast_radius: blastRadius, inaction_risk: textList, action_risk: textList,
  guardrails, observability, risk_dependencies: refs, risk_capacity: z.string().min(1), failure_modes: textList, scenarios,
  cost_of_error: costOfError, recommended_commitment: z.string().min(1), de_risking_actions: textList, risk_tradeoff: tradeoff,
  decision_conditions: textList, assumptions: textList, quantitative_support: z.boolean(), quantitative_claims: z.array(quantitativeClaim),
  unresolved_unknowns: refs, evidence_refs: refs, source_refs: refs,
});
export type InterventionRiskInput = z.input<typeof interventionRiskInputSchema>;

export const interventionRiskResultSchema = interventionRiskInputSchema.extend({
  disposition: z.enum(INTERVENTION_RISK_DISPOSITIONS),
  risk_trace: z.object({ upside: refs, downside: refs, exposure: refs, reversibility: refs, evidence_strength: z.string().min(1), inaction_risk: refs, recommended_commitment: z.string().min(1), de_risking: refs }),
  reason_codes: refs,
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type InterventionRiskResult = z.infer<typeof interventionRiskResultSchema>;

export const interventionRiskRunResultSchema = z.object({
  context_id: z.string().min(1), business_id: z.string().min(1), decision_cycle_id: z.string().min(1),
  disposition: z.enum(INTERVENTION_RISK_RUN_DISPOSITIONS), candidate_evaluations: z.array(interventionRiskResultSchema),
  primary_priority_candidate_id: z.string().min(1).nullable(), reason_codes: refs, unresolved_unknowns: refs, source_refs: refs,
  evaluated_at: z.string().datetime(), execution_authorized: z.literal(false), deterministic: z.literal(true),
});
export type InterventionRiskRunResult = z.infer<typeof interventionRiskRunResultSchema>;

function unique(values: string[]): string[] { return [...new Set(values)]; }

function fallback(raw: Partial<InterventionRiskInput>, reasons: string[], unknowns: string[]): InterventionRiskResult {
  const candidateId = typeof raw.candidate_id === "string" ? raw.candidate_id : "invalid-candidate";
  return interventionRiskResultSchema.parse({
    candidate_id: candidateId, ...(raw.priority_tier ? { priority_tier: raw.priority_tier } : {}),
    expected_impact_disposition: "VALIDATION_REQUIRED", feasibility_disposition: "VALIDATION_REQUIRED",
    intervention: typeof raw.intervention === "string" ? raw.intervention : "intervention not defined",
    intended_outcome: typeof raw.intended_outcome === "string" ? raw.intended_outcome : "outcome not defined",
    commitment_level: "UNKNOWN", exposure: "unknown", potential_upside: [], potential_downside: [], evidence_strength: "UNKNOWN", uncertainty: [],
    reversibility_profile: { can_revert: "UNKNOWN", reversal_delay: "unknown", reversal_cost: "unknown", residual_damage: "unknown" },
    blast_radius: { scope: [], level: "UNKNOWN", concentration: [], dependencies: [] }, inaction_risk: [], action_risk: [],
    guardrails: { hard_veto: false, status: "UNKNOWN", refs: [] }, observability: { monitoring_available: "UNKNOWN", detection_speed: "unknown", feedback_loop: "unknown", measurement_quality: "UNKNOWN" },
    risk_dependencies: [], risk_capacity: "UNKNOWN", failure_modes: [], scenarios: { downside_case: "unknown", base_case: "unknown", upside_case: "unknown", tail_risk: "unknown" },
    cost_of_error: { severity: "UNKNOWN", action: "UNKNOWN", delay: "UNKNOWN", failure: "UNKNOWN", rollback: "UNKNOWN", residual: "UNKNOWN" }, recommended_commitment: "GATHER_EVIDENCE", de_risking_actions: [], risk_tradeoff: { accepted: [], avoided: [], introduced: [], transferred: [] }, decision_conditions: [], assumptions: [], quantitative_support: false, quantitative_claims: [], unresolved_unknowns: unique(unknowns), evidence_refs: [], source_refs: [], disposition: "VALIDATION_REQUIRED", risk_trace: { upside: [], downside: [], exposure: [], reversibility: ["unknown"], evidence_strength: "UNKNOWN", inaction_risk: [], recommended_commitment: "GATHER_EVIDENCE", de_risking: [] }, reason_codes: unique(reasons), execution_authorized: false, deterministic: true,
  });
}

export function evaluateInterventionRisk(raw: InterventionRiskInput): InterventionRiskResult {
  const parsed = interventionRiskInputSchema.safeParse(raw);
  if (!parsed.success) return fallback(raw as Partial<InterventionRiskInput>, ["INPUT.SCHEMA_INVALID"], ["input_schema"]);
  const input = parsed.data;
  const unknowns = [...input.unresolved_unknowns];
  const reasons: string[] = [];
  if (input.reversibility_profile.can_revert === "UNKNOWN") { unknowns.push("reversibility"); reasons.push("REVERSIBILITY.UNKNOWN"); }
  if (input.guardrails.status === "UNKNOWN") { unknowns.push("guardrails"); reasons.push("GUARDRAIL.CONTEXT_UNKNOWN"); }
  if (input.risk_capacity === "UNKNOWN") { unknowns.push("tenant.risk_capacity"); reasons.push("TENANT.RISK_CAPACITY_UNKNOWN"); }
  if (input.observability.monitoring_available === "UNKNOWN" || input.observability.measurement_quality === "UNKNOWN") { unknowns.push("observability"); reasons.push("OBSERVABILITY.CONTEXT_UNKNOWN"); }
  if (input.quantitative_claims.length && !input.quantitative_support) reasons.push("RISK.NUMERIC_UNSUPPORTED");
  const normalizedClaims = input.quantitative_support ? input.quantitative_claims : [];
  if (input.guardrails.hard_veto || input.guardrails.status === "FAIL") reasons.push(input.guardrails.hard_veto ? "GUARDRAIL.HARD_VETO" : "GUARDRAIL.CONFLICT");
  if (input.reversibility_profile.can_revert === "FALSE") reasons.push("REVERSIBILITY.ONE_WAY_DOOR");
  if (input.cost_of_error.severity === "EXISTENTIAL") reasons.push("RISK.NO_RUIN");
  if (!input.potential_downside.length) { unknowns.push("potential_downside"); reasons.push("DOWNSIDE.MISSING"); }
  if (!input.inaction_risk.length) { unknowns.push("inaction_risk"); reasons.push("INACTION_RISK.MISSING"); }
  let disposition: InterventionRiskDisposition = "RISK_ACCEPTABLE_WITH_GUARDRAILS";
  if (input.guardrails.hard_veto || input.guardrails.status === "FAIL" || input.cost_of_error.severity === "EXISTENTIAL") disposition = "DO_NOT_PROCEED";
  else if (unknowns.length || input.reversibility_profile.can_revert === "FALSE" || input.cost_of_error.severity === "SEVERE") disposition = "VALIDATION_REQUIRED";
  else if (input.reversibility_profile.can_revert === "PARTIAL" || input.blast_radius.level === "MATERIAL" || input.cost_of_error.severity === "MATERIAL" || input.expected_impact_disposition !== "SUPPORTED_QUALITATIVE" || input.feasibility_disposition === "VALIDATION_REQUIRED") disposition = "RISK_REQUIRES_MITIGATION";
  return interventionRiskResultSchema.parse({
    ...input, quantitative_claims: normalizedClaims, disposition,
    risk_trace: { upside: unique(input.potential_upside), downside: unique(input.potential_downside), exposure: unique(input.blast_radius.scope), reversibility: [input.reversibility_profile.can_revert, input.reversibility_profile.reversal_delay, input.reversibility_profile.reversal_cost, input.reversibility_profile.residual_damage], evidence_strength: input.evidence_strength, inaction_risk: unique(input.inaction_risk), recommended_commitment: input.recommended_commitment, de_risking: unique(input.de_risking_actions) },
    reason_codes: unique(reasons), unresolved_unknowns: unique(unknowns), execution_authorized: false, deterministic: true,
  });
}

export function evaluateInterventionRiskSet(input: { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; candidates: InterventionRiskInput[]; evaluated_at: string }): InterventionRiskRunResult {
  const evaluations = input.candidates.map(evaluateInterventionRisk);
  const usable = evaluations.some((item) => ["RISK_ACCEPTABLE_WITH_GUARDRAILS", "RISK_REQUIRES_MITIGATION"].includes(item.disposition));
  return interventionRiskRunResultSchema.parse({ context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: evaluations.length === 0 ? "NO_RISK_CANDIDATES" : usable ? "RISK_ASSESSMENTS_AVAILABLE" : "VALIDATION_REQUIRED", candidate_evaluations: evaluations, primary_priority_candidate_id: input.primary_priority_candidate_id, reason_codes: unique(evaluations.flatMap((item) => item.reason_codes)), unresolved_unknowns: unique(evaluations.flatMap((item) => item.unresolved_unknowns)), source_refs: unique(evaluations.flatMap((item) => item.source_refs)), evaluated_at: input.evaluated_at, execution_authorized: false, deterministic: true });
}
