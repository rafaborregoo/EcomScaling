import { z } from "zod";

/**
 * F8.10 - lifecycle state machine.
 *
 * Authoritative state of an intervention, and the only place that decides
 * which commands and transitions are valid. Pure and deterministic: it reads
 * a current state plus a command and answers what happens, never performing
 * the transition itself.
 */

export const LIFECYCLE_STATES = [
  // Core flow.
  "PROPOSED", "PLANNING", "WAITING_APPROVAL", "READY", "SCHEDULED", "RUNNING",
  "MONITORING", "COMPLETED", "VERIFYING", "VERIFIED", "CLOSING", "CLOSED",
  // Controlled branches.
  "HOLD", "PAUSING", "PAUSED", "BLOCKED", "DEGRADED", "RETRYING", "FAILED",
  "ESCALATED", "REPLANNING", "ROLLING_BACK", "COMPENSATING", "RECOVERING",
  "ABORTING", "ABORTED",
  // Verification and revalidation branches.
  "VERIFICATION_FAILED", "REPAIRING", "REVALIDATION_REQUIRED", "EXPIRED",
  "OUTCOME_MONITORING", "HANDOFF_PENDING", "UNKNOWN",
] as const;
export type LifecycleState = (typeof LIFECYCLE_STATES)[number];

export const LIFECYCLE_COMMANDS = [
  "PLAN", "REJECT", "CANCEL", "REQUEST_APPROVAL", "APPROVE", "REVOKE_APPROVAL",
  "SCHEDULE", "START", "EXECUTE_STEP", "MONITOR", "HOLD", "PAUSE",
  "CONFIRM_STOPPED", "RESUME", "DEGRADE", "ESCALATE", "BLOCK", "UNBLOCK",
  "RETRY", "REPLAN", "ABORT", "CONFIRM_ABORTED", "ROLLBACK", "COMPENSATE",
  "RECOVER", "COMPLETE", "VERIFY", "CONFIRM_VERIFIED", "FAIL_VERIFICATION",
  "REPAIR", "CLOSE", "CONFIRM_CLOSED", "EXPIRE", "REVALIDATE",
  "REQUEST_HANDOFF", "ACCEPT_HANDOFF",
] as const;
export type LifecycleCommand = (typeof LIFECYCLE_COMMANDS)[number];

/** States in which no material write may happen, whatever else is true. */
export const NO_WRITE_STATES: readonly LifecycleState[] = [
  "PROPOSED", "PLANNING", "WAITING_APPROVAL", "READY", "SCHEDULED", "HOLD",
  "PAUSING", "PAUSED", "BLOCKED", "ESCALATED", "REPLANNING", "FAILED",
  "COMPLETED", "VERIFYING", "VERIFIED", "VERIFICATION_FAILED", "CLOSING",
  "CLOSED", "ABORTING", "ABORTED", "EXPIRED", "REVALIDATION_REQUIRED",
  "OUTCOME_MONITORING", "HANDOFF_PENDING", "UNKNOWN",
];

/** Terminal states. A delayed event must never revive one (spec 42). */
export const TERMINAL_STATES: readonly LifecycleState[] = ["CLOSED", "ABORTED"];

