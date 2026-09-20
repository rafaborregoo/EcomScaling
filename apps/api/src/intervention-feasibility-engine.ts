import { createClient } from "@supabase/supabase-js";
import { evaluateInterventionFeasibilitySet, fingerprintPlaybookInput, type InterventionFeasibilityInput, type InterventionFeasibilityRunResult, type PlaybookTemplate } from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p05.v1";
type Level = "LIMITED" | "MODERATE" | "MATERIAL" | "UNKNOWN";
type Tier = "NOW" | "NEXT" | "LATER" | "DO_NOT_DO" | "WAIT";
type ImpactCandidate = { candidate_id: string; disposition?: string | undefined; source_refs?: string[]; unresolved_unknowns?: string[] };
type PriorityCandidate = { candidate_id: string; priority_tier?: Tier; source_refs?: string[]; unresolved_unknowns?: string[] };
export type InterventionFeasibilityContext = { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; source_refs: string[]; as_of: string };
type FeasibilityExtension = Partial<InterventionFeasibilityInput>;

function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }
function text(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }
function dayStart(now: string) { return `${now.slice(0, 10)}T00:00:00.000Z`; }
function tier(value: unknown): Tier | undefined { return typeof value === "string" && ["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"].includes(value) ? value as Tier : undefined; }
function rows(row: unknown): Record<string, unknown>[] { const result = record(record(row).result); return Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.map(record) : []; }
function extension(template: PlaybookTemplate | null): FeasibilityExtension { const raw = template?.domain_extension as Record<string, unknown> | undefined; const value = raw?.feasibility ?? raw?.resources; return value && typeof value === "object" && !Array.isArray(value) ? value as FeasibilityExtension : {}; }
function level(value: unknown): Level { return ["LIMITED", "MODERATE", "MATERIAL", "UNKNOWN"].includes(value as string) ? value as Level : "UNKNOWN"; }

export function buildInterventionFeasibilityContext(organizationId: string, impactRun: unknown, priorityRun: unknown, now = new Date().toISOString()): InterventionFeasibilityContext {
  const impact = record(impactRun); const priority = record(priorityRun);
  return { context_id: text(impact.context_id) ?? `intervention-feasibility-context:${organizationId}:${dayStart(now).slice(0, 10)}`, business_id: organizationId, decision_cycle_id: text(impact.decision_cycle_id) ?? text(priority.decision_cycle_id) ?? `f7-p05:${organizationId}:${dayStart(now).slice(0, 10)}`, primary_priority_candidate_id: text(impact.primary_priority_candidate_id ?? priority.primary_priority_candidate_id) ?? null, source_refs: [...new Set([...strings(impact.source_refs), ...strings(priority.source_refs), SOURCE])], as_of: dayStart(now) };
}

export function candidateInputFromFeasibilitySources(template: PlaybookTemplate | null, context: InterventionFeasibilityContext, impact: ImpactCandidate, priority: PriorityCandidate): InterventionFeasibilityInput {
  const profile = extension(template);
  const defaults: InterventionFeasibilityInput = {
    candidate_id: impact.candidate_id, ...(priority.priority_tier ? { priority_tier: priority.priority_tier } : {}), expected_impact_disposition: ["SUPPORTED_QUALITATIVE", "POTENTIAL_ONLY", "VALIDATION_REQUIRED", "NO_VALID_IMPACT"].includes(impact.disposition ?? "") ? impact.disposition as InterventionFeasibilityInput["expected_impact_disposition"] : "VALIDATION_REQUIRED",
    resource_requirements: [], cost_profile: { direct: "UNKNOWN", recurring: "UNKNOWN", fixed: "UNKNOWN", variable: "UNKNOWN", switching: "UNKNOWN", maintenance: "UNKNOWN", coordination: "UNKNOWN", training: "UNKNOWN", decommissioning: "UNKNOWN", opportunity: "UNKNOWN", numeric_support: false, amounts: [] }, effort_profile: { complexity: "UNKNOWN", workload: "UNKNOWN", teams_involved: [], handoffs: [], coordination: "UNKNOWN" }, time_requirement: { implementation: "unknown", operational_readiness: "unknown", confident_outcome: "unknown", deadline_fit: "UNKNOWN" }, capability_gaps: [], dependencies: [], current_priority_refs: [], opportunity_cost_refs: [], success_capacity: { required_resources: [], moving_bottleneck: null, buffer_status: "UNKNOWN" }, adaptations: [], alternatives: [], minimum_viable_commitment: "unknown", recurring_burden: [], reversibility: "UNKNOWN", guardrail_status: "UNKNOWN", unresolved_unknowns: [...(impact.unresolved_unknowns ?? []), ...(priority.unresolved_unknowns ?? [])], evidence_refs: [...(impact.source_refs ?? [])], source_refs: [...new Set([...context.source_refs, ...(impact.source_refs ?? []), ...(priority.source_refs ?? []), ...(template?.source_refs ?? [])])],
  };
  const merged = { ...defaults, ...profile, candidate_id: impact.candidate_id, ...(priority.priority_tier ? { priority_tier: priority.priority_tier } : {}), source_refs: [...new Set([...defaults.source_refs, ...(profile.source_refs ?? [])])] };
  return { ...merged, resource_requirements: (profile.resource_requirements ?? []).map((item) => ({ ...item, required_level: level(item.required_level), source_refs: item.source_refs ?? [] })), cost_profile: { ...defaults.cost_profile, ...(profile.cost_profile ?? {}), amounts: profile.cost_profile?.numeric_support ? profile.cost_profile.amounts ?? [] : [] }, effort_profile: { ...defaults.effort_profile, ...(profile.effort_profile ?? {}) }, time_requirement: { ...defaults.time_requirement, ...(profile.time_requirement ?? {}) }, success_capacity: { ...defaults.success_capacity, ...(profile.success_capacity ?? {}) } } as InterventionFeasibilityInput;
}

