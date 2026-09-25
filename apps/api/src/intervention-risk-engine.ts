import { createClient } from "@supabase/supabase-js";
import { evaluateInterventionRiskSet, fingerprintPlaybookInput, type InterventionRiskInput, type InterventionRiskRunResult, type PlaybookTemplate } from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p06.v1";
type Tier = "NOW" | "NEXT" | "LATER" | "DO_NOT_DO" | "WAIT";
type SourceCandidate = { candidate_id: string; disposition?: string | undefined; source_refs?: string[] | undefined; unresolved_unknowns?: string[] | undefined; [key: string]: unknown };
export type InterventionRiskContext = { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; source_refs: string[]; as_of: string };
type RiskExtension = Partial<InterventionRiskInput>;

function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }
function text(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }
function dayStart(now: string) { return `${now.slice(0, 10)}T00:00:00.000Z`; }
function tier(value: unknown): Tier | undefined { return typeof value === "string" && ["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"].includes(value) ? value as Tier : undefined; }
function resultRows(row: unknown): Record<string, unknown>[] { const result = record(record(row).result); return Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.map(record) : []; }
function extension(template: PlaybookTemplate | null): RiskExtension { const raw = template?.domain_extension as Record<string, unknown> | undefined; const value = raw?.risk ?? raw?.reversibility; return value && typeof value === "object" && !Array.isArray(value) ? value as RiskExtension : {}; }

export function buildInterventionRiskContext(organizationId: string, priorityRun: unknown, impactRun: unknown, feasibilityRun: unknown, now = new Date().toISOString()): InterventionRiskContext {
  const priority = record(priorityRun); const impact = record(impactRun); const feasibility = record(feasibilityRun);
  return { context_id: text(priority.context_id ?? impact.context_id ?? feasibility.context_id) ?? `intervention-risk-context:${organizationId}:${dayStart(now).slice(0, 10)}`, business_id: organizationId, decision_cycle_id: text(priority.decision_cycle_id ?? impact.decision_cycle_id ?? feasibility.decision_cycle_id) ?? `f7-p06:${organizationId}:${dayStart(now).slice(0, 10)}`, primary_priority_candidate_id: text(priority.primary_priority_candidate_id ?? impact.primary_priority_candidate_id ?? feasibility.primary_priority_candidate_id) ?? null, source_refs: [...new Set([...strings(priority.source_refs), ...strings(impact.source_refs), ...strings(feasibility.source_refs), SOURCE])], as_of: dayStart(now) };
}

function sourceDisposition(value: string | undefined, allowed: string[], fallback: string) { return value && allowed.includes(value) ? value : fallback; }

export function candidateInputFromRiskSources(template: PlaybookTemplate | null, context: InterventionRiskContext, impact: SourceCandidate, feasibility: SourceCandidate): InterventionRiskInput {
  const profile = extension(template);
  const defaults: InterventionRiskInput = {
    candidate_id: impact.candidate_id,
    ...(tier(impact.priority_tier) ? { priority_tier: tier(impact.priority_tier) } : {}),
    expected_impact_disposition: sourceDisposition(impact.disposition, ["SUPPORTED_QUALITATIVE", "POTENTIAL_ONLY", "VALIDATION_REQUIRED", "NO_VALID_IMPACT"], "VALIDATION_REQUIRED") as InterventionRiskInput["expected_impact_disposition"],
    feasibility_disposition: sourceDisposition(feasibility.disposition, ["FEASIBLE_NOW", "FEASIBLE_WITH_ADAPTATION", "VALIDATION_REQUIRED", "NOT_FEASIBLE_NOW"], "VALIDATION_REQUIRED") as InterventionRiskInput["feasibility_disposition"],
    intervention: "intervention not declared", intended_outcome: "outcome not declared", commitment_level: "UNKNOWN", exposure: "unknown",
    potential_upside: [], potential_downside: [], evidence_strength: "UNKNOWN", uncertainty: [],
    reversibility_profile: { can_revert: "UNKNOWN", reversal_delay: "unknown", reversal_cost: "unknown", residual_damage: "unknown" },
    blast_radius: { scope: [], level: "UNKNOWN", concentration: [], dependencies: [] }, inaction_risk: [], action_risk: [],
    guardrails: { hard_veto: false, status: "UNKNOWN", refs: [] }, observability: { monitoring_available: "UNKNOWN", detection_speed: "unknown", feedback_loop: "unknown", measurement_quality: "UNKNOWN" },
    risk_dependencies: [], risk_capacity: "UNKNOWN", failure_modes: [], scenarios: { downside_case: "unknown", base_case: "unknown", upside_case: "unknown", tail_risk: "unknown" },
    cost_of_error: { severity: "UNKNOWN", action: "UNKNOWN", delay: "UNKNOWN", failure: "UNKNOWN", rollback: "UNKNOWN", residual: "UNKNOWN" }, recommended_commitment: "GATHER_EVIDENCE", de_risking_actions: [],
    risk_tradeoff: { accepted: [], avoided: [], introduced: [], transferred: [] }, decision_conditions: [], assumptions: [], quantitative_support: false, quantitative_claims: [],
    unresolved_unknowns: [...strings(impact.unresolved_unknowns), ...strings(feasibility.unresolved_unknowns)], evidence_refs: [...strings(impact.source_refs), ...strings(feasibility.source_refs)], source_refs: [...new Set([...context.source_refs, ...strings(impact.source_refs), ...strings(feasibility.source_refs), ...strings(template?.source_refs)])],
  };
  const merged = { ...defaults, ...profile, candidate_id: impact.candidate_id, expected_impact_disposition: defaults.expected_impact_disposition, feasibility_disposition: defaults.feasibility_disposition, ...(tier(impact.priority_tier) ? { priority_tier: tier(impact.priority_tier) } : {}), source_refs: [...new Set([...defaults.source_refs, ...strings(profile.source_refs)])] } as InterventionRiskInput;
  return {
    ...merged,
    potential_upside: strings(profile.potential_upside), potential_downside: strings(profile.potential_downside), uncertainty: strings(profile.uncertainty), inaction_risk: strings(profile.inaction_risk), action_risk: strings(profile.action_risk), risk_dependencies: strings(profile.risk_dependencies), failure_modes: strings(profile.failure_modes), de_risking_actions: strings(profile.de_risking_actions), decision_conditions: strings(profile.decision_conditions), assumptions: strings(profile.assumptions), quantitative_claims: profile.quantitative_support ? (profile.quantitative_claims ?? []) : [],
    unresolved_unknowns: [...new Set([...defaults.unresolved_unknowns, ...strings(profile.unresolved_unknowns)])],
  } as InterventionRiskInput;
}

