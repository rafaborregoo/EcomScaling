/**
 * F9, bloques por dominio de aprendizaje: 9.13-9.20.
 *
 * Aprenden de incidentes, decisiones humanas, recomendaciones, priorizacion,
 * playbooks, guardrails, autonomia y friccion. Todos comparten una regla: lo
 * que aprenden puede informar a gobernanza, nunca modificar por si mismo un
 * control, una politica o un nivel de autonomia.
 */
import {
  ageDays,
  evidenceQualityOf,
  fidelityOf,
  lcheck,
  learningResult,
  type LearningBlockResult,
  type LearningSnapshot,
} from "./learning-snapshot.js";

const count = <T>(items: T[], key: (x: T) => string) =>
  items.reduce<Record<string, number>>((acc, x) => ({ ...acc, [key(x)]: (acc[key(x)] ?? 0) + 1 }), {});

// --- 9.13 Aprendizaje de fallos e incidentes --------------------------------

export function evaluateIncidentLearning(s: LearningSnapshot): LearningBlockResult {
  const affected = s.experiences.filter(
    (e) => e.incident || e.rolled_back || ["FAILED", "ROLLED_BACK", "ABORTED"].includes(e.operational_outcome),
  );
  if (!affected.length) {
    return learningResult("9.13", "Aprendizaje de fallos e incidentes", {
      block_decision: "SIN_INCIDENTES",
      status: s.experiences.length ? "READY" : "WAITING_FOR_EVIDENCE",
      why: s.experiences.length ? "Ninguna intervencion cerrada acabo en fallo, rollback o incidente." : "Sin intervenciones cerradas no hay incidentes que analizar.",
      payload: { incidents: 0, experiences: s.experiences.length },
      next_evidence: s.experiences.length ? [] : ["Intervenciones cerradas por F8."],
    });
  }
  return learningResult("9.13", "Aprendizaje de fallos e incidentes", {
    block_decision: "CAUSA_NO_CONFIRMADA",
    status: "REVIEW_REQUIRED",
    why: `${affected.length} intervencion(es) acabaron en fallo, rollback o incidente. Sus datos quedan marcados como contaminados para el aprendizaje de estrategia, y ninguna politica critica se cambia con una causa sin confirmar.`,
    checks: [lcheck("policy_change", "PASS", "No se modifica ninguna politica automaticamente.")],
    payload: { incidents: affected.length, contaminated_experiences: affected.map((e) => e.id), by_outcome: count(affected, (e) => e.operational_outcome) },
    next_evidence: ["Causa raiz confirmada y factores contribuyentes, antes de proponer aprendizaje correctivo o preventivo."],
  });
}

// --- 9.14 Human override ------------------------------------------------------

export function evaluateHumanOverride(s: LearningSnapshot): LearningBlockResult {
  const rejected = s.approvals.filter((a) => a.decision === "rejected");
  if (!s.approvals.length) {
    return learningResult("9.14", "Human override y decisiones humanas", { block_decision: "SIN_DECISIONES_HUMANAS", status: "WAITING_FOR_EVIDENCE", why: "Nadie ha aprobado ni rechazado todavia una salida de la IA.", next_evidence: ["Decisiones humanas sobre salidas de la IA, con su motivo."] });
  }
  const byReason = count(rejected, (a) => a.reason_category ?? "sin_categoria");
  const recurrent = Object.entries(byReason).filter(([, n]) => n >= 3).map(([reason]) => reason);
  const decision = recurrent.length ? "PATRON_RECURRENTE" : rejected.length ? "OVERRIDE_SIN_OUTCOME" : "SIN_OVERRIDES";
  return learningResult("9.14", "Human override y decisiones humanas", {
    block_decision: decision,
    status: decision === "PATRON_RECURRENTE" ? "REVIEW_REQUIRED" : decision === "SIN_OVERRIDES" ? "READY" : "WAITING_FOR_EVIDENCE",
    why: decision === "PATRON_RECURRENTE"
      ? `El mismo motivo de rechazo se repite (${recurrent.join(", ")}): hay que investigar el patron antes de generalizar.`
      : decision === "OVERRIDE_SIN_OUTCOME"
        ? "Hay rechazos, pero sin outcome observado no se declara si tenia razon la persona o la IA."
        : "Las decisiones humanas acompanan a la IA sin rechazos.",
    payload: { approvals: s.approvals.length, rejected: rejected.length, rejection_rate: rejected.length / s.approvals.length, by_reason: byReason, recurrent },
    next_evidence: decision === "OVERRIDE_SIN_OUTCOME" ? ["Outcome observado de la decision final para comparar con la propuesta original."] : [],
  });
}

