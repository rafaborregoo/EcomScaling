/**
 * F8.12 — Rollback, recovery y compensacion.
 *
 * Fuente: conocimiento/fase-08/00-corpus-maestro/8.12 (el bloque no tiene
 * capas destiladas; se implementa desde el corpus y se anota).
 *
 * La pregunta del bloque (§1): ¿como volver a un estado seguro cuando la
 * ejecucion ya produjo cambios? La respuesta no siempre es rollback:
 *
 *   ROLLBACK      volver al estado anterior (§3). Exige que el cambio sea
 *                 reversible y que el estado anterior se conozca (§24).
 *   ROLL_FORWARD  corregir hacia un estado bueno nuevo (§65-68), cuando el
 *                 anterior no se conoce o volver seria peor.
 *   COMPENSATE    el efecto de negocio no se deshace (un email enviado, una
 *                 venta a precio erroneo): se compensa (§10-12).
 *   CONTAIN       resultado desconocido: primero contener y leer (§15).
 *
 * Antes de ejecutar, el bloque mide la preparacion (§32-33): estado previo,
 * camino de vuelta, permisos y tool. Un sistema maduro piensa en recovery antes
 * de necesitarlo. Despues, nunca declara recuperado mientras quede algo
 * inconsistente (§62): RECOVERY_NOT_COMPLETE.
 */

