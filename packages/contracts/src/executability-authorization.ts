/**
 * F8.01 — Ejecutabilidad y autorizacion.
 *
 * Tres preguntas que el contrato prohibe fundir en una (§7): ¿existe la
 * capacidad?, ¿hay acceso tecnico?, ¿hay autoridad para usarlo? Y una cuarta
 * que la gente suele olvidar (§26): autoridad para PREPARAR no es autoridad
 * para EJECUTAR.
 *
 * La capacidad sale del registro de tools real, no de lo que la recomendacion
 * supone. Hoy ninguna tool de escritura esta implementada, asi que ninguna
 * accion que cambie algo es ejecutable por el sistema: se prepara y se entrega
 * a una persona (modo `manual`, handoff §32). Eso es un bloqueo correcto, no
 * un fallo (§34).
 */

import {
  baseResult,
  check,
  mutatingActions,
  type BlockCheck,
  type ExecutionSnapshot,
  type SnapshotAction,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const EXECUTABILITY_DECISIONS = [
  "EXECUTABLE",
  "CONDITIONALLY_EXECUTABLE",
  "PARTIALLY_EXECUTABLE",
  "NOT_EXECUTABLE",
] as const;
export type ExecutabilityDecision = (typeof EXECUTABILITY_DECISIONS)[number];

export const AUTHORIZATION_DECISIONS = [
  "AUTHORIZED",
  "NOT_AUTHORIZED",
  "APPROVAL_REQUIRED",
  "AUTHORIZATION_UNCERTAIN",
] as const;
export type AuthorizationDecision = (typeof AUTHORIZATION_DECISIONS)[number];

/** Motivos de bloqueo del §33. */
export const BLOCKING_REASONS = [
  "capability_missing",
  "tool_unavailable",
  "access_missing",
  "authorization_missing",
  "approval_required",
  "scope_exceeded",
  "limit_exceeded",
  "context_insufficient",
  "readiness_missing",
] as const;
export type BlockingReason = (typeof BLOCKING_REASONS)[number];

export type ExecutionMode = "automated" | "assisted" | "manual" | "external";

export type ActionExecutability = {
  action_id: string;
  kind: "read" | "mutation";
  capability: "SUPPORTED" | "PREPARE_ONLY" | "MISSING";
  access: "GRANTED" | "MISSING" | "NOT_REQUIRED";
  executability: ExecutabilityDecision;
  blocking_reasons: BlockingReason[];
};

export type ExecutabilityPayload = {
  executability: ExecutabilityDecision;
  authorization: AuthorizationDecision;
  /** Autoridad para preparar y para ejecutar, por separado (§26). */
  may_prepare: boolean;
  may_execute: boolean;
  execution_mode: ExecutionMode;
  actions: ActionExecutability[];
  blocking_reasons: BlockingReason[];
  /** §39: candidato a ejecucion; no es una orden de ejecutar. */
  candidate_for_execution: boolean;
  handoff_required: boolean;
};

function authorizationFrom(snapshot: ExecutionSnapshot): AuthorizationDecision {
  const approval = snapshot.approval;
  if (!approval) return "AUTHORIZATION_UNCERTAIN";
  if (approval.revocation_status === "REVOKED") return "NOT_AUTHORIZED";
  if (["REJECTED", "REVOKED", "EXPIRED"].includes(approval.approval_state)) return "NOT_AUTHORIZED";
  if (approval.disposition === "HUMAN_ONLY") return "NOT_AUTHORIZED";
  if (["PENDING", "PARTIALLY_APPROVED"].includes(approval.approval_state)) return "APPROVAL_REQUIRED";
  if (["APPROVED", "CONDITIONALLY_APPROVED", "NOT_REQUIRED"].includes(approval.approval_state)) {
    // §36: una autorizacion que no se sabe si sigue vigente no autoriza.
    return approval.approval_freshness === "CURRENT" || approval.approval_state === "NOT_REQUIRED"
      ? "AUTHORIZED"
      : "AUTHORIZATION_UNCERTAIN";
  }
  return "AUTHORIZATION_UNCERTAIN";
}

function actionExecutability(action: SnapshotAction, snapshot: ExecutionSnapshot): ActionExecutability {
  const kind = action.change.startsWith("read") ? "read" : "mutation";
  const caps = snapshot.capabilities;
  const implemented = (permission: string) =>
    caps.filter((c) => c.permission === permission && c.status === "implemented_partial");

  if (kind === "read") {
    const readers = implemented("read");
    const connected = readers.some((c) => c.connector === "core" || c.connector_connected);
    return {
      action_id: action.id,
      kind,
      capability: readers.length ? "SUPPORTED" : "MISSING",
      access: connected ? "GRANTED" : readers.length ? "MISSING" : "NOT_REQUIRED",
      executability: readers.length && connected ? "EXECUTABLE" : "NOT_EXECUTABLE",
      blocking_reasons: readers.length ? (connected ? [] : ["access_missing"]) : ["capability_missing"],
    };
  }

  const writers = implemented("write");
  const canPreview = caps.some((c) => c.name === "dry_run_write" && c.status === "implemented_partial");
  if (writers.length === 0) {
    return {
      action_id: action.id,
      kind,
      capability: canPreview ? "PREPARE_ONLY" : "MISSING",
      access: "NOT_REQUIRED",
      executability: canPreview ? "CONDITIONALLY_EXECUTABLE" : "NOT_EXECUTABLE",
      blocking_reasons: ["capability_missing", "tool_unavailable"],
    };
  }
  const connected = writers.some((c) => c.connector_connected);
  return {
    action_id: action.id,
    kind,
    capability: "SUPPORTED",
    access: connected ? "GRANTED" : "MISSING",
    executability: connected ? "EXECUTABLE" : "NOT_EXECUTABLE",
    blocking_reasons: connected ? [] : ["access_missing"],
  };
}

export function evaluateExecutabilityAuthorization(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<ExecutabilityDecision, ExecutabilityPayload> {
  const actions = (snapshot.plan?.actions ?? []).map((a) => actionExecutability(a, snapshot));
  const authorization = authorizationFrom(snapshot);

  const executable = actions.filter((a) => a.executability === "EXECUTABLE").length;
  const executability: ExecutabilityDecision =
    actions.length === 0
      ? "NOT_EXECUTABLE"
      : executable === actions.length
        ? "EXECUTABLE"
        : executable > 0
          ? "PARTIALLY_EXECUTABLE"
          : actions.some((a) => a.executability === "CONDITIONALLY_EXECUTABLE")
            ? "CONDITIONALLY_EXECUTABLE"
            : "NOT_EXECUTABLE";

  const envelopeInside = ["INSIDE", "INSIDE_WITH_CONDITIONS"].includes(snapshot.envelope?.zone ?? "");
  const readinessOk = ["READY", "READY_WITH_CONDITIONS"].includes(snapshot.readiness?.decision ?? "");

  const reasons = new Set<BlockingReason>(actions.flatMap((a) => a.blocking_reasons));
  if (authorization === "APPROVAL_REQUIRED") reasons.add("approval_required");
  if (authorization === "NOT_AUTHORIZED" || authorization === "AUTHORIZATION_UNCERTAIN") reasons.add("authorization_missing");
  if (!envelopeInside) reasons.add("scope_exceeded");
  if (snapshot.envelope?.remaining_actions === 0) reasons.add("limit_exceeded");
  if (!readinessOk) reasons.add("readiness_missing");
  if (!snapshot.plan || snapshot.plan.actions.length === 0) reasons.add("context_insufficient");

  // §26: preparar exige plan dentro del envelope; ejecutar exige ademas
  // capacidad real, autoridad vigente y readiness.
  const mayPrepare = Boolean(snapshot.plan) && envelopeInside && authorization !== "NOT_AUTHORIZED";
  const mayExecute = executability === "EXECUTABLE" && authorization === "AUTHORIZED" && envelopeInside && readinessOk;

  const hasMutations = mutatingActions(snapshot.plan).length > 0;
  const writeCapable = actions.filter((a) => a.kind === "mutation").every((a) => a.capability === "SUPPORTED");
  const executionMode: ExecutionMode = !hasMutations
    ? "automated"
    : writeCapable
      ? ["BOUNDED_AUTONOMY", "ADAPTIVE_BOUNDED_AUTONOMY", "HIGH_AUTONOMY"].includes(snapshot.approval?.autonomy_level ?? "")
        ? "automated"
        : "assisted"
      : "manual";

  const checks: BlockCheck[] = [
    check("capability", actions.every((a) => a.capability === "SUPPORTED") ? "PASS" : "FAIL", true,
      hasMutations && !writeCapable
        ? "Ninguna tool de escritura esta implementada: los cambios se preparan, pero no los ejecuta el sistema."
        : "Hay capacidad para todas las acciones."),
    check("access", actions.every((a) => a.access !== "MISSING") ? "PASS" : "FAIL", true,
      actions.some((a) => a.access === "MISSING") ? "Falta la conexion que da acceso a alguna accion." : "El acceso tecnico existe o no hace falta."),
    check("authorization", authorization === "AUTHORIZED" ? "PASS" : authorization === "AUTHORIZATION_UNCERTAIN" ? "UNKNOWN" : "FAIL", true,
      `Autorizacion: ${authorization}. La ejecucion no puede depender de autorizacion implicita (§8).`),
    check("envelope", envelopeInside ? "PASS" : snapshot.envelope ? "FAIL" : "UNKNOWN", true,
      envelopeInside ? "Dentro del action envelope." : "Fuera del envelope o sin envelope evaluado."),
    check("readiness", readinessOk ? "PASS" : snapshot.readiness ? "FAIL" : "UNKNOWN", true,
      readinessOk ? "Readiness en verde." : `Readiness: ${snapshot.readiness?.decision ?? "sin evaluar"}.`),
  ];

  const handoff = hasMutations && !writeCapable;
  const decision = mayExecute ? "READY" : mayPrepare ? "CONDITIONAL" : "BLOCKED";

  return baseResult(snapshot, {
    block: "8.01",
    stage: "EXECUTABILITY_AUTHORIZATION",
    block_decision: executability,
    decision,
    why: mayExecute
      ? "Hay capacidad, acceso, autoridad vigente, readiness y envelope: es candidata a ejecucion."
      : handoff
        ? "Se puede preparar, pero ejecutarla tiene que hacerlo una persona: el sistema no tiene capacidad de escritura."
        : `No ejecutable todavia: ${[...reasons].join(", ")}.`,
    checks,
    next_actions: mayExecute
      ? ["pasar a readiness final y guardrails antes de actuar"]
      : handoff
        ? ["handoff a una persona con el plan preparado"]
        : reasons.has("approval_required")
          ? ["solicitar aprobacion"]
          : reasons.has("authorization_missing")
            ? ["solicitar autorizacion"]
            : ["satisfacer precondiciones"],
    payload: {
      executability,
      authorization,
      may_prepare: mayPrepare,
      may_execute: mayExecute,
      execution_mode: executionMode,
      actions,
      blocking_reasons: [...reasons],
      candidate_for_execution: mayExecute,
      handoff_required: handoff,
    },
  });
}
