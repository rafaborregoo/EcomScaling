/**
 * F9: el motor de aprendizaje continuo.
 *
 * Carga las fuentes reales de una tienda, construye la foto comun
 * (`learningSnapshotFromSources`, pura y testeable) y evalua los 40 bloques,
 * cada uno con su logica (packages/contracts/src/learning-blocks-*.ts). Un
 * resultado por bloque en `continuous_learning_runs`; si la foto no cambio, se
 * actualiza la fila existente en vez de apilar otra igual.
 *
 * Solo lee datos de la organizacion evaluada: 9.34-9.37 dependen de que la
 * foto nunca mezcle tiendas.
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  evaluateLearningBlocks,
  type LearningBlockResult,
  type LearningExperience,
  type LearningSnapshot,
  type PriorLearning,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";

const SOURCE = "f9-learning-engine.v2";
type Row = Record<string, unknown>;
const record = (value: unknown): Row => (value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {});
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const direction = (value: unknown): "up" | "down" | "flat" | null =>
  value === "up" || value === "down" || value === "flat" ? value : null;

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

export type LearningSources = {
  closures: Row[];
  plans: Row[];
  transitions: Row[];
  approvals: Row[];
  readiness: Row[];
  autonomy: Row[];
  prioritization: Row[];
  playbooks: Row[];
  dataQuality: Row | null;
  contextEvents: Row[];
  contextFacts: Row[];
  signals: Row[];
  expectedOutcomes: number;
  priorLearnings: Row[];
  /** F8: metrica objetivo declarada y efecto medido (`intervention_effects`). */
  effects?: Row[];
};

