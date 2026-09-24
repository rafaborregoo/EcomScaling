/**
 * F8.13 — Human override y escalado.
 *
 * Tres cosas, en este orden de importancia:
 *
 * 1. ¿Hace falta una persona? (§1) La piden 8.02 (escalation_required,
 *    HUMAN_ONLY), un resultado desconocido o fallido, o una autorizacion que
 *    ya no vale. Cada motivo va con su nombre: "escala" a secas no se puede
 *    atender.
 * 2. ¿A quien, con que urgencia y que se hace mientras? (§3, §7, §9) Mientras
 *    se espera, lo que estaba en marcha se para; nada avanza "por si acaso".
 * 3. ¿Que puede hacer esa persona AHORA? (§21-22) Los overrides disponibles no
 *    se inventan: son los comandos que la maquina de estados de 8.10 admite en
 *    el estado actual. Si no hay forma de parar (§34, emergency stop), se dice.
 *
 * Y la regla que evita el peor fallo del bloque (§33, control vacuum): una
 * escalada sin destino no es una escalada, es una intervencion que nadie
 * controla.
 */

import {
  baseResult,
  check,
  isExecutionActive,
  type ExecutionSnapshot,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const ESCALATION_DECISIONS = [
  "NO_ESCALATION",
  "ESCALATION_RECOMMENDED",
  "ESCALATION_REQUIRED",
  "HUMAN_CONTROL",
] as const;
export type EscalationDecision = (typeof ESCALATION_DECISIONS)[number];

export type EscalationUrgency = "routine" | "soon" | "immediate";

/** Comandos de 8.10 que son overrides humanos (§22). */
export const OVERRIDE_COMMANDS = ["PAUSE", "HOLD", "ABORT", "ROLLBACK", "RESUME", "REPLAN", "REQUEST_HANDOFF", "ACCEPT_HANDOFF", "REVOKE_APPROVAL", "CANCEL"] as const;

export type EscalationPayload = {
  reasons: string[];
  target: string | null;
  urgency: EscalationUrgency;
  blocking: boolean;
  safe_state_while_waiting: "none" | "hold" | "pause";
  available_overrides: string[];
  emergency_stop_available: boolean;
  control_owner: "AI" | "HUMAN" | "SHARED";
};

export function evaluateOverrideEscalation(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<EscalationDecision, EscalationPayload> {
  const { approval, lifecycle } = snapshot;
  const active = isExecutionActive(snapshot);
  const state = lifecycle?.state ?? null;

  const reasons: string[] = [];
  if (approval?.escalation_required) {
    reasons.push(...(approval.escalation_reasons.length ? approval.escalation_reasons : ["8.02 pide escalar"]));
  }
  if (approval?.disposition === "HUMAN_ONLY") reasons.push("la decision es solo humana (8.02)");
  if (state === "UNKNOWN") reasons.push("no se sabe si el cambio se aplico");
  if (state === "FAILED" || state === "VERIFICATION_FAILED") reasons.push(`la ejecucion quedo en ${state}`);
  if (active && (approval?.revocation_status === "REVOKED" || ["REVOKED", "EXPIRED"].includes(approval?.approval_state ?? ""))) {
    reasons.push("la autorizacion se revoco o expiro con la ejecucion en marcha");
  }
  if (lifecycle?.inconsistencies.length) reasons.push("el lifecycle se contradice");
  const softReasons = approval?.approval_freshness === "STALE" ? ["la aprobacion esta caducando"] : [];

  const humanOnly = approval?.disposition === "HUMAN_ONLY" || state === "ESCALATED" || state === "HANDOFF_PENDING";
  const urgent = state === "UNKNOWN" || (active && reasons.length > 0);

  const allowed = lifecycle?.allowed_commands ?? [];
  const availableOverrides = allowed.filter((c) => (OVERRIDE_COMMANDS as readonly string[]).includes(c));
  const emergencyStop = allowed.includes("ABORT") || allowed.includes("PAUSE");

  const target = approval?.escalation_target ?? approval?.required_approver_type ?? null;
  const vacuum = reasons.length > 0 && !target;

  const blockDecision: EscalationDecision = humanOnly
    ? "HUMAN_CONTROL"
    : reasons.length
      ? "ESCALATION_REQUIRED"
      : softReasons.length
        ? "ESCALATION_RECOMMENDED"
        : "NO_ESCALATION";

  const autonomy = approval?.autonomy_level ?? "";
  const controlOwner: EscalationPayload["control_owner"] = humanOnly
    ? "HUMAN"
    : ["BOUNDED_AUTONOMY", "ADAPTIVE_BOUNDED_AUTONOMY", "HIGH_AUTONOMY"].includes(autonomy)
      ? "AI"
      : "SHARED";

  const checks = [
    check("escalation_need_named", "PASS", true,
      reasons.length ? `Motivos: ${reasons.join("; ")}.` : "Nada exige una persona ahora."),
    check("no_control_vacuum", vacuum ? "FAIL" : "PASS", true,
      vacuum ? "Hay que escalar y no hay destino: nadie controlaria la intervencion (§33)." : target ? `Destino: ${target}.` : "Sin escalada no hace falta destino."),
    check("emergency_stop", !active ? "NOT_APPLICABLE" : emergencyStop ? "PASS" : "FAIL", true,
      !active ? "Sin ejecucion en marcha." : emergencyStop ? "Se puede parar desde el estado actual." : `Desde ${state} no hay forma de parar: la maquina de estados no admite PAUSE ni ABORT.`),
    check("safe_while_waiting", "PASS", true,
      reasons.length && active ? "Mientras se espera, la ejecucion se pausa." : "No hay espera en curso."),
  ];

  return baseResult(snapshot, {
    block: "8.13",
    stage: "OVERRIDE_ESCALATION",
    block_decision: blockDecision,
    decision: blockDecision === "NO_ESCALATION" ? "READY" : blockDecision === "ESCALATION_RECOMMENDED" ? "CONDITIONAL" : vacuum ? "BLOCKED" : "WAITING",
    why:
      blockDecision === "NO_ESCALATION" ? "Ninguna condicion pide una persona."
        : blockDecision === "HUMAN_CONTROL" ? `La intervencion esta en manos humanas${state ? ` (${state})` : ""}.`
          : blockDecision === "ESCALATION_RECOMMENDED" ? `Conviene avisar: ${softReasons.join("; ")}.`
            : `Hay que escalar${target ? ` a ${target}` : " y no hay destino"}: ${reasons.join("; ")}.`,
    checks,
    next_actions: vacuum
      ? ["asignar un destino de escalada antes de nada"]
      : blockDecision === "ESCALATION_REQUIRED"
        ? [`escalar a ${target}`, ...(active ? ["pausar mientras se decide"] : [])]
        : [],
    payload: {
      reasons: [...reasons, ...softReasons],
      target,
      urgency: urgent ? "immediate" : reasons.length ? "soon" : "routine",
      blocking: reasons.length > 0,
      safe_state_while_waiting: reasons.length && active ? "pause" : reasons.length ? "hold" : "none",
      available_overrides: availableOverrides,
      emergency_stop_available: emergencyStop,
      control_owner: controlOwner,
    },
  });
}
