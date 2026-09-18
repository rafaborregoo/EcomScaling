import { createClient } from "@supabase/supabase-js";
import {
  evaluateInterventionMatchingSet,
  fingerprintPlaybookInput,
  type InterventionMatchingInput,
  type InterventionMatchingRunResult,
  type PlaybookTemplate,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p02.v1";

type DiagnosticRow = {
  id: string;
  finalization_status?: string | null;
  validation_passed?: boolean | null;
  handoff_ready?: boolean | null;
};
type DecisionRow = { id: string; as_of?: string | null };
type TriState = "TRUE" | "FALSE" | "UNKNOWN";

export type InterventionMatchingContext = {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  problem_refs: string[];
  driver_refs: string[];
  cause_refs: string[];
  mechanism_refs: string[];
  lever_refs: string[];
  diagnosis_refs: string[];
  evidence_refs: string[];
  source_versions: string[];
  facts: Record<string, TriState>;
  as_of: string;
};

type MatchingExtension = {
  problem_refs?: unknown;
  driver_refs?: unknown;
  cause_refs?: unknown;
  mechanism_refs?: unknown;
  lever_refs?: unknown;
  causal_coherence?: unknown;
  supporting_signal_refs?: unknown;
  disconfirming_signal_refs?: unknown;
  discriminating_evidence_refs?: unknown;
  functional_type?: unknown;
  intervention_family?: unknown;
  scope_refs?: unknown;
  temporal_horizon?: unknown;
};

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

function dayStart(now = new Date()): string {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function triState(value: unknown): TriState {
  return value === "TRUE" || value === "FALSE" ? value : "UNKNOWN";
}

function extension(template: PlaybookTemplate): MatchingExtension {
  const raw = template.domain_extension as Record<string, unknown>;
  const matching = raw.matching ?? raw.causal_matching;
  return matching && typeof matching === "object"
    ? (matching as MatchingExtension)
    : {};
}

export function buildInterventionMatchingContext(
  organizationId: string,
  diagnostics: DiagnosticRow[],
  latestDecision: DecisionRow | null,
  now = new Date().toISOString(),
): InterventionMatchingContext {
  const asOf = dayStart(new Date(now));
  const diagnosisRefs = diagnostics.map((row) => row.id);
  const decisionRefs = latestDecision ? [latestDecision.id] : [];
  const evidenceRefs = [...diagnosisRefs, ...decisionRefs];
  const diagnosisSufficient = diagnostics.some(
    (row) =>
      row.finalization_status === "finalized_valid" &&
      row.validation_passed === true &&
      row.handoff_ready === true,
  );
  return {
    context_id: `intervention-matching-context:${organizationId}:${asOf.slice(0, 10)}`,
    business_id: organizationId,
    decision_cycle_id: `f7-p02:${organizationId}:${asOf.slice(0, 10)}`,
    // A decision output is a traceable problem reference only when the
    // upstream decision layer has supplied one; we never invent a KPI or cause.
    problem_refs: decisionRefs,
    driver_refs: [],
    cause_refs: [],
    mechanism_refs: [],
    lever_refs: [],
    diagnosis_refs: diagnosisRefs,
    evidence_refs: evidenceRefs,
    source_versions: ["f3-d14.v1", SOURCE],
    facts: {
      "problem.available": latestDecision ? "TRUE" : "UNKNOWN",
      "diagnosis.sufficient": diagnosisSufficient ? "TRUE" : "UNKNOWN",
      "matching.causal_coherence": "UNKNOWN",
      "matching.supporting_signals": "UNKNOWN",
    },
    as_of: asOf,
  };
}

export function candidateInputFromMatchingTemplate(
  template: PlaybookTemplate,
  context: InterventionMatchingContext,
): InterventionMatchingInput {
  const match = extension(template);
  const candidateProblemRefs = strings(match.problem_refs).length
    ? strings(match.problem_refs)
    : template.problem_refs;
  return {
    candidate_id: `${template.template_id}@${template.template_version}`,
    problem_refs: context.problem_refs,
    candidate_problem_refs: candidateProblemRefs,
    driver_refs: context.driver_refs,
    candidate_driver_refs: strings(match.driver_refs),
    cause_refs: context.cause_refs,
    candidate_cause_refs: strings(match.cause_refs),
    mechanism_refs: context.mechanism_refs,
    candidate_mechanism_refs: strings(match.mechanism_refs),
    lever_refs: context.lever_refs,
    candidate_lever_refs: strings(match.lever_refs),
    causal_coherence: triState(match.causal_coherence),
    supporting_signal_refs: strings(match.supporting_signal_refs),
    disconfirming_signal_refs: strings(match.disconfirming_signal_refs),
    discriminating_evidence_refs: strings(match.discriminating_evidence_refs),
    ...(text(match.functional_type) ? { functional_type: text(match.functional_type) } : {}),
    ...(text(match.intervention_family) ? { intervention_family: text(match.intervention_family) } : {}),
    scope_refs: strings(match.scope_refs),
    ...(text(match.temporal_horizon) ? { temporal_horizon: text(match.temporal_horizon) } : {}),
    unresolved_unknowns: [],
    evidence_refs: [...context.evidence_refs, ...template.source_refs],
    source_refs: [...context.source_versions, ...template.source_refs],
  };
}

type PersistInput = {
  organization_id: string;
  context: InterventionMatchingContext;
  candidates: InterventionMatchingInput[];
};

async function persist(
  supabase: any,
  input: PersistInput,
  result: InterventionMatchingRunResult,
) {
  const fingerprint = fingerprintPlaybookInput(input);
  const { data: existing, error: lookupError } = await supabase
    .from("intervention_matching_runs")
    .select("id, disposition")
    .eq("organization_id", input.organization_id)
    .eq("input_fingerprint", fingerprint)
    .maybeSingle();
  if (lookupError) throw new Error(`matching_lookup_failed: ${lookupError.message}`);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("intervention_matching_runs")
    .insert({
      organization_id: input.organization_id,
      context_id: result.context_id,
      decision_cycle_id: result.decision_cycle_id,
      as_of: input.context.as_of,
      evaluated_at: result.evaluated_at,
      input_fingerprint: fingerprint,
      disposition: result.disposition,
      candidate_count: result.candidate_evaluations.length,
      matched_count: result.matched_candidate_ids.length,
      input_envelope: input,
      result,
      unresolved_unknowns: result.unresolved_unknowns,
      reason_codes: result.reason_codes,
      source_refs: result.source_refs,
    })
    .select("id, disposition")
    .single();
  if (error || !data) throw new Error(`matching_write_failed: ${error?.message ?? "no row"}`);
  return data;
}

export async function runInterventionMatchingEngine(
  env: LoadedApiEnv,
  organizationId: string,
) {
  const supabase = service(env);
  const [diagnosticsResult, decisionResult, templatesResult] = await Promise.all([
    supabase
      .from("diagnostic_outputs")
      .select("id, finalization_status, validation_passed, handoff_ready")
      .eq("organization_id", organizationId)
      .eq("is_current", true)
      .not("status", "in", "(closed,invalidated)"),
    supabase
      .from("decision_outputs")
      .select("id, as_of")
      .eq("organization_id", organizationId)
      .order("as_of", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("playbook_templates")
      .select("template_id, template_version, lifecycle, template")
      .eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [diagnosticsResult, decisionResult, templatesResult]) {
    if (loaded.error) throw new Error(`matching_input_load_failed: ${loaded.error.message}`);
  }
  const context = buildInterventionMatchingContext(
    organizationId,
    (diagnosticsResult.data ?? []) as DiagnosticRow[],
    (decisionResult.data ?? null) as DecisionRow | null,
  );
  const candidates = parseActivePlaybookTemplates(templatesResult.data ?? [])
    .map((template) => candidateInputFromMatchingTemplate(template, context));
  const result = evaluateInterventionMatchingSet({
    context_id: context.context_id,
    business_id: organizationId,
    decision_cycle_id: context.decision_cycle_id,
    candidates,
    evaluated_at: new Date().toISOString(),
  });
  const stored = await persist(
    supabase,
    { organization_id: organizationId, context, candidates },
    result,
  );
  return {
    organization_id: organizationId,
    assessment_id: stored.id,
    disposition: result.disposition,
    candidate_count: result.candidate_evaluations.length,
    matched_count: result.matched_candidate_ids.length,
    unresolved_unknowns: result.unresolved_unknowns,
  };
}

export async function runInterventionMatchingEngineForAllOrganizations(
  env: LoadedApiEnv,
) {
  const supabase = service(env);
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);
  if (error) throw new Error(`matching_organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      await runInterventionMatchingEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.assessments += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