/** Filas de las tablas -> foto de aprendizaje. Pura: todo lo que no esta, queda null. */
export function learningSnapshotFromSources(organizationId: string, src: LearningSources, asOf: string): LearningSnapshot {
  // Un cierre por intervencion: el mas reciente.
  const latestClosure = new Map<string, Row>();
  for (const c of [...src.closures].sort((a, b) => String(b.evaluated_at).localeCompare(String(a.evaluated_at)))) {
    const id = text(c.intervention_id);
    if (id && !latestClosure.has(id)) latestClosure.set(id, c);
  }
  const plannedByRecommendation = new Map<string, number>();
  for (const p of [...src.plans].sort((a, b) => String(a.evaluated_at).localeCompare(String(b.evaluated_at)))) {
    const rec = text(p.recommendation_id);
    const actions = record(p.input_envelope).actions;
    if (rec && Array.isArray(actions)) plannedByRecommendation.set(rec, actions.length);
  }
  const transitionsBy = new Map<string, Row[]>();
  for (const t of src.transitions) {
    const id = text(t.intervention_id);
    if (id) transitionsBy.set(id, [...(transitionsBy.get(id) ?? []), t]);
  }

  const effectBy = new Map((src.effects ?? []).map((e) => [text(e.intervention_id), e]));

  const experiences: LearningExperience[] = [...latestClosure.values()].map((c) => {
    const intervention = text(c.intervention_id)!;
    const envelope = record(c.input_envelope);
    const result = record(c.result);
    const tasks = record(envelope.task_summary);
    const snapshot = record(c.final_state_snapshot);
    const transitions = transitionsBy.get(intervention) ?? [];
    const moves = transitions.map((t) => `${t.command ?? ""} ${t.to_state ?? ""}`.toUpperCase());
    const firstEvent = transitions.map((t) => String(t.event_at)).sort()[0] ?? null;
    // El efecto medido por F8 (intervention-effect) gana a lo que traiga el cierre.
    const effect = effectBy.get(intervention);
    const observed = effect?.observed_direction
      ? { metric: effect.metric, direction: effect.observed_direction, material: effect.material }
      : record(result.observed_effect);
    const expected = effect
      ? { metric: effect.metric, direction: effect.expected_direction }
      : record(envelope.expected_effect);
    const recommendation = text(c.recommendation_id);
    return {
      id: String(c.id),
      intervention_id: intervention,
      recommendation_id: recommendation,
      started_at: firstEvent ?? text(c.as_of),
      closed_at: String(c.evaluated_at),
      closure_state: String(c.closure_state ?? "UNKNOWN"),
      operational_outcome: String(c.operational_outcome ?? "INCONCLUSIVE"),
      verification_status: String(c.verification_status ?? "UNKNOWN"),
      closure_maturity: String(c.outcome_maturity ?? "INCOMPLETE"),
      tasks: num(tasks.total) !== null ? { total: num(tasks.total)!, completed: num(tasks.completed) ?? 0, blocked: num(tasks.blocked) ?? 0 } : null,
      planned_actions: recommendation ? (plannedByRecommendation.get(recommendation) ?? null) : null,
      rolled_back: moves.some((m) => m.includes("ROLLBACK") || m.includes("ROLLED_BACK")) || c.operational_outcome === "ROLLED_BACK",
      incident: moves.some((m) => m.includes("INCIDENT")) || c.operational_outcome === "FAILED",
      expected_state: text(snapshot.expected),
      actual_state: text(snapshot.actual),
      // Sin metrica objetivo declarada no hay efecto medido: null, y F9 lo dice.
      observed_effect: text(observed.metric) && direction(observed.direction)
        ? { metric: text(observed.metric)!, direction: direction(observed.direction)!, material: observed.material === true }
        : null,
      expected_effect: text(expected.metric) || direction(expected.direction)
        ? { metric: text(expected.metric), direction: direction(expected.direction) === "flat" ? null : (direction(expected.direction) as "up" | "down" | null) }
        : null,
      sample_sufficient: typeof effect?.sample_sufficient === "boolean" && effect.observed_direction
        ? effect.sample_sufficient
        : typeof result.sample_sufficient === "boolean" ? result.sample_sufficient : null,
      human: { approved: null, modified: false, rejected: false },
      unknowns: strings(c.unresolved_unknowns),
    };
  });

  const current_context: Record<string, string> = {};
  for (const f of src.contextFacts) {
    const dimension = text(f.dimension);
    const value = text(f.value);
    if (dimension && value && !f.effective_to) current_context[dimension] = value;
  }

  // Una fila por experiencia (la mas reciente): si la foto cambia, 9.12 escribe otra fila para la misma.
  const seenExperience = new Set<string>();
  const latestPrior = [...src.priorLearnings]
    .sort((a, b) => String(b.evaluated_at).localeCompare(String(a.evaluated_at)))
    .filter((row) => !seenExperience.has(String(row.experience_id)) && Boolean(seenExperience.add(String(row.experience_id))));
  const prior_learnings: PriorLearning[] = latestPrior.flatMap((row) => {
    const result = record(row.result);
    const payload = record(result.payload);
    const classification = String(row.classification ?? "INCONCLUSIVE");
    if (!["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"].includes(classification)) return [];
    return [{
      id: String(row.id),
      experience_id: String(row.experience_id),
      metric: text(payload.metric),
      direction: direction(payload.direction),
      classification: classification as PriorLearning["classification"],
      confidence: (["LOW", "MEDIUM", "HIGH"].includes(String(row.confidence)) ? row.confidence : "LOW") as PriorLearning["confidence"],
      context: Object.fromEntries(Object.entries(record(record(row.input_envelope).current_context)).filter((e): e is [string, string] => typeof e[1] === "string")),
      evaluated_at: String(row.evaluated_at),
      status: "active" as const,
    }];
  });

  return {
    organization_id: organizationId,
    as_of: asOf,
    experiences,
    prior_learnings,
    approvals: src.approvals.flatMap((a) =>
      a.decision === "approved" || a.decision === "rejected"
        ? [{ decision: a.decision, reason_category: text(a.reason_category), decided_at: String(a.decided_at) }]
        : [],
    ),
    readiness: src.readiness.map((r) => ({ decision: String(r.readiness_decision ?? "UNKNOWN"), blockers: strings(r.blocking_reasons), evaluated_at: String(r.evaluated_at) })),
    autonomy: src.autonomy.map((a) => ({ autonomy_level: String(a.autonomy_level ?? "UNKNOWN"), approval_state: String(a.approval_state ?? "UNKNOWN"), execution_state: String(a.execution_state ?? "UNKNOWN"), evaluated_at: String(a.evaluated_at) })),
    prioritization: src.prioritization.map((p) => ({ primary_candidate_id: text(p.primary_priority_candidate_id), disposition: String(p.disposition ?? "UNKNOWN"), evaluated_at: String(p.evaluated_at) })),
    playbooks: src.playbooks.map((p) => ({ domain: String(p.domain ?? "GENERAL"), disposition: String(p.disposition ?? "UNKNOWN"), evaluated_at: String(p.evaluated_at) })),
    data_quality: src.dataQuality ? { reliability: text(src.dataQuality.reliability), coverage: src.dataQuality.coverage == null ? null : String(src.dataQuality.coverage) } : null,
    context_events: src.contextEvents.map((e) => ({ event_type: String(e.event_type), source: String(e.source ?? "declared"), occurred_at: String(e.occurred_at), ended_at: text(e.ended_at) })),
    current_context,
    signals_30d: src.signals.map((sig) => ({ metric: String(sig.metric), direction: String(sig.direction), trajectory: text(sig.trajectory) })),
    expected_outcomes_available: src.expectedOutcomes > 0,
    cross_tenant_sources: 0,
  };
}

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

