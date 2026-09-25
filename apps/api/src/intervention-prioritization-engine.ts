import { createClient } from "@supabase/supabase-js";
import {
  evaluateInterventionPrioritizationSet,
  fingerprintPlaybookInput,
  type InterventionPrioritizationInput,
  type InterventionPrioritizationRunResult,
  type PlaybookTemplate,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p03.v1";
type TriState = "TRUE" | "FALSE" | "UNKNOWN";
type Level = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

type UpstreamCandidate = {
  candidate_id: string;
  disposition: string;
  conditions?: string[];
  blockers?: string[];
  unresolved_unknowns?: string[];
  evidence_refs?: string[];
  source_refs?: string[];
};

export type InterventionPrioritizationContext = {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  problem_refs: string[];
  source_refs: string[];
  as_of: string;
};

type PrioritizationExtension = Partial<{
  bottleneck_relation: "BOTTLENECK" | "ROOT_CAUSE" | "SYMPTOM" | "SECONDARY" | "UNKNOWN";
  active_damage: TriState;
  expected_impact: Level;
  evidence_quality: Level;
  urgency: Level;
  time_to_value: "FAST" | "MEDIUM" | "SLOW" | "UNKNOWN";
  effort: Level;
  risk: Level;
  reversibility: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  dependency_status: "READY" | "BLOCKED" | "UNKNOWN";
  learning_value: Level;
  resource_fit: TriState;
  guardrail_status: "PASS" | "FAIL" | "UNKNOWN";
  strategic_fit: Level;
  intervention_state: "IDEA" | "TEST" | "VALIDATED" | "SCALED" | "FAILING" | "UNKNOWN";
  problem_refs: string[];
  dependency_refs: string[];
  conditions: string[];
}>;

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function dayStart(now: string): string {
  return `${now.slice(0, 10)}T00:00:00.000Z`;
}

function resultCandidates(row: unknown): UpstreamCandidate[] {
  const result = record(record(row).result);
  return Array.isArray(result.candidate_evaluations)
    ? result.candidate_evaluations.map((candidate) => {
      const item = record(candidate);
      return {
        candidate_id: text(item.candidate_id) ?? "invalid-candidate",
        disposition: text(item.disposition) ?? "INSUFFICIENT_EVIDENCE",
        conditions: strings(item.conditions),
        blockers: strings(item.blockers),
        unresolved_unknowns: strings(item.unresolved_unknowns),
        evidence_refs: strings(item.evidence_refs),
        source_refs: strings(item.source_refs),
      };
    })
    : [];
}

function resultIds(row: unknown, key: string): string[] {
  return strings(record(record(row).result)[key]);
}

function extension(template: PlaybookTemplate | null): PrioritizationExtension {
  const raw = template?.domain_extension as Record<string, unknown> | undefined;
  const value = raw?.prioritization;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as PrioritizationExtension
    : {};
}

function level(value: unknown): Level {
  return value === "HIGH" || value === "MEDIUM" || value === "LOW" ? value : "UNKNOWN";
}

function triState(value: unknown): TriState {
  return value === "TRUE" || value === "FALSE" ? value : "UNKNOWN";
}

function enumValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return values.includes(value as T) ? value as T : fallback;
}

export function buildInterventionPrioritizationContext(
  organizationId: string,
  matchingRun: unknown,
  eligibilityRun: unknown,
  now = new Date().toISOString(),
): InterventionPrioritizationContext {
  const matching = record(matchingRun);
  const eligibility = record(eligibilityRun);
  const matchingEnvelope = record(matching.input_envelope);
  const matchingContext = record(matchingEnvelope.context);
  const sourceRefs = [
    ...strings(matching.source_refs),
    ...strings(eligibility.source_refs),
    ...strings(matchingContext.evidence_refs),
  ];
  return {
    context_id: text(matching.context_id) ?? `intervention-prioritization-context:${organizationId}:${dayStart(now).slice(0, 10)}`,
    business_id: organizationId,
    decision_cycle_id: text(matching.decision_cycle_id) ?? `f7-p03:${organizationId}:${dayStart(now).slice(0, 10)}`,
    problem_refs: strings(matchingContext.problem_refs),
    source_refs: [...new Set([...sourceRefs, SOURCE])],
    as_of: dayStart(now),
  };
}