// --- 9.15 Aprendizaje de recomendaciones --------------------------------------

export function evaluateRecommendationLearning(s: LearningSnapshot): LearningBlockResult {
  const executed = s.experiences.filter((e) => e.recommendation_id && e.operational_outcome !== "NOT_EXECUTED");
  const evaluable = executed.filter((e) => {
    const q = evidenceQualityOf(e, s);
    return (q.level === "MEDIUM" || q.level === "HIGH") && q.maturity === "MATURE" && fidelityOf(e) !== "LOW";
  });
  const approved = s.approvals.filter((a) => a.decision === "approved").length;
  const rejected = s.approvals.filter((a) => a.decision === "rejected").length;
  const decision = !executed.length ? "SIN_RECOMENDACIONES_EJECUTADAS" : evaluable.length ? "EVALUABLE" : "PENDIENTE_DE_OUTCOME";
  return learningResult("9.15", "Aprendizaje sobre recomendaciones", {
    block_decision: decision,
    status: decision === "EVALUABLE" ? "READY" : "WAITING_FOR_EVIDENCE",
    why: decision === "SIN_RECOMENDACIONES_EJECUTADAS"
      ? "Ninguna recomendacion se ha ejecutado: una recomendacion no ejecutada no tiene outcome que atribuirle."
      : decision === "PENDIENTE_DE_OUTCOME"
        ? "Hay recomendaciones ejecutadas, pero ninguna con outcome maduro y evidencia suficiente para juzgarla."
        : `${evaluable.length} recomendacion(es) ejecutadas se pueden evaluar ex post, separadas de su calidad ex ante.`,
    payload: { approved, rejected, executed: executed.length, evaluable: evaluable.length, expected_outcomes_available: s.expected_outcomes_available },
    next_evidence: decision === "EVALUABLE" ? [] : ["Outcome maduro de las recomendaciones ejecutadas."],
  });
}

// --- 9.16 Aprendizaje de priorizacion ------------------------------------------

export function evaluatePrioritizationLearning(s: LearningSnapshot): LearningBlockResult {
  const latest = [...s.prioritization].sort((a, b) => b.evaluated_at.localeCompare(a.evaluated_at))[0];
  if (!latest) return learningResult("9.16", "Aprendizaje de priorizacion", { block_decision: "SIN_PRIORIZACION", status: "WAITING_FOR_EVIDENCE", why: "No hay priorizacion de intervenciones (7.03) que evaluar.", next_evidence: ["Una pasada de priorizacion con candidata principal."] });
  const executedIds = new Set(s.experiences.map((e) => e.recommendation_id).filter(Boolean));
  const topExecuted = latest.primary_candidate_id ? executedIds.has(latest.primary_candidate_id) : null;
  const age = ageDays(latest.evaluated_at, s.as_of) ?? 0;
  const newSignals = s.signals_30d.length;
  const stale = age > 30 && newSignals > 0;
  const decision = stale ? "REPRIORIZAR" : topExecuted === null ? "SIN_CANDIDATA_PRINCIPAL" : topExecuted ? "PRIORIDAD_EJECUTADA" : "PRIORIDAD_NO_EJECUTADA";
  return learningResult("9.16", "Aprendizaje de priorizacion", {
    block_decision: decision,
    status: decision === "REPRIORIZAR" ? "REVIEW_REQUIRED" : decision === "PRIORIDAD_EJECUTADA" ? "READY" : "WAITING_FOR_EVIDENCE",
    why: decision === "REPRIORIZAR"
      ? `La priorizacion tiene ${Math.round(age)} dias y hay ${newSignals} senal(es) nuevas: mantenerla seria sostener una prioridad obsoleta.`
      : decision === "PRIORIDAD_EJECUTADA"
        ? "Se ejecuto la candidata principal: su outcome dira si el cuello de botella elegido era el correcto."
        : decision === "PRIORIDAD_NO_EJECUTADA"
          ? "La candidata principal no se ha ejecutado: no se puede aprender si la prioridad era correcta."
          : "La priorizacion no dejo candidata principal.",
    next_evidence: decision === "PRIORIDAD_NO_EJECUTADA" ? ["Ejecucion de la candidata principal."] : decision === "SIN_CANDIDATA_PRINCIPAL" ? ["Una priorizacion con candidata principal (7.03)."] : [],
    payload: { disposition: latest.disposition, primary_candidate_id: latest.primary_candidate_id, top_executed: topExecuted, age_days: Math.round(age), new_signals_30d: newSignals },
  });
}

