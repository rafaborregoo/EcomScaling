import { z } from "zod";

/** F8.02: autonomía graduada y aprobación humana. La evaluación nunca autoriza ejecución. */
export const HITL_AUTONOMY_LEVELS = [
  "OBSERVE",
  "RECOMMEND",
  "PREPARE",
  "APPROVAL_GATED",
  "BOUNDED_AUTONOMY",
  "ADAPTIVE_BOUNDED_AUTONOMY",
  "HIGH_AUTONOMY",
  "HUMAN_ONLY",
] as const;
export type HitlAutonomyLevel = (typeof HITL_AUTONOMY_LEVELS)[number];

export const HITL_APPROVAL_REQUIREMENTS = [
  "NOT_REQUIRED",
  "APPROVAL",
  "SPECIALIZED_APPROVAL",
  "DUAL_APPROVAL",
  "HUMAN_REVIEW",
  "HUMAN_ONLY",
] as const;
export type HitlApprovalRequirement = (typeof HITL_APPROVAL_REQUIREMENTS)[number];

export const HITL_APPROVAL_STATES = [
  "NOT_REQUIRED",
  "PENDING",
  "APPROVED",
  "CONDITIONALLY_APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "EXPIRED",
  "REVOKED",
] as const;
export type HitlApprovalState = (typeof HITL_APPROVAL_STATES)[number];

export const HITL_EXECUTION_STATES = [
  "NOT_STARTED",
  "PREPARED",
  "BLOCKED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "PAUSED",
  "CANCELLED",
] as const;
export type HitlExecutionState = (typeof HITL_EXECUTION_STATES)[number];

export const HITL_GRANULARITIES = ["ACTION", "BATCH", "PLAN", "OBJECTIVE"] as const;
export const HITL_REVIEW_TIMINGS = ["BEFORE", "DURING", "AFTER"] as const;
export const HITL_DISPOSITIONS = [
  "AUTONOMY_AVAILABLE",
  "APPROVAL_REQUIRED",
  "ESCALATION_REQUIRED",
  "HUMAN_ONLY",
  "VALIDATION_REQUIRED",
] as const;

const text = z.string().min(1);
const refs = z.array(text);
const autonomy = z.enum(HITL_AUTONOMY_LEVELS);

export const hitlPreApprovalSchema = z.object({
  active: z.boolean(),
  conditions: refs,
  scope: text,
  limits: refs,
  valid_until: z.string().datetime().nullable(),
  revoked: z.boolean(),
});

export const hitlPolicySchema = z.object({
  autonomy_level: autonomy,
  autonomy_ceiling: autonomy,
  approval_requirement: z.enum(HITL_APPROVAL_REQUIREMENTS),
  approval_granularity: z.enum(HITL_GRANULARITIES),
  required_approver_type: text,
  required_approval_tier: text,
  dual_approval_required: z.boolean(),
  human_only: z.boolean(),
  fail_closed: z.boolean(),
  pre_approval: hitlPreApprovalSchema.nullable(),
  review_timing: z.enum(HITL_REVIEW_TIMINGS),
  intervention_ownership: z.enum(["AI_OWNED", "HUMAN_OWNED", "SHARED"]),
});

export const hitlExistingApprovalSchema = z.object({
  approval_id: text,
  state: z.enum(HITL_APPROVAL_STATES),
  approved_scope: text,
  approved_version: text,
  conditions: refs,
  valid_until: z.string().datetime().nullable(),
  approved_at: z.string().datetime().nullable(),
  freshness_ok: z.boolean(),
  authority_valid: z.boolean(),
  revoked: z.boolean(),
  approver_type: text,
  approver_id: text,
});

export const hitlApprovalInputSchema = z.object({
  context_id: text,
  business_id: text,
  decision_cycle_id: text,
  action_id: text,
  action_type: text,
  action_description: text,
  domain: text,
  proposer_id: text,
  requested_autonomy: autonomy,
  is_material: z.boolean(),
  risk: text,
  impact: text,
  financial_exposure: text,
  customer_exposure: text,
  blast_radius: text,
  reversibility: text,
  sensitivity: text,
  uncertainty: text,
  novelty: text,
  policy: hitlPolicySchema,
  existing_approval: hitlExistingApprovalSchema.nullable(),
  source_refs: refs,
  unresolved_unknowns: refs,
});
export type HitlApprovalInput = z.input<typeof hitlApprovalInputSchema>;

export const hitlApprovalPackageSchema = z.object({
  action: text,
  reason: text,
  expected_impact: text,
  risk: text,
  scope: text,
  reversibility: text,
  duration: text,
  no_action_consequence: text,
});