import {
  baseResult,
  check,
  executionEverStarted,
  mutatingActions,
  type ExecutionSnapshot,
  type SnapshotAction,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const RECOVERY_DECISIONS = [
  "NOT_NEEDED",
  "PREPARED",
  "UNPREPARED",
  "RECOVERY_REQUIRED",
  "RECOVERY_IN_PROGRESS",
  "RECOVERY_NOT_COMPLETE",
  "RECOVERED",
] as const;
export type RecoveryDecision = (typeof RECOVERY_DECISIONS)[number];

export type RecoveryStrategy = "ROLLBACK" | "ROLL_FORWARD" | "COMPENSATE" | "CONTAIN" | "NONE";

/** §25-28: la reversibilidad tecnica y la de negocio no son la misma. */
export type Reversibility = "reversible" | "partially_reversible" | "irreversible";

export type ActionRecovery = {
  action_id: string;
  reversibility: Reversibility;
  previous_state_known: boolean;
  rollback_eligible: boolean;
};

export type RecoveryPayload = {
  actions: ActionRecovery[];
  strategy: RecoveryStrategy;
  /** §53: orden inverso al de ejecucion. */
  rollback_order: string[];
  restore_capability: boolean;
  recovery_complete: boolean | null;
};

// Cambios cuyo efecto de negocio sobrevive a deshacer el dato (§26, §27, §29).
const BUSINESS_EFFECT = /(precio|price|descuento|discount|envi(ar|o)|send|email|campa|refund|reembolso|borra|delete)/i;

function reversibilityOf(action: SnapshotAction): Reversibility {
  if (!action.reversible) return "irreversible";
  return BUSINESS_EFFECT.test(`${action.change} ${action.title}`) ? "partially_reversible" : "reversible";
}

const known = (value: string | null) => Boolean(value && value.trim() && value !== "UNKNOWN");

export function evaluateRollbackRecovery(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<RecoveryDecision, RecoveryPayload> {
  const mutations = mutatingActions(snapshot.plan);
  const state = snapshot.lifecycle?.state ?? null;
  const started = executionEverStarted(snapshot);

  const actions: ActionRecovery[] = mutations.map((a) => {
    const reversibility = reversibilityOf(a);
    const previous = known(a.current_state);
    return {
      action_id: a.id,
      reversibility,
      previous_state_known: previous,
      rollback_eligible: reversibility !== "irreversible" && previous,
    };
  });

  // El camino de vuelta usa la misma capacidad de escritura que la ida.
  const restoreCapability = snapshot.capabilities.some(
    (c) => c.permission === "write" && c.status === "implemented_partial",
  );

  const failed = ["FAILED", "VERIFICATION_FAILED", "UNKNOWN"].includes(state ?? "");
  const inRecovery = ["ROLLING_BACK", "COMPENSATING", "RECOVERING", "REPAIRING"].includes(state ?? "");
  const rolledBack = snapshot.closure != null && snapshot.lifecycle?.transitions.some((t) => t.to_state === "ROLLING_BACK");

  const strategy: RecoveryStrategy =
    state === "UNKNOWN"
      ? "CONTAIN"
      : !failed && !inRecovery
        ? "NONE"
        : actions.some((a) => a.reversibility === "irreversible")
          ? "COMPENSATE"
          : actions.every((a) => a.rollback_eligible)
            ? "ROLLBACK"
            : "ROLL_FORWARD";

  // §62: recuperado solo con verificacion; si no, no completo.
  const recoveryComplete = rolledBack
    ? snapshot.closure?.verification_status === "VERIFIED"
    : null;

  const prepared = actions.every((a) => a.rollback_eligible || a.reversibility === "irreversible") && (mutations.length === 0 || restoreCapability || !started);
  const irreversibleWithoutPlan = actions.some((a) => a.reversibility === "irreversible") && (snapshot.plan?.rollback_criteria.length ?? 0) === 0;

  const blockDecision: RecoveryDecision =
    mutations.length === 0
      ? "NOT_NEEDED"
      : inRecovery
        ? "RECOVERY_IN_PROGRESS"
        : rolledBack
          ? recoveryComplete ? "RECOVERED" : "RECOVERY_NOT_COMPLETE"
          : failed
            ? "RECOVERY_REQUIRED"
            : prepared && !irreversibleWithoutPlan
              ? "PREPARED"
              : "UNPREPARED";

  const checks = [
    check("previous_state_captured", actions.every((a) => a.previous_state_known) ? "PASS" : mutations.length ? "FAIL" : "NOT_APPLICABLE", true,
      actions.some((a) => !a.previous_state_known)
        ? `Sin estado previo en ${actions.filter((a) => !a.previous_state_known).map((a) => a.action_id).join(", ")}: no hay a donde volver (§34).`
        : "Cada cambio conoce el estado del que parte."),
    check("reversibility_classified", "PASS", true,
      actions.length ? actions.map((a) => `${a.action_id}: ${a.reversibility}`).join(", ") : "Sin cambios."),
    check("irreversible_has_plan", irreversibleWithoutPlan ? "FAIL" : "PASS", true,
      irreversibleWithoutPlan ? "Hay cambios irreversibles sin criterio de rollback ni compensacion." : "Los irreversibles tienen criterio de recovery o no los hay."),
    check("restore_capability", mutations.length === 0 ? "NOT_APPLICABLE" : restoreCapability ? "PASS" : "FAIL", false,
      restoreCapability ? "Hay tool para deshacer." : "Deshacer tambien seria manual: no hay tool de escritura implementada."),
    // Invariante, no condicion: RECOVERED solo sale con verificacion, y sin
    // ella el estado es RECOVERY_NOT_COMPLETE (§62). Por construccion.
    check("not_claimed_prematurely", "PASS", true,
      blockDecision === "RECOVERY_NOT_COMPLETE"
        ? "Se deshizo sin verificacion: se declara no completo, no recuperado (§62)."
        : "Recuperado solo se declara con verificacion (§62)."),
  ];

  return baseResult(snapshot, {
    block: "8.12",
    stage: "ROLLBACK_RECOVERY",
    block_decision: blockDecision,
    decision:
      blockDecision === "NOT_NEEDED" || blockDecision === "RECOVERED" ? "COMPLETED"
        : blockDecision === "PREPARED" ? "READY"
          : blockDecision === "RECOVERY_IN_PROGRESS" ? "WAITING"
            : "BLOCKED",
    why:
      blockDecision === "NOT_NEEDED" ? "El plan no cambia nada: no hay nada que deshacer."
        : blockDecision === "PREPARED" ? "Recovery preparado antes de ejecutar: estado previo conocido y camino de vuelta para cada cambio."
          : blockDecision === "UNPREPARED" ? "Si esto sale mal no se sabra volver: falta estado previo o plan para lo irreversible."
            : blockDecision === "RECOVERY_REQUIRED" ? `La ejecucion quedo en ${state}: estrategia ${strategy}.`
              : blockDecision === "RECOVERY_IN_PROGRESS" ? `Recovery en curso (${state}).`
                : blockDecision === "RECOVERY_NOT_COMPLETE" ? "Se deshizo, pero sin verificacion que lo confirme: el recovery no esta completo."
                  : "Recuperado y verificado.",
    checks,
    next_actions:
      strategy === "CONTAIN" ? ["contener", "leer el estado real antes de elegir entre rollback y roll forward"]
        : strategy === "ROLLBACK" ? [`deshacer en orden inverso: ${[...mutations].reverse().map((a) => a.id).join(" -> ")}`, "verificar cada paso"]
          : strategy === "ROLL_FORWARD" ? ["reparar hacia un estado bueno nuevo; el anterior no se conoce o no conviene"]
            : strategy === "COMPENSATE" ? ["compensar el efecto de negocio que no se deshace"]
              : blockDecision === "UNPREPARED" ? ["capturar el estado previo", "definir rollback o compensacion para lo irreversible"]
                : [],
    payload: {
      actions,
      strategy,
      rollback_order: [...mutations].reverse().map((a) => a.id),
      restore_capability: restoreCapability,
      recovery_complete: recoveryComplete,
    },
  });
}