/** Commands each state accepts, before guards are evaluated. */
const ALLOWED: Record<LifecycleState, readonly LifecycleCommand[]> = {
  PROPOSED: ["PLAN", "REJECT", "CANCEL"],
  PLANNING: ["REQUEST_APPROVAL", "REPLAN", "CANCEL", "BLOCK"],
  WAITING_APPROVAL: ["APPROVE", "REJECT", "CANCEL", "EXPIRE", "ESCALATE"],
  READY: ["START", "SCHEDULE", "CANCEL", "REVALIDATE", "EXPIRE", "BLOCK", "REVOKE_APPROVAL"],
  SCHEDULED: ["START", "CANCEL", "REVALIDATE", "EXPIRE", "HOLD", "BLOCK"],
  RUNNING: [
    "EXECUTE_STEP", "MONITOR", "HOLD", "PAUSE", "DEGRADE", "ESCALATE", "BLOCK",
    "REPLAN", "ABORT", "ROLLBACK", "COMPLETE", "REVOKE_APPROVAL", "REQUEST_HANDOFF",
  ],
  MONITORING: ["EXECUTE_STEP", "MONITOR", "HOLD", "PAUSE", "ESCALATE", "COMPLETE", "ABORT", "REPLAN"],
  HOLD: ["RESUME", "REPLAN", "ESCALATE", "ABORT", "MONITOR"],
  PAUSING: ["CONFIRM_STOPPED", "ESCALATE", "ABORT"],
  PAUSED: ["RESUME", "REPLAN", "ABORT", "ESCALATE", "MONITOR", "REVALIDATE"],
  BLOCKED: ["UNBLOCK", "ESCALATE", "ABORT", "REPLAN", "CANCEL"],
  DEGRADED: ["EXECUTE_STEP", "MONITOR", "PAUSE", "ESCALATE", "ABORT", "RECOVER", "COMPLETE"],
  RETRYING: ["EXECUTE_STEP", "ESCALATE", "ABORT", "PAUSE"],
  FAILED: ["RETRY", "ROLLBACK", "COMPENSATE", "ESCALATE", "RECOVER", "ABORT", "REPLAN"],
  ESCALATED: ["RESUME", "ABORT", "REPLAN", "ACCEPT_HANDOFF", "REQUEST_HANDOFF", "MONITOR"],
  REPLANNING: ["REQUEST_APPROVAL", "CANCEL", "ABORT", "ESCALATE"],
  ROLLING_BACK: ["EXECUTE_STEP", "MONITOR", "VERIFY", "ESCALATE", "ABORT"],
  COMPENSATING: ["EXECUTE_STEP", "MONITOR", "VERIFY", "ESCALATE", "ABORT"],
  RECOVERING: ["EXECUTE_STEP", "MONITOR", "RESUME", "ESCALATE", "ABORT"],
  ABORTING: ["CONFIRM_ABORTED", "ESCALATE"],
  ABORTED: [],
  COMPLETED: ["VERIFY"],
  VERIFYING: ["CONFIRM_VERIFIED", "FAIL_VERIFICATION", "ESCALATE"],
  VERIFIED: ["MONITOR", "CLOSE"],
  VERIFICATION_FAILED: ["REPAIR", "ROLLBACK", "ESCALATE", "ABORT"],
  REPAIRING: ["EXECUTE_STEP", "VERIFY", "ESCALATE", "ABORT"],
  OUTCOME_MONITORING: ["MONITOR", "CLOSE", "ESCALATE"],
  CLOSING: ["CONFIRM_CLOSED", "ESCALATE"],
  CLOSED: [],
  REVALIDATION_REQUIRED: ["REVALIDATE", "REPLAN", "CANCEL", "ABORT"],
  EXPIRED: ["REVALIDATE", "REPLAN", "CANCEL"],
  HANDOFF_PENDING: ["ACCEPT_HANDOFF", "ESCALATE", "ABORT"],
  UNKNOWN: ["REVALIDATE", "ESCALATE", "ABORT"],
};

/** Where each command lands when its guard passes. */
const DESTINATION: Partial<Record<LifecycleCommand, LifecycleState>> = {
  PLAN: "PLANNING", REQUEST_APPROVAL: "WAITING_APPROVAL", APPROVE: "READY",
  SCHEDULE: "SCHEDULED", START: "RUNNING", MONITOR: "MONITORING", HOLD: "HOLD",
  PAUSE: "PAUSING", CONFIRM_STOPPED: "PAUSED", DEGRADE: "DEGRADED",
  ESCALATE: "ESCALATED", BLOCK: "BLOCKED", UNBLOCK: "REVALIDATION_REQUIRED",
  RETRY: "RETRYING", REPLAN: "REPLANNING", ABORT: "ABORTING",
  CONFIRM_ABORTED: "ABORTED", ROLLBACK: "ROLLING_BACK", COMPENSATE: "COMPENSATING",
  RECOVER: "RECOVERING", COMPLETE: "COMPLETED", VERIFY: "VERIFYING",
  CONFIRM_VERIFIED: "VERIFIED", FAIL_VERIFICATION: "VERIFICATION_FAILED",
  REPAIR: "REPAIRING", CLOSE: "CLOSING", CONFIRM_CLOSED: "CLOSED",
  EXPIRE: "EXPIRED", REVOKE_APPROVAL: "PAUSING", REJECT: "ABORTED",
  CANCEL: "ABORTING", REQUEST_HANDOFF: "HANDOFF_PENDING", RESUME: "RUNNING",
  // Accepting a handoff never resumes straight into work: the new owner
  // revalidates first, so there is no control vacuum (spec 46).
  ACCEPT_HANDOFF: "REVALIDATION_REQUIRED",
};

