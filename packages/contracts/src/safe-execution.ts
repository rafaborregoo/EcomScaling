/**
 * F8.07 — Ejecucion segura y control de cambios, a nivel de plan.
 *
 * `packages/integrations/src/safe-mutation.ts` es el gate de UNA mutacion
 * contra el estado vivo del proveedor, y es el unico que puede decir COMMIT.
 * Este bloque va antes: comprueba si el plan trae lo que ese gate va a pedir
 * (§14, pre-commit check) para cada accion que cambia algo:
 *
 *   - estado actual conocido: sin pre-state no hay rollback ni diff (§2, §4)
 *   - estado deseado explicito (§3) y por tanto un diff previsualizable (§15)
 *   - idempotencia (§6): la exige la tool, hay que poder construir la clave
 *   - punto de no retorno (§13): una accion irreversible exige aprobacion propia
 *   - presupuesto de cambios (§28) y alcance dentro del envelope (§5)
 *   - que exista una operacion de proveedor que la ejecute (§12, commit point)
 *
 * Sin operacion de proveedor el resultado honesto es PREPARE_ONLY: se puede
 * dejar todo listo, pero el commit lo hace una persona.
 */

import {
  baseResult,
  check,
  mutatingActions,
  type BlockCheck,
  type ExecutionSnapshot,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const SAFE_EXECUTION_DECISIONS = [
  "NO_CHANGES",
  "SAFE_TO_COMMIT",
  "PREPARE_ONLY",
  "BLOCKED_PRECOMMIT",
] as const;
export type SafeExecutionDecision = (typeof SAFE_EXECUTION_DECISIONS)[number];

export type ChangePreflight = {
  action_id: string;
  change_class: "reversible" | "irreversible";
  pre_state_known: boolean;
  desired_state_known: boolean;
  diff_previewable: boolean;
  point_of_no_return: boolean;
  missing: string[];
};

export type SafeExecutionPayload = {
  changes: ChangePreflight[];
  provider_operation_available: boolean;
  within_change_budget: boolean;
  within_envelope: boolean;
  safety_mode: "normal" | "prepare_only" | "blocked";
};

const known = (value: string | null) => Boolean(value && value.trim() && value !== "UNKNOWN");

export function evaluateSafeExecution(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<SafeExecutionDecision, SafeExecutionPayload> {
  const mutations = mutatingActions(snapshot.plan);
  const approval = snapshot.approval;
  const approvedExplicitly = ["APPROVED", "CONDITIONALLY_APPROVED"].includes(approval?.approval_state ?? "");

  const changes: ChangePreflight[] = mutations.map((action) => {
    const pre = known(action.current_state);
    const desired = known(action.desired_state);
    const noReturn = !action.reversible;
    const missing = [
      pre ? null : "estado actual (pre-state)",
      desired ? null : "estado deseado",
      noReturn && !approvedExplicitly ? "aprobacion explicita del punto de no retorno" : null,
    ].filter((m): m is string => m !== null);
    return {
      action_id: action.id,
      change_class: noReturn ? "irreversible" : "reversible",
      pre_state_known: pre,
      desired_state_known: desired,
      diff_previewable: pre && desired,
      point_of_no_return: noReturn,
      missing,
    };
  });

  const providerOperation = snapshot.capabilities.some(
    (c) => c.permission === "write" && c.status === "implemented_partial" && c.connector_connected,
  );
  const budget = snapshot.plan?.max_actions ?? null;
  const withinBudget = budget == null ? false : mutations.length <= budget;
  const withinEnvelope = ["INSIDE", "INSIDE_WITH_CONDITIONS"].includes(snapshot.envelope?.zone ?? "");
  const preflightOk = changes.every((c) => c.missing.length === 0);

  const blockDecision: SafeExecutionDecision =
    mutations.length === 0
      ? "NO_CHANGES"
      : !preflightOk || !withinEnvelope || !withinBudget
        ? "BLOCKED_PRECOMMIT"
        : providerOperation
          ? "SAFE_TO_COMMIT"
          : "PREPARE_ONLY";

  const checks: BlockCheck[] = [
    check("pre_state_snapshot", changes.every((c) => c.pre_state_known) ? "PASS" : mutations.length ? "FAIL" : "NOT_APPLICABLE", true,
      changes.some((c) => !c.pre_state_known)
        ? `Sin estado actual en: ${changes.filter((c) => !c.pre_state_known).map((c) => c.action_id).join(", ")}. Sin pre-state no hay diff ni forma de volver.`
        : "Cada cambio sabe desde que estado parte."),
    check("desired_state", changes.every((c) => c.desired_state_known) ? "PASS" : mutations.length ? "FAIL" : "NOT_APPLICABLE", true,
      "El estado deseado tiene que ser explicito para poder verificarlo despues."),
    check("point_of_no_return", changes.some((c) => c.point_of_no_return && c.missing.some((m) => m.includes("no retorno"))) ? "FAIL" : "PASS", true,
      changes.some((c) => c.point_of_no_return)
        ? "Hay cambios irreversibles: exigen aprobacion explicita antes del commit."
        : "Todos los cambios son reversibles."),
    check("change_budget", withinBudget || mutations.length === 0 ? "PASS" : budget == null ? "UNKNOWN" : "FAIL", true,
      budget == null ? "El plan no declara presupuesto de acciones." : `${mutations.length} cambio(s) para un maximo de ${budget}.`),
    check("envelope_scope", withinEnvelope || mutations.length === 0 ? "PASS" : snapshot.envelope ? "FAIL" : "UNKNOWN", true,
      withinEnvelope ? "El alcance del cambio esta dentro del envelope." : "El cambio no esta cubierto por un envelope vigente."),
    check("provider_operation", providerOperation || mutations.length === 0 ? "PASS" : "FAIL", false,
      providerOperation ? "Existe operacion de proveedor para el commit." : "Ninguna operacion de proveedor implementa el cambio: el commit es manual."),
  ];

  return baseResult(snapshot, {
    block: "8.07",
    stage: "SAFE_EXECUTION",
    block_decision: blockDecision,
    decision:
      blockDecision === "NO_CHANGES" ? "COMPLETED"
        : blockDecision === "SAFE_TO_COMMIT" ? "READY"
          : blockDecision === "PREPARE_ONLY" ? "CONDITIONAL"
            : "BLOCKED",
    why:
      blockDecision === "NO_CHANGES"
        ? "El plan solo lee: no hay cambio que controlar."
        : blockDecision === "BLOCKED_PRECOMMIT"
          ? `El pre-commit check no pasa: ${[...new Set(changes.flatMap((c) => c.missing))].join(", ") || (!withinEnvelope ? "fuera del envelope" : "presupuesto de cambios")}.`
          : blockDecision === "PREPARE_ONLY"
            ? "Todo el control previo esta en orden, pero no hay operacion de proveedor: se deja preparado para que lo aplique una persona."
            : "Pre-commit check superado y con operacion de proveedor: el gate de safe-mutation decide cada commit.",
    checks,
    next_actions:
      blockDecision === "BLOCKED_PRECOMMIT"
        ? ["completar el pre-state y el estado deseado", "aprobar explicitamente los cambios irreversibles"]
        : blockDecision === "PREPARE_ONLY"
          ? ["entregar el diff a una persona para aplicarlo", "registrar el cambio aplicado como mutacion externa"]
          : blockDecision === "SAFE_TO_COMMIT"
            ? ["pasar cada mutacion por el gate de safe-mutation"]
            : [],
    payload: {
      changes,
      provider_operation_available: providerOperation,
      within_change_budget: withinBudget,
      within_envelope: withinEnvelope,
      safety_mode: blockDecision === "SAFE_TO_COMMIT" ? "normal" : blockDecision === "BLOCKED_PRECOMMIT" ? "blocked" : "prepare_only",
    },
  });
}
