import { createClient } from "@supabase/supabase-js";
import { evaluateRecommendationCommunication, fingerprintPlaybookInput, type PlaybookTemplate, type RecommendationCommunicationInput, type RecommendationCommunicationResult } from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import { parseActivePlaybookTemplates } from "./playbook-engine.js";

const SOURCE = "f7-p18.v1";
type CommunicationExtension = Partial<RecommendationCommunicationInput>;
export type RecommendationCommunicationContext = { context_id: string; business_id: string; decision_cycle_id: string; source_refs: string[]; as_of: string };

function service(env: LoadedApiEnv) { return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", { auth: { persistSession: false, autoRefreshToken: false } }) as any; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }
function text(value: unknown, fallback = "UNKNOWN"): string { return typeof value === "string" && value.length > 0 ? value : fallback; }
function dayStart(now: string) { return `${now.slice(0, 10)}T00:00:00.000Z`; }
function extension(template: PlaybookTemplate | null): CommunicationExtension { const raw = record(template?.domain_extension); const value = raw.recommendation_communication ?? raw.communication; return value && typeof value === "object" && !Array.isArray(value) ? value as CommunicationExtension : {}; }

export function buildRecommendationCommunicationContext(organizationId: string, upstreamRun: unknown, now = new Date().toISOString()): RecommendationCommunicationContext {
  const row = record(upstreamRun); const asOf = dayStart(now);
  return { context_id: text(row.context_id, `recommendation-communication-context:${organizationId}:${asOf.slice(0, 10)}`), business_id: organizationId, decision_cycle_id: text(row.decision_cycle_id, `f7-p18:${organizationId}:${asOf.slice(0, 10)}`), source_refs: [...new Set([...strings(row.source_refs), SOURCE])], as_of: asOf };
}

export function recommendationCommunicationInputFromSources(template: PlaybookTemplate | null, context: RecommendationCommunicationContext, confidenceRun: Record<string, unknown>, outcomeRun: Record<string, unknown> = {}): RecommendationCommunicationInput {
  const configured = extension(template); const confidence = record(confidenceRun.result); const outcome = record(outcomeRun.result);
  const base: RecommendationCommunicationInput = {
    context_id: context.context_id, business_id: context.business_id, decision_cycle_id: context.decision_cycle_id,
    recommendation: text(configured.recommendation, text(confidence.recommendation, text(outcome.recommendation))),
    reason: text(configured.reason), why_now: text(configured.why_now), what_not_to_do: strings(configured.what_not_to_do),
    expected_outcome: text(configured.expected_outcome, text(outcome.causal_thesis)), main_risk: text(configured.main_risk),
    main_uncertainty: text(configured.main_uncertainty, text(confidence.main_uncertainty)), priority_role: text(configured.priority_role, "PRIMARY"),
    recommendation_strength: text(configured.recommendation_strength), scope: text(configured.scope, text(confidence.scope, text(outcome.scope))),
    stage: text(configured.stage, text(confidence.recommendation_form, "VALIDATION_REQUIRED")), value_type: text(configured.value_type),
    temporary_or_structural: text(configured.temporary_or_structural), audience: text(configured.audience, "CONSULTANT"), user_need: text(configured.user_need, "DECISION"),
    confidence_language: text(configured.confidence_language, text(confidence.confidence_rationale)), fact_evidence: strings(configured.fact_evidence),
    inference_evidence: strings(configured.inference_evidence), strongest_evidence: strings(configured.strongest_evidence), conflicting_evidence: strings(configured.conflicting_evidence),
    success_signal: text(configured.success_signal, text(outcome.primary_success_criterion)), invalidating_condition: text(configured.invalidating_condition),
    next_decision: text(configured.next_decision), sequence: strings(configured.sequence), dependencies: strings(configured.dependencies), constraints: strings(configured.constraints),
    current_priority: text(configured.current_priority), current_bottleneck: text(configured.current_bottleneck), evidence_quality: text(configured.evidence_quality, text(confidence.evidence_quality)),
    current_confidence: text(configured.current_confidence, text(confidence.recommendation_confidence)), commitment_scope: text(configured.commitment_scope, text(confidence.commitment_scope)),
    commitment_magnitude: text(configured.commitment_magnitude, text(confidence.commitment_magnitude)), commitment_velocity: text(configured.commitment_velocity, text(confidence.commitment_velocity)),
    commitment_duration: text(configured.commitment_duration, text(confidence.commitment_duration)), source_refs: [...new Set([...context.source_refs, ...strings(confidenceRun.source_refs), ...strings(outcomeRun.source_refs), ...strings(configured.source_refs)])], unresolved_unknowns: strings(configured.unresolved_unknowns),
  };
  return { ...base, ...configured, context_id: context.context_id, business_id: context.business_id, decision_cycle_id: context.decision_cycle_id, source_refs: base.source_refs, unresolved_unknowns: base.unresolved_unknowns } as RecommendationCommunicationInput;
}

async function persist(supabase: any, organizationId: string, input: RecommendationCommunicationInput, result: RecommendationCommunicationResult, asOf: string) {
  const fingerprint = fingerprintPlaybookInput(input); const existing = await supabase.from("recommendation_communication_runs").select("id, disposition").eq("organization_id", organizationId).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`recommendation_communication_lookup_failed: ${existing.error.message}`); if (existing.data) return existing.data;
  const inserted = await supabase.from("recommendation_communication_runs").insert({ organization_id: organizationId, context_id: result.context_id, decision_cycle_id: result.decision_cycle_id, as_of: asOf, evaluated_at: result.evaluated_at, input_fingerprint: fingerprint, disposition: result.disposition, scope: result.scope, primary_recommendation: result.primary_recommendation, input_envelope: input, result, unresolved_unknowns: result.unresolved_unknowns, reason_codes: result.reason_codes, source_refs: result.source_refs }).select("id, disposition").single();
  if (inserted.error || !inserted.data) throw new Error(`recommendation_communication_write_failed: ${inserted.error?.message ?? "no row"}`); return inserted.data;
}

