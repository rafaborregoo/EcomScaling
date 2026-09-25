/**
 * F9, gobernanza, capas de conocimiento y marco final: 9.00, 9.30-9.32,
 * 9.34-9.37 y 9.39-9.41.
 *
 * Varios de estos bloques no miran datos: miran lo que dijeron los demas
 * (9.00 elige la rama del flujo universal, 9.30 decide que necesita revision,
 * 9.31 comprueba que cada salida se puede explicar, 9.40 aprende del propio
 * proceso y 9.41 recorre el pipeline maestro). Por eso reciben los resultados.
 *
 * Las capas entre tiendas (9.34 transferencia, 9.35 cohortes, 9.36 global) no
 * existen en la plataforma: el motor solo carga datos de la tienda evaluada.
 * Esos bloques lo dicen, y 9.37 comprueba que asi sea.
 */
import {
  byRecency,
  fidelityOf,
  lcheck,
  learningResult,
  maturityOf,
  type F9BlockCode,
  type LearningBlockResult,
  type LearningSnapshot,
} from "./learning-snapshot.js";

type Results = Map<F9BlockCode, LearningBlockResult>;
const decisionOf = (r: Results, b: F9BlockCode) => r.get(b)?.block_decision ?? "SIN_EVALUAR";
const statusOf = (r: Results, b: F9BlockCode) => r.get(b)?.status ?? "WAITING_FOR_EVIDENCE";

// --- 9.32 Trazabilidad ---------------------------------------------------------

export function evaluateLearningTraceability(s: LearningSnapshot): LearningBlockResult {
  const gaps: string[] = [];
  for (const e of s.experiences) {
    if (!e.recommendation_id) gaps.push(`${e.id}: sin recomendacion de origen`);
    if (!e.started_at) gaps.push(`${e.id}: sin inicio de ventana`);
    if (e.planned_actions == null) gaps.push(`${e.id}: sin plan enlazado`);
  }
  const experienceIds = new Set(s.experiences.map((e) => e.id));
  for (const p of s.prior_learnings) if (!experienceIds.has(p.experience_id)) gaps.push(`${p.id}: su experiencia ya no esta en la foto`);
  return learningResult("9.32", "Learning traceability", {
    block_decision: !s.experiences.length && !s.prior_learnings.length ? "SIN_ENTIDADES" : gaps.length ? "HUECOS_DE_TRAZA" : "TRAZABLE",
    status: gaps.length ? "REVIEW_REQUIRED" : s.experiences.length ? "READY" : "WAITING_FOR_EVIDENCE",
    why: gaps.length
      ? `${gaps.length} hueco(s) en la cadena aprendizaje -> evidencia -> experiencia: esas transiciones no dejan rastro navegable.`
      : s.experiences.length
        ? "Cada experiencia y aprendizaje enlaza su origen."
        : "Todavia no hay entidades que trazar.",
    payload: { gaps: gaps.slice(0, 50), gap_count: gaps.length },
    next_evidence: s.experiences.length || s.prior_learnings.length ? [] : ["Intervenciones cerradas o aprendizajes que trazar."],
  });
}

// --- 9.34 Transfer learning, 9.35 cohortes, 9.36 global vs tenant, 9.37 privacidad ---

export function evaluateTransferLearning(s: LearningSnapshot): LearningBlockResult {
  return learningResult("9.34", "Transfer learning entre tiendas", {
    block_decision: s.cross_tenant_sources ? "REVISAR_AISLAMIENTO" : "SIN_CAPA_DE_TRANSFERENCIA",
    status: s.cross_tenant_sources ? "BLOCKED" : "WAITING_FOR_EVIDENCE",
    why: s.cross_tenant_sources
      ? "La foto contiene datos de otras tiendas sin un proceso de transferencia autorizado."
      : "No existe todavia una capa de conocimiento abstraido entre tiendas: no hay candidatos que transferir. Todo lo que se usa se valida en esta tienda.",
    payload: { cross_tenant_sources: s.cross_tenant_sources },
    next_evidence: ["Conocimiento abstraido y anonimizado de otras tiendas, con reglas de similitud, antes de transferir."],
  });
}

