import { createClient } from "@supabase/supabase-js";
import {
  evaluateInterventionEligibilitySet,
  fingerprintPlaybookInput,
  type InterventionEligibilityInput,
  type InterventionEligibilityRunResult,
  type PlaybookTemplate,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p01.v1";

type DiagnosticRow = {
  id: string;
  finalization_status?: string | null;
  validation_passed?: boolean | null;
  handoff_ready?: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type DecisionRow = { id: string; as_of?: string | null };

export type InterventionEligibilityContext = {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  priority_problem_refs: string[];
  diagnosis_refs: string[];
  evidence_refs: string[];
  source_versions: string[];
  facts: Record<string, "TRUE" | "FALSE" | "UNKNOWN">;
  as_of: string;
};

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

function dayStart(now = new Date()): string {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export function buildInterventionEligibilityContext(
  organizationId: string,
  diagnostics: DiagnosticRow[],
  latestDecision: DecisionRow | null,
  now = new Date().toISOString(),
): InterventionEligibilityContext {
  const asOf = dayStart(new Date(now));
  const diagnosisRefs = diagnostics.map((row) => row.id);
  const sourceRefs = [...diagnosisRefs, ...(latestDecision ? [latestDecision.id] : [])];
  const finalDiagnostic = diagnostics.some(
    (row) =>
      row.finalization_status === "finalized_valid" &&
      row.validation_passed === true &&
      row.handoff_ready === true,
  );
  const diagnosticState = finalDiagnostic ? "TRUE" : diagnosisRefs.length ? "UNKNOWN" : "UNKNOWN";
  return {
    context_id: `intervention-eligibility-context:${organizationId}:${asOf.slice(0, 10)}`,
    business_id: organizationId,
    decision_cycle_id: `f7-p01:${organizationId}:${asOf.slice(0, 10)}`,
    priority_problem_refs: latestDecision ? [latestDecision.id] : [],
    diagnosis_refs: diagnosisRefs,
    evidence_refs: sourceRefs,
    source_versions: ["f3-d14.v1", SOURCE],
    facts: {
      "priority.available": latestDecision ? "TRUE" : "UNKNOWN",
      "diagnosis.sufficient": diagnosticState,
      "evidence.sufficient": diagnosticState,
      "constraints.critical_clear": "UNKNOWN",
      "dependencies.satisfied": "UNKNOWN",
      "resources.fit": "UNKNOWN",
      "timing.maturity.fit": "UNKNOWN",
      "risk.acceptable": "UNKNOWN",
      "strategy.aligned": "UNKNOWN",
      "interference.clear": "UNKNOWN",
      "materiality.observed": "UNKNOWN",
    },
    as_of: asOf,
  };
}

function candidateId(template: PlaybookTemplate): string {
  return `${template.template_id}@${template.template_version}`;
}

export function candidateInputFromTemplate(
  template: PlaybookTemplate,
  context: InterventionEligibilityContext,
): InterventionEligibilityInput {
  const candidate = candidateId(template);
  const conditionRefs = template.preconditions
    .filter((condition) => condition.condition_type !== "HARD_PRECONDITION")
    .map((condition) => condition.reason_code ?? condition.fact_ref);
  const blockerRefs = template.contraindications.map(
    (condition) => condition.reason_code ?? condition.fact_ref,
  );
  const fact = (key: string): "TRUE" | "FALSE" | "UNKNOWN" =>
    context.facts[key] ?? "UNKNOWN";
  const diagnosis = fact("diagnosis.sufficient");
  return {
    candidate_id: candidate,
    priority_problem_refs: context.priority_problem_refs,
    candidate_problem_refs: template.problem_refs,
    diagnosis_sufficient: diagnosis,
    // A valid diagnosis is not enough to invent causal fit. A later block may
    // enrich this check with explicit matching evidence.
    causal_coherence: template.problem_refs.length ? "UNKNOWN" : "UNKNOWN",
    evidence_sufficient: fact("evidence.sufficient"),
    critical_constraint_clear: fact("constraints.critical_clear"),
    dependencies_satisfied: template.dependencies.length
      ? "UNKNOWN"
      : "TRUE",
    resource_fit: template.resource_requirements.length ? "UNKNOWN" : "UNKNOWN",
    timing_maturity_fit: "UNKNOWN",
    risk_acceptable: template.intervention_risks.length ? "UNKNOWN" : "UNKNOWN",
    strategy_aligned: "UNKNOWN",
    interference_clear: "UNKNOWN",
    materiality: "UNKNOWN",
    conditions: conditionRefs,
    blockers: blockerRefs,
    unresolved_unknowns: [],
    evidence_refs: [...context.evidence_refs, ...template.source_refs],
    source_refs: [...context.source_versions, ...template.source_refs],
  };
}

type PersistInput = {
  organization_id: string;
  context: InterventionEligibilityContext;
  candidates: InterventionEligibilityInput[];
  evaluated_at: string;
};

async function persist(
  supabase: any,
  input: PersistInput,
  result: InterventionEligibilityRunResult,
) {
  const fingerprint = fingerprintPlaybookInput(input);
  const { data: existing, error: lookupError } = await supabase
    .from("intervention_eligibility_runs")
    .select("id, disposition")
    .eq("organization_id", input.organization_id)
    .eq("input_fingerprint", fingerprint)
    .maybeSingle();
  if (lookupError) throw new Error(`eligibility_lookup_failed: ${lookupError.message}`);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("intervention_eligibility_runs")
    .insert({
      organization_id: input.organization_id,
      context_id: result.context_id,
      decision_cycle_id: result.decision_cycle_id,
      as_of: input.context.as_of,
      evaluated_at: result.evaluated_at,
      input_fingerprint: fingerprint,
      disposition: result.disposition,
      candidate_count: result.candidate_evaluations.length,
      eligible_count: result.eligible_candidate_ids.length,
      input_envelope: input,
      result,
      unresolved_unknowns: result.unresolved_unknowns,
      reason_codes: result.reason_codes,
      source_refs: result.source_refs,
    })
    .select("id, disposition")
    .single();
  if (error || !data) throw new Error(`eligibility_write_failed: ${error?.message ?? "no row"}`);
  return data;
}

export async function runInterventionEligibilityEngine(
  env: LoadedApiEnv,
  organizationId: string,
) {
  const supabase = service(env);
  const [diagnosticsResult, decisionResult, templatesResult] = await Promise.all([
    supabase
      .from("diagnostic_outputs")
      .select("id, finalization_status, validation_passed, handoff_ready, updated_at, created_at")
      .eq("organization_id", organizationId)
      .eq("is_current", true)
      .not("status", "in", "(closed,invalidated)")
      .order("created_at", { ascending: false }),
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
    if (loaded.error) throw new Error(`eligibility_input_load_failed: ${loaded.error.message}`);
  }
  const context = buildInterventionEligibilityContext(
    organizationId,
    (diagnosticsResult.data ?? []) as DiagnosticRow[],
    (decisionResult.data ?? null) as DecisionRow | null,
  );
  const candidates = parseActivePlaybookTemplates(templatesResult.data ?? [])
    .map((template) => candidateInputFromTemplate(template, context));
  const evaluatedAt = new Date().toISOString();
  const result = evaluateInterventionEligibilitySet({
    context_id: context.context_id,
    business_id: organizationId,
    decision_cycle_id: context.decision_cycle_id,
    candidates,
    evaluated_at: evaluatedAt,
  });
  const stored = await persist(
    supabase,
    { organization_id: organizationId, context, candidates, evaluated_at: evaluatedAt },
    result,
  );
  return {
    organization_id: organizationId,
    assessment_id: stored.id,
    disposition: result.disposition,
    candidate_count: result.candidate_evaluations.length,
    eligible_count: result.eligible_candidate_ids.length,
    unresolved_unknowns: result.unresolved_unknowns,
  };
}

export async function runInterventionEligibilityEngineForAllOrganizations(
  env: LoadedApiEnv,
) {
  const supabase = service(env);
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);
  if (error) throw new Error(`eligibility_organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      await runInterventionEligibilityEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.assessments += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