// --- 9.17 Aprendizaje de playbooks ---------------------------------------------

const BENCHMARK_DOMAINS = /BENCHMARK|GUARDRAIL/;

export function evaluatePlaybookLearning(s: LearningSnapshot): LearningBlockResult {
  const runs = s.playbooks.filter((p) => !BENCHMARK_DOMAINS.test(p.domain));
  if (!runs.length) return learningResult("9.17", "Aprendizaje de playbooks", { block_decision: "SIN_PLAYBOOKS", status: "WAITING_FOR_EVIDENCE", why: "No hay evaluaciones de playbooks (F5).", next_evidence: ["Pasadas de los playbooks de F5."] });
  const ready = runs.filter((p) => p.disposition === "READY_FOR_RECOMMENDATION").length;
  const blocked = runs.filter((p) => p.disposition === "BLOCKED").length;
  const executed = s.experiences.length;
  const decision = blocked * 2 >= runs.length ? "MAYORIA_BLOQUEADOS" : ready && !executed ? "EJECUCION_NO_REGISTRADA" : executed ? "EVIDENCIA_POR_PASO_DESCONOCIDA" : "SIN_PLAYBOOK_LISTO";
  return learningResult("9.17", "Aprendizaje de playbooks", {
    block_decision: decision,
    status: decision === "MAYORIA_BLOQUEADOS" ? "REVIEW_REQUIRED" : "WAITING_FOR_EVIDENCE",
    why: decision === "MAYORIA_BLOQUEADOS"
      ? "La mayoria de los playbooks quedan bloqueados: la aplicabilidad o las precondiciones estan fallando."
      : decision === "EJECUCION_NO_REGISTRADA"
        ? "Hay playbooks listos, pero ninguna ejecucion registrada: no se asume que se siguio el diseno."
        : decision === "EVIDENCIA_POR_PASO_DESCONOCIDA"
          ? "Hay ejecuciones, pero sin evidencia por paso: el exito del playbook no se reparte entre sus pasos (UNKNOWN)."
          : "Ningun playbook esta listo para recomendar.",
    payload: { runs: runs.length, by_domain: count(runs, (p) => p.domain), by_disposition: count(runs, (p) => p.disposition) },
    next_evidence: ["Registro de la ejecucion real por paso de cada playbook."],
  });
}

// --- 9.18 Calibracion de benchmarks y guardrails --------------------------------

export function evaluateBenchmarkCalibration(s: LearningSnapshot): LearningBlockResult {
  const runs = s.playbooks.filter((p) => BENCHMARK_DOMAINS.test(p.domain));
  const triggers = runs.filter((p) => p.disposition === "BLOCKED" || p.disposition === "VALIDATION_REQUIRED");
  const decision = !runs.length ? "SIN_BENCHMARKS" : !triggers.length ? "SIN_DISPAROS" : "CALIBRACION_PENDIENTE_DE_OUTCOMES";
  return learningResult("9.18", "Benchmarks y guardrails", {
    block_decision: decision,
    status: decision === "SIN_DISPAROS" ? "READY" : "WAITING_FOR_EVIDENCE",
    why: decision === "CALIBRACION_PENDIENTE_DE_OUTCOMES"
      ? `${triggers.length} disparo(s) de benchmark o guardrail sin outcome enlazado: no se puede saber cuales eran falsos positivos. El guardrail vigente se sigue aplicando; el aprendizaje solo puede proponer calibracion a gobernanza.`
      : decision === "SIN_DISPAROS"
        ? "Los benchmarks y guardrails evaluados no han disparado."
        : "No hay evaluaciones de benchmarks (F6).",
    checks: [lcheck("self_modify", "PASS", "El aprendizaje no modifica ningun control critico por si mismo.")],
    next_evidence: !runs.length ? ["Evaluaciones de benchmarks y guardrails (F6)."] : triggers.length ? ["Outcome posterior a cada disparo para separar falsos positivos, falsos negativos y casi-incidentes."] : [],
    payload: { runs: runs.length, triggers: triggers.length, by_domain: count(triggers, (p) => p.domain), false_positives: null, false_negatives: null },
  });
}

