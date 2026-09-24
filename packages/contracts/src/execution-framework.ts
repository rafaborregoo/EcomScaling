/**
 * F8.00 — Flujo universal de ejecucion supervisada.
 *
 * La regla que manda (runtime §1): "una recomendacion no puede saltar
 * directamente al paso de ejecucion". El bloque recorre la secuencia de quince
 * pasos y dice hasta donde llego la intervencion con evidencia, que paso falta
 * y si algun paso posterior existe sin el anterior -- eso es la secuencia rota,
 * lo peor que puede pasar, porque significa que algo se hizo sin la base que lo
 * justificaba.
 *
 * Tambien vigila el context drift (§3): una aprobacion anterior al plan vigente
 * aprobo otra cosa. No se reaprovecha.
 */

import {
  baseResult,
  check,
  executionEverStarted,
  isExecutionActive,
  type BlockCheck,
  type ExecutionSnapshot,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

/** Lifecycle conceptual del runtime §16. */
export const FRAMEWORK_STAGES = [
  "PROPOSED",
  "EVALUATED",
  "AUTHORIZED",
  "READY",
  "EXECUTING",
  "COMPLETED",
] as const;

export const FRAMEWORK_DECISIONS = [
  ...FRAMEWORK_STAGES,
  "SEQUENCE_BROKEN",
  "BLOCKED",
] as const;
export type FrameworkDecision = (typeof FRAMEWORK_DECISIONS)[number];

export type FrameworkPayload = {
  /** Cada paso de la secuencia con evidencia o sin ella. */
  sequence: { step: string; present: boolean }[];
  reached_stage: (typeof FRAMEWORK_STAGES)[number];
  missing_step: string | null;
  skipped_steps: string[];
  context_drift: boolean;
  safe_state: "NOT_STARTED" | "PAUSE" | "BLOCK_NEXT_ACTION" | "ESCALATE" | "NONE";
};

const APPROVED_STATES = ["APPROVED", "CONDITIONALLY_APPROVED", "NOT_REQUIRED"];
const READY_DECISIONS = ["READY", "READY_WITH_CONDITIONS", "PARTIALLY_READY"];

export function evaluateExecutionFramework(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<FrameworkDecision, FrameworkPayload> {
  const { plan, readiness, envelope, approval, lifecycle, closure } = snapshot;
  const started = executionEverStarted(snapshot);
  const approved = approval != null && APPROVED_STATES.includes(approval.approval_state);

  // Pasos con evidencia en la foto. Los del final (verificar, cerrar) solo
  // cuentan si ocurrieron; antes de ejecutar no "faltan", no tocan todavia.
  const sequence = [
    { step: "recomendacion", present: plan != null },
    { step: "intencion_y_plan", present: plan != null && plan.actions.length > 0 },
    { step: "autorizacion", present: approved },
    { step: "readiness", present: readiness != null && READY_DECISIONS.includes(readiness.decision) },
    { step: "action_envelope", present: envelope != null && ["INSIDE", "INSIDE_WITH_CONDITIONS"].includes(envelope.zone) },
    { step: "ejecucion", present: started },
    { step: "verificacion", present: closure != null && ["VERIFIED", "PARTIALLY_VERIFIED"].includes(closure.verification_status) },
    { step: "cierre", present: closure != null && closure.closure_state === "CLOSED" },
  ];

  // Secuencia rota: un paso presente con uno anterior ausente. Solo importa
  // desde la ejecucion: un readiness evaluado sin aprobacion es normal (se
  // evalua en paralelo), una ejecucion sin aprobacion no.
  const ejecucionIdx = sequence.findIndex((s) => s.step === "ejecucion");
  const skipped = started
    ? sequence.slice(0, ejecucionIdx).filter((s) => !s.present).map((s) => s.step)
    : [];

  const firstMissing = sequence.slice(0, ejecucionIdx).find((s) => !s.present)?.step ?? null;

  // §3: una aprobacion anterior no basta si el contexto material cambio. Las
  // tres senales que lo dicen ya existen: readiness caducado, readiness que
  // pide revalidar y aprobacion que 8.02 marca como STALE.
  const contextDrift = Boolean(
    readiness?.stale ||
      readiness?.revalidate_required ||
      approval?.approval_freshness === "STALE",
  );

  const reached: (typeof FRAMEWORK_STAGES)[number] =
    closure?.closure_state === "CLOSED" || lifecycle?.state === "CLOSED"
      ? "COMPLETED"
      : started
        ? "EXECUTING"
        : sequence.slice(0, ejecucionIdx).every((s) => s.present)
          ? "READY"
          : approved
            ? "AUTHORIZED"
            : plan
              ? "EVALUATED"
              : "PROPOSED";

  const checks: BlockCheck[] = [
    check("plan_exists", plan ? "PASS" : "FAIL", true, plan ? `Plan ${plan.id} v${plan.version}.` : "No hay plan de ejecucion: no hay nada que supervisar."),
    check(
      "no_skipped_steps",
      skipped.length ? "FAIL" : "PASS",
      true,
      skipped.length
        ? `Hubo ejecucion sin: ${skipped.join(", ")}. La secuencia no admite saltos (runtime §1).`
        : "Ningun paso posterior existe sin el anterior.",
    ),
    check(
      "context_current",
      contextDrift ? "FAIL" : readiness ? "PASS" : "UNKNOWN",
      true,
      contextDrift
        ? "El contexto cambio desde la aprobacion o el readiness esta caducado: hay que revalidar antes de la siguiente accion (runtime §3)."
        : readiness
          ? "Readiness vigente y sin revalidacion pendiente."
          : "Sin readiness no se puede saber si el contexto sigue siendo el aprobado.",
    ),
    check(
      "execution_never_authorized_here",
      "PASS",
      true,
      "Este bloque no concede autoridad: execution_authorized sigue en false.",
    ),
    check(
      "lifecycle_consistent",
      lifecycle && lifecycle.inconsistencies.length ? "FAIL" : "PASS",
      false,
      lifecycle?.inconsistencies.length
        ? `El lifecycle reporta incoherencias: ${lifecycle.inconsistencies.join(", ")}.`
        : "Sin incoherencias en el lifecycle.",
    ),
  ];

  const safeState: FrameworkPayload["safe_state"] = skipped.length
    ? "ESCALATE"
    : contextDrift && isExecutionActive(snapshot)
      ? "PAUSE"
      : contextDrift
        ? "BLOCK_NEXT_ACTION"
        : !started && firstMissing
          ? "NOT_STARTED"
          : "NONE";

  const blockDecision: FrameworkDecision = skipped.length
    ? "SEQUENCE_BROKEN"
    : contextDrift || !plan
      ? "BLOCKED"
      : reached;

  const decision =
    blockDecision === "SEQUENCE_BROKEN" || blockDecision === "BLOCKED"
      ? "BLOCKED"
      : blockDecision === "COMPLETED"
        ? "COMPLETED"
        : blockDecision === "READY" || blockDecision === "EXECUTING"
          ? "READY"
          : "WAITING";

  const why =
    blockDecision === "SEQUENCE_BROKEN"
      ? `La intervencion se ejecuto saltandose ${skipped.join(", ")}.`
      : !plan
        ? "No hay plan: una recomendacion no pasa a ejecucion sin intencion y plan."
        : contextDrift
          ? "El contexto ya no es el que se aprobo."
          : firstMissing && !started
            ? `La intervencion esta en ${reached}: falta ${firstMissing} antes de poder ejecutar.`
            : `La intervencion esta en ${reached} con todos los pasos previos cubiertos.`;

  return baseResult(snapshot, {
    block: "8.00",
    stage: "UNIVERSAL",
    block_decision: blockDecision,
    decision,
    why,
    checks,
    next_actions: skipped.length
      ? ["escalar", "reconstruir la secuencia antes de la siguiente accion"]
      : contextDrift
        ? ["revalidar readiness y aprobacion"]
        : firstMissing && !started
          ? [`completar ${firstMissing}`]
          : ["supervisar", "verificar el estado resultante"],
    payload: {
      sequence,
      reached_stage: reached,
      missing_step: started ? null : firstMissing,
      skipped_steps: skipped,
      context_drift: contextDrift,
      safe_state: safeState,
    },
  });
}
