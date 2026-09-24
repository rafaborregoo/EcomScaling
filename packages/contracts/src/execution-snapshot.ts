/**
 * F8: la foto de una intervencion que leen los bloques de supervision.
 *
 * Hasta ahora los doce bloques F8.00-F8.17 pendientes compartian un `switch`
 * con los checks escritos a mano, y varios devolvian `UNKNOWN` fijo: no
 * comprobaban, declaraban que no se sabia. La correccion del 2026-09-22 los
 * devolvio a `esqueleto` por eso.
 *
 * Ahora cada bloque tiene su evaluador (su fichero, sus reglas, sus estados y
 * sus tests) y todos leen la misma foto: lo que los bloques ya hechos (8.02
 * aprobacion, 8.03 plan, 8.04 readiness, 8.05 envelope, 8.10 lifecycle, 8.16
 * cierre) dejaron escrito, mas dos hechos del sistema que nadie leia: que
 * capacidades existen de verdad (el registro de tools) y que otras
 * intervenciones hay abiertas en la organizacion.
 *
 * Lo que la foto no trae se queda en `null`, y cada evaluador decide que
 * significa esa ausencia para su pregunta. `null` no es "vale".
 */

import type { SupervisionStage } from "./execution-supervision.js";

export type SnapshotAction = {
  id: string;
  title: string;
  target: string;
  change: string;
  current_state: string | null;
  desired_state: string | null;
  reversible: boolean;
  requires_approval: boolean;
};

export type SnapshotPlan = {
  id: string;
  status: string;
  version: number;
  environment: "TEST" | "STAGING" | "PRODUCTION" | "UNKNOWN";
  actions: SnapshotAction[];
  success_criteria: string[];
  stop_criteria: string[];
  hold_criteria: string[];
  rollback_criteria: string[];
  postconditions: string[];
  invariants: string[];
  observation_window: string | null;
  max_actions: number | null;
  max_retries: number | null;
  evaluated_at: string;
};

export type SnapshotReadiness = {
  decision: string;
  blocking_reasons: string[];
  stale: boolean;
  revalidate_required: boolean;
  evaluated_at: string;
};

export type SnapshotEnvelope = {
  zone: "INSIDE" | "INSIDE_WITH_CONDITIONS" | "OUTSIDE" | "FORBIDDEN";
  violations: string[];
  remaining_actions: number | null;
  fresh: boolean;
  scope_expansion_required: boolean;
};

export type SnapshotApproval = {
  disposition: string;
  approval_state: string;
  approval_freshness: string;
  revocation_status: string;
  approval_valid_until: string | null;
  escalation_required: boolean;
  escalation_reasons: string[];
  escalation_target: string | null;
  autonomy_level: string;
  required_approver_type: string | null;
};

export type SnapshotTransition = {
  command: string;
  decision: string;
  from_state: string;
  to_state: string;
  reasons: string[];
  event_at: string;
};

export type SnapshotLifecycle = {
  intervention_id: string;
  state: string;
  last_event_at: string | null;
  inconsistencies: string[];
  allowed_commands: string[];
  transitions: SnapshotTransition[];
};

/** Una capacidad del registro de tools: lo que el sistema sabe hacer de verdad. */
export type SnapshotCapability = {
  name: string;
  permission: "read" | "propose" | "write" | "admin";
  status: "implemented_partial" | "planned" | "disabled";
  connector: string | null;
  connector_connected: boolean;
  requires_idempotency_key: boolean;
};

/** Otra intervencion abierta en la misma organizacion (8.14). */
export type SnapshotOtherIntervention = {
  plan_id: string;
  targets: string[];
  state: string | null;
};

export type SnapshotClosure = {
  closure_state: string;
  verification_status: string;
  expected: string | null;
  actual: string | null;
};

export type ExecutionSnapshot = {
  organization_id: string;
  as_of: string;
  plan: SnapshotPlan | null;
  readiness: SnapshotReadiness | null;
  envelope: SnapshotEnvelope | null;
  approval: SnapshotApproval | null;
  lifecycle: SnapshotLifecycle | null;
  capabilities: SnapshotCapability[];
  other_interventions: SnapshotOtherIntervention[];
  closure: SnapshotClosure | null;
  source_refs: string[];
  unresolved_unknowns: string[];
};

// --- Salida comun -----------------------------------------------------------

export type BlockCheckStatus = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";

export type BlockCheck = {
  id: string;
  status: BlockCheckStatus;
  /** Duro = su FAIL o UNKNOWN bloquea (fail closed). Blando = avisa. */
  hard: boolean;
  detail: string;
};

