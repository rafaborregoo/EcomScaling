import { createClient } from "@supabase/supabase-js";
import { evaluateInterventionTestExecuteSet, fingerprintPlaybookInput, type InterventionTestExecuteInput, type InterventionTestExecuteRunResult, type PlaybookTemplate } from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p08.v1";
type TestExecuteExtension = Partial<InterventionTestExecuteInput>;
export type InterventionTestExecuteContext = { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; source_refs: string[]; as_of: string };

function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }
function text(value: unknown, fallback = ""): string { return typeof value === "string" && value.length > 0 ? value : fallback; }
function dayStart(now: string) { return `${now.slice(0, 10)}T00:00:00.000Z`; }
function candidateRows(row: unknown): Record<string, unknown>[] { const result = record(record(row).result); return Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.map(record) : []; }
function extension(template: PlaybookTemplate | null): TestExecuteExtension { const raw = template?.domain_extension as Record<string, unknown> | undefined; const value = raw?.test_execute ?? raw?.experimentation ?? raw?.decision_test_vs_execute; return value && typeof value === "object" && !Array.isArray(value) ? value as TestExecuteExtension : {}; }
function refs(profile: TestExecuteExtension, key: keyof InterventionTestExecuteInput): string[] { return strings(profile[key]); }

export function buildInterventionTestExecuteContext(organizationId: string, sequencingRun: unknown, now = new Date().toISOString()): InterventionTestExecuteContext {
  const sequence = record(sequencingRun);
  return { context_id: text(sequence.context_id, `intervention-test-execute-context:${organizationId}:${dayStart(now).slice(0, 10)}`), business_id: organizationId, decision_cycle_id: text(sequence.decision_cycle_id, `f7-p08:${organizationId}:${dayStart(now).slice(0, 10)}`), primary_priority_candidate_id: typeof sequence.primary_priority_candidate_id === "string" ? sequence.primary_priority_candidate_id : null, source_refs: [...new Set([...strings(sequence.source_refs), SOURCE])], as_of: dayStart(now) };
}

export function candidateInputFromTestExecuteSources(template: PlaybookTemplate | null, context: InterventionTestExecuteContext, sequenceCandidate: Record<string, unknown>): InterventionTestExecuteInput {
  const profile = extension(template);
  const candidateId = text(sequenceCandidate.candidate_id, "invalid-candidate");
  const intervention = text(profile.candidate_intervention, text(sequenceCandidate.strategic_intervention, "intervention not declared"));
  const defaults: InterventionTestExecuteInput = {
    candidate_id: candidateId,
    candidate_intervention: intervention,
    known_defect: "UNKNOWN",
    evidence_strength: "UNKNOWN",
    evidence_sufficiency: "UNKNOWN",
    remaining_uncertainty: [...strings(sequenceCandidate.unresolved_unknowns), ...refs(profile, "remaining_uncertainty")],
    decision_relevance: "UNKNOWN",
    downside: [], reversibility: [], blast_radius: [], cost_of_error: [], cost_of_delay: [], value_of_learning: [],
    measurement_capability: "UNKNOWN", traffic_volume: "UNKNOWN", resources: [], existing_evidence: [], context_similarity: "UNKNOWN", guardrails: [], guardrail_status: "UNKNOWN", urgency: "UNKNOWN", current_experiments: [], business_priority: [], economics_screen: "UNCLEAR", testability: "UNKNOWN", implementation_fidelity: "UNKNOWN", contamination: [], segment_relevance: [], primary_outcome: "outcome not declared", guardrail_outcomes: [], measurement_requirement: "measurement not declared", hypothesis: "hypothesis not declared", learning_question: "learning question not declared", decision_after_result: [], exposure_mode: "UNKNOWN", pilot_scope: "UNKNOWN", observation_requirement: "UNKNOWN", observation_state: "UNKNOWN", evidence_reuse: "UNKNOWN", transferability_caveat: "UNKNOWN", experiment_cost: "UNKNOWN", experimentability: "UNKNOWN", execution_uncertainty: "UNKNOWN", intervention_scale: "UNKNOWN", experiment_type: "NOT_APPLICABLE", sequence_handoff: [], unresolved_unknowns: [...strings(sequenceCandidate.unresolved_unknowns)], evidence_refs: [...strings(sequenceCandidate.source_refs)], source_refs: [...new Set([...context.source_refs, ...strings(sequenceCandidate.source_refs), ...strings(template?.source_refs)])],
  };
  const merged = { ...defaults, ...profile, candidate_id: candidateId, candidate_intervention: intervention, source_refs: [...new Set([...defaults.source_refs, ...refs(profile, "source_refs")])], unresolved_unknowns: [...new Set([...defaults.unresolved_unknowns, ...refs(profile, "unresolved_unknowns")])], evidence_refs: [...new Set([...defaults.evidence_refs, ...refs(profile, "evidence_refs")])] } as InterventionTestExecuteInput;
  const arrayKeys: Array<keyof InterventionTestExecuteInput> = ["remaining_uncertainty", "downside", "reversibility", "blast_radius", "cost_of_error", "cost_of_delay", "value_of_learning", "resources", "existing_evidence", "guardrails", "current_experiments", "business_priority", "contamination", "segment_relevance", "guardrail_outcomes", "decision_after_result", "sequence_handoff"];
  for (const key of arrayKeys) (merged as unknown as Record<string, unknown>)[key] = refs(profile, key);
  (merged as unknown as Record<string, unknown>).remaining_uncertainty = [...new Set([...defaults.remaining_uncertainty, ...refs(profile, "remaining_uncertainty")])];
  (merged as unknown as Record<string, unknown>).unresolved_unknowns = [...new Set([...defaults.unresolved_unknowns, ...refs(profile, "unresolved_unknowns")])];
  (merged as unknown as Record<string, unknown>).evidence_refs = [...new Set([...defaults.evidence_refs, ...refs(profile, "evidence_refs")])];
  return merged;
}

