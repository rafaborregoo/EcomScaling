import { createClient } from "@supabase/supabase-js";
import {
  evaluatePlaybookFramework,
  playbookTemplateSchema,
  type PlaybookFrameworkInputLike,
  type PlaybookFrameworkResult,
  type PlaybookTemplate,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("playbook-engine");

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

type DiagnosticRow = {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
};

type DecisionRow = {
  id: string;
  as_of?: string | null;
};

export type PlaybookEngineOptions = {
  domain?: string;
  contextBuilder?: (
    organizationId: string,
    diagnostics: DiagnosticRow[],
    latestDecision: DecisionRow | null,
    now?: string,
  ) => PlaybookFrameworkInputLike["context"];
  contextEnricher?: (
    supabase: any,
    context: PlaybookFrameworkInputLike["context"],
    organizationId: string,
  ) => Promise<PlaybookFrameworkInputLike["context"]>;
  templateFilter?: (template: PlaybookTemplate) => boolean;
};

function dayStart(now = new Date()): string {
  return `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export function buildPlaybookContext(
  organizationId: string,
  diagnostics: DiagnosticRow[],
  latestDecision: DecisionRow | null,
  now = new Date().toISOString(),
): PlaybookFrameworkInputLike["context"] {
  const asOf = dayStart(new Date(now));
  const diagnosisRefs = diagnostics.map((row) => row.id);
  const sourceRefs = [
    ...diagnosisRefs,
    ...(latestDecision ? [latestDecision.id] : []),
  ];
  return {
    context_id: `playbook-context:${organizationId}:${asOf.slice(0, 10)}`,
    decision_cycle_id: `f5-p00:${organizationId}:${asOf.slice(0, 10)}`,
    business_id: organizationId,
    priority_ref: latestDecision?.id ?? null,
    objective_ref: null,
    problem_refs: diagnosisRefs,
    diagnosis_refs: diagnosisRefs,
    maturity_ref: null,
    business_context_ref: null,
    constraint_refs: [],
    risk_assessment_refs: [],
    economics_refs: [],
    dependency_refs: [],
    evidence_refs: sourceRefs,
    source_versions: ["p12.v1", "d12.v1", "f5-p00.v1"],
    facts: {
      "diagnosis.available": diagnosisRefs.length ? "TRUE" : "UNKNOWN",
      "priority.available": latestDecision ? "TRUE" : "UNKNOWN",
      "tracking.reliable": "UNKNOWN",
      "economics.available": "UNKNOWN",
      "operational.capacity.available": "UNKNOWN",
    },
    as_of: asOf,
  };
}

export function parseActivePlaybookTemplates(rows: unknown[]): PlaybookTemplate[] {
  const templates: PlaybookTemplate[] = [];
  for (const row of rows) {
    const candidate = row as {
      template_id?: string;
      template_version?: string;
      lifecycle?: string;
      template?: unknown;
    };
    if (candidate.lifecycle !== "ACTIVE") continue;
    const parsed = playbookTemplateSchema.safeParse(candidate.template);
    if (
      parsed.success &&
      parsed.data.template_id === candidate.template_id &&
      parsed.data.template_version === candidate.template_version
    ) {
      templates.push(parsed.data);
    }
  }
  return templates;
}

async function persist(
  supabase: any,
  input: PlaybookFrameworkInputLike,
  result: PlaybookFrameworkResult,
  domain: string,
) {
  const { data: existing, error: lookupError } = await supabase
    .from("playbook_framework_runs")
    .select("id, disposition")
    .eq("organization_id", input.context.business_id)
    .eq("input_fingerprint", result.input_fingerprint)
    .maybeSingle();
  if (lookupError) {
    throw new Error(`playbook_lookup_failed: ${lookupError.message}`);
  }
  if (existing) return existing;
  const { data, error } = await supabase
    .from("playbook_framework_runs")
    .insert({
      organization_id: input.context.business_id,
      context_id: input.context.context_id,
      decision_cycle_id: input.context.decision_cycle_id,
      as_of: input.context.as_of,
      evaluated_at: result.evaluated_at,
      input_fingerprint: result.input_fingerprint,
      domain,
      disposition: result.disposition,
      selected_instance_id: result.selected_instance?.instance_id ?? null,
      candidate_count: result.candidate_evaluations.length,
      input_envelope: input,
      result,
      unresolved_unknowns: result.unresolved_unknowns,
      reason_codes: result.reason_codes,
      source_refs: result.source_refs,
    })
    .select("id, disposition")
    .single();
  if (error || !data) {
    throw new Error(`playbook_write_failed: ${error?.message ?? "no row"}`);
  }
  return data;
}

export async function runPlaybookFrameworkEngine(
  env: LoadedApiEnv,
  organizationId: string,
  options: PlaybookEngineOptions = {},
) {
  const supabase = service(env);
  const [diagnosticsResult, decisionResult, templatesResult] =
    await Promise.all([
      supabase
        .from("diagnostic_outputs")
        .select("id, updated_at, created_at")
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
  for (const result of [
    diagnosticsResult,
    decisionResult,
    templatesResult,
  ]) {
    if (result.error) {
      throw new Error(`playbook_input_load_failed: ${result.error.message}`);
    }
  }
  const baseContext = (options.contextBuilder ?? buildPlaybookContext)(
    organizationId,
    (diagnosticsResult.data ?? []) as DiagnosticRow[],
    (decisionResult.data ?? null) as DecisionRow | null,
  );
  const context = options.contextEnricher
    ? await options.contextEnricher(supabase, baseContext, organizationId)
    : baseContext;
  const input: PlaybookFrameworkInputLike = {
    context,
    templates: parseActivePlaybookTemplates(templatesResult.data ?? []).filter(
      options.templateFilter ?? (() => true),
    ),
    evaluated_at: new Date().toISOString(),
  };
  const result = evaluatePlaybookFramework(input);
  const stored = await persist(supabase, input, result, options.domain ?? "GENERAL");
  return {
    organization_id: organizationId,
    assessment_id: stored.id,
    disposition: result.disposition,
    candidate_count: result.candidate_evaluations.length,
    unresolved_unknowns: result.unresolved_unknowns,
  };
}

export async function runPlaybookFrameworkEngineForAllOrganizations(
  env: LoadedApiEnv,
  options: PlaybookEngineOptions = {},
) {
  const supabase = service(env);
  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);
  if (error) {
    throw new Error(`playbook_organizations_load_failed: ${error.message}`);
  }
  const summary = {
    organizations: 0,
    succeeded: 0,
    failed: 0,
    assessments: 0,
  };
  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      await runPlaybookFrameworkEngine(env, organization.id as string, options);
      summary.succeeded += 1;
      summary.assessments += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error("playbook_org_failed", {
        organization_id: organization.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return summary;
}
