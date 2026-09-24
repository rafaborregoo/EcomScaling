/**
 * F8.08 — Supervision durante la ejecucion.
 *
 * Dos preguntas segun el momento:
 *
 * ANTES de ejecutar: ¿hay plan de monitorizacion (§1)? Criterio de exito que
 * observar, criterio de parada, ventana de observacion. Una intervencion que
 * arranca sin saber que mirar no esta supervisada, esta suelta.
 *
 * DURANTE: la salud de la intervencion (§33), separada del estado de
 * ejecucion. Se mira la frescura de la observacion (§45), si las precondiciones
 * siguen en pie (§19), si la autorizacion cambio (§21) y cuanto envelope queda
 * (§22). De ahi sale una respuesta de la lista del §37: continue, hold,
 * reduce, pause, abort, rollback o escalate.
 *
 * Una observacion caducada no es "todo bien": es `BLIND`, y la respuesta es
 * parar hasta volver a ver (fail-safe del runtime 8.00 §12).
 */

import {
  baseResult,
  check,
  isExecutionActive,
  isFresh,
  type BlockCheck,
  type ExecutionSnapshot,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const MONITORING_HEALTH = [
  "NOT_STARTED",
  "HEALTHY",
  "WATCH",
  "DEGRADED",
  "BLIND",
] as const;
export type MonitoringHealth = (typeof MONITORING_HEALTH)[number];

export type MonitoringResponse = "continue" | "hold" | "reduce" | "pause" | "abort" | "rollback" | "escalate";

export type MonitoringPayload = {
  health: MonitoringHealth;
  response: MonitoringResponse;
  plan_ready: boolean;
  plan_gaps: string[];
  observation_fresh: boolean | null;
  envelope_remaining: number | null;
  signals: string[];
};

/** Horas sin observar a partir de las cuales la supervision esta ciega. */
export const MONITORING_FRESHNESS_HOURS = 24;

export function evaluateExecutionMonitoring(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<MonitoringHealth, MonitoringPayload> {
  const plan = snapshot.plan;
  const active = isExecutionActive(snapshot);

  const planGaps = [
    plan?.success_criteria.length ? null : "sin criterio de exito que observar",
    plan?.stop_criteria.length ? null : "sin criterio de parada",
    plan?.observation_window && plan.observation_window !== "contextual" ? null : "sin ventana de observacion concreta",
  ].filter((g): g is string => g !== null);
  const planReady = Boolean(plan) && planGaps.length === 0;

  const signals: string[] = [];
  let health: MonitoringHealth = "NOT_STARTED";
  let response: MonitoringResponse = "hold";
  let fresh: boolean | null = null;

  if (active) {
    fresh = isFresh(snapshot.lifecycle?.last_event_at, snapshot.as_of, MONITORING_FRESHNESS_HOURS);
    const authorizationLost =
      snapshot.approval?.revocation_status === "REVOKED" ||
      ["REVOKED", "EXPIRED", "REJECTED"].includes(snapshot.approval?.approval_state ?? "");
    const preconditionsBroken = snapshot.readiness?.stale || ["NOT_READY", "BLOCKED"].includes(snapshot.readiness?.decision ?? "");
    const envelopeExhausted = snapshot.envelope?.remaining_actions === 0;
    const envelopeBreached = ["OUTSIDE", "FORBIDDEN"].includes(snapshot.envelope?.zone ?? "");

    if (authorizationLost) signals.push("la autorizacion se revoco o expiro durante la ejecucion");
    if (preconditionsBroken) signals.push("las precondiciones ya no se cumplen");
    if (envelopeBreached) signals.push("la ejecucion salio del action envelope");
    if (envelopeExhausted) signals.push("el envelope no admite mas acciones");
    if (!fresh) signals.push(`sin observacion en las ultimas ${MONITORING_FRESHNESS_HOURS} h`);

    health = !fresh
      ? "BLIND"
      : authorizationLost || envelopeBreached
        ? "DEGRADED"
        : preconditionsBroken || envelopeExhausted
          ? "WATCH"
          : "HEALTHY";
    response = envelopeBreached
      ? "abort"
      : authorizationLost
        ? "pause"
        : !fresh
          ? "pause"
          : preconditionsBroken
            ? "hold"
            : envelopeExhausted
              ? "reduce"
              : "continue";
  }

  const checks: BlockCheck[] = [
    check("monitoring_plan", planReady ? "PASS" : "FAIL", !active ? false : true,
      planReady ? "Hay criterio de exito, de parada y ventana de observacion." : `Plan de monitorizacion incompleto: ${planGaps.join(", ")}.`),
    check("observation_freshness", !active ? "NOT_APPLICABLE" : fresh ? "PASS" : "FAIL", true,
      !active ? "No hay ejecucion en marcha que observar." : fresh ? "La observacion es reciente." : "La supervision esta ciega: sin observacion reciente."),
    check("continuous_preconditions", !active ? "NOT_APPLICABLE" : signals.some((s) => s.includes("precondiciones")) ? "FAIL" : "PASS", true,
      "Las precondiciones se revisan mientras dura la ejecucion, no solo al empezar."),
    check("authorization_still_valid", !active ? "NOT_APPLICABLE" : signals.some((s) => s.includes("autorizacion")) ? "FAIL" : "PASS", true,
      "Una autorizacion revocada a mitad obliga a parar."),
  ];

  const decision = !active
    ? planReady ? "WAITING" : "CONDITIONAL"
    : health === "HEALTHY" ? "READY" : health === "WATCH" ? "CONDITIONAL" : "BLOCKED";

  return baseResult(snapshot, {
    block: "8.08",
    stage: "MONITORING",
    block_decision: health,
    decision,
    why: !active
      ? planReady
        ? "No hay ejecucion en marcha; el plan de monitorizacion esta listo para cuando la haya."
        : `No hay ejecucion en marcha, y cuando la haya no se sabra que mirar: ${planGaps.join(", ")}.`
      : health === "HEALTHY"
        ? "Ejecucion en marcha, observada y dentro de sus limites."
        : `Ejecucion en marcha con senales: ${signals.join("; ")}.`,
    checks,
    next_actions: !active
      ? planReady ? [] : ["definir criterio de exito, de parada y ventana de observacion antes de ejecutar"]
      : [response],
    payload: {
      health,
      response,
      plan_ready: planReady,
      plan_gaps: planGaps,
      observation_fresh: fresh,
      envelope_remaining: snapshot.envelope?.remaining_actions ?? null,
      signals,
    },
  });
}