async function loadSources(supabase: any, organizationId: string): Promise<LearningSources> {
  const org = (table: string, columns: string) => supabase.from(table).select(columns).eq("organization_id", organizationId);
  const results = await Promise.all([
    org("execution_closure_runs", "id, intervention_id, recommendation_id, as_of, evaluated_at, closure_state, operational_outcome, verification_status, outcome_maturity, input_envelope, result, final_state_snapshot, unresolved_unknowns").order("evaluated_at", { ascending: false }).limit(200),
    org("execution_plan_runs", "recommendation_id, input_envelope, evaluated_at").order("evaluated_at", { ascending: false }).limit(200),
    org("execution_lifecycle_transitions", "intervention_id, command, to_state, event_at").order("event_at", { ascending: false }).limit(2000),
    org("agent_approvals", "decision, reason_category, decided_at").gte("decided_at", since(180)),
    org("readiness_assessment_runs", "readiness_decision, blocking_reasons, evaluated_at").gte("evaluated_at", since(90)).limit(500),
    org("hitl_approval_assessment_runs", "autonomy_level, approval_state, execution_state, evaluated_at").gte("evaluated_at", since(90)).limit(500),
    org("intervention_prioritization_runs", "primary_priority_candidate_id, disposition, evaluated_at").order("evaluated_at", { ascending: false }).limit(20),
    org("playbook_framework_runs", "domain, disposition, evaluated_at").gte("evaluated_at", since(30)).order("evaluated_at", { ascending: false }).limit(500),
    org("data_quality_assessments", "reliability, coverage").eq("source", "shopify").eq("dataset", "orders").order("assessed_at", { ascending: false }).limit(1),
    org("context_change_events", "event_type, source, occurred_at, ended_at").gte("occurred_at", since(365)),
    org("tenant_context_facts", "dimension, value, effective_to").is("effective_to", null),
    org("signals", "metric, direction, trajectory").gte("window_end", since(30)).limit(500),
    org("expected_outcome_runs", "id").gte("evaluated_at", since(90)).limit(1),
    org("continuous_learning_runs", "id, experience_id, classification, confidence, evaluated_at, result, input_envelope").eq("block_code", "9.12").eq("gate", true).order("evaluated_at", { ascending: false }).limit(200),
    org("intervention_effects", "intervention_id, metric, expected_direction, observed_direction, material, sample_sufficient"),
  ]);
  const failed = results.findIndex((r: any) => r.error);
  if (failed >= 0) throw new Error(`continuous_learning_source_${failed}_failed: ${results[failed].error.message}`);
  const [closures, plans, transitions, approvals, readiness, autonomy, prioritization, playbooks, dataQuality, contextEvents, contextFacts, signals, expected, prior, effects] = results.map((r: any) => r.data ?? []);
  // Solo la ultima pasada de cada dominio de playbook.
  const latestPlaybook = new Map<string, Row>();
  for (const p of playbooks as Row[]) if (!latestPlaybook.has(String(p.domain))) latestPlaybook.set(String(p.domain), p);
  return {
    closures, plans, transitions, approvals, readiness, autonomy, prioritization,
    playbooks: [...latestPlaybook.values()],
    dataQuality: (dataQuality as Row[])[0] ?? null,
    contextEvents, contextFacts, signals,
    expectedOutcomes: (expected as Row[]).length,
    priorLearnings: prior,
    effects,
  };
}

