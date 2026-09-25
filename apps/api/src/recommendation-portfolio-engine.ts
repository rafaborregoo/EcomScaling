import { createClient } from "@supabase/supabase-js";
import {
  evaluateRecommendationPortfolio,
  fingerprintPlaybookInput,
  type PlaybookTemplate,
  type RecommendationPortfolioCandidateInput,
  type RecommendationPortfolioInput,
  type RecommendationPortfolioResult,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p12.v1";
type PortfolioExtension = Partial<RecommendationPortfolioInput> & { candidate_overrides?: Record<string, Partial<RecommendationPortfolioCandidateInput>> };
export type RecommendationPortfolioContext = { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; source_refs: string[]; as_of: string };

function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }
function text(value: unknown, fallback = "UNKNOWN"): string { return typeof value === "string" && value.length > 0 ? value : fallback; }
function dayStart(now: string) { return `${now.slice(0, 10)}T00:00:00.000Z`; }
function rows(value: unknown): Record<string, unknown>[] { const result = record(record(value).result); return Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.map(record) : []; }
function extension(template: PlaybookTemplate | null): PortfolioExtension { const raw = record(template?.domain_extension); const value = raw.portfolio ?? raw.recommendation_portfolio; return value && typeof value === "object" && !Array.isArray(value) ? value as PortfolioExtension : {}; }
function refs(value: unknown): string[] { return strings(value); }

export function buildRecommendationPortfolioContext(organizationId: string, upstreamRun: unknown, now = new Date().toISOString()): RecommendationPortfolioContext {
  const row = record(upstreamRun); const asOf = dayStart(now);
  return { context_id: text(row.context_id, `recommendation-portfolio-context:${organizationId}:${asOf.slice(0, 10)}`), business_id: organizationId, decision_cycle_id: text(row.decision_cycle_id, `f7-p12:${organizationId}:${asOf.slice(0, 10)}`), primary_priority_candidate_id: typeof row.primary_priority_candidate_id === "string" ? row.primary_priority_candidate_id : null, source_refs: [...new Set([...strings(row.source_refs), SOURCE])], as_of: asOf };
}

function overrideFor(configured: PortfolioExtension, candidateId: string): Partial<RecommendationPortfolioCandidateInput> {
  const overrides = configured.candidate_overrides && typeof configured.candidate_overrides === "object" ? configured.candidate_overrides : {};
  const value = overrides[candidateId];
  return value && typeof value === "object" ? value : {};
}

export function candidateInputFromPortfolioSources(template: PlaybookTemplate | null, context: RecommendationPortfolioContext, upstreamCandidate: Record<string, unknown>): RecommendationPortfolioCandidateInput {
  const configured = extension(template); const candidateId = text(upstreamCandidate.candidate_id, "invalid-candidate"); const override = overrideFor(configured, candidateId);
  const feasible = text(upstreamCandidate.feasibility_disposition, "UNKNOWN");
  const defaults: RecommendationPortfolioCandidateInput = {
    candidate_id: candidateId,
    intervention: text(upstreamCandidate.best_feasible_recommendation, text(upstreamCandidate.desired_intervention, "intervention not declared")),
    desired_role: text(override.desired_role, candidateId === context.primary_priority_candidate_id ? "PRIMARY" : "DEFERRED"),
    status: text(override.status, feasible === "BLOCKED" ? "BLOCKED" : "ACTIVE_OPTION"),
    horizon: text(override.horizon, text(upstreamCandidate.timing_fit, "UNKNOWN")),
    problem: text(override.problem, text(upstreamCandidate.binding_constraint, "problem not declared")),
    expected_outcome: text(override.expected_outcome, text(upstreamCandidate.expected_outcome, "outcome not declared")),
    causal_mechanism: text(override.causal_mechanism, text(upstreamCandidate.constraint_effect, "mechanism not declared")),
    priority_context: text(override.priority_context, candidateId === context.primary_priority_candidate_id ? "primary priority candidate" : "candidate from F7.11"),
    entry_reason: text(override.entry_reason, candidateId === context.primary_priority_candidate_id ? "Dominant priority from upstream" : "Requires explicit portfolio role"),
    deferral_reason: text(override.deferral_reason, text(upstreamCandidate.deferred_action, "")),
    reentry_trigger: text(override.reentry_trigger, text(upstreamCandidate.activation_trigger, "")),
    dependencies: refs(override.dependencies ?? upstreamCandidate.dependencies),
    shared_resources: refs(override.shared_resources ?? configured.shared_resources),
    evidence_status: text(override.evidence_status, text(upstreamCandidate.feasibility_confidence, "UNKNOWN")),
    individual_feasibility: text(override.individual_feasibility, feasible),
    individual_risk: text(override.individual_risk, text(upstreamCandidate.portfolio_risk, "UNKNOWN")),
    reversibility: text(override.reversibility, "UNKNOWN"),
    conflict_with: refs(override.conflict_with ?? upstreamCandidate.conflict_with),
    supports_candidate_ids: refs(override.supports_candidate_ids),
    enables_candidate_ids: refs(override.enables_candidate_ids),
    duplicate_of: text(override.duplicate_of, ""),
    explicit_exclusion: override.explicit_exclusion === true,
    source_refs: [...new Set([...context.source_refs, ...strings(template?.source_refs), ...strings(upstreamCandidate.source_refs), ...refs(override.source_refs)])],
  };
  return { ...defaults, ...override, candidate_id: candidateId, source_refs: defaults.source_refs, dependencies: defaults.dependencies, shared_resources: defaults.shared_resources, conflict_with: defaults.conflict_with, supports_candidate_ids: defaults.supports_candidate_ids, enables_candidate_ids: defaults.enables_candidate_ids } as RecommendationPortfolioCandidateInput;
}