// --- 9.19 Aprendizaje sobre autonomia -------------------------------------------

export const AUTONOMY_REVIEW_MIN_VERIFIED = 5;

export function evaluateAutonomyLearning(s: LearningSnapshot): LearningBlockResult {
  if (!s.autonomy.length && !s.experiences.length) {
    return learningResult("9.19", "Aprendizaje sobre autonomia", { block_decision: "SIN_EVIDENCIA", status: "WAITING_FOR_EVIDENCE", why: "No hay aprobaciones HITL ni ejecuciones de las que aprender autonomia.", next_evidence: ["Aprobaciones HITL (8.02) y ejecuciones cerradas."] });
  }
  const recentIncidents = s.experiences.filter((e) => (e.incident || e.rolled_back) && (ageDays(e.closed_at, s.as_of) ?? 999) <= 30);
  const cleanVerified = s.experiences.filter((e) => fidelityOf(e) === "HIGH" && !e.incident && !e.rolled_back).length;
  const decision = recentIncidents.length ? "REGRESION_RECOMENDADA" : cleanVerified >= AUTONOMY_REVIEW_MIN_VERIFIED ? "ELEGIBLE_PARA_REVISION" : "MANTENER";
  return learningResult("9.19", "Aprendizaje sobre autonomia", {
    block_decision: decision,
    status: decision === "MANTENER" ? "READY" : "REVIEW_REQUIRED",
    why: decision === "REGRESION_RECOMENDADA"
      ? `${recentIncidents.length} incidente(s) o rollback en 30 dias: se recomienda reducir autonomia en esa clase de accion. La incertidumbre reduce autonomia, nunca la amplia.`
      : decision === "ELEGIBLE_PARA_REVISION"
        ? `${cleanVerified} ejecuciones verificadas sin incidentes: la accion es elegible para que gobernanza revise su nivel. El sistema nunca se promociona a si mismo.`
        : "No hay base para cambiar la autonomia: se mantiene la vigente.",
    checks: [lcheck("no_self_promotion", "PASS", "Ningun resultado sube la autonomia por si mismo.")],
    payload: { autonomy_levels: count(s.autonomy, (a) => a.autonomy_level), clean_verified_executions: cleanVerified, recent_incidents: recentIncidents.length, min_for_review: AUTONOMY_REVIEW_MIN_VERIFIED },
  });
}

// --- 9.20 Infraestructura y friccion operacional -----------------------------

export function evaluateOperationalFriction(s: LearningSnapshot): LearningBlockResult {
  if (!s.readiness.length) return learningResult("9.20", "Infraestructura y friccion operacional", { block_decision: "SIN_DATOS", status: "WAITING_FOR_EVIDENCE", why: "No hay evaluaciones de readiness (8.04) de las que medir friccion.", next_evidence: ["Evaluaciones de readiness (8.04)."] });
  const blocked = s.readiness.filter((r) => /BLOCK|NOT_READY/i.test(r.decision));
  const blockerCounts = count(blocked.flatMap((r) => r.blockers.map((b) => ({ b }))), (x) => x.b);
  const bottlenecks = Object.entries(blockerCounts).filter(([, n]) => n >= 2).map(([b]) => b);
  const partial = s.experiences.filter((e) => fidelityOf(e) !== "HIGH").length;
  const decision = bottlenecks.length ? "CUELLO_DE_BOTELLA" : blocked.length ? "FRICCION_PUNTUAL" : "SIN_FRICCION";
  return learningResult("9.20", "Infraestructura y friccion operacional", {
    block_decision: decision,
    status: decision === "CUELLO_DE_BOTELLA" ? "REVIEW_REQUIRED" : "READY",
    why: decision === "CUELLO_DE_BOTELLA"
      ? `El mismo bloqueo se repite (${bottlenecks.join(", ")}): limita varias intervenciones y se eleva a priorizacion o infraestructura.`
      : decision === "FRICCION_PUNTUAL"
        ? "Hubo bloqueos de readiness, sin repetirse."
        : "Las intervenciones evaluadas no se bloquearon por readiness.",
    checks: [lcheck("attribution_gate", partial ? "FAIL" : "PASS", partial ? `${partial} ejecucion(es) sin fidelidad completa: su aprendizaje estrategico baja de confianza.` : "Todas las ejecuciones con fidelidad completa.")],
    payload: { readiness_runs: s.readiness.length, blocked: blocked.length, blockers: blockerCounts, bottlenecks, partial_executions: partial },
  });
}

