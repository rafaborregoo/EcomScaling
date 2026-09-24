/**
 * F8.14 — Concurrencia y coordinacion de intervenciones.
 *
 * Antes de actuar hay que saber que mas esta tocando lo mismo (§1). Dos
 * intervenciones sobre el mismo objeto no solo pueden pisarse: hacen imposible
 * atribuir el resultado despues (runtime 8.00 §14), que es el dano silencioso.
 *
 * La decision de admision (§23):
 *   ADMIT      nadie mas toca estos objetos
 *   COORDINATE hay solape con intervenciones planeadas: secuenciarlas o
 *              fusionarlas antes de ejecutar ninguna (§26-28)
 *   QUEUE      otra intervencion esta ESCRIBIENDO sobre el mismo objeto:
 *              single writer (§22), esta espera su turno
 *   DUPLICATE  otra intervencion ya persigue exactamente los mismos objetos
 *              (§29): no se ejecuta dos veces lo mismo
 *
 * Solo cuentan las intervenciones abiertas: una cerrada o abortada ya no
 * compite por nada.
 */

import {
  ACTIVE_EXECUTION_STATES,
  baseResult,
  check,
  mutatingActions,
  type ExecutionSnapshot,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const ADMISSION_DECISIONS = ["ADMIT", "COORDINATE", "QUEUE", "DUPLICATE"] as const;
export type AdmissionDecision = (typeof ADMISSION_DECISIONS)[number];

export type InterventionOverlap = {
  plan_id: string;
  shared_targets: string[];
  other_state: string | null;
  interaction: "write_conflict" | "planned_overlap" | "duplicate";
};

export type ConcurrencyPayload = {
  own_targets: string[];
  overlaps: InterventionOverlap[];
  admission: AdmissionDecision;
  single_writer_respected: boolean;
};

const CLOSED_STATES = ["CLOSED", "ABORTED", "EXPIRED"];

export function evaluateExecutionConcurrency(
  snapshot: ExecutionSnapshot,
): SupervisionBlockResult<AdmissionDecision, ConcurrencyPayload> {
  // Solo compiten los objetos que se van a cambiar: dos lecturas del mismo
  // objeto no se pisan.
  const ownTargets = [...new Set(mutatingActions(snapshot.plan).map((a) => a.target))];

  const overlaps: InterventionOverlap[] = snapshot.other_interventions
    .filter((o) => o.plan_id !== snapshot.plan?.id && !CLOSED_STATES.includes(o.state ?? ""))
    .map((o) => {
      const shared = o.targets.filter((t) => ownTargets.includes(t));
      const sameSet = shared.length > 0 && shared.length === ownTargets.length && o.targets.length === ownTargets.length;
      const writing = (ACTIVE_EXECUTION_STATES as readonly string[]).includes(o.state ?? "");
      return {
        plan_id: o.plan_id,
        shared_targets: shared,
        other_state: o.state,
        interaction: (writing ? "write_conflict" : sameSet ? "duplicate" : "planned_overlap") as InterventionOverlap["interaction"],
      };
    })
    .filter((o) => o.shared_targets.length > 0);

  const admission: AdmissionDecision = overlaps.some((o) => o.interaction === "write_conflict")
    ? "QUEUE"
    : overlaps.some((o) => o.interaction === "duplicate")
      ? "DUPLICATE"
      : overlaps.length
        ? "COORDINATE"
        : "ADMIT";

  const writers = overlaps.filter((o) => o.interaction === "write_conflict");

  const checks = [
    check("active_intervention_awareness", "PASS", true,
      `${snapshot.other_interventions.length} otra(s) intervencion(es) revisada(s) en la organizacion.`),
    check("single_writer", writers.length ? "FAIL" : "PASS", true,
      writers.length
        ? `Otra intervencion esta escribiendo sobre ${writers.flatMap((w) => w.shared_targets).join(", ")}.`
        : "Nadie mas esta escribiendo sobre estos objetos."),
    check("no_duplicate", overlaps.some((o) => o.interaction === "duplicate") ? "FAIL" : "PASS", true,
      "No se ejecuta dos veces la misma intervencion."),
    check("attribution_preserved", overlaps.length ? "FAIL" : "PASS", false,
      overlaps.length ? "Con intervenciones solapadas el resultado no se podra atribuir a una sola." : "El resultado sera atribuible."),
  ];

  return baseResult(snapshot, {
    block: "8.14",
    stage: "CONCURRENCY",
    block_decision: admission,
    decision: admission === "ADMIT" ? "READY" : admission === "COORDINATE" ? "CONDITIONAL" : admission === "QUEUE" ? "WAITING" : "BLOCKED",
    why:
      admission === "ADMIT"
        ? ownTargets.length ? "Ninguna otra intervencion toca estos objetos." : "El plan no cambia objetos: no compite con nadie."
        : admission === "QUEUE"
          ? `Espera: ${writers.map((w) => w.plan_id).join(", ")} esta escribiendo sobre los mismos objetos.`
          : admission === "DUPLICATE"
            ? `Duplica a ${overlaps.filter((o) => o.interaction === "duplicate").map((o) => o.plan_id).join(", ")}.`
            : `Solapa con ${overlaps.map((o) => o.plan_id).join(", ")} en ${[...new Set(overlaps.flatMap((o) => o.shared_targets))].join(", ")}: secuenciar o fusionar antes de ejecutar.`,
    checks,
    next_actions:
      admission === "QUEUE" ? ["esperar a que termine la otra intervencion y revalidar"]
        : admission === "DUPLICATE" ? ["descartar o supersedear una de las dos"]
          : admission === "COORDINATE" ? ["decidir orden o fusion con el consultor"]
            : [],
    payload: {
      own_targets: ownTargets,
      overlaps,
      admission,
      single_writer_respected: writers.length === 0,
    },
  });
}
