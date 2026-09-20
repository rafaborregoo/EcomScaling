import { createClient } from "@supabase/supabase-js";
import { evaluateInterventionSequenceSet, fingerprintPlaybookInput, type InterventionSequencingInput, type InterventionSequencingRunResult, type PlaybookTemplate } from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p07.v1";
type Tier = "NOW" | "NEXT" | "LATER" | "DO_NOT_DO" | "WAIT";
type SourceCandidate = { candidate_id: string; priority_tier?: Tier | undefined; disposition?: string | undefined; source_refs?: string[] | undefined; unresolved_unknowns?: string[] | undefined; [key: string]: unknown };
export type InterventionSequencingContext = { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; source_refs: string[]; as_of: string };
type SequencingExtension = Partial<InterventionSequencingInput>;

function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }
function text(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }
function dayStart(now: string) { return `${now.slice(0, 10)}T00:00:00.000Z`; }
function tier(value: unknown): Tier | undefined { return typeof value === "string" && ["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"].includes(value) ? value as Tier : undefined; }
function resultRows(row: unknown): Record<string, unknown>[] { const result = record(record(row).result); return Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations.map(record) : []; }
function extension(template: PlaybookTemplate | null): SequencingExtension { const raw = template?.domain_extension as Record<string, unknown> | undefined; const value = raw?.sequencing ?? raw?.dependencies; return value && typeof value === "object" && !Array.isArray(value) ? value as SequencingExtension : {}; }

export function buildInterventionSequencingContext(organizationId: string, priorityRun: unknown, impactRun: unknown, feasibilityRun: unknown, riskRun: unknown, now = new Date().toISOString()): InterventionSequencingContext {
  const priority = record(priorityRun); const impact = record(impactRun); const feasibility = record(feasibilityRun); const risk = record(riskRun);
  return { context_id: text(priority.context_id ?? impact.context_id ?? feasibility.context_id ?? risk.context_id) ?? `intervention-sequencing-context:${organizationId}:${dayStart(now).slice(0, 10)}`, business_id: organizationId, decision_cycle_id: text(priority.decision_cycle_id ?? impact.decision_cycle_id ?? feasibility.decision_cycle_id ?? risk.decision_cycle_id) ?? `f7-p07:${organizationId}:${dayStart(now).slice(0, 10)}`, primary_priority_candidate_id: text(priority.primary_priority_candidate_id ?? impact.primary_priority_candidate_id ?? feasibility.primary_priority_candidate_id ?? risk.primary_priority_candidate_id) ?? null, source_refs: [...new Set([...strings(priority.source_refs), ...strings(impact.source_refs), ...strings(feasibility.source_refs), ...strings(risk.source_refs), SOURCE])], as_of: dayStart(now) };
}

function status(value: unknown, fallback: string) { return typeof value === "string" && value.length > 0 ? value : fallback; }

export function candidateInputFromSequencingSources(template: PlaybookTemplate | null, context: InterventionSequencingContext, priority: SourceCandidate, risk: SourceCandidate): InterventionSequencingInput {
  const profile = extension(template);
  const defaults: InterventionSequencingInput = {
    candidate_id: priority.candidate_id, ...(priority.priority_tier ? { priority_tier: priority.priority_tier } : {}), strategic_intervention: "intervention not declared", intended_outcome: "outcome not declared", priority_disposition: status(priority.disposition, "VALIDATION_REQUIRED"), impact_disposition: "VALIDATION_REQUIRED", feasibility_disposition: "VALIDATION_REQUIRED", risk_disposition: status(risk.disposition, "VALIDATION_REQUIRED"), prerequisites: [], current_blockers: [], resource_context: [], risk_context: [], evidence_context: [], lead_times: [], business_mode: "UNKNOWN", guardrails: [], guardrail_status: "UNKNOWN", current_experiments: [], critical_path: [], sequence_steps: [], gates: [], parallel_tracks: [], not_yet: [], wait_conditions: [], exit_conditions: [], unresolved_unknowns: [...strings(priority.unresolved_unknowns), ...strings(risk.unresolved_unknowns)], evidence_refs: [...strings(priority.source_refs), ...strings(risk.source_refs)], source_refs: [...new Set([...context.source_refs, ...strings(priority.source_refs), ...strings(risk.source_refs), ...strings(template?.source_refs)])],
  };
  const merged = { ...defaults, ...profile, candidate_id: priority.candidate_id, priority_disposition: status(priority.disposition, "VALIDATION_REQUIRED"), risk_disposition: status(risk.disposition, "VALIDATION_REQUIRED"), ...(priority.priority_tier ? { priority_tier: priority.priority_tier } : {}), source_refs: [...new Set([...defaults.source_refs, ...strings(profile.source_refs)])] } as InterventionSequencingInput;
  return { ...merged, current_blockers: strings(profile.current_blockers), resource_context: strings(profile.resource_context), risk_context: strings(profile.risk_context), evidence_context: strings(profile.evidence_context), lead_times: strings(profile.lead_times), guardrails: strings(profile.guardrails), current_experiments: strings(profile.current_experiments), critical_path: strings(profile.critical_path), parallel_tracks: strings(profile.parallel_tracks), not_yet: strings(profile.not_yet), wait_conditions: strings(profile.wait_conditions), exit_conditions: strings(profile.exit_conditions), unresolved_unknowns: [...new Set([...defaults.unresolved_unknowns, ...strings(profile.unresolved_unknowns)])] } as InterventionSequencingInput;
}

