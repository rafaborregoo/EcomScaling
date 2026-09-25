import { createClient } from "@supabase/supabase-js";
import {
  evaluateMaturityRecommendationSet,
  fingerprintPlaybookInput,
  type MaturityRecommendationInput,
  type MaturityRecommendationRunResult,
  type PlaybookTemplate,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p10.v1";
type MaturityExtension = Partial<MaturityRecommendationInput> & {
  functional_capability?: string;
};

export type MaturityProfileSnapshot = {
  profile_id: string;
  business_stage: string | null;
  confidence: string;
  capabilities: Array<{
    capability: string;
    current_level: string;
    confidence: string;
  }>;
};

export type MaturityRecommendationContext = {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  primary_priority_candidate_id: string | null;
  maturity_profile_refs: string[];
  source_refs: string[];
  as_of: string;
};

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function text(value: unknown, fallback = "UNKNOWN"): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function dayStart(now: string) {
  return `${now.slice(0, 10)}T00:00:00.000Z`;
}

function resultRows(upstreamRun: unknown): Record<string, unknown>[] {
  const result = record(record(upstreamRun).result);
  return Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.map(record)
    : [];
}

function extension(template: PlaybookTemplate | null): MaturityExtension {
  const raw = record(template?.domain_extension);
  const value = raw.maturity ?? raw.maturity_recommendations;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as MaturityExtension)
    : {};
}

function refs(profile: MaturityExtension, key: keyof MaturityRecommendationInput): string[] {
  return strings(profile[key]);
}

export function buildMaturityRecommendationContext(
  organizationId: string,
  upstreamRun: unknown,
  profiles: MaturityProfileSnapshot[],
  now = new Date().toISOString(),
): MaturityRecommendationContext {
  const row = record(upstreamRun);
  const asOf = dayStart(now);
  return {
    context_id: text(row.context_id, `maturity-recommendation-context:${organizationId}:${asOf.slice(0, 10)}`),
    business_id: organizationId,
    decision_cycle_id: text(row.decision_cycle_id, `f7-p10:${organizationId}:${asOf.slice(0, 10)}`),
    primary_priority_candidate_id:
      typeof row.primary_priority_candidate_id === "string" ? row.primary_priority_candidate_id : null,
    maturity_profile_refs: profiles.map((profile) => profile.profile_id),
    source_refs: [...new Set([
      ...strings(row.source_refs),
      ...profiles.map((profile) => `maturity-profile:${profile.profile_id}`),
      SOURCE,
    ])],
    as_of: asOf,
  };
}

export function candidateInputFromMaturitySources(
  template: PlaybookTemplate | null,
  context: MaturityRecommendationContext,
  profile: MaturityProfileSnapshot | null,
  upstreamCandidate: Record<string, unknown>,
): MaturityRecommendationInput {
  const configured = extension(template);
  const candidateId = text(upstreamCandidate.candidate_id, "invalid-candidate");
  const capability = text(configured.functional_capability, "");
  const observed = profile?.capabilities.find((item) => item.capability === capability);
  const defaults: MaturityRecommendationInput = {
    candidate_id: candidateId,
    selected_intervention: text(
      configured.selected_intervention,
      text(upstreamCandidate.selected_intervention, text(upstreamCandidate.candidate_intervention, "intervention not declared")),
    ),
    business_stage: text(configured.business_stage, "UNKNOWN"),
    functional_maturity: observed?.current_level ?? text(configured.functional_maturity, "UNKNOWN"),
    intervention_readiness: text(configured.intervention_readiness, "UNKNOWN"),
    existing_capabilities: refs(configured, "existing_capabilities"),
    missing_capabilities: refs(configured, "missing_capabilities"),
    evidence: refs(configured, "evidence"),
    risk: refs(configured, "risk"),
    resource_constraints: refs(configured, "resource_constraints"),
    current_mode: text(configured.current_mode, "UNKNOWN"),
    current_bottleneck: text(configured.current_bottleneck, "UNKNOWN"),
    local_reset: configured.local_reset === true,
    absorption_capacity: text(configured.absorption_capacity, "UNKNOWN"),
    candidate_complexity: text(configured.candidate_complexity, "UNKNOWN"),
    focus_capacity: text(configured.focus_capacity, "UNKNOWN"),
    organization_complexity: refs(configured, "organization_complexity"),
    current_debt: refs(configured, "current_debt"),
    current_recommendation: text(configured.current_recommendation, "Validar el contexto antes de recomendar una intervención"),
    deferred_recommendation: text(configured.deferred_recommendation, "UNKNOWN"),
    not_yet_reason: text(configured.not_yet_reason, ""),
    capability_to_build: text(configured.capability_to_build, ""),
    maturity_unlock: refs(configured, "maturity_unlock"),
    unresolved_unknowns: [...new Set([
      ...strings(upstreamCandidate.unresolved_unknowns),
      ...refs(configured, "unresolved_unknowns"),
      ...(profile ? [] : ["maturity_profile"]),
    ])],
    evidence_refs: [...new Set([
      ...strings(upstreamCandidate.source_refs),
      ...refs(configured, "evidence_refs"),
    ])],
    source_refs: [...new Set([
      ...context.source_refs,
      ...strings(upstreamCandidate.source_refs),
      ...refs(configured, "source_refs"),
      ...(profile ? [`maturity-profile:${profile.profile_id}`] : []),
    ])],
  };

  const merged = { ...defaults, ...configured, candidate_id: candidateId } as MaturityRecommendationInput;
  const arrayKeys: Array<keyof MaturityRecommendationInput> = [
    "existing_capabilities",
    "missing_capabilities",
    "evidence",
    "risk",
    "resource_constraints",
    "organization_complexity",
    "current_debt",
    "maturity_unlock",
  ];
  for (const key of arrayKeys) {
    (merged as unknown as Record<string, unknown>)[key] = refs(configured, key);
  }
  merged.unresolved_unknowns = defaults.unresolved_unknowns;
  merged.evidence_refs = defaults.evidence_refs;
  merged.source_refs = defaults.source_refs;
  merged.functional_maturity = observed?.current_level ?? text(configured.functional_maturity, "UNKNOWN");
  return merged;
}