/** Las seis decisiones que admite la tabla `execution_supervision_runs`. */
export type SupervisionTableDecision =
  | "READY"
  | "CONDITIONAL"
  | "BLOCKED"
  | "WAITING"
  | "UNKNOWN"
  | "COMPLETED";

export type SupervisionBlockCode =
  | "8.00" | "8.01" | "8.06" | "8.07" | "8.08" | "8.09"
  | "8.11" | "8.12" | "8.13" | "8.14" | "8.15" | "8.17";

export type SupervisionBlockResult<TDecision extends string = string, TPayload = unknown> = {
  block: SupervisionBlockCode;
  stage: SupervisionStage;
  /** La decision en el vocabulario del bloque. */
  block_decision: TDecision;
  /** Proyeccion a las seis de la tabla, para listar y filtrar. */
  decision: SupervisionTableDecision;
  why: string;
  checks: BlockCheck[];
  blockers: string[];
  warnings: string[];
  next_actions: string[];
  payload: TPayload;
  plan_id: string;
  action_id: string;
  source_refs: string[];
  unresolved_unknowns: string[];
  execution_authorized: false;
  deterministic: true;
  evaluated_at: string;
};

export function check(id: string, status: BlockCheckStatus, hard: boolean, detail: string): BlockCheck {
  return { id, status, hard, detail };
}

/** Duros que fallan o no se saben: bloquean. Blandos: avisan. */
export function splitChecks(checks: BlockCheck[]) {
  const blockers = checks
    .filter((c) => c.hard && (c.status === "FAIL" || c.status === "UNKNOWN"))
    .map((c) => c.id);
  const warnings = checks
    .filter((c) => !c.hard && (c.status === "FAIL" || c.status === "UNKNOWN"))
    .map((c) => c.id);
  return { blockers, warnings };
}

export function isFresh(iso: string | null | undefined, asOf: string, maxHours: number): boolean {
  if (!iso) return false;
  const age = Date.parse(asOf) - Date.parse(iso);
  return Number.isFinite(age) && age >= 0 && age <= maxHours * 3600_000;
}

/** Las acciones que cambian algo fuera (no lecturas). */
export function mutatingActions(plan: SnapshotPlan | null): SnapshotAction[] {
  return (plan?.actions ?? []).filter((a) => !a.change.startsWith("read"));
}

/** Estados del lifecycle en los que hay ejecucion en marcha. */
export const ACTIVE_EXECUTION_STATES = [
  "SCHEDULED", "RUNNING", "MONITORING", "RETRYING", "DEGRADED", "PAUSING", "PAUSED",
  "ROLLING_BACK", "COMPENSATING", "RECOVERING", "REPAIRING", "ABORTING",
] as const;

export function isExecutionActive(snapshot: ExecutionSnapshot): boolean {
  return (ACTIVE_EXECUTION_STATES as readonly string[]).includes(snapshot.lifecycle?.state ?? "");
}

/** Hubo ejecucion alguna vez: el lifecycle paso por RUNNING. */
export function executionEverStarted(snapshot: ExecutionSnapshot): boolean {
  const lifecycle = snapshot.lifecycle;
  if (!lifecycle) return false;
  if (isExecutionActive(snapshot)) return true;
  return lifecycle.transitions.some((t) => t.decision === "ACCEPTED" && t.to_state === "RUNNING");
}

export function baseResult<TDecision extends string, TPayload>(
  snapshot: ExecutionSnapshot,
  fields: {
    block: SupervisionBlockCode;
    stage: SupervisionStage;
    block_decision: TDecision;
    decision: SupervisionTableDecision;
    why: string;
    checks: BlockCheck[];
    next_actions: string[];
    payload: TPayload;
    extra_blockers?: string[];
  },
): SupervisionBlockResult<TDecision, TPayload> {
  const { blockers, warnings } = splitChecks(fields.checks);
  return {
    block: fields.block,
    stage: fields.stage,
    block_decision: fields.block_decision,
    decision: fields.decision,
    why: fields.why,
    checks: fields.checks,
    blockers: [...new Set([...blockers, ...(fields.extra_blockers ?? [])])],
    warnings,
    next_actions: fields.next_actions,
    payload: fields.payload,
    plan_id: snapshot.plan?.id ?? "sin-plan",
    action_id: snapshot.plan?.actions[0]?.id ?? "sin-accion",
    source_refs: snapshot.source_refs,
    unresolved_unknowns: snapshot.unresolved_unknowns,
    execution_authorized: false,
    deterministic: true,
    evaluated_at: snapshot.as_of,
  };
}