async function persist(supabase: any, organizationId: string, context: InterventionFeasibilityContext, candidates: InterventionFeasibilityInput[], result: InterventionFeasibilityRunResult) {
  const input = { organization_id: organizationId, context, candidates }; const fingerprint = fingerprintPlaybookInput(input);
  const existing = await supabase.from("intervention_feasibility_runs").select("id, disposition").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`feasibility_lookup_failed: ${existing.error.message}`); if (existing.data) return existing.data;
  const inserted = await supabase.from("intervention_feasibility_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, as_of: context.as_of, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, input_envelope: input, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, disposition").single();
  if (inserted.error || !inserted.data) throw new Error(`feasibility_write_failed: ${inserted.error?.message ?? "no row"}`); return inserted.data;
}

export async function runInterventionFeasibilityEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [impactResult, priorityResult, templatesResult] = await Promise.all([
    supabase.from("intervention_impact_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("intervention_prioritization_runs").select("decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template_id, template_version, lifecycle, template").eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [impactResult, priorityResult, templatesResult]) if (loaded.error) throw new Error(`feasibility_input_load_failed: ${loaded.error.message}`);
  const context = buildInterventionFeasibilityContext(organizationId, impactResult.data ?? {}, priorityResult.data ?? {});
  const impactCandidates = rows(impactResult.data).map((row) => ({ candidate_id: text(row.candidate_id) ?? "invalid-candidate", disposition: text(row.disposition), source_refs: strings(row.source_refs), unresolved_unknowns: strings(row.unresolved_unknowns) }));
  const priorityById = new Map(rows(priorityResult.data).map((row) => { const candidateId = text(row.candidate_id) ?? "invalid-candidate"; return [candidateId, { candidate_id: candidateId, ...(tier(row.priority_tier) ? { priority_tier: tier(row.priority_tier) } : {}), source_refs: strings(row.source_refs), unresolved_unknowns: strings(row.unresolved_unknowns) } as PriorityCandidate]; }));
  const templates = new Map(parseActivePlaybookTemplates(templatesResult.data ?? []).map((item) => [`${item.template_id}@${item.template_version}`, item]));
  const candidates = impactCandidates.map((impact) => candidateInputFromFeasibilitySources(templates.get(impact.candidate_id) ?? null, context, impact, priorityById.get(impact.candidate_id) ?? { candidate_id: impact.candidate_id }));
  const result = evaluateInterventionFeasibilitySet({ context_id: context.context_id, business_id: organizationId, decision_cycle_id: context.decision_cycle_id, primary_priority_candidate_id: context.primary_priority_candidate_id, candidates, evaluated_at: new Date().toISOString() });
  const stored = await persist(supabase, organizationId, context, candidates, result);
  return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runInterventionFeasibilityEngineForAllOrganizations(env: LoadedApiEnv) { const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`feasibility_organizations_load_failed: ${loaded.error.message}`); const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 }; for (const organization of loaded.data ?? []) { summary.organizations += 1; try { await runInterventionFeasibilityEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; } } return summary; }
