/**
 * F8: motor de supervision. Lee lo que los bloques hechos (8.02, 8.03, 8.04,
 * 8.05, 8.10, 8.16) dejaron escrito, mas el registro real de tools y las
 * conexiones activas, arma la foto de la intervencion y la pasa por los doce
 * evaluadores de @ecomscaling/contracts. Cada bloque se guarda con su propia
 * salida en `execution_supervision_runs`.
 *
 * `executionSnapshotFromSources` es pura a proposito: la traduccion de filas a
 * foto es donde se esconden los fallos silenciosos (una columna mal leida
 * convierte un dato en `null`, y `null` se lee como "no se sabe"), y asi se
 * prueba sin base de datos.
 */
import { createClient } from "@supabase/supabase-js";
import {
  evaluateSupervisionBlocks,
  fingerprintPlaybookInput,
  type ExecutionSnapshot,
  type SnapshotAction,
  type SnapshotCapability,
  type SupervisionBlockResult,
} from "@ecomscaling/contracts";
import { TOOL_REGISTRY, normalizeToolConnectorId } from "@ecomscaling/ai";
import { type LoadedApiEnv } from "@ecomscaling/config";

type Row = Record<string, unknown>;
const record = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const SOURCE = "f8-supervision.v2";
const ENVIRONMENTS = ["TEST", "STAGING", "PRODUCTION", "UNKNOWN"] as const;
const ZONES = ["INSIDE", "INSIDE_WITH_CONDITIONS", "OUTSIDE", "FORBIDDEN"] as const;

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

function actionsOf(envelope: Row): SnapshotAction[] {
  const raw = Array.isArray(envelope.actions) ? envelope.actions.map(record) : [];
  return raw.map((a, index) => ({
    id: text(a.id) ?? `action-${index + 1}`,
    title: text(a.title) ?? "",
    target: text(a.target) ?? "sin-objetivo",
    change: text(a.change) ?? "unknown_change",
    current_state: text(a.current_state),
    desired_state: text(a.desired_state),
    // Si el plan no lo dice, no se asume reversible.
    reversible: a.reversible === true,
    requires_approval: a.requires_approval !== false,
  }));
}

export type SupervisionSources = {
  plan: Row | null;
  readiness: Row | null;
  envelope: Row | null;
  approval: Row | null;
  lifecycle: Row | null;
  transitions: Row[];
  closure: Row | null;
  otherPlans: Row[];
  otherLifecycles: Row[];
  connectedProviders: string[];
};

export function capabilitiesFromRegistry(connectedProviders: string[]): SnapshotCapability[] {
  const connected = new Set(connectedProviders.map(normalizeToolConnectorId));
  return TOOL_REGISTRY.map((tool) => ({
    name: tool.name,
    permission: tool.permission,
    status: tool.status,
    connector: tool.connector,
    connector_connected: tool.connector === "core" || (tool.connector != null && connected.has(tool.connector)),
    requires_idempotency_key: tool.requires_idempotency_key,
  }));
}