export function evaluateCohortLearning(s: LearningSnapshot): LearningBlockResult {
  return learningResult("9.35", "Cohort learning", {
    block_decision: "SIN_COHORTES",
    status: "WAITING_FOR_EVIDENCE",
    why: "No hay cohortes de tiendas definidas: sin ellas no hay priores de cohorte, y la evidencia de la tienda manda sola.",
    payload: { cohorts: 0, tenant_experiences: s.experiences.length },
    next_evidence: ["Definicion de cohortes con varias tiendas independientes que compartan patron."],
  });
}

export const COLD_START_LEARNINGS = 3;

export function evaluateGlobalVsTenant(s: LearningSnapshot): LearningBlockResult {
  const local = s.prior_learnings.filter((p) => p.status === "active").length;
  const cold = local < COLD_START_LEARNINGS;
  return learningResult("9.36", "Global knowledge vs tenant specific learning", {
    block_decision: cold ? "COLD_START" : "TENANT_CON_EVIDENCIA_PROPIA",
    status: "READY",
    why: cold
      ? "Poca evidencia propia: se razona con el marco general de las fases (politicas y contratos) como prior, manteniendo la incertidumbre y recomendando validar."
      : "La tienda tiene aprendizajes propios: se priorizan sobre el marco general, que queda como referencia.",
    checks: [lcheck("isolation", s.cross_tenant_sources ? "FAIL" : "PASS", "Ningun dato en bruto de otra tienda entra en el razonamiento.")],
    payload: { layers: ["policies", "tenant"], tenant_learnings: local, cold_start_threshold: COLD_START_LEARNINGS },
  });
}

export function evaluatePrivacyIsolation(s: LearningSnapshot): LearningBlockResult {
  const isolated = s.cross_tenant_sources === 0;
  return learningResult("9.37", "Privacidad y aislamiento del aprendizaje", {
    block_decision: isolated ? "AISLADO" : "FUGA_POTENCIAL",
    status: isolated ? "READY" : "BLOCKED",
    why: isolated
      ? "La foto de aprendizaje solo contiene datos de esta tienda: aislamiento antes de recuperar, agregar, promocionar o explicar."
      : "Hay datos de otras tiendas en la foto: se bloquea el uso y se trata como incidente.",
    checks: [lcheck("tenant_scope", isolated ? "PASS" : "FAIL", `Fuentes de otras tiendas: ${s.cross_tenant_sources}.`)],
    payload: { cross_tenant_sources: s.cross_tenant_sources },
  });
}

// --- 9.39 Strategic learning --------------------------------------------------------

export function evaluateStrategicLearning(s: LearningSnapshot): LearningBlockResult {
  const mature = byRecency(s).filter((e) => maturityOf(e, s.as_of) === "MATURE" && e.observed_effect && fidelityOf(e) === "HIGH");
  const byMetric = mature.reduce<Record<string, string[]>>((acc, e) => {
    const key = `${e.observed_effect!.metric}:${e.observed_effect!.direction}`;
    return { ...acc, [key]: [...(acc[key] ?? []), e.id] };
  }, {});
  const theses = Object.entries(byMetric).filter(([, ids]) => ids.length >= 3).map(([key, ids]) => ({ key, experiences: ids }));
  return learningResult("9.39", "Strategic learning", {
    block_decision: theses.length ? "TESIS_REFORZABLE" : "TACTICA_NO_PROMOVIBLE",
    status: theses.length ? "REVIEW_REQUIRED" : "WAITING_FOR_EVIDENCE",
    why: theses.length
      ? "Un efecto se repite en varias intervenciones maduras y bien ejecutadas: puede reforzar una tesis estrategica, que se revisa con sus supuestos y criterios de parada."
      : "Ninguna tactica tiene todavia efecto repetido y maduro: no se convierte en estrategia hasta entender su efecto en el sistema.",
    payload: { theses, mature_experiences: mature.length },
    next_evidence: theses.length ? [] : ["El mismo efecto en tres intervenciones maduras y bien ejecutadas."],
  });
}

// --- 9.30 Gobernanza (compone) --------------------------------------------------------

