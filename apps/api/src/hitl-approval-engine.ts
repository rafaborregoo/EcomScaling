import { createClient } from "@supabase/supabase-js";
import { evaluateHitlApproval, fingerprintPlaybookInput, type HitlApprovalInput, type HitlApprovalResult, type HitlApprovalState, type HitlAutonomyLevel, type HitlApprovalRequirement } from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";

const SOURCE = "f8-p02.v1";
const DEFAULT_POLICY: HitlApprovalInput["policy"] = {
  autonomy_level: "PREPARE", autonomy_ceiling: "APPROVAL_GATED", approval_requirement: "NOT_REQUIRED", approval_granularity: "ACTION", required_approver_type: "consultant", required_approval_tier: "tenant", dual_approval_required: false, human_only: false, fail_closed: true, pre_approval: null, review_timing: "BEFORE", intervention_ownership: "SHARED",
};

type Row = Record<string, unknown>;
function record(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []; }
function text(value: unknown, fallback = "UNKNOWN"): string { return typeof value === "string" && value.trim() ? value : fallback; }
function bool(value: unknown, fallback = false): boolean { return typeof value === "boolean" ? value : fallback; }
function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
function asOf(now: string) { return `${now.slice(0, 10)}T00:00:00.000Z`; }

export type HitlApprovalContext = { context_id: string; business_id: string; decision_cycle_id: string; source_refs: string[]; as_of: string };

export function buildHitlApprovalContext(organizationId: string, upstream: unknown, now = new Date().toISOString()): HitlApprovalContext {
  const row = record(upstream); const day = asOf(now);
  return { context_id: text(row.context_id, `hitl-approval-context:${organizationId}:${day.slice(0, 10)}`), business_id: organizationId, decision_cycle_id: text(row.decision_cycle_id, `f8-p02:${organizationId}:${day.slice(0, 10)}`), source_refs: [...new Set([...strings(row.source_refs), SOURCE])], as_of: day };
}

function policyFrom(raw: unknown): HitlApprovalInput["policy"] {
  const value = record(raw);
  const pre = value.pre_approval && typeof value.pre_approval === "object" ? record(value.pre_approval) : null;
  return {
    ...DEFAULT_POLICY,
    autonomy_level: (value.autonomy_level as HitlAutonomyLevel) ?? DEFAULT_POLICY.autonomy_level,
    autonomy_ceiling: (value.autonomy_ceiling as HitlAutonomyLevel) ?? DEFAULT_POLICY.autonomy_ceiling,
    approval_requirement: (value.approval_requirement as HitlApprovalRequirement) ?? DEFAULT_POLICY.approval_requirement,
    approval_granularity: (value.approval_granularity as HitlApprovalInput["policy"]["approval_granularity"]) ?? DEFAULT_POLICY.approval_granularity,
    required_approver_type: text(value.required_approver_type, DEFAULT_POLICY.required_approver_type),
    required_approval_tier: text(value.required_approval_tier, DEFAULT_POLICY.required_approval_tier),
    dual_approval_required: bool(value.dual_approval_required),
    human_only: bool(value.human_only), fail_closed: value.fail_closed !== false,
    pre_approval: pre ? { active: bool(pre.active), conditions: strings(pre.conditions), scope: text(pre.scope), limits: strings(pre.limits), valid_until: typeof pre.valid_until === "string" ? pre.valid_until : null, revoked: bool(pre.revoked) } : null,
    review_timing: (value.review_timing as HitlApprovalInput["policy"]["review_timing"]) ?? DEFAULT_POLICY.review_timing,
    intervention_ownership: (value.intervention_ownership as HitlApprovalInput["policy"]["intervention_ownership"]) ?? DEFAULT_POLICY.intervention_ownership,
  };
}