/** Commands that do work inside the current state without leaving it. */
const SELF_TRANSITION: readonly LifecycleCommand[] = ["EXECUTE_STEP"];

export const lifecycleContextSchema = z.object({
  organization_id: z.string().min(1),
  intervention_id: z.string().min(1),
  current_state: z.enum(LIFECYCLE_STATES),
  /** Actor issuing the command and whether they may act on this intervention. */
  actor_id: z.string().min(1),
  actor_authorized: z.boolean(),
  /** Approval validity, checked by the WAITING_APPROVAL -> READY guard. */
  approval_valid: z.boolean(),
  readiness_revalidated: z.boolean(),
  authority_valid: z.boolean(),
  /** False when the real state could not be established (spec 15, 44). */
  state_known: z.boolean(),
  blocking_reason_resolved: z.boolean(),
  plan_version: z.number().int().nonnegative(),
  /** Plan version the command was issued against; a mismatch is stale (spec 5). */
  command_plan_version: z.number().int().nonnegative(),
  /** Event time, compared with the last applied one (spec 43). */
  event_at: z.string().min(1),
  last_event_at: z.string().min(1).nullable(),
  /** Child actions, for completion calculation (spec 32, 33). */
  required_children_terminal: z.boolean(),
  critical_children_unresolved: z.boolean(),
  /** Closure gate inputs (spec 48). */
  active_actions: z.number().int().nonnegative(),
  unknown_critical_actions: z.number().int().nonnegative(),
  unresolved_recovery: z.boolean(),
  handoff_complete: z.boolean(),
  /** Retry eligibility (spec 16). */
  retry_eligible: z.boolean(),
  duplicate_execution_detected: z.boolean(),
  guardrails_clear: z.boolean(),
  /** True while the runtime still observes writes in flight (spec 30). */
  execution_actually_stopped: z.boolean(),
});
export type LifecycleContext = z.input<typeof lifecycleContextSchema>;

export const lifecycleDecisions = ["ACCEPTED", "REJECTED", "NO_OP", "STALE"] as const;
export type LifecycleDecision = (typeof lifecycleDecisions)[number];

export type LifecycleTransition = {
  decision: LifecycleDecision;
  from: LifecycleState;
  /** Where the machine lands. Equals `from` unless the decision is ACCEPTED. */
  to: LifecycleState;
  command: LifecycleCommand;
  reasons: string[];
  blocking_condition: string | null;
  /** True when this command would authorize a material write. */
  material_write_allowed: boolean;
  deterministic: true;
};

const reject = (
  context: z.output<typeof lifecycleContextSchema>,
  command: LifecycleCommand,
  reason: string,
  decision: LifecycleDecision = "REJECTED",
): LifecycleTransition => ({
  decision,
  from: context.current_state,
  to: context.current_state,
  command,
  reasons: [reason],
  blocking_condition: decision === "REJECTED" ? reason : null,
  material_write_allowed: false,
  deterministic: true,
});