export function evaluateLearningGovernance(s: LearningSnapshot, r: Results): LearningBlockResult {
  const review: string[] = [];
  if (decisionOf(r, "9.19") !== "MANTENER" && r.has("9.19") && decisionOf(r, "9.19") !== "SIN_EVIDENCIA") review.push("cambio de autonomia (9.19)");
  if (decisionOf(r, "9.26").startsWith("CANDIDATO")) review.push("promocion de conocimiento (9.26)");
  if (decisionOf(r, "9.27") === "SUPERSESSION_PROPUESTA") review.push("sustitucion de conocimiento (9.27)");
  if (decisionOf(r, "9.33") === "RETIRADA_PROPUESTA") review.push("retirada de conocimiento (9.33)");
  if (decisionOf(r, "9.18") === "CALIBRACION_PENDIENTE_DE_OUTCOMES") review.push("calibracion de guardrails (9.18)");
  if (decisionOf(r, "9.22") === "CONTRADICCION_SIN_RESOLVER") review.push("contradiccion sin resolver (9.22)");
  return learningResult("9.30", "Learning governance", {
    block_decision: review.length ? "REVISION_HUMANA" : "AUTOMATICO_ACOTADO",
    status: review.length ? "REVIEW_REQUIRED" : "READY",
    why: review.length
      ? `Necesita revision humana: ${review.join(", ")}. Lo de bajo riesgo y alcance local se automatiza; lo de alto impacto se gobierna.`
      : "Nada de lo evaluado cambia autonomia, politicas ni conocimiento compartido: puede seguir por la via automatica acotada.",
    checks: [lcheck("authority", "PASS", "Ningun aprendizaje cambia la autoridad directamente: como mucho produce una recomendacion.")],
    payload: { review_items: review, organization_id: s.organization_id },
  });
}

// --- 9.31 Explainable learning (compone) ----------------------------------------------

export function evaluateExplainableLearning(_s: LearningSnapshot, r: Results): LearningBlockResult {
  const unexplained = [...r.values()].filter(
    (x) => !x.why.trim() || (x.status === "WAITING_FOR_EVIDENCE" && !x.next_evidence.length),
  );
  return learningResult("9.31", "Explainable learning", {
    block_decision: unexplained.length ? "EXPLICACION_INCOMPLETA" : "EXPLICABLE",
    status: unexplained.length ? "REVIEW_REQUIRED" : "READY",
    why: unexplained.length
      ? `${unexplained.length} bloque(s) esperan evidencia sin decir cual: una abstencion tambien se explica.`
      : "Cada bloque dice por que decide lo que decide y, cuando se abstiene, que evidencia falta.",
    payload: { unexplained: unexplained.map((x) => x.block) },
  });
}

// --- 9.40 Meta-learning (compone) ------------------------------------------------------