async function persist(supabase: any, organizationId: string, context: InterventionSequencingContext, candidates: InterventionSequencingInput[], result: InterventionSequencingRunResult) {
  const input = { organization_id: organizationId, context, candidates }; const fingerprint = fingerprintPlaybookInput(input);
  const existing = await supabase.from("intervention_sequencing_runs").select("id, disposition").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`sequencing_lookup_failed: ${existing.error.message}`); if (existing.data) return existing.data;
  const inserted = await supabase.from("intervention_sequencing_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, as_of: context.as_of, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, input_envelope: input, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, disposition").single();
  if (inserted.error || !inserted.data) throw new Error(`sequencing_write_failed: ${inserted.error?.message ?? "no row"}`); return inserted.data;
}

export async function runInterventionSequencingEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [priorityResult, impactResult, feasibilityResult, riskResult, templatesResult] = await Promise.all([
    supabase.from("intervention_prioritization_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("intervention_impact_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("intervention_feasibility_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("intervention_risk_runs").select("context_id, decision_cycle_id, primary_priority_candidate_id, source_refs, result").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template_id, template_version, lifecycle, template").eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [priorityResult, impactResult, feasibilityResult, riskResult, templatesResult]) if (loaded.error) throw new Error(`sequencing_input_load_failed: ${loaded.error.message}`);
  const context = buildInterventionSequencingContext(organizationId, priorityResult.data ?? {}, impactResult.data ?? {}, feasibilityResult.data ?? {}, riskResult.data ?? {});
  const priorityCandidates = resultRows(priorityResult.data).map((row) => ({ ...row, candidate_id: text(row.candidate_id) ?? "invalid-candidate", priority_tier: tier(row.priority_tier), disposition: text(row.disposition), source_refs: strings(row.source_refs), unresolved_unknowns: strings(row.unresolved_unknowns) }));
  const riskById = new Map(resultRows(riskResult.data).map((row) => [text(row.candidate_id) ?? "invalid-candidate", { ...row, candidate_id: text(row.candidate_id) ?? "invalid-candidate", disposition: text(row.disposition), source_refs: strings(row.source_refs), unresolved_unknowns: strings(row.unresolved_unknowns) }]));
  const templates = new Map(parseActivePlaybookTemplates(templatesResult.data ?? []).map((item) => [`${item.template_id}@${item.template_version}`, item]));
  const candidates = priorityCandidates.map((priority) => candidateInputFromSequencingSources(templates.get(priority.candidate_id) ?? null, context, priority, riskById.get(priority.candidate_id) ?? { candidate_id: priority.candidate_id }));
  const result = evaluateInterventionSequenceSet({ context_id: context.context_id, business_id: organizationId, decision_cycle_id: context.decision_cycle_id, primary_priority_candidate_id: context.primary_priority_candidate_id, candidates, evaluated_at: new Date().toISOString() });
  const stored = await persist(supabase, organizationId, context, candidates, result);
  return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, candidate_count: result.candidate_evaluations.length, primary_priority_candidate_id: result.primary_priority_candidate_id, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runInterventionSequencingEngineForAllOrganizations(env: LoadedApiEnv) { const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`sequencing_organizations_load_failed: ${loaded.error.message}`); const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 }; for (const organization of loaded.data ?? []) { summary.organizations += 1; try { await runInterventionSequencingEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; } } return summary; }