/** Guards that must hold before a specific command is accepted (spec 29). */
function guardFailure(
  context: z.output<typeof lifecycleContextSchema>,
  command: LifecycleCommand,
): string | null {
  switch (command) {
    case "APPROVE":
      return context.approval_valid ? null : "La aprobacion no es valida; WAITING_APPROVAL no pasa a READY.";
    case "START":
      if (!context.approval_valid) return "No se arranca sin aprobacion valida.";
      if (!context.readiness_revalidated) return "Hay que revalidar readiness antes de RUNNING.";
      if (!context.authority_valid) return "La autoridad no es valida.";
      if (!context.state_known) return "El estado real no se conoce; no se arranca a ciegas.";
      return null;
    case "RESUME":
      if (!context.blocking_reason_resolved) return "El motivo de la pausa sigue sin resolverse.";
      if (!context.readiness_revalidated) return "Reanudar exige revalidar readiness.";
      if (!context.authority_valid) return "La autoridad ya no es valida.";
      if (!context.state_known) return "El estado real no se conoce.";
      return null;
    case "UNBLOCK":
      return context.blocking_reason_resolved ? null : "La dependencia bloqueante sigue abierta.";
    case "RETRY":
      if (!context.retry_eligible) return "La accion no es elegible para reintento.";
      if (context.duplicate_execution_detected) return "Hay evidencia de ejecucion duplicada; no se reintenta.";
      if (!context.guardrails_clear) return "Hay guardrails activos; no se reintenta.";
      return null;
    case "COMPLETE":
      if (!context.required_children_terminal) return "Quedan pasos requeridos sin terminar.";
      if (context.critical_children_unresolved) return "Hay trabajo critico pendiente.";
      return null;
    case "CONFIRM_STOPPED":
      return context.execution_actually_stopped
        ? null
        : "No se marca PAUSED hasta que la ejecucion haya parado de verdad.";
    case "CONFIRM_ABORTED":
      return context.active_actions === 0 ? null : "Quedan acciones activas; ABORTING no confirma.";
    case "CONFIRM_CLOSED":
      if (context.active_actions > 0) return "Quedan acciones activas.";
      if (context.unknown_critical_actions > 0) return "Hay acciones criticas en estado desconocido.";
      if (context.unresolved_recovery) return "Hay recuperacion sin resolver.";
      if (!context.state_known) return "El estado final no se conoce.";
      if (!context.handoff_complete) return "El handoff no esta completo.";
      return null;
    case "EXECUTE_STEP":
      if (!context.state_known) return "El estado real no se conoce; no se ejecuta.";
      if (!context.guardrails_clear) return "Hay guardrails activos.";
      if (!context.authority_valid) return "La autoridad no es valida.";
      return null;
    case "REVALIDATE":
      return context.readiness_revalidated && context.authority_valid && context.state_known
        ? null
        : "La revalidacion no reune readiness, autoridad y estado conocido.";
    default:
      return null;
  }
}

/**
 * A revalidated intervention always lands back in READY: revalidation proves
 * it may start again, never that it is already running.
 */
const REVALIDATE_DESTINATION: LifecycleState = "READY";

function destinationOf(state: LifecycleState, command: LifecycleCommand): LifecycleState | undefined {
  if (command === "REVALIDATE") return REVALIDATE_DESTINATION;
  if (SELF_TRANSITION.includes(command)) return state;
  return DESTINATION[command];
}

export function evaluateLifecycleCommand(
  raw: LifecycleContext,
  command: LifecycleCommand,
): LifecycleTransition {
  const parsed = lifecycleContextSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      decision: "REJECTED",
      from: "UNKNOWN",
      to: "UNKNOWN",
      command,
      reasons: ["input_schema"],
      blocking_condition: "input_schema",
      material_write_allowed: false,
      deterministic: true,
    };
  }
  const context = parsed.data;
  const state = context.current_state;

  // 42. A delayed event must never revive closed or aborted work.
  if (TERMINAL_STATES.includes(state)) {
    return reject(context, command, `${state} es terminal: no acepta comandos ni eventos posteriores.`, "STALE");
  }

  // 43. Out-of-order events are judged by event time against the last applied one.
  if (context.last_event_at && context.event_at < context.last_event_at) {
    return reject(context, command, "El evento llega fuera de orden y es anterior al ultimo aplicado.", "STALE");
  }

  // 5. Plan freshness: a command issued against an older plan is stale.
  if (context.command_plan_version !== context.plan_version) {
    return reject(
      context,
      command,
      `El comando se emitio contra la version de plan ${context.command_plan_version} y la vigente es ${context.plan_version}.`,
      "STALE",
    );
  }

  // 4. Actor authority.
  if (!context.actor_authorized) {
    return reject(context, command, `El actor ${context.actor_id} no tiene autoridad sobre esta intervencion.`);
  }

  const destination = destinationOf(state, command);

  // 41. Repeated commands are idempotent where possible. A self-transition is
  // real work inside the state, not a repeat, so it is excluded.
  if (destination && destination === state && !SELF_TRANSITION.includes(command)) {
    return {
      decision: "NO_OP",
      from: state,
      to: state,
      command,
      reasons: [`Ya esta en ${state}; el comando repetido no cambia nada.`],
      blocking_condition: null,
      material_write_allowed: false,
      deterministic: true,
    };
  }

  // 40. State-based permissions, checked before every material action.
  if (!ALLOWED[state].includes(command)) {
    return reject(context, command, `${state} no admite ${command}.`);
  }

  const failure = guardFailure(context, command);
  if (failure) return reject(context, command, failure);

  if (!destination) {
    return reject(context, command, `${command} no define transicion de destino.`);
  }

  // 3, 4, 5, 28. Material writes never happen from a no-write state.
  const materialWrite = command === "EXECUTE_STEP" && !NO_WRITE_STATES.includes(state);

  return {
    decision: "ACCEPTED",
    from: state,
    to: destination,
    command,
    reasons: [],
    blocking_condition: null,
    material_write_allowed: materialWrite,
    deterministic: true,
  };
}