export function executionSnapshotFromSources(
  organizationId: string,
  sources: SupervisionSources,
  asOf: string,
): ExecutionSnapshot {
  const planRow = sources.plan;
  const planEnvelope = record(planRow?.input_envelope);
  const planResult = record(planRow?.result);
  const criteria = (key: string) => strings(planEnvelope[key]);
  const temporal = record(planEnvelope.temporal_controls);
  const budgets = record(planEnvelope.budgets);
  const environment = text(planEnvelope.environment);

  const readinessResult = record(sources.readiness?.result);
  const envelopeResult = record(sources.envelope?.result);
  const envelopeCapacity = record(envelopeResult.remaining_capacity);
  const approvalResult = record(sources.approval?.result);
  const closureSnapshot = record(sources.closure?.final_state_snapshot);
  const lifecycleRow = sources.lifecycle;

  const lifecycleByIntervention = new Map(
    sources.otherLifecycles.map((l) => [String(l.intervention_id), text(l.state)]),
  );

  const zone = text(sources.envelope?.envelope_zone ?? envelopeResult.zone);

  return {
    organization_id: organizationId,
    as_of: asOf,
    plan: planRow
      ? {
          id: String(planRow.id),
          status: text(planRow.plan_status) ?? "DRAFT",
          version: num(planRow.plan_version) ?? 1,
          environment: (ENVIRONMENTS as readonly string[]).includes(environment ?? "")
            ? (environment as (typeof ENVIRONMENTS)[number])
            : "UNKNOWN",
          actions: actionsOf(planEnvelope),
          success_criteria: criteria("success_criteria"),
          stop_criteria: criteria("stop_criteria"),
          hold_criteria: criteria("hold_criteria"),
          rollback_criteria: criteria("rollback_criteria"),
          postconditions: criteria("postconditions"),
          invariants: criteria("invariants"),
          observation_window: text(temporal.observation_window),
          max_actions: num(budgets.max_actions),
          max_retries: num(budgets.max_retries),
          evaluated_at: text(planRow.evaluated_at) ?? asOf,
        }
      : null,
    readiness: sources.readiness
      ? {
          decision: text(sources.readiness.readiness_decision ?? readinessResult.readiness_decision) ?? "UNKNOWN",
          blocking_reasons: strings(readinessResult.blocking_reasons),
          stale: readinessResult.stale === true,
          revalidate_required: readinessResult.revalidate_required === true,
          evaluated_at: text(sources.readiness.evaluated_at) ?? asOf,
        }
      : null,
    envelope: sources.envelope
      ? {
          zone: (ZONES as readonly string[]).includes(zone ?? "") ? (zone as (typeof ZONES)[number]) : "FORBIDDEN",
          violations: strings(envelopeResult.violations),
          remaining_actions: num(envelopeCapacity.actions),
          fresh: envelopeResult.envelope_fresh === true,
          scope_expansion_required: envelopeResult.scope_expansion_required === true,
        }
      : null,
    approval: sources.approval
      ? {
          disposition: text(sources.approval.disposition ?? approvalResult.disposition) ?? "APPROVAL_REQUIRED",
          approval_state: text(sources.approval.approval_state ?? approvalResult.approval_state) ?? "PENDING",
          approval_freshness: text(approvalResult.approval_freshness) ?? "UNKNOWN",
          revocation_status: text(approvalResult.revocation_status) ?? "UNKNOWN",
          approval_valid_until: text(approvalResult.approval_valid_until),
          escalation_required: approvalResult.escalation_required === true,
          escalation_reasons: strings(approvalResult.escalation_reasons),
          escalation_target: text(approvalResult.escalation_target),
          autonomy_level: text(sources.approval.autonomy_level ?? approvalResult.autonomy_level) ?? "RECOMMEND",
          required_approver_type: text(approvalResult.required_approver_type),
        }
      : null,
    lifecycle: lifecycleRow
      ? {
          intervention_id: String(lifecycleRow.intervention_id),
          state: text(lifecycleRow.state) ?? "UNKNOWN",
          last_event_at: text(lifecycleRow.last_event_at),
          inconsistencies: strings(lifecycleRow.inconsistencies),
          allowed_commands: strings(lifecycleRow.allowed_commands),
          transitions: sources.transitions.map((t) => ({
            command: String(t.command),
            decision: String(t.decision),
            from_state: String(t.from_state),
            to_state: String(t.to_state),
            reasons: strings(t.reasons),
            event_at: String(t.event_at),
          })),
        }
      : null,
    capabilities: capabilitiesFromRegistry(sources.connectedProviders),
    other_interventions: sources.otherPlans.map((p) => ({
      plan_id: String(p.id),
      targets: actionsOf(record(p.input_envelope)).filter((a) => !a.change.startsWith("read")).map((a) => a.target),
      state: lifecycleByIntervention.get(String(p.id)) ?? lifecycleByIntervention.get(String(p.recommendation_id)) ?? null,
    })),
    closure: sources.closure
      ? {
          closure_state: text(sources.closure.closure_state) ?? "COMPLETED",
          verification_status: text(sources.closure.verification_status) ?? "UNKNOWN",
          expected: text(closureSnapshot.expected),
          actual: text(closureSnapshot.actual),
        }
      : null,
    source_refs: [...new Set([SOURCE, ...strings(planRow?.source_refs), ...strings(planResult.source_refs)])],
    unresolved_unknowns: [...new Set([...strings(planRow?.unresolved_unknowns), ...strings(planResult.unresolved_unknowns)])],
  };
}

