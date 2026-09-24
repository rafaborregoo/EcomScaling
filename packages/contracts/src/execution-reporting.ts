/**
 * F8.17 — Comunicacion y reporting de ejecucion.
 *
 * El informe se compone con lo que los demas bloques ya determinaron; este no
 * vuelve a decidir nada. Lo que si hace es imponer las reglas de la
 * comunicacion:
 *
 *   - no decir "hecho" de algo que no se ejecuto (§54 no-op, §51 estado
 *     desconocido): el lector entiende lo que lee, no lo que quisimos decir
 *   - separar lo confirmado de lo potencial (§18-19)
 *   - si hace falta una decision humana, pedirla con su alcance (§23-24)
 *   - explicar el limite: que NO afirma el informe (§55)
 *   - dos audiencias (§4): el consultor recibe el razonamiento; el cliente,
 *     el estado y lo que se le pide, sin checks internos ni candidatos (§64)
 *
 * Materialidad (§2): si nada cambio desde la ultima vez, no hay evento que
 * comunicar, y se dice asi en vez de mandar ruido.
 */

import {
  baseResult,
  check,
  executionEverStarted,
  type ExecutionSnapshot,
  type SupervisionBlockResult,
} from "./execution-snapshot.js";

export const REPORTING_DECISIONS = [
  "NOTHING_MATERIAL",
  "INFORMATIONAL",
  "DECISION_REQUESTED",
  "ATTENTION_REQUIRED",
] as const;
export type ReportingDecision = (typeof REPORTING_DECISIONS)[number];

export type AudienceReport = {
  audience: "consultant" | "client";
  summary: string;
  current_state: string;
  next_step: string | null;
  decision_request: string | null;
  details: string[];
};

export type ReportingPayload = {
  reports: AudienceReport[];
  not_claimed: string[];
  executed: boolean;
  material: boolean;
};

/** Frases que un informe no puede decir de algo sin ejecutar. */
const EXECUTION_CLAIMS = /\b(ejecutad[oa]|aplicad[oa]|hecho|completad[oa]|resuelt[oa])\b/i;

export function evaluateExecutionReporting(
  snapshot: ExecutionSnapshot,
  blocks: SupervisionBlockResult[],
): SupervisionBlockResult<ReportingDecision, ReportingPayload> {
  const executed = executionEverStarted(snapshot);
  const blocked = blocks.filter((b) => b.decision === "BLOCKED");
  const needsHuman = blocks.some(
    (b) => (b.block === "8.13" && b.block_decision !== "NO_ESCALATION") ||
      (b.block === "8.01" && (b.payload as { authorization?: string }).authorization === "APPROVAL_REQUIRED"),
  );
  const handoff = blocks.some((b) => b.block === "8.01" && (b.payload as { handoff_required?: boolean }).handoff_required);
  const incident = blocks.find((b) => b.block === "8.11" && ["INCIDENT", "CRITICAL_INCIDENT"].includes(b.block_decision));

  const material = blocked.length > 0 || needsHuman || Boolean(incident) || executed;
  const blockDecision: ReportingDecision = incident
    ? "ATTENTION_REQUIRED"
    : needsHuman
      ? "DECISION_REQUESTED"
      : material
        ? "INFORMATIONAL"
        : "NOTHING_MATERIAL";

  const state = snapshot.lifecycle?.state ?? (snapshot.plan ? "PREPARADO, SIN EJECUTAR" : "SIN PLAN");
  const nextStep = incident?.next_actions[0] ?? blocked[0]?.next_actions[0] ?? null;
  const decisionRequest = needsHuman
    ? handoff
      ? "Aplicar el cambio preparado a mano, o descartarlo: el sistema no puede ejecutarlo."
      : "Aprobar o rechazar la intervencion con el alcance descrito."
    : handoff
      ? "El cambio esta preparado para aplicarlo a mano."
      : null;

  const notClaimed = [
    executed ? null : "No se ha ejecutado ningun cambio.",
    "Esto no demuestra impacto en el negocio: eso lo mide el aprendizaje (fase 9) con resultados maduros.",
    incident ? null : "No hay incidentes abiertos, lo que no garantiza que no vayan a aparecer.",
  ].filter((n): n is string => n !== null);

  const consultantSummary = incident
    ? `Incidente: ${incident.why}`
    : blocked.length
      ? `Bloqueada por ${blocked.map((b) => b.block).join(", ")}: ${blocked[0]!.why}`
      : executed
        ? `En ejecucion o ejecutada (${state}).`
        : "Preparada y sin bloqueos.";
  const clientSummary = incident
    ? "Hay un problema con un cambio en curso; tu consultor lo esta revisando."
    : executed
      ? "Se esta aplicando un cambio acordado; te avisaremos del resultado cuando se haya comprobado."
      : needsHuman
        ? "Hay un cambio preparado que necesita una decision antes de aplicarse."
        : "Hay un cambio en preparacion. Todavia no se ha tocado nada en tu tienda.";

  const reports: AudienceReport[] = [
    {
      audience: "consultant",
      summary: consultantSummary,
      current_state: state,
      next_step: nextStep,
      decision_request: decisionRequest,
      details: blocks.map((b) => `${b.block} ${b.block_decision}: ${b.why}`),
    },
    {
      audience: "client",
      summary: clientSummary,
      current_state: executed ? "en curso" : "sin aplicar",
      next_step: needsHuman ? "Revisar la propuesta con tu consultor." : null,
      decision_request: needsHuman ? decisionRequest : null,
      // Sin checks internos, candidatos ni razonamiento (§64).
      details: [],
    },
  ];

  const overclaims = executed ? [] : reports.filter((r) => EXECUTION_CLAIMS.test(r.summary)).map((r) => r.audience);

  const checks = [
    check("no_false_execution_claim", overclaims.length ? "FAIL" : "PASS", true,
      overclaims.length ? `El informe para ${overclaims.join(", ")} da por hecho algo sin ejecutar.` : "Ningun informe afirma una ejecucion que no ocurrio."),
    check("decision_request_scoped", needsHuman && !decisionRequest ? "FAIL" : "PASS", true,
      decisionRequest ?? "No se pide ninguna decision."),
    check("boundary_explained", "PASS", true, notClaimed.join(" ")),
    check("client_redacted", reports.find((r) => r.audience === "client")!.details.length ? "FAIL" : "PASS", true,
      "El informe al cliente no lleva razonamiento interno."),
  ];

  return baseResult(snapshot, {
    block: "8.17",
    stage: "REPORTING",
    block_decision: blockDecision,
    decision: blockDecision === "ATTENTION_REQUIRED" ? "BLOCKED" : blockDecision === "DECISION_REQUESTED" ? "WAITING" : "READY",
    why: blockDecision === "NOTHING_MATERIAL" ? "Nada material que comunicar." : consultantSummary,
    checks,
    next_actions: blockDecision === "NOTHING_MATERIAL" ? [] : ["enviar el informe a su audiencia"],
    payload: { reports, not_claimed: notClaimed, executed, material },
  });
}
