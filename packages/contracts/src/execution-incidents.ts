/**
 * F8.11 — Fallos, excepciones e incidentes.
 *
 * Lo primero es no confundir (8.01 §34): una intervencion BLOQUEADA
 * correctamente no ha fallado. Bloquear es el sistema funcionando. Contarlo
 * como incidente llena la cola de ruido y entierra los fallos de verdad.
 *
 * Las clases (§2) que se distinguen aqui:
 *   BLOCKED          la supervision paro algo a tiempo: no es incidente
 *   FAILURE          algo se intento y fallo
 *   UNKNOWN_OUTCOME  no se sabe si el cambio se aplico (§23): el peor caso,
 *                    porque reintentar puede duplicar y no reintentar puede
 *                    dejarlo a medias
 *   INCONSISTENCY    el lifecycle contradice su propia historia
 *   STALE_EVENT      llego un evento fuera de orden (informativo)
 *
 * La severidad sale de factores (§10), no de una etiqueta: si hubo mutacion,
 * si era irreversible, si el estado es desconocido. Desde `medium` se abre
 * incidente, con contencion (§33) y dueño (§29).
 */

import {
  baseResult,
  check,
  executionEverStarted,
  mutatingActions,
  type ExecutionSnapshot,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const INCIDENT_DECISIONS = [
  "NO_PROBLEM",
  "BLOCKED_NOT_FAILED",
  "MINOR",
  "INCIDENT",
  "CRITICAL_INCIDENT",
] as const;
export type IncidentDecision = (typeof INCIDENT_DECISIONS)[number];

export type ProblemClass = "BLOCKED" | "FAILURE" | "UNKNOWN_OUTCOME" | "INCONSISTENCY" | "STALE_EVENT";
export type IncidentSeverity = "info" | "low" | "medium" | "high" | "critical";

export type ProblemRecord = {
  class: ProblemClass;
  severity: IncidentSeverity;
  origin: string;
  detail: string;
  retryable: boolean;
};

export type IncidentPayload = {
  problems: ProblemRecord[];
  incident_required: boolean;
  severity: IncidentSeverity | null;
  containment: "none" | "hold_next_action" | "pause" | "freeze_and_verify_state";
  owner: string;
};

const SEVERITY_ORDER: IncidentSeverity[] = ["info", "low", "medium", "high", "critical"];
const worst = (list: IncidentSeverity[]) =>
  list.reduce<IncidentSeverity | null>((acc, s) => (acc == null || SEVERITY_ORDER.indexOf(s) > SEVERITY_ORDER.indexOf(acc) ? s : acc), null);

export function evaluateExecutionIncidents(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<IncidentDecision, IncidentPayload> {
  const lifecycle = snapshot.lifecycle;
  const mutations = mutatingActions(snapshot.plan);
  const irreversible = mutations.some((a) => !a.reversible);
  const started = executionEverStarted(snapshot);
  const problems: ProblemRecord[] = [];

  for (const t of lifecycle?.transitions ?? []) {
    if (t.decision === "STALE") {
      problems.push({ class: "STALE_EVENT", severity: "info", origin: `transicion ${t.command}`, detail: "Evento fuera de orden descartado por el lifecycle.", retryable: false });
    }
    if (t.to_state === "FAILED" || t.to_state === "VERIFICATION_FAILED") {
      problems.push({
        class: "FAILURE",
        severity: irreversible ? "critical" : mutations.length ? "high" : "medium",
        origin: `transicion ${t.command} -> ${t.to_state}`,
        detail: t.reasons.join("; ") || "La ejecucion fallo.",
        retryable: !irreversible,
      });
    }
  }

  if (lifecycle?.state === "UNKNOWN") {
    problems.push({
      class: "UNKNOWN_OUTCOME",
      severity: mutations.length ? (irreversible ? "critical" : "high") : "medium",
      origin: "estado del lifecycle",
      detail: "No se sabe si el cambio se aplico. No reintentar a ciegas: primero leer el estado real.",
      retryable: false,
    });
  }
  if (lifecycle?.inconsistencies.length) {
    problems.push({
      class: "INCONSISTENCY",
      severity: "high",
      origin: "execution_lifecycle_states",
      detail: lifecycle.inconsistencies.join("; "),
      retryable: false,
    });
  }
  if (snapshot.closure?.verification_status === "FAILED") {
    problems.push({ class: "FAILURE", severity: "high", origin: "8.16 cierre", detail: "La verificacion del cierre fallo.", retryable: false });
  }

  // Bloqueos correctos: lifecycle BLOCKED o supervision que paro antes de
  // ejecutar. Se registran como informacion, nunca como incidente.
  if (!started && (lifecycle?.state === "BLOCKED" || snapshot.readiness?.decision === "BLOCKED")) {
    problems.push({ class: "BLOCKED", severity: "info", origin: "supervision previa", detail: "La intervencion se paro antes de ejecutar. Es el control funcionando.", retryable: false });
  }

  const severity = worst(problems.filter((p) => p.class !== "BLOCKED" && p.class !== "STALE_EVENT").map((p) => p.severity));
  const incidentRequired = severity != null && SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf("medium");

  const blockDecision: IncidentDecision =
    severity === "critical"
      ? "CRITICAL_INCIDENT"
      : incidentRequired
        ? "INCIDENT"
        : severity != null
          ? "MINOR"
          : problems.some((p) => p.class === "BLOCKED")
            ? "BLOCKED_NOT_FAILED"
            : "NO_PROBLEM";

  const unknownOutcome = problems.some((p) => p.class === "UNKNOWN_OUTCOME");
  const containment: IncidentPayload["containment"] = unknownOutcome
    ? "freeze_and_verify_state"
    : severity === "critical" || severity === "high"
      ? "pause"
      : incidentRequired
        ? "hold_next_action"
        : "none";

  const checks = [
    check("problem_classification", "PASS", true,
      problems.length ? `${problems.length} problema(s) clasificados.` : "Sin problemas en el lifecycle ni en el cierre."),
    check("blocked_is_not_failure", "PASS", true,
      "Un bloqueo correcto se registra como informacion, no como incidente (8.01 §34)."),
    check("unknown_outcome", unknownOutcome ? "FAIL" : "PASS", true,
      unknownOutcome ? "Hay un resultado desconocido: congelar y leer el estado real antes de cualquier reintento." : "Ningun resultado desconocido."),
    check("incident_owner", incidentRequired ? "PASS" : "NOT_APPLICABLE", false,
      incidentRequired ? "El incidente queda asignado al consultor de la cuenta." : "No hay incidente que asignar."),
  ];

  return baseResult(snapshot, {
    block: "8.11",
    stage: "INCIDENTS",
    block_decision: blockDecision,
    decision: blockDecision === "CRITICAL_INCIDENT" || blockDecision === "INCIDENT" ? "BLOCKED" : blockDecision === "MINOR" ? "CONDITIONAL" : "READY",
    why:
      blockDecision === "NO_PROBLEM"
        ? started ? "La ejecucion no registra fallos." : "Sin ejecucion y sin problemas registrados."
        : blockDecision === "BLOCKED_NOT_FAILED"
          ? "La intervencion esta bloqueada por la supervision: es un control que funciona, no un fallo."
          : `${blockDecision}: ${problems.filter((p) => p.class !== "BLOCKED").map((p) => `${p.class} (${p.severity})`).join(", ")}.`,
    checks,
    next_actions:
      containment === "freeze_and_verify_state"
        ? ["congelar la intervencion", "leer el estado real del proveedor", "decidir reintento o recovery con ese estado"]
        : containment === "pause"
          ? ["pausar", "escalar al consultor", "preparar recovery (8.12)"]
          : containment === "hold_next_action"
            ? ["retener la siguiente accion", "revisar el fallo"]
            : [],
    payload: {
      problems,
      incident_required: incidentRequired,
      severity,
      containment,
      owner: incidentRequired ? "consultor asignado" : "ninguno",
    },
  });
}