export function hitlApprovalInputFromSources(context: HitlApprovalContext, outputRow: unknown, approvalRow: unknown, policyRaw?: unknown): HitlApprovalInput {
  const row = record(outputRow); const output = record(row.output); const approval = record(approvalRow); const writes = Array.isArray(output.proposed_writes) ? output.proposed_writes.length : 0; const tasks = Array.isArray(output.proposed_tasks) ? output.proposed_tasks.length : 0; const approvalRequired = bool(row.approval_required, writes > 0 || tasks > 0);
  const existingApproval = approval.id ? { approval_id: text(approval.id), state: (approval.decision === "approved" ? "APPROVED" : "REJECTED") as HitlApprovalState, approved_scope: text(output.approval_scope, text(row.id)), approved_version: text(output.version, text(row.schema_version, "v1")), conditions: strings(output.approval_conditions), valid_until: typeof output.approval_valid_until === "string" ? output.approval_valid_until : null, approved_at: typeof approval.decided_at === "string" ? approval.decided_at : null, freshness_ok: true, authority_valid: true, revoked: false, approver_type: "consultant", approver_id: text(approval.decided_by) } : null;
  return {
    context_id: context.context_id, business_id: context.business_id, decision_cycle_id: context.decision_cycle_id,
    action_id: text(row.id, "pending-agent-output"), action_type: text(output.action_type, writes || tasks ? "write" : "recommendation"), action_description: text(output.title, text(output.summary, writes || tasks ? "Propuesta de escritura generada por IA" : "Recomendación generada por IA")), domain: text(output.domain, text(output.agent_code, "agent")), proposer_id: "ai",
    requested_autonomy: approvalRequired ? "APPROVAL_GATED" : "PREPARE", is_material: approvalRequired || writes > 0 || tasks > 0, risk: text(output.risk), impact: text(output.expected_impact, text(output.impact)), financial_exposure: text(output.financial_exposure), customer_exposure: text(output.customer_exposure), blast_radius: text(output.blast_radius), reversibility: text(output.reversibility), sensitivity: text(output.sensitivity), uncertainty: text(output.uncertainty), novelty: text(output.novelty), policy: policyFrom(policyRaw ?? output.hitl_policy), existing_approval: existingApproval, source_refs: [...new Set([...context.source_refs, "agent_outputs"])], unresolved_unknowns: [...strings(output.unresolved_unknowns), ...(row.id ? [] : ["agent_output"])],
  };
}

async function persist(supabase: any, organizationId: string, input: HitlApprovalInput, result: HitlApprovalResult, asOfDate: string) {
  const inputFingerprint = fingerprintPlaybookInput(input);
  const existing = await supabase.from("hitl_approval_assessment_runs").select("id, disposition").eq("organization_id", organizationId).eq("input_fingerprint", inputFingerprint).maybeSingle();
  if (existing.error) throw new Error(`hitl_approval_lookup_failed: ${existing.error.message}`);
  if (existing.data) return existing.data;
  const inserted = await supabase.from("hitl_approval_assessment_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, action_id: result.action_id, as_of: asOfDate, evaluated_at: result.evaluated_at, input_fingerprint: inputFingerprint, disposition: result.disposition, autonomy_level: result.autonomy_level, approval_requirement: result.approval_requirement, approval_state: result.approval_state, approval_gate: result.approval_gate, execution_state: result.execution_state, input_envelope: input, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, disposition").single();
  if (inserted.error || !inserted.data) throw new Error(`hitl_approval_write_failed: ${inserted.error?.message ?? "no row"}`);
  return inserted.data;
}

export async function runHitlApprovalEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [outputResult, templatesResult] = await Promise.all([
    supabase.from("agent_outputs").select("id, output, approval_required, status, schema_version, created_at, updated_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template").eq("lifecycle", "ACTIVE").limit(30),
  ]);
  if (outputResult.error) throw new Error(`hitl_approval_input_load_failed: ${outputResult.error.message}`);
  if (templatesResult.error) throw new Error(`hitl_approval_policy_load_failed: ${templatesResult.error.message}`);
  const output = outputResult.data as Row | null;
  const approvalResult = output?.id ? await supabase.from("agent_approvals").select("id, decision, decided_by, decided_at").eq("organization_id", organizationId).eq("output_id", output.id).order("decided_at", { ascending: false }).limit(1).maybeSingle() : { data: null, error: null };
  if (approvalResult.error) throw new Error(`hitl_approval_state_load_failed: ${approvalResult.error.message}`);
  const template = (templatesResult.data ?? []).map((item: unknown) => record(record(item).template).hitl_approval).find(Boolean);
  const context = buildHitlApprovalContext(organizationId, output, new Date().toISOString());
  const input = hitlApprovalInputFromSources(context, output, approvalResult.data, template);
  const result = evaluateHitlApproval(input);
  const stored = await persist(supabase, organizationId, input, result, context.as_of);
  return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, autonomy_level: result.autonomy_level, approval_state: result.approval_state, execution_state: result.execution_state, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runHitlApprovalEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`hitl_approval_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 }; for (const organization of loaded.data ?? []) { summary.organizations += 1; try { await runHitlApprovalEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; } } return summary;
}