async function persist(supabase: any, organizationId: string, context: InterventionRiskContext, candidates: InterventionRiskInput[], result: InterventionRiskRunResult) {
  const input = { organization_id: organizationId, context, candidates }; const fingerprint = fingerprintPlaybookInput(input);
  const existing = await supabase.from("intervention_risk_runs").select("id, disposition").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`risk_lookup_failed: ${existing.error.message}`); if (existing.data) return existing.data;
  const inserted = await supabase.from("intervention_risk_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, as_of: context.as_of, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, input_envelope: input, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, disposition").single();
  if (inserted.error || !inserted.data) throw new Error(`risk_write_failed: ${inserted.error?.message ?? "no row"}`); return inserted.data;
}

export async function runInterventionRiskEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [priorityResult, impactResult, feasibilityResult, templatesResult] = await Promise.all([
    supabase.from("intervention_prioritization_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("intervention_impact_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("intervention_feasibility_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template_id, template_version, lifecycle, template").eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [priorityResult, impactResult, feasibilityResult, templatesResult]) if (loaded.error) throw new Error(`risk_input_load_failed: ${loaded.error.message}`);
  const context = buildInterventionRiskContext(organizationId, priorityResult.data ?? {}, impactResult.data ?? {}, feasibilityResult.data ?? {});
  const impactCandidates = resultRows(impactResult.data).map((row) => ({ ...row, candidate_id: text(row.candidate_id) ?? "invalid-candidate", disposition: text(row.disposition), source_refs: strings(row.source_refs), unresolved_unknowns: strings(row.unresolved_unknowns) }));
  const feasibilityById = new Map(resultRows(feasibilityResult.data).map((row) => [text(row.candidate_id) ?? "invalid-candidate", { ...row, candidate_id: text(row.candidate_id) ?? "invalid-candidate", disposition: text(row.disposition), source_refs: strings(row.source_refs), unresolved_unknowns: strings(row.unresolved_unknowns) }]));
  const templates = new Map(parseActivePlaybookTemplates(templatesResult.data ?? []).map((item) => [`${item.template_id}@${item.template_version}`, item]));
  const candidates = impactCandidates.map((impact) => candidateInputFromRiskSources(templates.get(impact.candidate_id) ?? null, context, impact, feasibilityById.get(impact.candidate_id) ?? { candidate_id: impact.candidate_id }));
  const result = evaluateInterventionRiskSet({ context_id: context.context_id, business_id: organizationId, decision_cycle_id: context.decision_cycle_id, primary_priority_candidate_id: context.primary_priority_candidate_id, candidates, evaluated_at: new Date().toISOString() });
  const stored = await persist(supabase, organizationId, context, candidates, result);
  return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runInterventionRiskEngineForAllOrganizations(env: LoadedApiEnv) { const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`risk_organizations_load_failed: ${loaded.error.message}`); const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 }; for (const organization of loaded.data ?? []) { summary.organizations += 1; try { await runInterventionRiskEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; } } return summary; }
