import { createClient } from "@supabase/supabase-js";
import {
  evaluateDynamicDecision,
  fingerprintPlaybookInput,
  type DynamicDecisionInput,
  type DynamicDecisionResult,
  type DynamicDecisionUnitInput,
  type PlaybookTemplate,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p13.v1";
type DynamicExtension = { unit_overrides?: Record<string, Partial<DynamicDecisionUnitInput>>; original_recommendation?: string; portfolio_context?: string; external_context?: string; source_refs?: string[]; unresolved_unknowns?: string[] };
export type DynamicDecisionContext = { context_id: string; business_id: string; decision_cycle_id: string; source_refs: string[]; as_of: string };

function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }
function text(value: unknown, fallback = "UNKNOWN"): string { return typeof value === "string" && value.length > 0 ? value : fallback; }
function dayStart(now: string) { return `${now.slice(0, 10)}T00:00:00.000Z`; }
function extension(template: PlaybookTemplate | null): DynamicExtension { const raw = record(template?.domain_extension); const value = raw.dynamic_decision ?? raw.decision_update; return value && typeof value === "object" && !Array.isArray(value) ? value as DynamicExtension : {}; }
function rows(value: unknown): Record<string, unknown>[] { const result = record(record(value).result); return Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.map(record) : []; }
function overrideFor(configured: DynamicExtension, candidateId: string): Partial<DynamicDecisionUnitInput> { const value = configured.unit_overrides?.[candidateId]; return value && typeof value === "object" ? value : {}; }

export function buildDynamicDecisionContext(organizationId: string, upstreamRun: unknown, now = new Date().toISOString()): DynamicDecisionContext {
  const row = record(upstreamRun); const asOf = dayStart(now);
  return { context_id: text(row.context_id, `dynamic-decision-context:${organizationId}:${asOf.slice(0, 10)}`), business_id: organizationId, decision_cycle_id: text(row.decision_cycle_id, `f7-p13:${organizationId}:${asOf.slice(0, 10)}`), source_refs: [...new Set([...strings(row.source_refs), SOURCE])], as_of: asOf };
}

export function dynamicDecisionInputFromSources(template: PlaybookTemplate | null, context: DynamicDecisionContext, upstreamCandidate: Record<string, unknown>): DynamicDecisionInput {
  const configured = extension(template); const candidateId = text(upstreamCandidate.candidate_id, "invalid-candidate"); const override = overrideFor(configured, candidateId);
  const base: DynamicDecisionUnitInput = {
    unit_id: candidateId,
    original_recommendation: text(override.original_recommendation, text(upstreamCandidate.intervention, "recommendation not declared")),
    intervention_type: text(override.intervention_type, "recommendation portfolio intervention"),
    intended_mechanism: text(override.intended_mechanism, text(upstreamCandidate.causal_mechanism, "mechanism not declared")),
    expected_outcome: text(override.expected_outcome, text(upstreamCandidate.expected_outcome, "outcome not declared")),
    observed_outcome: text(override.observed_outcome), primary_outcome: text(override.primary_outcome), secondary_effects: strings(override.secondary_effects), economics: text(override.economics), guardrails: strings(override.guardrails), risk: text(override.risk), intervention_fidelity: text(override.intervention_fidelity), baseline_quality: text(override.baseline_quality), trend: text(override.trend), causal_confidence: text(override.causal_confidence), incrementality: text(override.incrementality), headroom: text(override.headroom), marginal_economics: text(override.marginal_economics), scale_readiness: text(override.scale_readiness), reversibility: text(override.reversibility), rollback_cost: text(override.rollback_cost), opportunity_cost: text(override.opportunity_cost), decision_scope: text(override.decision_scope, text(upstreamCandidate.problem, candidateId)), fix_forward_alternative: text(override.fix_forward_alternative, ""), source_refs: [...new Set([...context.source_refs, ...strings(upstreamCandidate.source_refs), ...strings(override.source_refs)])], unresolved_unknowns: strings(override.unresolved_unknowns),
  };
  return { context_id: context.context_id, business_id: context.business_id, decision_cycle_id: context.decision_cycle_id, original_recommendation: text(configured.original_recommendation, base.original_recommendation), portfolio_context: text(configured.portfolio_context, "Portfolio context not declared"), external_context: text(configured.external_context, "External context not declared"), decision_units: [{ ...base, ...override, unit_id: candidateId, source_refs: base.source_refs, secondary_effects: base.secondary_effects, guardrails: base.guardrails, unresolved_unknowns: base.unresolved_unknowns }], source_refs: [...new Set([...context.source_refs, ...strings(configured.source_refs)])], unresolved_unknowns: strings(configured.unresolved_unknowns) };
}

async function persist(supabase: any, organizationId: string, input: DynamicDecisionInput, result: DynamicDecisionResult, asOf: string) {
  const fingerprint = fingerprintPlaybookInput(input); const existing = await supabase.from("dynamic_decision_runs").select("id, disposition").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`dynamic_decision_lookup_failed: ${existing.error.message}`); if (existing.data) return existing.data;
  const inserted = await supabase.from("dynamic_decision_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, as_of: asOf, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, disposition: result.disposition, unit_count: result.unit_decisions.length, overall_decision: result.overall_decision, input_envelope: input, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, disposition").single();
  if (inserted.error || !inserted.data) throw new Error(`dynamic_decision_write_failed: ${inserted.error?.message ?? "no row"}`); return inserted.data;
}

export async function runDynamicDecisionEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [portfolioResult, templatesResult] = await Promise.all([
    supabase.from("recommendation_portfolio_runs").select("context_id, decision_cycle_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template_id, template_version, lifecycle, template").eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [portfolioResult, templatesResult]) if (loaded.error) throw new Error(`dynamic_decision_input_load_failed: ${loaded.error.message}`);
  const context = buildDynamicDecisionContext(organizationId, portfolioResult.data ?? {}); const templates = new Map(parseActivePlaybookTemplates(templatesResult.data ?? []).map((item) => [`${item.template_id}@${item.template_version}`, item])); const upstreamCandidates = rows(portfolioResult.data); const template = templates.get(text(upstreamCandidates[0]?.candidate_id)) ?? null; const input: DynamicDecisionInput = { context_id: context.context_id, business_id: context.business_id, decision_cycle_id: context.decision_cycle_id, original_recommendation: text(extension(template).original_recommendation, "Actualizar recomendaciones con outcome observado"), portfolio_context: text(extension(template).portfolio_context, "Portfolio F7.12"), external_context: text(extension(template).external_context, "No declarado"), decision_units: upstreamCandidates.map((candidate) => dynamicDecisionInputFromSources(templates.get(text(candidate.candidate_id)) ?? null, context, candidate).decision_units[0]!).filter(Boolean), source_refs: context.source_refs, unresolved_unknowns: [] };
  const result = evaluateDynamicDecision(input); const stored = await persist(supabase, organizationId, input, result, context.as_of); return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, overall_decision: result.overall_decision, unit_count: result.unit_decisions.length, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runDynamicDecisionEngineForAllOrganizations(env: LoadedApiEnv) { const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`dynamic_decision_organizations_load_failed: ${loaded.error.message}`); const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 }; for (const organization of loaded.data ?? []) { summary.organizations += 1; try { await runDynamicDecisionEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; } } return summary; }
