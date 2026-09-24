/**
 * F8.09 — Guardrails y condiciones de intervencion.
 *
 * Cada guardrail tiene identidad (§1), procedencia (§2), fuerza (§5), fuente de
 * observacion (§9), estado (§11) y respuesta asignada (§12). Los estados:
 *
 *   CLEAR            observado y dentro
 *   APPROACHING      observado y cerca del limite (§15)
 *   BREACHED         observado y fuera (§16)
 *   MISSING_SIGNAL   no se puede observar (§34)
 *
 * MISSING_SIGNAL en un guardrail duro no se lee como CLEAR: el contrato pide
 * fail closed, asi que responde como si estuviera roto con la respuesta mas
 * suave que protege (hold). Y cuando varios saltan a la vez, gana la respuesta
 * mas protectora (§18 prioridad, §19 resolucion de conflictos): stop antes que
 * rollback antes que pause antes que hold antes que escalate.
 */

import {
  baseResult,
  check,
  mutatingActions,
  type ExecutionSnapshot,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const GUARDRAIL_STATES = ["CLEAR", "APPROACHING", "BREACHED", "MISSING_SIGNAL"] as const;
export type GuardrailState = (typeof GUARDRAIL_STATES)[number];

export const GUARDRAIL_RESPONSES = ["STOP", "ROLLBACK", "PAUSE", "HOLD", "ESCALATE", "CONTINUE"] as const;
export type GuardrailResponse = (typeof GUARDRAIL_RESPONSES)[number];

export type Guardrail = {
  id: string;
  provenance: string;
  strength: "hard" | "soft";
  observation_source: string;
  state: GuardrailState;
  on_breach: GuardrailResponse;
  detail: string;
};

export type GuardrailPayload = {
  guardrails: Guardrail[];
  response: GuardrailResponse;
  triggered: string[];
  resume_conditions: string[];
};

/** Orden de proteccion: el indice menor protege mas. */
export function mostProtective(responses: GuardrailResponse[]): GuardrailResponse {
  return [...responses].sort((a, b) => GUARDRAIL_RESPONSES.indexOf(a) - GUARDRAIL_RESPONSES.indexOf(b))[0] ?? "CONTINUE";
}

export function evaluateExecutionGuardrails(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<GuardrailResponse, GuardrailPayload> {
  const { plan, envelope, approval, readiness, lifecycle } = snapshot;
  const pendingMutations = mutatingActions(plan).length;
  const remaining = envelope?.remaining_actions ?? null;

  const guardrails: Guardrail[] = [
    {
      id: "envelope_boundary",
      provenance: "8.05 action envelope",
      strength: "hard",
      observation_source: "action_envelope_runs",
      state: !envelope ? "MISSING_SIGNAL" : ["OUTSIDE", "FORBIDDEN"].includes(envelope.zone) ? "BREACHED" : envelope.zone === "INSIDE_WITH_CONDITIONS" ? "APPROACHING" : "CLEAR",
      on_breach: "STOP",
      detail: envelope ? `Zona ${envelope.zone}${envelope.violations.length ? `: ${envelope.violations.join(", ")}` : ""}.` : "Sin envelope evaluado.",
    },
    {
      id: "authorization_valid",
      provenance: "8.02 aprobacion",
      strength: "hard",
      observation_source: "hitl_approval_assessment_runs",
      state: !approval
        ? "MISSING_SIGNAL"
        : approval.revocation_status === "REVOKED" || ["REVOKED", "EXPIRED", "REJECTED"].includes(approval.approval_state)
          ? "BREACHED"
          : approval.approval_freshness === "STALE"
            ? "APPROACHING"
            : "CLEAR",
      on_breach: "PAUSE",
      detail: approval ? `Aprobacion ${approval.approval_state}, frescura ${approval.approval_freshness}.` : "Sin evaluacion de aprobacion.",
    },
    {
      id: "readiness_not_blocked",
      provenance: "8.04 readiness",
      strength: "hard",
      observation_source: "readiness_assessment_runs",
      state: !readiness
        ? "MISSING_SIGNAL"
        : ["NOT_READY", "BLOCKED"].includes(readiness.decision) || readiness.stale
          ? "BREACHED"
          : readiness.decision === "PARTIALLY_READY" || readiness.revalidate_required
            ? "APPROACHING"
            : "CLEAR",
      on_breach: "HOLD",
      detail: readiness ? `Readiness ${readiness.decision}${readiness.stale ? ", caducado" : ""}.` : "Sin readiness.",
    },
    {
      id: "action_budget",
      provenance: "8.05 action envelope",
      strength: "hard",
      observation_source: "action_envelope_runs",
      state: remaining == null
        ? "MISSING_SIGNAL"
        : remaining < pendingMutations
          ? "BREACHED"
          : remaining - pendingMutations <= 1 && pendingMutations > 0
            ? "APPROACHING"
            : "CLEAR",
      on_breach: "STOP",
      detail: remaining == null ? "El envelope no declara capacidad restante." : `Quedan ${remaining} accion(es) para ${pendingMutations} cambio(s).`,
    },
    {
      id: "stop_criteria_declared",
      provenance: "8.03 plan",
      strength: "hard",
      observation_source: "execution_plan_runs",
      state: !plan ? "MISSING_SIGNAL" : plan.stop_criteria.length ? "CLEAR" : "BREACHED",
      on_breach: "HOLD",
      detail: plan?.stop_criteria.length ? `Criterios de parada: ${plan.stop_criteria.join("; ")}.` : "Un plan sin criterio de parada no tiene guardrail que lo pare.",
    },
    {
      id: "rollback_path_for_irreversible",
      provenance: "8.03 plan",
      strength: "soft",
      observation_source: "execution_plan_runs",
      state: !plan
        ? "MISSING_SIGNAL"
        : mutatingActions(plan).some((a) => !a.reversible) && plan.rollback_criteria.length === 0
          ? "BREACHED"
          : "CLEAR",
      on_breach: "ESCALATE",
      detail: "Un cambio irreversible sin criterio de rollback se escala antes de tocarlo.",
    },
    {
      id: "lifecycle_coherent",
      provenance: "8.10 lifecycle",
      strength: "hard",
      observation_source: "execution_lifecycle_states",
      state: !lifecycle ? "CLEAR" : lifecycle.inconsistencies.length ? "BREACHED" : "CLEAR",
      on_breach: "ESCALATE",
      detail: lifecycle?.inconsistencies.length ? `Incoherencias: ${lifecycle.inconsistencies.join(", ")}.` : "Lifecycle coherente o sin ejecucion.",
    },
  ];

  const triggered = guardrails.filter(
    (g) => g.state === "BREACHED" || (g.state === "MISSING_SIGNAL" && g.strength === "hard"),
  );
  const response = mostProtective(
    triggered.map((g) => (g.state === "MISSING_SIGNAL" ? "HOLD" : g.on_breach)),
  );

  const checks = guardrails.map((g) =>
    check(
      g.id,
      g.state === "CLEAR" ? "PASS" : g.state === "APPROACHING" ? "PASS" : g.state === "MISSING_SIGNAL" ? "UNKNOWN" : "FAIL",
      g.strength === "hard",
      g.detail,
    ),
  );

  return baseResult(snapshot, {
    block: "8.09",
    stage: "GUARDRAILS",
    block_decision: response,
    decision: response === "CONTINUE"
      ? guardrails.some((g) => g.state === "APPROACHING") ? "CONDITIONAL" : "READY"
      : "BLOCKED",
    why: response === "CONTINUE"
      ? guardrails.some((g) => g.state === "APPROACHING")
        ? `Ningun guardrail roto; cerca del limite: ${guardrails.filter((g) => g.state === "APPROACHING").map((g) => g.id).join(", ")}.`
        : "Todos los guardrails observados y dentro."
      : `${response}: ${triggered.map((g) => `${g.id} (${g.state === "MISSING_SIGNAL" ? "sin senal" : "roto"})`).join(", ")}.`,
    checks,
    next_actions: response === "CONTINUE" ? [] : [response.toLowerCase(), ...triggered.map((g) => `resolver ${g.id}`)],
    payload: {
      guardrails,
      response,
      triggered: triggered.map((g) => g.id),
      resume_conditions: triggered.map((g) => `${g.id} vuelve a CLEAR con senal observada`),
    },
  });
}