async function loadProfiles(supabase: any, organizationId: string): Promise<MaturityProfileSnapshot[]> {
  const profilesResult = await supabase
    .from("maturity_profiles")
    .select("id, business_stage, confidence")
    .eq("organization_id", organizationId)
    .is("superseded_at", null);
  if (profilesResult.error) throw new Error(`maturity_profiles_load_failed: ${profilesResult.error.message}`);

  const profiles = (profilesResult.data ?? []) as Array<{ id: string; business_stage: string | null; confidence: string }>;
  if (profiles.length === 0) return [];
  const capabilitiesResult = await supabase
    .from("capability_maturity")
    .select("profile_id, capability, current_level, confidence")
    .in("profile_id", profiles.map((profile) => profile.id));
  if (capabilitiesResult.error) throw new Error(`maturity_capabilities_load_failed: ${capabilitiesResult.error.message}`);
  const byProfile = new Map<string, MaturityProfileSnapshot["capabilities"]>();
  for (const row of (capabilitiesResult.data ?? []) as Array<{ profile_id: string; capability: string; current_level: string; confidence: string }>) {
    const values = byProfile.get(row.profile_id) ?? [];
    values.push({ capability: row.capability, current_level: row.current_level, confidence: row.confidence });
    byProfile.set(row.profile_id, values);
  }
  return profiles.map((profile) => ({
    profile_id: profile.id,
    business_stage: profile.business_stage,
    confidence: profile.confidence,
    capabilities: byProfile.get(profile.id) ?? [],
  }));
}

async function persist(
  supabase: any,
  organizationId: string,
  context: MaturityRecommendationContext,
  candidates: MaturityRecommendationInput[],
  result: MaturityRecommendationRunResult,
) {
  const input = { context, candidates };
  const fingerprint = fingerprintPlaybookInput(input);
  const existing = await supabase
    .from("maturity_recommendation_runs")
    .select("id, disposition")
    .eq("organization_id", organizationId)
    .eq("input_fingerprint", fingerprint)
    .maybeSingle();
  if (existing.error) throw new Error(`maturity_recommendations_lookup_failed: ${existing.error.message}`);
  if (existing.data) return existing.data;
  const inserted = await supabase
    .from("maturity_recommendation_runs")
    .insert({
      organization_id: organizationId,
      context_id: result.context_id,
      decision_cycle_id: result.decision_cycle_id,
      as_of: context.as_of,
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
    })
    .select("id, disposition")
    .single();
  if (inserted.error || !inserted.data) throw new Error(`maturity_recommendations_write_failed: ${inserted.error?.message ?? "no row"}`);
  return inserted.data;
}

export async function runMaturityRecommendationEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [upstreamResult, templatesResult, profiles] = await Promise.all([
    supabase
      .from("intervention_intensity_runs")
      .select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("playbook_templates")
      .select("template_id, template_version, lifecycle, template")
      .eq("lifecycle", "ACTIVE"),
    loadProfiles(supabase, organizationId),
  ]);
  for (const loaded of [upstreamResult, templatesResult]) {
    if (loaded.error) throw new Error(`maturity_recommendations_input_load_failed: ${loaded.error.message}`);
  }
  const context = buildMaturityRecommendationContext(organizationId, upstreamResult.data ?? {}, profiles);
  const templates = new Map(
    parseActivePlaybookTemplates(templatesResult.data ?? []).map((item) => [`${item.template_id}@${item.template_version}`, item]),
  );
  const candidates = resultRows(upstreamResult.data).map((candidate) => {
    const template = templates.get(text(candidate.candidate_id)) ?? null;
    const configured = extension(template);
    const capability = text(configured.functional_capability, "");
    const profile = profiles.find((item) => item.capabilities.some((entry) => entry.capability === capability)) ?? profiles[0] ?? null;
    return candidateInputFromMaturitySources(template, context, profile, candidate);
  });
  const result = evaluateMaturityRecommendationSet({
    context_id: context.context_id,
    business_id: organizationId,
    decision_cycle_id: context.decision_cycle_id,
    primary_priority_candidate_id: context.primary_priority_candidate_id,
    candidates,
    evaluated_at: new Date().toISOString(),
  });
  const stored = await persist(supabase, organizationId, context, candidates, result);
  return {
    organization_id: organizationId,
    assessment_id: stored.id,
    disposition: result.disposition,
    candidate_count: result.candidate_evaluations.length,
    primary_priority_candidate_id: result.primary_priority_candidate_id,
    unresolved_unknowns: result.unresolved_unknowns,
  };
}

export async function runMaturityRecommendationEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (loaded.error) throw new Error(`maturity_recommendations_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of loaded.data ?? []) {
    summary.organizations += 1;
    try {
      await runMaturityRecommendationEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.assessments += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
