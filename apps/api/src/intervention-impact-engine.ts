import { createClient } from "@supabase/supabase-js";
import {
  evaluateInterventionImpactSet,
  fingerprintPlaybookInput,
  type InterventionImpactInput,
  type InterventionImpactRunResult,
  type PlaybookTemplate,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p04.v1";
type Level = "LIMITED" | "MODERATE" | "MATERIAL" | "POTENTIALLY_HIGH" | "UNKNOWN";
type Tier = "NOW" | "NEXT" | "LATER" | "DO_NOT_DO" | "WAIT";

type PriorityCandidate = { candidate_id: string; priority_tier?: Tier; unresolved_unknowns?: string[]; source_refs?: string[] };
type MatchingCandidate = { candidate_id: string; causal_chain?: { mechanism_refs?: string[] }; evidence_refs?: string[]; source_refs?: string[]; unresolved_unknowns?: string[] };

export type InterventionImpactContext = {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  primary_priority_candidate_id: string | null;
  source_refs: string[];
  as_of: string;
};

type ImpactExtension = Partial<{
  primary_effect: string;
  mechanism_refs: string[];
  leading_indicator_refs: string[];
  business_outcome_refs: string[];
  economic_outcome_refs: string[];
  scope: string;
  magnitude_qualitative: Level;
  magnitude_value: number | null;
  magnitude_unit: string | null;
  time_to_signal: string;
  time_to_full_value: string;
  durability: "TRANSIENT" | "ONGOING" | "DURABLE" | "REPEATABLE" | "UNKNOWN";
  estimate_basis: "DETERMINISTIC" | "OBSERVED" | "MODELED" | "SPECULATIVE" | "UNKNOWN";
  quantitative_support: boolean;
  incrementality: "INCREMENTAL" | "ATTRIBUTED_ONLY" | "MIXED" | "UNKNOWN";
  counterfactual_present: boolean;
  secondary_effects: string[];
  negative_effects: string[];
  tradeoffs: string[];
  assumptions: string[];
  guardrail_refs: string[];
  guardrail_status: "PASS" | "FAIL" | "UNKNOWN";
}>;

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any;
}
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }
function text(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }
function dayStart(now: string): string { return `${now.slice(0, 10)}T00:00:00.000Z`; }
function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T { return values.includes(value as T) ? value as T : fallback; }
function level(value: unknown): Level { return enumValue(value, ["LIMITED", "MODERATE", "MATERIAL", "POTENTIALLY_HIGH", "UNKNOWN"], "UNKNOWN"); }
function tier(value: unknown): Tier | undefined { return typeof value === "string" && ["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"].includes(value) ? value as Tier : undefined; }
function extension(template: PlaybookTemplate | null): ImpactExtension {
  const raw = template?.domain_extension as Record<string, unknown> | undefined;
  const value = raw?.impact ?? raw?.expected_impact;
  return value && typeof value === "object" && !Array.isArray(value) ? value as ImpactExtension : {};
}
function candidateRows(row: unknown): Record<string, unknown>[] {
  const result = record(record(row).result);
  return Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.map(record) : [];
}
function priorityCandidate(row: Record<string, unknown>): PriorityCandidate {
  const priorityTier = tier(row.priority_tier);
  return {
    candidate_id: text(row.candidate_id) ?? "invalid-candidate",
    ...(priorityTier === undefined ? {} : { priority_tier: priorityTier }),
    unresolved_unknowns: strings(row.unresolved_unknowns),
    source_refs: strings(row.source_refs),
  };
}

export function buildInterventionImpactContext(organizationId: string, priorityRun: unknown, now = new Date().toISOString()): InterventionImpactContext {
  const row = record(priorityRun);
  return {
    context_id: text(row.context_id) ?? `intervention-impact-context:${organizationId}:${dayStart(now).slice(0, 10)}`,
    business_id: organizationId,
    decision_cycle_id: text(row.decision_cycle_id) ?? `f7-p04:${organizationId}:${dayStart(now).slice(0, 10)}`,
    primary_priority_candidate_id: text(row.primary_priority_candidate_id) ?? null,
    source_refs: [...new Set([...strings(row.source_refs), SOURCE])],
    as_of: dayStart(now),
  };
}