function fingerprint(block: string, snapshot: LearningSnapshot) {
  const { as_of: _asOf, ...stable } = snapshot;
  return `f9:${block}:${createHash("sha256").update(JSON.stringify(stable)).digest("hex").slice(0, 32)}`;
}

async function persist(supabase: any, snapshot: LearningSnapshot, result: LearningBlockResult, evaluatedAt: string) {
  const focus = [...snapshot.experiences].sort((a, b) => b.closed_at.localeCompare(a.closed_at))[0] ?? null;
  const inputFingerprint = fingerprint(result.block, snapshot);
  const row = {
    evaluated_at: evaluatedAt,
    status: result.status,
    classification: result.classification,
    confidence: result.confidence,
    gate: result.gate,
    result,
    rationale: [result.why],
    learning: result.gate ? [result.why] : [],
    next_evidence_needed: result.next_evidence,
    unresolved_unknowns: focus?.unknowns ?? [],
    source_refs: [SOURCE],
  };
  const existing = await supabase.from("continuous_learning_runs").select("id").eq("organization_id", snapshot.organization_id).eq("block_code", result.block).eq("input_fingerprint", inputFingerprint).maybeSingle();
  if (existing.error) throw new Error(`continuous_learning_lookup_failed: ${existing.error.message}`);
  if (existing.data) {
    const updated = await supabase.from("continuous_learning_runs").update(row).eq("id", existing.data.id);
    if (updated.error) throw new Error(`continuous_learning_update_failed: ${updated.error.message}`);
    return;
  }
  const inserted = await supabase.from("continuous_learning_runs").insert({
    ...row,
    organization_id: snapshot.organization_id,
    block_code: result.block,
    experience_id: focus?.id ?? "sin-experiencia",
    intervention_id: focus?.intervention_id ?? null,
    recommendation_id: focus?.recommendation_id ?? null,
    as_of: snapshot.as_of,
    input_fingerprint: inputFingerprint,
    // La foto resumida: lo necesario para reconstruir la decision sin copiar filas enteras.
    input_envelope: {
      experiences: snapshot.experiences.length,
      focus_experience: focus,
      prior_learnings: snapshot.prior_learnings.length,
      current_context: snapshot.current_context,
      data_quality: snapshot.data_quality,
    },
  });
  if (inserted.error) throw new Error(`continuous_learning_write_failed: ${inserted.error.message}`);
}

export async function runContinuousLearningEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const now = new Date().toISOString();
  const snapshot = learningSnapshotFromSources(organizationId, await loadSources(supabase, organizationId), now);
  const results = evaluateLearningBlocks(snapshot);
  for (const result of results) await persist(supabase, snapshot, result, now);
  return {
    organization_id: organizationId,
    assessments: results.length,
    ready: results.filter((r) => r.status === "READY").length,
    experiences: snapshot.experiences.length,
    source: SOURCE,
  };
}

export async function runContinuousLearningEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (loaded.error) throw new Error(`continuous_learning_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of loaded.data ?? []) {
    summary.organizations += 1;
    try {
      const result = await runContinuousLearningEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.assessments += result.assessments;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
