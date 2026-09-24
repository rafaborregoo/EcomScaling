/**
 * F8.15 — Verificacion de ejecucion.
 *
 * "Una respuesta tecnica de exito no sustituye esta comprobacion" (runtime
 * 8.00 §11). Que el lifecycle diga COMPLETED significa que se hizo algo, no que
 * el mundo quedo como se queria. Verificado es: estado esperado conocido,
 * estado real observado, y los dos coinciden.
 *
 * Por etapa (§1):
 *   sin ejecutar  -> ¿es verificable el plan? (estado deseado explicito y
 *                    postcondiciones que se puedan observar). Un plan que no
 *                    se puede verificar no deberia ejecutarse.
 *   ejecutado     -> estado (§8): VERIFIED, PARTIALLY_VERIFIED, FAILED,
 *                    INCONCLUSIVE o PENDING si nadie lo ha comprobado aun.
 *
 * El gate (§38-39) decide si se puede cerrar: solo con VERIFIED, o con
 * PARTIALLY_VERIFIED y la desviacion aceptada.
 */

import {
  baseResult,
  check,
  executionEverStarted,
  mutatingActions,
  type ExecutionSnapshot,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const VERIFICATION_DECISIONS = [
  "NOT_APPLICABLE",
  "VERIFIABLE",
  "NOT_VERIFIABLE",
  "PENDING",
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "FAILED",
  "INCONCLUSIVE",
] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

export type VerificationPayload = {
  stage: "not_executed" | "executed";
  expected_state: string | null;
  actual_state: string | null;
  unverifiable_actions: string[];
  postconditions: string[];
  gate: "pass" | "hold" | "fail" | "not_applicable";
};

const known = (value: string | null | undefined) => Boolean(value && value.trim() && value !== "UNKNOWN");
const norm = (value: string) => value.trim().toLowerCase();

export function evaluateExecutionVerification(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<VerificationDecision, VerificationPayload> {
  const mutations = mutatingActions(snapshot.plan);
  const started = executionEverStarted(snapshot);
  const closure = snapshot.closure;
  const postconditions = snapshot.plan?.postconditions ?? [];

  const unverifiable = mutations.filter((a) => !known(a.desired_state)).map((a) => a.id);

  let blockDecision: VerificationDecision;
  let gate: VerificationPayload["gate"] = "not_applicable";

  if (!started) {
    blockDecision = mutations.length === 0
      ? "NOT_APPLICABLE"
      : unverifiable.length === 0 && postconditions.length > 0
        ? "VERIFIABLE"
        : "NOT_VERIFIABLE";
  } else if (!closure || !known(closure.actual)) {
    // Se ejecuto y nadie ha observado el resultado: pendiente, no verificado.
    blockDecision = "PENDING";
    gate = "hold";
  } else if (closure.verification_status === "FAILED") {
    blockDecision = "FAILED";
    gate = "fail";
  } else if (known(closure.expected) && norm(closure.expected!) === norm(closure.actual!)) {
    blockDecision = "VERIFIED";
    gate = "pass";
  } else if (closure.verification_status === "PARTIALLY_VERIFIED") {
    blockDecision = "PARTIALLY_VERIFIED";
    gate = "hold";
  } else if (!known(closure.expected)) {
    blockDecision = "INCONCLUSIVE";
    gate = "hold";
  } else {
    // Esperado y real conocidos y distintos: eso es un fallo de verificacion,
    // aunque la tool respondiera exito.
    blockDecision = "FAILED";
    gate = "fail";
  }

  const checks = [
    check("expected_state_defined", unverifiable.length === 0 ? "PASS" : "FAIL", true,
      unverifiable.length ? `Sin estado deseado explicito en ${unverifiable.join(", ")}: no habra con que comparar.` : "Cada cambio declara su estado deseado."),
    check("postconditions", mutations.length === 0 ? "NOT_APPLICABLE" : postconditions.length ? "PASS" : "FAIL", true,
      postconditions.length ? `Postcondiciones: ${postconditions.join("; ")}.` : "El plan no declara postcondiciones observables."),
    check("tool_result_is_not_verification", "PASS", true,
      "Un COMPLETED del lifecycle no cuenta como verificado sin estado real observado (8.06 §20)."),
    check("actual_state_observed", !started ? "NOT_APPLICABLE" : known(closure?.actual) ? "PASS" : "UNKNOWN", true,
      !started ? "Sin ejecucion no hay estado real que observar." : known(closure?.actual) ? `Estado real: ${closure?.actual}.` : "Nadie ha observado el estado resultante."),
  ];

  return baseResult(snapshot, {
    block: "8.15",
    stage: "VERIFICATION",
    block_decision: blockDecision,
    decision:
      blockDecision === "VERIFIED" || blockDecision === "NOT_APPLICABLE" ? "COMPLETED"
        : blockDecision === "VERIFIABLE" ? "WAITING"
          : blockDecision === "PENDING" || blockDecision === "PARTIALLY_VERIFIED" || blockDecision === "INCONCLUSIVE" ? "CONDITIONAL"
            : "BLOCKED",
    why:
      blockDecision === "NOT_APPLICABLE" ? "El plan solo lee: no hay cambio que verificar."
        : blockDecision === "VERIFIABLE" ? "Aun sin ejecutar; cuando se ejecute habra con que comparar."
          : blockDecision === "NOT_VERIFIABLE" ? "Si se ejecuta, no se podra saber si salio bien: falta estado deseado o postcondiciones."
            : blockDecision === "PENDING" ? "Ejecutado, pero nadie ha comprobado todavia el estado resultante."
              : blockDecision === "VERIFIED" ? "El estado real coincide con el esperado."
                : blockDecision === "PARTIALLY_VERIFIED" ? "Parte del resultado se ha comprobado; el resto no."
                  : blockDecision === "INCONCLUSIVE" ? "Hay estado real pero no un esperado con que compararlo."
                    : "El estado real no es el esperado.",
    checks,
    next_actions:
      blockDecision === "NOT_VERIFIABLE" ? ["declarar estado deseado y postcondiciones antes de ejecutar"]
        : blockDecision === "PENDING" ? ["observar el estado real y compararlo"]
          : blockDecision === "FAILED" ? ["abrir incidente (8.11)", "decidir recovery (8.12)"]
            : blockDecision === "PARTIALLY_VERIFIED" || blockDecision === "INCONCLUSIVE" ? ["completar la verificacion o aceptar la desviacion por escrito"]
              : [],
    payload: {
      stage: started ? "executed" : "not_executed",
      expected_state: closure?.expected ?? mutations[0]?.desired_state ?? null,
      actual_state: closure?.actual ?? null,
      unverifiable_actions: unverifiable,
      postconditions,
      gate,
    },
  });
}