function portfolioInputFromSources(template: PlaybookTemplate | null, context: RecommendationPortfolioContext, candidates: RecommendationPortfolioCandidateInput[]): RecommendationPortfolioInput {
  const configured = extension(template);
  return {
    context_id: context.context_id,
    business_id: context.business_id,
    decision_cycle_id: context.decision_cycle_id,
    strategic_objective: text(configured.strategic_objective, "Validar el objetivo estratégico del portafolio"),
    dominant_priority: text(configured.dominant_priority, context.primary_priority_candidate_id ?? "UNKNOWN"),
    candidates,
    existing_initiatives: refs(configured.existing_initiatives),
    current_portfolio: refs(configured.current_portfolio),
    current_wip: text(configured.current_wip),
    available_capacity: text(configured.available_capacity),
    shared_resources: refs(configured.shared_resources),
    management_attention: text(configured.management_attention),
    aggregate_capacity: text(configured.aggregate_capacity),
    resource_conflicts: refs(configured.resource_conflicts),
    portfolio_constraints: refs(configured.portfolio_constraints),
    strategic_theme: text(configured.strategic_theme),
    current_portfolio_complexity: text(configured.current_portfolio_complexity),
    current_risk_state: text(configured.current_risk_state),
    evidence_quality: text(configured.evidence_quality),
    timing_context: text(configured.timing_context),
    source_refs: [...new Set([...context.source_refs, ...strings(template?.source_refs), ...refs(configured.source_refs)])],
    unresolved_unknowns: [...new Set([...refs(configured.unresolved_unknowns), ...(context.primary_priority_candidate_id ? [] : ["primary_priority_candidate"])])],
  };
}

async function persist(supabase: any, organizationId: string, input: RecommendationPortfolioInput, result: RecommendationPortfolioResult, asOf: string) {
  const fingerprint = fingerprintPlaybookInput(input); const existing = await supabase.from("recommendation_portfolio_runs").select("id, disposition").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`recommendation_portfolio_lookup_failed: ${existing.error.message}`); if (existing.data) return existing.data;
  const inserted = await supabase.from("recommendation_portfolio_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, as_of: asOf, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_candidate_id: result.primary_candidate_id, input_envelope: input, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, disposition").single();
  if (inserted.error || !inserted.data) throw new Error(`recommendation_portfolio_write_failed: ${inserted.error?.message ?? "no row"}`); return inserted.data;
}

export async function runRecommendationPortfolioEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [upstreamResult, templatesResult] = await Promise.all([
    supabase.from("constraint_recommendation_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template_id, template_version, lifecycle, template").eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [upstreamResult, templatesResult]) if (loaded.error) throw new Error(`recommendation_portfolio_input_load_failed: ${loaded.error.message}`);
  const context = buildRecommendationPortfolioContext(organizationId, upstreamResult.data ?? {}); const templates = new Map(parseActivePlaybookTemplates(templatesResult.data ?? []).map((item) => [`${item.template_id}@${item.template_version}`, item]));
  const upstreamCandidates = rows(upstreamResult.data); const candidates = upstreamCandidates.map((candidate) => candidateInputFromPortfolioSources(templates.get(text(candidate.candidate_id)) ?? null, context, candidate));
  const template = templates.get(text(context.primary_priority_candidate_id)) ?? null; const input = portfolioInputFromSources(template, context, candidates); const result = evaluateRecommendationPortfolio(input);
  const stored = await persist(supabase, organizationId, input, result, context.as_of);
  return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_candidate_id: result.primary_candidate_id, active_candidate_ids: result.active_candidate_ids, deferred_candidate_ids: result.deferred_candidate_ids, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runRecommendationPortfolioEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`recommendation_portfolio_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of loaded.data ?? []) { summary.organizations += 1; try { await runRecommendationPortfolioEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; } }
  return summary;
}
