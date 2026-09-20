import { createClient } from "@supabase/supabase-js";
import {
  evaluateConstraintRecommendationSet,
  fingerprintPlaybookInput,
  type ConstraintContext,
  type ConstraintRecommendationInput,
  type ConstraintRecommendationRunResult,
  type PlaybookTemplate,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p11.v1";
type ConstraintExtension = Partial<ConstraintRecommendationInput>;
export type ConstraintRecommendationContext = { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; source_refs: string[]; as_of: string };

function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }
function text(value: unknown, fallback = "UNKNOWN"): string { return typeof value === "string" && value.length > 0 ? value : fallback; }
function dayStart(now: string) { return `${now.slice(0, 10)}T00:00:00.000Z`; }
function rows(value: unknown): Record<string, unknown>[] { const result = record(record(value).result); return Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.map(record) : []; }
function extension(template: PlaybookTemplate | null): ConstraintExtension { const raw = record(template?.domain_extension); const value = raw.constraints ?? raw.constraint_recommendations; return value && typeof value === "object" && !Array.isArray(value) ? value as ConstraintExtension : {}; }
function refs(profile: ConstraintExtension, key: keyof ConstraintRecommendationInput): string[] { return strings(profile[key]); }
function constraintItems(value: unknown): ConstraintContext[] { return Array.isArray(value) ? value.filter((item) => { const row = record(item); return typeof row.name === "string" && typeof row.type === "string" && typeof row.status === "string"; }).map((item) => { const row = record(item); return { name: text(row.name), type: text(row.type), duration: text(row.duration), status: text(row.status), slack: text(row.slack), granularity: text(row.granularity), controllability: text(row.controllability), severity: text(row.severity), classification: text(row.classification), evidence: strings(row.evidence), interaction_with: strings(row.interaction_with) }; }) : []; }

export function buildConstraintRecommendationContext(organizationId: string, upstreamRun: unknown, now = new Date().toISOString()): ConstraintRecommendationContext {
  const row = record(upstreamRun); const asOf = dayStart(now);
  return { context_id: text(row.context_id, `constraint-recommendation-context:${organizationId}:${asOf.slice(0, 10)}`), business_id: organizationId, decision_cycle_id: text(row.decision_cycle_id, `f7-p11:${organizationId}:${asOf.slice(0, 10)}`), primary_priority_candidate_id: typeof row.primary_priority_candidate_id === "string" ? row.primary_priority_candidate_id : null, source_refs: [...new Set([...strings(row.source_refs), SOURCE])], as_of: asOf };
}

export function candidateInputFromConstraintSources(template: PlaybookTemplate | null, context: ConstraintRecommendationContext, upstreamCandidate: Record<string, unknown>): ConstraintRecommendationInput {
  const configured = extension(template); const candidateId = text(upstreamCandidate.candidate_id, "invalid-candidate");
  const configuredConstraints = constraintItems(configured.constraints);
  const defaults: ConstraintRecommendationInput = {
    candidate_id: candidateId,
    desired_intervention: text(configured.desired_intervention, text(upstreamCandidate.desired_intervention, text(upstreamCandidate.current_recommendation, "intervention not declared"))),
    required_resources: refs(configured, "required_resources"), constraints: configuredConstraints,
    binding_constraint: text(configured.binding_constraint, "UNKNOWN"), secondary_constraints: refs(configured, "secondary_constraints"), latent_constraints: refs(configured, "latent_constraints"), expected_outcome: text(configured.expected_outcome), success_capacity: text(configured.success_capacity), business_context: text(configured.business_context), evidence: refs(configured, "evidence"), risk: refs(configured, "risk"), dependencies: refs(configured, "dependencies"), guardrails: refs(configured, "guardrails"), current_recommendation: text(configured.current_recommendation, "Validar la intervención bajo restricciones declaradas"), deferred_action: text(configured.deferred_action), activation_trigger: text(configured.activation_trigger), constraint_effect: text(configured.constraint_effect), remove_options: refs(configured, "remove_options"), scope_reduction_options: refs(configured, "scope_reduction_options"), alternative_mechanisms: refs(configured, "alternative_mechanisms"), reallocation_options: refs(configured, "reallocation_options"), resequencing_options: refs(configured, "resequencing_options"), prepare_actions: refs(configured, "prepare_actions"), opportunity_cost: refs(configured, "opportunity_cost"), resource_productivity: refs(configured, "resource_productivity"), temporary_workaround: refs(configured, "temporary_workaround"), resource_substitution: refs(configured, "resource_substitution"), cash_path: refs(configured, "cash_path"), unresolved_unknowns: [...new Set([...strings(upstreamCandidate.unresolved_unknowns), ...refs(configured, "unresolved_unknowns"), ...(configuredConstraints.length ? [] : ["constraints"])])], evidence_refs: [...new Set([...strings(upstreamCandidate.source_refs), ...refs(configured, "evidence_refs")])], source_refs: [...new Set([...context.source_refs, ...strings(upstreamCandidate.source_refs), ...strings(template?.source_refs), ...refs(configured, "source_refs")])],
  };
  return { ...defaults, ...configured, candidate_id: candidateId, constraints: configuredConstraints, unresolved_unknowns: defaults.unresolved_unknowns, evidence_refs: defaults.evidence_refs, source_refs: defaults.source_refs } as ConstraintRecommendationInput;
}

async function persist(supabase: any, organizationId: string, context: ConstraintRecommendationContext, candidates: ConstraintRecommendationInput[], result: ConstraintRecommendationRunResult) {
  const input = { organization_id: organizationId, context, candidates }; const fingerprint = fingerprintPlaybookInput(input);
  const existing = await supabase.from("constraint_recommendation_runs").select("id, disposition").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`constraint_recommendations_lookup_failed: ${existing.error.message}`); if (existing.data) return existing.data;
  const inserted = await supabase.from("constraint_recommendation_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, as_of: context.as_of, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, input_envelope: input, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, disposition").single();
  if (inserted.error || !inserted.data) throw new Error(`constraint_recommendations_write_failed: ${inserted.error?.message ?? "no row"}`); return inserted.data;
}

export async function runConstraintRecommendationEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [upstreamResult, templatesResult] = await Promise.all([
    supabase.from("maturity_recommendation_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template_id, template_version, lifecycle, template").eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [upstreamResult, templatesResult]) if (loaded.error) throw new Error(`constraint_recommendations_input_load_failed: ${loaded.error.message}`);
  const context = buildConstraintRecommendationContext(organizationId, upstreamResult.data ?? {}); const templates = new Map(parseActivePlaybookTemplates(templatesResult.data ?? []).map((item) => [`${item.template_id}@${item.template_version}`, item]));
  const candidates = rows(upstreamResult.data).map((candidate) => candidateInputFromConstraintSources(templates.get(text(candidate.candidate_id)) ?? null, context, candidate));
  const result = evaluateConstraintRecommendationSet({ context_id: context.context_id, business_id: organizationId, decision_cycle_id: context.decision_cycle_id, primary_priority_candidate_id: context.primary_priority_candidate_id, candidates, evaluated_at: new Date().toISOString() });
  const stored = await persist(supabase, organizationId, context, candidates, result);
  return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runConstraintRecommendationEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`constraint_recommendations_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of loaded.data ?? []) { summary.organizations += 1; try { await runConstraintRecommendationEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; } }
  return summary;
}