export type LifecycleView = {
  state: LifecycleState;
  why: string;
  allowed_commands: LifecycleCommand[];
  prohibited_commands: LifecycleCommand[];
  blocking_conditions: string[];
  next_states: LifecycleState[];
  material_write_allowed: boolean;
  /** Spec 49: a state that cannot coexist with what the runtime observes. */
  inconsistencies: string[];
};

const WHY: Partial<Record<LifecycleState, string>> = {
  PROPOSED: "La intervencion existe como propuesta; todavia no hay plan.",
  WAITING_APPROVAL: "El plan espera una decision humana.",
  READY: "Aprobada y lista; falta arrancar o programar.",
  RUNNING: "Ejecutando pasos del plan bajo supervision.",
  PAUSING: "Se pidio pausar; no se marca PAUSED hasta confirmar que paro de verdad.",
  PAUSED: "Detenida sin escrituras nuevas; reanudar exige revalidar.",
  BLOCKED: "Una dependencia externa impide avanzar.",
  UNKNOWN: "El estado real no se pudo establecer; no se escribe hasta verificarlo.",
  CLOSED: "Estado operativo terminal; el trabajo nuevo es otra intervencion enlazada.",
};

/** Spec 50: what the runtime must be able to answer at any moment. */
export function describeLifecycleState(raw: LifecycleContext): LifecycleView {
  const parsed = lifecycleContextSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      state: "UNKNOWN", why: "Contexto de lifecycle invalido.", allowed_commands: [],
      prohibited_commands: [...LIFECYCLE_COMMANDS], blocking_conditions: ["input_schema"],
      next_states: [], material_write_allowed: false, inconsistencies: ["input_schema"],
    };
  }
  const context = parsed.data;
  const state = context.current_state;
  const allowed: LifecycleCommand[] = [];
  const blocking: string[] = [];

  for (const command of ALLOWED[state]) {
    const failure = guardFailure(context, command);
    if (failure) blocking.push(`${command}: ${failure}`);
    else allowed.push(command);
  }

  const inconsistencies: string[] = [];
  // 49. Impossible state detection.
  if (TERMINAL_STATES.includes(state) && context.active_actions > 0) {
    inconsistencies.push(`${state} con ${context.active_actions} acciones activas.`);
  }
  if (NO_WRITE_STATES.includes(state) && context.active_actions > 0 && state !== "PAUSING" && state !== "ABORTING") {
    inconsistencies.push(`${state} no admite escrituras y hay acciones activas.`);
  }
  if (!context.state_known && state !== "UNKNOWN" && context.active_actions > 0) {
    inconsistencies.push("Hay acciones activas y el estado real no se conoce.");
  }

  return {
    state,
    why: WHY[state] ?? `Estado ${state}.`,
    allowed_commands: allowed,
    prohibited_commands: LIFECYCLE_COMMANDS.filter((command) => !allowed.includes(command)),
    blocking_conditions: blocking,
    next_states: [
      ...new Set(
        allowed
          .map((command) => destinationOf(state, command))
          .filter((next): next is LifecycleState => Boolean(next) && next !== state),
      ),
    ],
    material_write_allowed: !NO_WRITE_STATES.includes(state) && context.guardrails_clear && context.state_known,
    inconsistencies,
  };
}