export function candidateInputFromImpactSources(
  template: PlaybookTemplate | null,
  context: InterventionImpactContext,
  priority: PriorityCandidate,
  matching: MatchingCandidate,
): InterventionImpactInput {
  const profile = extension(template);
  const causalMechanisms = strings(matching.causal_chain?.mechanism_refs);
  const primaryEffect = profile.primary_effect ?? template?.expected_effects?.[0] ?? "impact_not_declared";
  return {
    candidate_id: priority.candidate_id,
    ...(priority.priority_tier ? { priority_tier: priority.priority_tier } : {}),
    primary_effect: primaryEffect,
    mechanism_refs: profile.mechanism_refs?.length ? profile.mechanism_refs : causalMechanisms,
    leading_indicator_refs: profile.leading_indicator_refs ?? [],
    business_outcome_refs: profile.business_outcome_refs ?? [],
    economic_outcome_refs: profile.economic_outcome_refs ?? [],
    scope: profile.scope ?? "scope_not_declared",
    magnitude_qualitative: level(profile.magnitude_qualitative),
    magnitude_value: typeof profile.magnitude_value === "number" ? profile.magnitude_value : null,
    magnitude_unit: typeof profile.magnitude_unit === "string" ? profile.magnitude_unit : null,
    time_to_signal: profile.time_to_signal ?? "not_declared",
    time_to_full_value: profile.time_to_full_value ?? "not_declared",
    durability: enumValue(profile.durability, ["TRANSIENT", "ONGOING", "DURABLE", "REPEATABLE", "UNKNOWN"], "UNKNOWN"),
    estimate_basis: enumValue(profile.estimate_basis, ["DETERMINISTIC", "OBSERVED", "MODELED", "SPECULATIVE", "UNKNOWN"], "UNKNOWN"),
    quantitative_support: profile.quantitative_support === true,
    incrementality: enumValue(profile.incrementality, ["INCREMENTAL", "ATTRIBUTED_ONLY", "MIXED", "UNKNOWN"], "UNKNOWN"),
    counterfactual_present: profile.counterfactual_present === true,
    secondary_effects: profile.secondary_effects ?? [],
    negative_effects: profile.negative_effects ?? [],
    tradeoffs: profile.tradeoffs ?? [],
    assumptions: profile.assumptions ?? [],
    guardrail_refs: profile.guardrail_refs ?? [],
    guardrail_status: enumValue(profile.guardrail_status, ["PASS", "FAIL", "UNKNOWN"], "UNKNOWN"),
    unresolved_unknowns: [...(priority.unresolved_unknowns ?? []), ...(matching.unresolved_unknowns ?? [])],
    evidence_refs: [...new Set([...context.source_refs, ...(matching.evidence_refs ?? []), ...(template?.source_refs ?? [])])],
    source_refs: [...new Set([...context.source_refs, ...(priority.source_refs ?? []), ...(matching.source_refs ?? []), ...(template?.source_refs ?? [])])],
  };
}

type PersistInput = { organization_id: string; context: InterventionImpactContext; candidates: InterventionImpactInput[] };
async function persist(supabase: any, input: PersistInput, result: InterventionImpactRunResult) {
  const fingerprint = fingerprintPlaybookInput(input);
  const { data: existing, error: lookupError } = await supabase.from("intervention_impact_runs").select("id, disposition").eq("organization_id", input.organization_id).eq("input_fingerprint", fingerprint).maybeSingle();
  if (lookupError) throw new Error(`impact_lookup_failed: ${lookupError.message}`);
  if (existing) return existing;
  const { data, error } = await supabase.from("intervention_impact_runs").insert({
    organization_id: input.organization_id,
    context_id: result.context_id,
    decision_cycle_id: result.decision_cycle_id,
    as_of: input.context.as_of,
    evaluated_at: result.evaluated_at,
    input_fingerprint: fingerprint,
    disposition: result.disposition,
    candidate_count: result.candidate_evaluations.length,
    primary_priority_candidate_id: result.primary_priority_candidate_id,
    input_envelope: input,
    result,
    unresolved_unknowns: result.unresolved_unknowns,
    reason_codes: result.reason_codes,
    source_refs: result.source_refs,
  }).select("id, disposition").single();
  if (error || !data) throw new Error(`impact_write_failed: ${error?.message ?? "no row"}`);
  return data;
}

export async function runInterventionImpactEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [priorityResult, matchingResult, templatesResult] = await Promise.all([
    supabase.from("intervention_prioritization_runs").select("id, context_id, decision_cycle_id, as_of, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("intervention_matching_runs").select("id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template_id, template_version, lifecycle, template").eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [priorityResult, matchingResult, templatesResult]) if (loaded.error) throw new Error(`impact_input_load_failed: ${loaded.error.message}`);
  const context = buildInterventionImpactContext(organizationId, priorityResult.data ?? {});
  const priorities = candidateRows(priorityResult.data).map(priorityCandidate);
  const matchingRows = candidateRows(matchingResult.data);
  const matchingById = new Map(matchingRows.map((row) => [text(row.candidate_id) ?? "invalid-candidate", {
    candidate_id: text(row.candidate_id) ?? "invalid-candidate",
    causal_chain: record(row.causal_chain) as { mechanism_refs?: string[] },
    evidence_refs: strings(row.evidence_refs), source_refs: strings(row.source_refs), unresolved_unknowns: strings(row.unresolved_unknowns),
  }]));
  const templates = new Map(parseActivePlaybookTemplates(templatesResult.data ?? []).map((template) => [`${template.template_id}@${template.template_version}`, template]));
  const candidates = priorities.map((priority) => candidateInputFromImpactSources(templates.get(priority.candidate_id) ?? null, context, priority, matchingById.get(priority.candidate_id) ?? { candidate_id: priority.candidate_id }));
  const result = evaluateInterventionImpactSet({ context_id: context.context_id, business_id: organizationId, decision_cycle_id: context.decision_cycle_id, primary_priority_candidate_id: context.primary_priority_candidate_id, candidates, evaluated_at: new Date().toISOString() });
  const stored = await persist(supabase, { organization_id: organizationId, context, candidates }, result);
  return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runInterventionImpactEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const { data: organizations, error } = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (error) throw new Error(`impact_organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try { await runInterventionImpactEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; }
  }
  return summary;
}