export function evaluateMetaLearning(s: LearningSnapshot, r: Results): LearningBlockResult {
  if (s.experiences.length < 3) {
    return learningResult("9.40", "Meta learning", { block_decision: "EPISODIOS_INSUFICIENTES", status: "WAITING_FOR_EVIDENCE", why: "Con menos de tres episodios no se puede evaluar el propio proceso de aprendizaje.", next_evidence: ["Al menos tres intervenciones cerradas."] });
  }
  const inconclusive = s.experiences.filter((e) => !e.observed_effect || maturityOf(e, s.as_of) !== "MATURE").length / s.experiences.length;
  const failedExecution = s.experiences.filter((e) => ["LOW", "NOT_EXECUTED", "ROLLED_BACK"].includes(fidelityOf(e))).length / s.experiences.length;
  const missing = [...r.values()].flatMap((x) => x.next_evidence);
  const debt = Object.entries(missing.reduce<Record<string, number>>((acc, m) => ({ ...acc, [m]: (acc[m] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, n]) => ({ evidence: m, blocks: n }));
  const decision = inconclusive > 0.5 ? "DEUDA_DE_EVIDENCIA" : failedExecution > 0.3 ? "FALLO_DE_EJECUCION_RECURRENTE" : "PROCESO_SANO";
  return learningResult("9.40", "Meta learning", {
    block_decision: decision,
    status: decision === "PROCESO_SANO" ? "READY" : "REVIEW_REQUIRED",
    why: decision === "DEUDA_DE_EVIDENCIA"
      ? `El ${Math.round(inconclusive * 100)} % de los episodios no llega a aprendizaje: el cuello de botella del proceso es la evidencia que falta, no el razonamiento.`
      : decision === "FALLO_DE_EJECUCION_RECURRENTE"
        ? `El ${Math.round(failedExecution * 100)} % de las ejecuciones no son fieles: hay que simplificar recomendaciones o reforzar verificacion.`
        : "El proceso de aprendizaje convierte episodios en aprendizaje a un ritmo razonable.",
    payload: { inconclusive_rate: inconclusive, failed_execution_rate: failedExecution, learning_debt: debt },
  });
}

// --- 9.41 Framework final: pipeline maestro (compone) -----------------------------------

const PIPELINE: { gate: string; block: F9BlockCode }[] = [
  { gate: "observe", block: "9.01" },
  { gate: "evidence", block: "9.04" },
  { gate: "anti_learning", block: "9.28" },
  { gate: "pattern_validation", block: "9.07" },
  { gate: "contradiction", block: "9.22" },
  { gate: "scope", block: "9.37" },
  { gate: "promotion", block: "9.26" },
  { gate: "governance", block: "9.30" },
];

export function evaluateFrameworkEngine(_s: LearningSnapshot, r: Results): LearningBlockResult {
  const gates = PIPELINE.map(({ gate, block }) => ({ gate, block, status: statusOf(r, block), decision: decisionOf(r, block) }));
  const stop = gates.find((g) => g.status !== "READY");
  return learningResult("9.41", "Framework final learning engine", {
    block_decision: stop ? `DETENIDO_EN_${stop.gate.toUpperCase()}` : "PIPELINE_COMPLETO",
    status: stop ? (stop.status === "BLOCKED" ? "BLOCKED" : stop.status) : "READY",
    why: stop
      ? `El pipeline se detiene en ${stop.gate} (${stop.block}: ${stop.decision}). Ningun aprendizaje se salta evidencia, alcance, gobernanza, privacidad ni ciclo de vida.`
      : "El aprendizaje paso todas las puertas del pipeline maestro.",
    checks: gates.map((g) => lcheck(g.gate, g.status === "READY" ? "PASS" : g.status === "WAITING_FOR_EVIDENCE" ? "UNKNOWN" : "FAIL", `${g.block}: ${g.decision}`)),
    payload: { gates },
    next_evidence: stop ? r.get(stop.block)?.next_evidence ?? [] : [],
  });
}

// --- 9.00 Flujo universal (compone) ----------------------------------------------------

export function evaluateUniversalFramework(s: LearningSnapshot, r: Results): LearningBlockResult {
  const branch = !s.experiences.length ? "SIN_EXPERIENCIA"
    : decisionOf(r, "9.03") === "NO" ? "REVISION_DE_EJECUCION"
      : decisionOf(r, "9.22") === "CONTRADICCION_SIN_RESOLVER" ? "CONTRADICCION"
        : statusOf(r, "9.12") === "READY" ? "ACTUALIZACION_DE_CREENCIA"
          : decisionOf(r, "9.04") === "UNKNOWN" || decisionOf(r, "9.04") === "LOW" ? "SIN_ACTUALIZACION_MATERIAL"
            : "INCONCLUSO";
  return learningResult("9.00", "Framework universal de aprendizaje continuo", {
    block_decision: branch,
    status: branch === "ACTUALIZACION_DE_CREENCIA" ? "READY" : branch === "REVISION_DE_EJECUCION" || branch === "CONTRADICCION" ? "REVIEW_REQUIRED" : "WAITING_FOR_EVIDENCE",
    classification: r.get("9.12")?.classification ?? "INCONCLUSIVE",
    why: {
      SIN_EXPERIENCIA: "El flujo no empieza asumiendo que hay aprendizaje: todavia no hay experiencia observable.",
      REVISION_DE_EJECUCION: "La estrategia no se ejecuto con fidelidad: primero revision de ejecucion, despues (si procede) aprendizaje de estrategia.",
      CONTRADICCION: "La evidencia nueva contradice aprendizajes previos: se compara contexto, ejecucion y medicion antes de actualizar nada.",
      ACTUALIZACION_DE_CREENCIA: "Hay una actualizacion de creencia soportada, con su confianza y sus limites.",
      SIN_ACTUALIZACION_MATERIAL: "NO MATERIAL BELIEF UPDATE: no aprender es una salida valida cuando la evidencia no alcanza.",
      INCONCLUSO: "EXPERIENCE -> INCONCLUSIVE: no se degrada a una conclusion binaria.",
    }[branch]!,
    payload: { branch },
    next_evidence: branch === "ACTUALIZACION_DE_CREENCIA" ? [] : [...(r.get("9.12")?.next_evidence ?? []), ...(branch === "SIN_EXPERIENCIA" ? ["Una intervencion ejecutada y cerrada por F8."] : [])],
  });
}