export async function runRecommendationCommunicationEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const [confidenceResult, outcomeResult, templatesResult] = await Promise.all([
    supabase.from("recommendation_confidence_runs").select("context_id, decision_cycle_id, source_refs, result, scope").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("expected_outcome_runs").select("context_id, decision_cycle_id, source_refs, result, scope").eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("playbook_templates").select("template_id, template_version, lifecycle, template").eq("lifecycle", "ACTIVE"),
  ]);
  for (const loaded of [confidenceResult, outcomeResult, templatesResult]) if (loaded.error) throw new Error(`recommendation_communication_input_load_failed: ${loaded.error.message}`);
  const upstream = confidenceResult.data ?? outcomeResult.data ?? {}; const context = buildRecommendationCommunicationContext(organizationId, upstream); const templates = new Map(parseActivePlaybookTemplates(templatesResult.data ?? []).map((item) => [`${item.template_id}@${item.template_version}`, item]));
  const confidence = record(confidenceResult.data); const outcome = record(outcomeResult.data); const resultData = record(confidence.result); const unitId = text(resultData.scope, text(confidence.scope, text(outcome.scope))); const template = templates.get(unitId) ?? (templates.size === 1 ? ([...templates.values()][0] ?? null) : null);
  const input = recommendationCommunicationInputFromSources(template, context, confidence, outcome); const result = evaluateRecommendationCommunication(input); const stored = await persist(supabase, organizationId, input, result, context.as_of);
  return { organization_id: organizationId, assessment_id: stored.id, disposition: result.disposition, primary_recommendation: result.primary_recommendation, recommendation_stage: result.recommendation_stage, unresolved_unknowns: result.unresolved_unknowns };
}

export async function runRecommendationCommunicationEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env); const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]); if (loaded.error) throw new Error(`recommendation_communication_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 }; for (const organization of loaded.data ?? []) { summary.organizations += 1; try { await runRecommendationCommunicationEngine(env, organization.id as string); summary.succeeded += 1; summary.assessments += 1; } catch { summary.failed += 1; } } return summary;
}