export const hitlApprovalResultSchema = z.object({
  context_id: text,
  business_id: text,
  decision_cycle_id: text,
  action_id: text,
  domain: text,
  disposition: z.enum(HITL_DISPOSITIONS),
  autonomy_level: autonomy,
  approval_requirement: z.enum(HITL_APPROVAL_REQUIREMENTS),
  approval_gate: z.boolean(),
  approval_state: z.enum(HITL_APPROVAL_STATES),
  approval_granularity: z.enum(HITL_GRANULARITIES),
  required_approver_type: text,
  required_approval_tier: text,
  approval_package: hitlApprovalPackageSchema,
  approval_scope: text,
  approval_conditions: refs,
  approval_valid_until: z.string().datetime().nullable(),
  approval_freshness: z.enum(["NOT_APPLICABLE", "CURRENT", "STALE", "UNKNOWN"]),
  revocation_status: z.enum(["NOT_APPLICABLE", "ACTIVE", "REVOKED", "UNKNOWN"]),
  escalation_required: z.boolean(),
  escalation_reasons: refs,
  escalation_target: text,
  intervention_ownership: z.enum(["AI_OWNED", "HUMAN_OWNED", "SHARED"]),
  review_timing: z.enum(HITL_REVIEW_TIMINGS),
  execution_state: z.enum(HITL_EXECUTION_STATES),
  quality_flags: refs,
  unresolved_unknowns: refs,
  reason_codes: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type HitlApprovalResult = z.infer<typeof hitlApprovalResultSchema>;

const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const normalized = (value: string) => value.trim().toUpperCase();
const unknown = (value: string) => ["", "UNKNOWN", "UNAVAILABLE", "NOT_ASSESSED", "NOT_DECLARED"].includes(normalized(value));
const has = (value: string, ...tokens: string[]) => tokens.some((token) => normalized(value).includes(token));

function fallback(raw: Partial<HitlApprovalInput>, evaluatedAt: string): HitlApprovalResult {
  return hitlApprovalResultSchema.parse({
    context_id: typeof raw.context_id === "string" ? raw.context_id : "invalid-context",
    business_id: typeof raw.business_id === "string" ? raw.business_id : "invalid-business",
    decision_cycle_id: typeof raw.decision_cycle_id === "string" ? raw.decision_cycle_id : "invalid-cycle",
    action_id: typeof raw.action_id === "string" ? raw.action_id : "invalid-action",
    domain: typeof raw.domain === "string" ? raw.domain : "UNKNOWN",
    disposition: "VALIDATION_REQUIRED", autonomy_level: "HUMAN_ONLY", approval_requirement: "HUMAN_ONLY",
    approval_gate: true, approval_state: "PENDING", approval_granularity: "ACTION",
    required_approver_type: "UNKNOWN", required_approval_tier: "UNKNOWN",
    approval_package: { action: "UNKNOWN", reason: "El contrato de entrada no es válido.", expected_impact: "UNKNOWN", risk: "UNKNOWN", scope: "UNKNOWN", reversibility: "UNKNOWN", duration: "UNKNOWN", no_action_consequence: "UNKNOWN" },
    approval_scope: "UNKNOWN", approval_conditions: [], approval_valid_until: null, approval_freshness: "UNKNOWN", revocation_status: "UNKNOWN",
    escalation_required: true, escalation_reasons: ["input_schema"], escalation_target: "UNKNOWN", intervention_ownership: "HUMAN_OWNED", review_timing: "BEFORE", execution_state: "BLOCKED",
    quality_flags: ["HITL.INPUT_SCHEMA_INVALID"], unresolved_unknowns: ["input_schema"], reason_codes: ["HITL.INPUT_SCHEMA_INVALID"], source_refs: Array.isArray(raw.source_refs) ? raw.source_refs.filter((item): item is string => typeof item === "string") : [], evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true,
  });
}

export function evaluateHitlApproval(raw: HitlApprovalInput, evaluatedAt = new Date().toISOString()): HitlApprovalResult {
  const parsed = hitlApprovalInputSchema.safeParse(raw);
  if (!parsed.success) return fallback(raw as Partial<HitlApprovalInput>, evaluatedAt);
  const input = parsed.data;
  const missing = [...input.unresolved_unknowns];
  for (const field of ["action_description", "domain", "risk", "impact", "reversibility", "uncertainty"] as const) if (unknown(input[field])) missing.push(field);
  const criticalUnknown = missing.length > input.unresolved_unknowns.length;
  const highRisk = has(input.risk, "HIGH", "CRITICAL", "MATERIAL") || has(input.sensitivity, "HIGH", "REGULATORY") || has(input.reversibility, "IRREVERSIBLE", "UNKNOWN");
  const highExposure = has(input.financial_exposure, "HIGH", "MATERIAL") || has(input.customer_exposure, "HIGH", "MATERIAL") || has(input.blast_radius, "HIGH", "GLOBAL", "MATERIAL");
  const uncertainOrNovel = has(input.uncertainty, "HIGH", "MATERIAL", "UNKNOWN") || has(input.novelty, "HIGH", "NEW", "UNVALIDATED");
  const humanOnly = input.policy.human_only || input.policy.autonomy_ceiling === "HUMAN_ONLY" || input.policy.approval_requirement === "HUMAN_ONLY";
  const gated = humanOnly || input.is_material || highRisk || highExposure || uncertainOrNovel || input.policy.approval_requirement !== "NOT_REQUIRED" || input.policy.autonomy_level === "APPROVAL_GATED";
  const policyGate = input.policy.approval_requirement !== "NOT_REQUIRED" ? input.policy.approval_requirement : "APPROVAL";
  const approvalRequirement = humanOnly ? "HUMAN_ONLY" : gated ? (input.policy.dual_approval_required ? "DUAL_APPROVAL" : policyGate) : "NOT_REQUIRED";
  const reasons = unique([
    ...(input.is_material ? ["material_action"] : []), ...(highRisk ? ["risk_or_irreversibility"] : []), ...(highExposure ? ["material_exposure"] : []), ...(uncertainOrNovel ? ["uncertainty_or_novelty"] : []), ...(input.policy.approval_requirement !== "NOT_REQUIRED" ? ["policy_gate"] : []), ...(humanOnly ? ["human_only_policy"] : []),
  ]);
  const approval = input.existing_approval;
  const approvalExpired = Boolean(approval?.valid_until && new Date(approval.valid_until).getTime() <= new Date(evaluatedAt).getTime());
  const approvalInvalid = Boolean(approval && (!approval.authority_valid || approval.revoked || !approval.freshness_ok || approvalExpired));
  const approvalState: HitlApprovalState = !gated ? "NOT_REQUIRED" : !approval ? "PENDING" : approvalInvalid ? (approval.revoked ? "REVOKED" : approvalExpired ? "EXPIRED" : "PENDING") : approval.state;
  const freshness: HitlApprovalResult["approval_freshness"] = !approval ? (gated ? "UNKNOWN" : "NOT_APPLICABLE") : approvalInvalid ? (approvalExpired || !approval.freshness_ok ? "STALE" : "UNKNOWN") : "CURRENT";
  const disposition: HitlApprovalResult["disposition"] = criticalUnknown ? "VALIDATION_REQUIRED" : humanOnly ? "HUMAN_ONLY" : gated && approvalState !== "APPROVED" && approvalState !== "CONDITIONALLY_APPROVED" && approvalState !== "PARTIALLY_APPROVED" ? "APPROVAL_REQUIRED" : "AUTONOMY_AVAILABLE";
  const escalationReasons = unique([...reasons, ...(approvalInvalid ? ["approval_invalid_or_stale"] : []), ...(criticalUnknown ? ["critical_context_unknown"] : [])]);
  const result: HitlApprovalResult = {
    context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, action_id: input.action_id, domain: input.domain,
    disposition, autonomy_level: humanOnly ? "HUMAN_ONLY" : gated ? "APPROVAL_GATED" : input.policy.autonomy_level,
    approval_requirement: approvalRequirement, approval_gate: gated, approval_state: approvalState, approval_granularity: input.policy.approval_granularity,
    required_approver_type: input.policy.required_approver_type, required_approval_tier: input.policy.required_approval_tier,
    approval_package: { action: input.action_description, reason: reasons.length ? `Gate activado por: ${reasons.join(", ")}.` : "La política permite preparar la acción.", expected_impact: input.impact, risk: input.risk, scope: approval?.approved_scope ?? input.action_id, reversibility: input.reversibility, duration: input.policy.pre_approval?.valid_until ?? "NOT_DECLARED", no_action_consequence: "NOT_DECLARED" },
    approval_scope: approval?.approved_scope ?? input.action_id, approval_conditions: approval?.conditions ?? input.policy.pre_approval?.conditions ?? [], approval_valid_until: approval?.valid_until ?? input.policy.pre_approval?.valid_until ?? null,
    approval_freshness: freshness, revocation_status: approval?.revoked ? "REVOKED" : approval ? "ACTIVE" : gated ? "UNKNOWN" : "NOT_APPLICABLE",
    escalation_required: criticalUnknown || humanOnly || (gated && approvalState !== "APPROVED" && approvalState !== "CONDITIONALLY_APPROVED" && approvalState !== "PARTIALLY_APPROVED"), escalation_reasons: escalationReasons, escalation_target: input.policy.required_approver_type,
    intervention_ownership: input.policy.intervention_ownership, review_timing: input.policy.review_timing,
    execution_state: gated ? "BLOCKED" : "NOT_STARTED", quality_flags: unique([...(input.policy.fail_closed && gated ? ["HITL.FAIL_CLOSED_GATE"] : []), ...(approvalInvalid ? ["HITL.APPROVAL_NOT_CURRENT"] : [])]), unresolved_unknowns: unique(missing), reason_codes: unique([...(criticalUnknown ? ["HITL.CONTEXT_INCOMPLETE"] : []), ...escalationReasons]), source_refs: input.source_refs, evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true,
  };
  return hitlApprovalResultSchema.parse(result);
}

