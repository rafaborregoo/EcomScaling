import { createClient } from "@supabase/supabase-js";
import { evaluateActionEnvelope, fingerprintPlaybookInput, type ActionEnvelopeInput, type ActionEnvelopeResult } from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";

const SOURCE = "f8-p05.v1";
type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
const text = (value: unknown, fallback = "UNKNOWN") => typeof value === "string" && value.trim() ? value : fallback;
function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }

export function actionEnvelopeInputFromSources(organizationId: string, planRow: unknown, readinessRow: unknown = {}): ActionEnvelopeInput {
  const plan = record(planRow); const envelope = record(plan.input_envelope); const result = record(plan.result); const readiness = record(readinessRow); const readinessResult = record(readiness.result);
  const scope = record(envelope.scope); const actions = Array.isArray(envelope.actions) ? envelope.actions.map(record) : [];
  const planActions = actions.length ? actions : [{ id: "action-1", title: "read-only validation", target: text(scope.in_scope, "recommendation-scope"), change: "read_before_write", current_state: "UNKNOWN", desired_state: "UNKNOWN" }];
  const actionTypes = planActions.map((action) => String(action.change ?? "") === "prepare_reversible_change" || (String(action.change ?? "").includes("write") && !String(action.change ?? "").startsWith("read")) ? "PREPARE" : "READ");
  const environment = (["UNKNOWN", "TEST", "STAGING", "PRODUCTION"] as const).includes(text(envelope.environment, "UNKNOWN") as "UNKNOWN" | "TEST" | "STAGING" | "PRODUCTION") ? text(envelope.environment, "UNKNOWN") as ActionEnvelopeInput["environment"] : "UNKNOWN";
  return {
    context_id: text(plan.context_id, `action-envelope:${organizationId}`), business_id: organizationId, envelope_version: 1, environment,
    in_scope: strings(scope.in_scope).length ? strings(scope.in_scope) : [text(scope, "recommendation-scope")],
    out_of_scope: [...strings(scope.out_of_scope), "direct_tool_execution", "automatic_publication"],
    allowed_action_types: ["READ", "PREPARE"], forbidden_action_types: ["DELETE", "PUBLISH", "EXECUTE"],
    allowed_tools: ["catalog", "analytics", "diagnostic"], forbidden_tools: ["publisher", "destructive-write"],
    allowed_object_ids: planActions.map((action) => text(action.target, text(scope.in_scope, "recommendation-scope"))), max_actions: Number(record(envelope.budgets).max_actions ?? Math.max(planActions.length, 1)),
    max_magnitude_per_action: 1, max_cumulative_magnitude: Math.max(planActions.length, 1), consumed_actions: 0, consumed_magnitude: 0,
    conditions: ["readiness remains valid", "human approval remains valid"], invariants: ["execution_authorized remains false", "no tenant crossing", "no silent scope clipping"],
    valid_until: new Date(Date.now() + 15 * 60_000).toISOString(),
    plan: planActions.map((action, index) => ({ id: text(action.id, `action-${index + 1}`), action_type: actionTypes[index] ?? "READ", target: text(action.target, "recommendation-scope"), object_id: text(action.target, "recommendation-scope"), tool: "diagnostic", magnitude: 1, environment, tenant_id: organizationId, side_effects: actionTypes[index] === "READ" ? [] : ["prepare_only"] })),
    source_refs: [...new Set([SOURCE, "execution_plan_runs", "readiness_assessment_runs", ...strings(plan.source_refs), ...strings(result.source_refs), ...strings(readiness.source_refs), ...strings(readinessResult.source_refs)])], unresolved_unknowns: [...new Set([...strings(plan.unresolved_unknowns), ...strings(result.unresolved_unknowns), ...strings(readiness.unresolved_unknowns), ...strings(readinessResult.unresolved_unknowns)])],
  };
}

async function persist(supabase: any, organizationId: string, input: ActionEnvelopeInput, result: ActionEnvelopeResult) {
  const fingerprint = fingerprintPlaybookInput(input); const existing = await supabase.from("action_envelope_runs").select("id, envelope_zone").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`action_envelope_lookup_failed: ${existing.error.message}`); if (existing.data) return existing.data;
  const inserted = await supabase.from("action_envelope_runs").insert({ organization_id: organizationId, context_id: result.context_id, business_id: result.business_id, envelope_version: result.envelope_version, as_of: result.evaluated_at, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, envelope_zone: result.zone, input_envelope: input, result, violations: result.violations, warnings: result.warnings, unresolved_unknowns: result.unresolved_unknowns, source_refs: result.source_refs }).select("id, envelope_zone").single();
  if (inserted.error || !inserted.data) throw new Error(`action_envelope_write_failed: ${inserted.error?.message ?? "no row"}`); return inserted.data;
}

export async function runActionEnvelopeEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env); const [planResult, readinessResult] = await Promise.all([
    supabase.from("execution_plan_runs").select("id, context_id, input_envelope, result, source_refs, unresolved_unknowns").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("readiness_assessment_runs").select("result, source_refs, unresolved_unknowns").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (planResult.error || readinessResult.error) throw new Error(`action_envelope_input_load_failed: ${planResult.error?.message ?? readinessResult.error?.message}`);
  if (!planResult.data) return { organization_id: organizationId, assessment_id: null, envelope_zone: "FORBIDDEN", violations: ["execution_plan_missing"] };
  const input = actionEnvelopeInputFromSources(organizationId, planResult.data, readinessResult.data); const result = evaluateActionEnvelope(input); const stored = await persist(supabase, organizationId, input, result);
  return { organization_id: organizationId, assessment_id: stored.id, envelope_zone: result.zone, violations: result.violations, warnings: result.warnings };
}

export async function runActionEnvelopeEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`action_envelope_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 }; for (const organization of loaded.data ?? []) { summary.organizations += 1; try { const result = await runActionEnvelopeEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += result.assessment_id ? 1 : 0; } catch { summary.failed += 1; } } return summary;
}
