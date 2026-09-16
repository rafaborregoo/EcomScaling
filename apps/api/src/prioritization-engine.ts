/** F4/P00: materializa el contrato raíz sobre el diagnóstico vigente.
 *
 * P0 todavía no rankea. Si P1 no ha producido contexto, deja la ejecución en
 * INPUT_INCOMPLETE y conserva explícitamente el hueco; no supone growth.
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  evaluatePrioritizationRun,
  type PrioritizationInputLike,
  type PrioritizationResult,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";

const logger = createLogger("prioritization-engine");
function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any;
}

type DiagnosticOutputRow = {
  id: string;
  case_id: string;
  status: string;
  is_current: boolean;
  updated_at?: string | null;
  created_at?: string | null;
};

function snapshotId(outputs: DiagnosticOutputRow[], asOf: string): string {
  const latest = outputs.map((output) => output.updated_at ?? output.created_at ?? asOf).sort().at(-1) ?? asOf;
  return `diagnostic-outputs:${latest}`;
}

function snapshotAsOf(outputs: DiagnosticOutputRow[], fallback: string): string {
  return outputs.map((output) => output.updated_at ?? output.created_at ?? fallback).sort().at(-1) ?? fallback;
}

function buildInput(organizationId: string, outputs: DiagnosticOutputRow[], now = new Date().toISOString()): PrioritizationInputLike {
  const analysisSnapshotId = snapshotId(outputs, now);
  const decisionAsOf = snapshotAsOf(outputs, now);
  return {
    prioritization_run_id: randomUUID(),
    business_id: organizationId,
    analysis_snapshot_id: analysisSnapshotId,
    created_at: now,
    decision_as_of: decisionAsOf,
    schema_version: "p0.v1",
    decision_policy_version: "p0-deterministic.v1",
    diagnostic_refs: outputs.map((output) => output.id),
    // P1 owns the context. P0 must expose its absence, never infer a growth goal.
    decision_context_ref: null,
    candidate_set_ref: `diagnostic-outputs:${organizationId}`,
    evaluation_time: now,
    candidates: outputs.map((output) => ({ candidate_id: output.id, candidate_type: "PROBLEM" as const })),
    gates: [],
  };
}

async function persist(supabase: any, input: PrioritizationInputLike, result: PrioritizationResult) {
  const { data: existing, error: existingError } = await supabase.from("prioritization_runs")
    .select("id, run_status, decision_validity")
    .eq("organization_id", input.business_id)
    .eq("analysis_snapshot_id", input.analysis_snapshot_id)
    .eq("input_fingerprint", result.input_fingerprint)
    .eq("decision_policy_version", input.decision_policy_version)
    .maybeSingle();
  if (existingError) throw new Error(`prioritization_run_lookup_failed: ${existingError.message}`);
  // P0 semantic idempotency: a retry of the same frozen input reuses the
  // historical run; it never creates a second decision with a new UUID.
  if (existing) return existing.id as string;
  const { data: run, error } = await supabase.from("prioritization_runs").insert({
    id: input.prioritization_run_id,
    organization_id: input.business_id,
    business_id: input.business_id,
    analysis_snapshot_id: input.analysis_snapshot_id,
    created_at: input.created_at,
    decision_as_of: input.decision_as_of,
    schema_version: input.schema_version,
    decision_policy_version: input.decision_policy_version,
    input_fingerprint: result.input_fingerprint,
    run_status: result.run_status,
    decision_validity: result.decision_validity,
    input_envelope: input,
    unresolved_unknowns: result.unresolved_unknowns,
    abstention_reason_codes: result.abstention_reason_codes,
    source_lineage_refs: result.source_lineage_refs,
    warnings: result.warnings,
    result,
  }).select("id").single();
  if (error || !run) throw new Error(`prioritization_run_write_failed: ${error?.message ?? "no row"}`);
  const { error: traceError } = await supabase.from("prioritization_rule_traces").insert({
    organization_id: input.business_id,
    prioritization_run_id: run.id,
    rule_id: "P0.INPUT_VALIDATION",
    rule_version: input.schema_version,
    rule_type: "input",
    input_refs: [input.analysis_snapshot_id, ...(input.diagnostic_refs ?? [])],
    result: { run_status: result.run_status, decision_validity: result.decision_validity },
    reason_codes: result.abstention_reason_codes,
    evidence_refs: [input.analysis_snapshot_id],
    deterministic: true,
  });
  if (traceError) throw new Error(`prioritization_trace_write_failed: ${traceError.message}`);
  return run.id as string;
}

export async function runPrioritizationEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const { data: outputs, error } = await supabase.from("diagnostic_outputs")
    .select("id, case_id, status, is_current, updated_at, created_at")
    .eq("organization_id", organizationId)
    .eq("is_current", true)
    .not("status", "in", "(closed,invalidated)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`prioritization_diagnostics_load_failed: ${error.message}`);
  const input = buildInput(organizationId, (outputs ?? []) as DiagnosticOutputRow[]);
  const result = evaluatePrioritizationRun(input);
  const runId = await persist(supabase, input, result);
  return { run_id: runId, run_status: result.run_status, decision_validity: result.decision_validity, candidates: input.candidates?.length ?? 0 };
}

export async function runPrioritizationEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);
  const { data: organizations, error } = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (error) throw new Error(`prioritization_organizations_load_failed: ${error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, runs: 0, incomplete: 0, abstained: 0 };
  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runPrioritizationEngine(env, organization.id as string);
      summary.succeeded += 1; summary.runs += 1;
      if (result.run_status === "INPUT_INCOMPLETE") summary.incomplete += 1;
      if (result.run_status === "ABSTAINED") summary.abstained += 1;
    } catch (error) {
      summary.failed += 1;
      logger.error("prioritization_engine_org_failed", { organization_id: organization.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return summary;
}