const latest = (supabase: any, table: string, organizationId: string, columns: string) =>
  supabase.from(table).select(columns).eq("organization_id", organizationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle();

async function loadSources(supabase: any, organizationId: string): Promise<SupervisionSources | null> {
  const plan = await latest(supabase, "execution_plan_runs", organizationId, "id, recommendation_id, plan_status, plan_version, input_envelope, result, evaluated_at, source_refs, unresolved_unknowns");
  if (plan.error) throw new Error(`supervision_plan_load_failed: ${plan.error.message}`);
  if (!plan.data) return null;
  const planId = String(plan.data.id);
  const recommendationId = String(plan.data.recommendation_id ?? planId);

  const [readiness, envelope, approval, lifecycles, closure, otherPlans, connections] = await Promise.all([
    latest(supabase, "readiness_assessment_runs", organizationId, "readiness_decision, result, evaluated_at"),
    latest(supabase, "action_envelope_runs", organizationId, "envelope_zone, result, evaluated_at"),
    latest(supabase, "hitl_approval_assessment_runs", organizationId, "disposition, approval_state, autonomy_level, result, evaluated_at"),
    supabase.from("execution_lifecycle_states").select("intervention_id, state, last_event_at, inconsistencies, allowed_commands").eq("organization_id", organizationId),
    supabase.from("execution_closure_runs").select("closure_state, verification_status, final_state_snapshot, evaluated_at").eq("organization_id", organizationId).eq("recommendation_id", recommendationId).order("evaluated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("execution_plan_runs").select("id, recommendation_id, input_envelope, evaluated_at").eq("organization_id", organizationId).neq("recommendation_id", recommendationId).order("evaluated_at", { ascending: false }).limit(50),
    supabase.from("integration_connections").select("provider").eq("organization_id", organizationId).in("status", ["connected", "syncing"]),
  ]);
  for (const [name, result] of Object.entries({ readiness, envelope, approval, lifecycles, closure, otherPlans, connections })) {
    if ((result as any).error) throw new Error(`supervision_${name}_load_failed: ${(result as any).error.message}`);
  }

  const lifecycleRows = (lifecycles.data ?? []) as Row[];
  const own = lifecycleRows.find((l) => [planId, recommendationId].includes(String(l.intervention_id))) ?? null;
  const transitions = own
    ? await supabase.from("execution_lifecycle_transitions").select("command, decision, from_state, to_state, reasons, event_at").eq("organization_id", organizationId).eq("intervention_id", own.intervention_id).order("event_at", { ascending: true }).limit(200)
    : { data: [], error: null };
  if (transitions.error) throw new Error(`supervision_transitions_load_failed: ${transitions.error.message}`);

  // Una fila por recomendacion: la ultima version de cada plan ajeno.
  const seen = new Set<string>();
  const others = ((otherPlans.data ?? []) as Row[]).filter((p) => {
    const key = String(p.recommendation_id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    plan: plan.data,
    readiness: readiness.data,
    envelope: envelope.data,
    approval: approval.data,
    lifecycle: own,
    transitions: transitions.data ?? [],
    closure: closure.data,
    otherPlans: others,
    otherLifecycles: lifecycleRows.filter((l) => l !== own),
    connectedProviders: ((connections.data ?? []) as Row[]).map((c) => String(c.provider)),
  };
}

async function persist(supabase: any, organizationId: string, snapshot: ExecutionSnapshot, result: SupervisionBlockResult) {
  // La huella excluye el instante: mismas entradas, misma fila.
  const { as_of: _asOf, ...stable } = snapshot;
  const fingerprint = fingerprintPlaybookInput({ block: result.block, ...stable });
  const existing = await supabase.from("execution_supervision_runs").select("id").eq("organization_id", organizationId).eq("stage", result.stage).eq("input_fingerprint", fingerprint).maybeSingle();
  if (existing.error) throw new Error(`supervision_lookup_failed: ${existing.error.message}`);
  if (existing.data) return false;
  const inserted = await supabase.from("execution_supervision_runs").insert({
    organization_id: organizationId,
    context_id: `supervision:${result.plan_id}`,
    plan_id: result.plan_id,
    action_id: result.action_id,
    stage: result.stage,
    as_of: result.evaluated_at,
    evaluated_at: result.evaluated_at,
    input_fingerprint: fingerprint,
    decision: result.decision,
    input_envelope: snapshot,
    result,
    blockers: result.blockers,
    warnings: result.warnings,
    source_refs: result.source_refs,
    unresolved_unknowns: result.unresolved_unknowns,
  });
  if (inserted.error) throw new Error(`supervision_write_failed: ${inserted.error.message}`);
  return true;
}

export async function runExecutionSupervisionForOrganization(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const sources = await loadSources(supabase, organizationId);
  if (!sources) return { organization_id: organizationId, assessments: 0, written: 0, decisions: [] as string[] };
  const snapshot = executionSnapshotFromSources(organizationId, sources, new Date().toISOString());
  const results = evaluateSupervisionBlocks(snapshot);
  let written = 0;
  for (const result of results) {
    if (await persist(supabase, organizationId, snapshot, result)) written += 1;
  }
  return {
    organization_id: organizationId,
    assessments: results.length,
    written,
    decisions: results.map((r) => `${r.block}:${r.block_decision}`),
  };
}

export async function runExecutionSupervisionForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (loaded.error) throw new Error(`supervision_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, assessments: 0 };
  for (const organization of loaded.data ?? []) {
    summary.organizations += 1;
    try {
      const result = await runExecutionSupervisionForOrganization(env, organization.id as string);
      summary.succeeded += 1;
      summary.assessments += result.assessments;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