async function persist(supabase: any, organizationId: string, context: InterventionTestExecuteContext, candidates: InterventionTestExecuteInput[], result: InterventionTestExecuteRunResult) {
  const input = { organization_id: organizationId, context, candidates };
  const fingerprint = fingerprintPlaybookInput(input);
  const existing = await supabase.from("intervention_test_execute_runs").select("id, disposition").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`test_execute_lookup_failed: ${existing.error.message}`);
  if (existing.data) return existing.data;
  const inserted = await supabase.from("intervention_test_execute_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, as_of: context.as_of, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, input_envelope: input, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, disposition").single();
  if (inserted.error || !inserted.data) throw new Error(`test_execute_write_failed: ${inserted.error?.message ?? "no row"}`);
  return inserted.data;
}

export async function runInterventionTestExecuteEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [sequenceResult, templatesResult] = await Promise.all([
    supabase.from("intervention_sequencing_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template_id, template_version, lifecycle, template").eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [sequenceResult, templatesResult]) if (loaded.error) throw new Error(`test_execute_input_load_failed: ${loaded.error.message}`);
  const context = buildInterventionTestExecuteContext(organizationId, sequenceResult.data ?? {});
  const templates = new Map(parseActivePlaybookTemplates(templatesResult.data ?? []).map((item) => [`${item.template_id}@${item.template_version}`, item]));
  const candidates = candidateRows(sequenceResult.data).map((candidate) => candidateInputFromTestExecuteSources(templates.get(text(candidate.candidate_id)) ?? null, context, candidate));
  const result = evaluateInterventionTestExecuteSet({ context_id: context.context_id, business_id: organizationId, decision_cycle_id: context.decision_cycle_id, primary_priority_candidate_id: context.primary_priority_candidate_id, candidates, evaluated_at: new Date().toISOString() });
  const stored = await persist(supabase, organizationId, context, candidates, result);
  return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runInterventionTestExecuteEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (loaded.error) throw new Error(`test_execute_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of loaded.data ?? []) { summary.organizations += 1; try { await runInterventionTestExecuteEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; } }
  return summary;
}