export function candidateInputFromPrioritizationSources(
  template: PlaybookTemplate | null,
  context: InterventionPrioritizationContext,
  matching: UpstreamCandidate,
  eligibility: UpstreamCandidate,
): InterventionPrioritizationInput {
  const profile = extension(template);
  const candidateId = matching.candidate_id !== "invalid-candidate"
    ? matching.candidate_id
    : eligibility.candidate_id;
  const refs = (profile.problem_refs ?? template?.problem_refs ?? context.problem_refs);
  return {
    candidate_id: candidateId,
    matched_disposition: enumValue(matching.disposition, ["MATCHED", "INSUFFICIENT_EVIDENCE", "NO_CAUSAL_MATCH"], "INSUFFICIENT_EVIDENCE"),
    eligibility_disposition: enumValue(eligibility.disposition, ["ELIGIBLE_NOW", "ELIGIBLE_WITH_CONDITIONS", "INSUFFICIENT_EVIDENCE", "PREMATURE", "BLOCKED_BY_CONSTRAINT", "NOT_APPROPRIATE"], "INSUFFICIENT_EVIDENCE"),
    bottleneck_relation: enumValue(profile.bottleneck_relation, ["BOTTLENECK", "ROOT_CAUSE", "SYMPTOM", "SECONDARY", "UNKNOWN"], "UNKNOWN"),
    active_damage: triState(profile.active_damage),
    expected_impact: level(profile.expected_impact),
    evidence_quality: level(profile.evidence_quality),
    urgency: level(profile.urgency),
    time_to_value: enumValue(profile.time_to_value, ["FAST", "MEDIUM", "SLOW", "UNKNOWN"], "UNKNOWN"),
    effort: level(profile.effort),
    risk: level(profile.risk),
    reversibility: enumValue(profile.reversibility, ["HIGH", "MEDIUM", "LOW", "UNKNOWN"], "UNKNOWN"),
    dependency_status: enumValue(profile.dependency_status, ["READY", "BLOCKED", "UNKNOWN"], "UNKNOWN"),
    learning_value: level(profile.learning_value),
    resource_fit: triState(profile.resource_fit),
    guardrail_status: enumValue(profile.guardrail_status, ["PASS", "FAIL", "UNKNOWN"], "UNKNOWN"),
    strategic_fit: level(profile.strategic_fit),
    intervention_state: enumValue(profile.intervention_state, ["IDEA", "TEST", "VALIDATED", "SCALED", "FAILING", "UNKNOWN"], "UNKNOWN"),
    problem_refs: refs,
    dependency_refs: profile.dependency_refs ?? [],
    conditions: [...(profile.conditions ?? []), ...(eligibility.conditions ?? [])],
    unresolved_unknowns: [...(matching.unresolved_unknowns ?? []), ...(eligibility.unresolved_unknowns ?? [])],
    evidence_refs: [...new Set([...context.source_refs, ...(matching.evidence_refs ?? []), ...(eligibility.evidence_refs ?? []), ...(template?.source_refs ?? [])])],
    source_refs: [...new Set([...context.source_refs, ...(matching.source_refs ?? []), ...(eligibility.source_refs ?? []), ...(template?.source_refs ?? [])])],
  };
}

type PersistInput = {
  organization_id: string;
  context: InterventionPrioritizationContext;
  candidates: InterventionPrioritizationInput[];
};

async function persist(supabase: any, input: PersistInput, result: InterventionPrioritizationRunResult) {
  const fingerprint = fingerprintPlaybookInput(input);
  const { data: existing, error: lookupError } = await supabase
    .from("intervention_prioritization_runs")
    .select("id, disposition")
    .eq("organization_id", input.organization_id)
    .eq("input_fingerprint", fingerprint)
    .maybeSingle();
  if (lookupError) throw new Error(`prioritization_lookup_failed: ${lookupError.message}`);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("intervention_prioritization_runs")
    .insert({
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
    })
    .select("id, disposition")
    .single();
  if (error || !data) throw new Error(`prioritization_write_failed: ${error?.message ?? "no row"}`);
  return data;
}

export async function runInterventionPrioritizationEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [eligibilityResult, matchingResult, templatesResult] = await Promise.all([
    supabase.from("intervention_eligibility_runs")
      .select("id, context_id, decision_cycle_id, as_of, source_refs, input_envelope, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("intervention_matching_runs")
      .select("id, context_id, decision_cycle_id, as_of, source_refs, input_envelope, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("playbook_templates")
      .select("template_id, template_version, lifecycle, template")
      .eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [eligibilityResult, matchingResult, templatesResult]) {
    if (loaded.error) throw new Error(`prioritization_input_load_failed: ${loaded.error.message}`);
  }
  const matchingRun = matchingResult.data ?? {};
  const eligibilityRun = eligibilityResult.data ?? {};
  const context = buildInterventionPrioritizationContext(organizationId, matchingRun, eligibilityRun);
  const matchingCandidates = resultCandidates(matchingRun);
  const eligibilityCandidates = resultCandidates(eligibilityRun);
  const allIds = [...new Set([
    ...resultIds(matchingRun, "matched_candidate_ids"),
    ...resultIds(eligibilityRun, "eligible_candidate_ids"),
    ...matchingCandidates.map((candidate) => candidate.candidate_id),
    ...eligibilityCandidates.map((candidate) => candidate.candidate_id),
  ])];
  const templates = parseActivePlaybookTemplates(templatesResult.data ?? []);
  const byId = new Map(templates.map((template) => [`${template.template_id}@${template.template_version}`, template]));
  const matchingById = new Map(matchingCandidates.map((candidate) => [candidate.candidate_id, candidate]));
  const eligibilityById = new Map(eligibilityCandidates.map((candidate) => [candidate.candidate_id, candidate]));
  const candidates = allIds.map((candidateId) => candidateInputFromPrioritizationSources(
    byId.get(candidateId) ?? null,
    context,
    matchingById.get(candidateId) ?? { candidate_id: candidateId, disposition: "INSUFFICIENT_EVIDENCE", source_refs: [] },
    eligibilityById.get(candidateId) ?? { candidate_id: candidateId, disposition: "INSUFFICIENT_EVIDENCE", source_refs: [] },
  ));
  const result = evaluateInterventionPrioritizationSet({
    context_id: context.context_id,
    business_id: organizationId,
    decision_cycle_id: context.decision_cycle_id,
    candidates,
    evaluated_at: new Date().toISOString(),
  });
  const stored = await persist(supabase, { organization_id: organizationId, context, candidates }, result);
  return {
    organization_id: organizationId,
    assessment_id: stored.id,
    disposition: result.disposition,
    candidate_count: result.candidate_evaluations.length,
    primary_priority_candidate_id: result.primary_priority_candidate_id,
    unresolved_unknowns: result.unresolved_unknowns,
  };
}

export async function runInterventionPrioritizationEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const { data: organizations, error } = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (error) throw new Error(`prioritization_organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      await runInterventionPrioritizationEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.assessments += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
