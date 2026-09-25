/**
 * F9, bloques de experiencia y evidencia: 9.01, 9.03-9.09 y 9.12.
 *
 * Cada evaluador razona sobre la ultima experiencia cerrada y, cuando el bloque
 * lo pide, sobre el historial. Ninguno convierte un SUCCESS operacional de F8
 * en aprendizaje causal: la cadena es experiencia -> fidelidad -> calidad de
 * evidencia -> confusores -> nivel causal -> madurez -> confianza -> outcome.
 */
import {
  causalLevelOf,
  confidenceFrom,
  confoundersOf,
  evidenceQualityOf,
  fidelityOf,
  focusExperience,
  lcheck,
  learningResult,
  maturityOf,
  OUTCOME_HORIZON_DAYS,
  type LearningBlockResult,
  type LearningClassification,
  type LearningConfidence,
  type LearningSnapshot,
} from "./learning-snapshot.js";

const SIN_EXPERIENCIA = "Todavia no hay ninguna intervencion cerrada por F8: no hay experiencia de la que aprender.";
const needExperience = "Una intervencion ejecutada y cerrada por F8 (8.16).";

// --- 9.01 Unidad de experiencia --------------------------------------------

export function evaluateExperienceUnit(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.01", "Unidad de experiencia y contexto", { block_decision: "SIN_EXPERIENCIA", status: "WAITING_FOR_EVIDENCE", why: SIN_EXPERIENCIA, next_evidence: [needExperience] });
  const checks = [
    lcheck("context", Object.keys(s.current_context).length ? "PASS" : "UNKNOWN", Object.keys(s.current_context).length ? "Hay contexto de negocio declarado u observado (D02)." : "No hay contexto de negocio: se describe, pero se reduce atribucion y generalizacion."),
    lcheck("decision", e.recommendation_id ? "PASS" : "FAIL", e.recommendation_id ? "La experiencia enlaza la recomendacion que la origino." : "Sin recomendacion enlazada: no se puede juzgar la decision con la informacion de su momento."),
    lcheck("planned_intervention", e.planned_actions != null ? "PASS" : "UNKNOWN", e.planned_actions != null ? `Plan con ${e.planned_actions} accion(es).` : "No se encuentra el plan de ejecucion."),
    lcheck("actual_execution", e.tasks ? "PASS" : "UNKNOWN", e.tasks ? `${e.tasks.completed}/${e.tasks.total} tareas completadas al cerrar.` : "F8 no dejo recuento de tareas: PLANNED != ACTUAL sin poder comprobarlo."),
    lcheck("window", e.started_at ? "PASS" : "UNKNOWN", e.started_at ? "Ventana de observacion con inicio conocido." : "Sin inicio conocido de la ventana."),
    lcheck("outcome", e.observed_effect ? "PASS" : "FAIL", e.observed_effect ? "Hay efecto medido sobre la metrica objetivo." : "Sin efecto medido: CANNOT EVALUATE INTERVENTION, queda como historial operacional."),
  ];
  const decision = e.operational_outcome === "NOT_EXECUTED" || fidelityOf(e) === "LOW"
    ? "EJECUCION_FALLIDA"
    : !e.observed_effect
      ? "SIN_OUTCOME"
      : checks.some((c) => c.id === "context" && c.status !== "PASS")
        ? "SIN_CONTEXTO"
        : checks.every((c) => c.status === "PASS")
          ? "COMPLETA"
          : "INCOMPLETA";
  const complete = s.experiences.filter((x) => x.observed_effect && x.recommendation_id && x.tasks).length;
  return learningResult("9.01", "Unidad de experiencia y contexto", {
    block_decision: decision,
    status: decision === "COMPLETA" ? "READY" : "WAITING_FOR_EVIDENCE",
    why: decision === "COMPLETA"
      ? "La experiencia tiene contexto, decision, plan, ejecucion real, ventana y outcome: es materia prima, no aprendizaje."
      : decision === "EJECUCION_FALLIDA"
        ? "La intervencion no se ejecuto como se planeo: sirve para aprender de ejecucion, no como prueba de la estrategia."
        : decision === "SIN_OUTCOME"
          ? "Falta el efecto medido: la experiencia se conserva, pero no sostiene aprendizaje de eficacia."
          : "La experiencia tiene huecos que reducen lo que se puede inferir de ella.",
    checks,
    payload: { experience_id: e.id, experiences: s.experiences.length, complete_experiences: complete, missing: checks.filter((c) => c.status !== "PASS").map((c) => c.id) },
    next_evidence: checks.filter((c) => c.status !== "PASS").map((c) => c.detail),
  });
}

// --- 9.03 Execution fidelity -----------------------------------------------

export function evaluateExecutionFidelity(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.03", "Calidad de ejecucion y execution fidelity", { block_decision: "UNKNOWN", status: "WAITING_FOR_EVIDENCE", why: SIN_EXPERIENCIA, next_evidence: [needExperience] });
  const fidelity = fidelityOf(e);
  const validity = fidelity === "HIGH" ? "YES" : fidelity === "PARTIAL" ? "PARTIALLY" : fidelity === "UNKNOWN" ? "UNKNOWN" : "NO";
  const all = s.experiences.map(fidelityOf);
  const reliability = all.length ? all.filter((f) => f === "HIGH").length / all.length : null;
  return learningResult("9.03", "Calidad de ejecucion y execution fidelity", {
    block_decision: validity,
    status: validity === "YES" ? "READY" : validity === "PARTIALLY" ? "REVIEW_REQUIRED" : validity === "NO" ? "BLOCKED" : "WAITING_FOR_EVIDENCE",
    why: validity === "YES"
      ? "Se completaron todas las tareas y F8 verifico el estado final: el outcome puede informar sobre la estrategia."
      : validity === "PARTIALLY"
        ? "Solo parte del plan se ejecuto: la evidencia vale para los componentes ejecutados, el resto queda sin probar."
        : validity === "NO"
          ? `La intervencion real no representa la estrategia (${fidelity}): se aprende de ejecucion, no de la estrategia.`
          : "No hay evidencia de ejecucion suficiente: EXECUTION FIDELITY = UNKNOWN, no se asume que se cumplio el plan.",
    checks: [
      lcheck("completion", e.tasks ? (e.tasks.completed >= e.tasks.total ? "PASS" : "FAIL") : "UNKNOWN", e.tasks ? `${e.tasks.completed}/${e.tasks.total} tareas.` : "Sin recuento de tareas."),
      lcheck("verified", e.verification_status === "VERIFIED" ? "PASS" : e.verification_status === "UNKNOWN" ? "UNKNOWN" : "FAIL", `Verificacion de F8: ${e.verification_status}.`),
      lcheck("rollback", e.rolled_back ? "FAIL" : "PASS", e.rolled_back ? "Hubo rollback: separar el periodo previo y el posterior." : "Sin rollback."),
    ],
    payload: { fidelity, evaluation_validity: validity, execution_reliability: reliability, experiences: all.length, execution_learning: validity === "NO" },
    next_evidence: validity === "UNKNOWN" ? ["Recuento de tareas y verificacion del estado final al cerrar (8.15/8.16)."] : [],
  });
}

// --- 9.04 Calidad de evidencia ---------------------------------------------

const LANGUAGE: Record<string, string> = {
  LOW: "La evidencia temprana sugiere...",
  MEDIUM: "La evidencia disponible respalda...",
  HIGH: "Evidencia repetida y de calidad respalda con fuerza...",
  UNKNOWN: "No hay evidencia suficiente para afirmar nada.",
};

export function evaluateEvidenceQuality(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.04", "Calidad de evidencia", { block_decision: "UNKNOWN", status: "WAITING_FOR_EVIDENCE", why: SIN_EXPERIENCIA, next_evidence: [needExperience] });
  const q = evidenceQualityOf(e, s);
  return learningResult("9.04", "Calidad de evidencia", {
    block_decision: q.level,
    status: q.level === "MEDIUM" || q.level === "HIGH" ? "READY" : "WAITING_FOR_EVIDENCE",
    confidence: confidenceFrom(q.level),
    why: q.level === "UNKNOWN"
      ? "Sin efecto medido o sin calidad de medicion conocida no hay evidencia que pesar: que una metrica se mueva no es evidencia."
      : q.level === "LOW"
        ? "La evidencia sirve para investigar o repetir la prueba, no para conocimiento durable."
        : "La evidencia es suficiente para pasar a atribucion causal, con sus limites explicitos.",
    checks: [
      lcheck("measurement", q.measurement === "UNKNOWN" ? "UNKNOWN" : q.measurement === "LOW" ? "FAIL" : "PASS", `Fiabilidad de la fuente segun D01: ${q.measurement}.`),
      lcheck("sample", e.sample_sufficient === null ? "UNKNOWN" : e.sample_sufficient ? "PASS" : "FAIL", "Muestra suficiente para la afirmacion."),
      lcheck("maturity", q.maturity === "MATURE" ? "PASS" : "FAIL", `Madurez del outcome: ${q.maturity}.`),
      lcheck("observed", e.observed_effect ? "PASS" : "FAIL", "Efecto medido sobre la metrica objetivo."),
    ],
    payload: { level: q.level, dimensions: { measurement: q.measurement, maturity: q.maturity, sample_sufficient: e.sample_sufficient }, language: LANGUAGE[q.level], handoff_to_attribution: q.level === "MEDIUM" || q.level === "HIGH" },
    next_evidence: q.missing,
  });
}

// --- 9.05 Causalidad y atribucion ------------------------------------------

export function evaluateCausalAttribution(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.05", "Causalidad, correlacion y atribucion", { block_decision: "descriptiva", status: "WAITING_FOR_EVIDENCE", why: SIN_EXPERIENCIA, next_evidence: [needExperience] });
  const level = causalLevelOf(e, s);
  return learningResult("9.05", "Causalidad, correlacion y atribucion", {
    block_decision: level,
    status: level === "causal_plausible" ? "REVIEW_REQUIRED" : "WAITING_FOR_EVIDENCE",
    why: level === "descriptiva"
      ? "Sin efecto medido solo se puede describir lo que paso."
      : level === "asociativa"
        ? "El efecto acompana a la intervencion, pero ejecucion, confusores o direccion esperada no permiten ir mas alla de asociacion."
        : "Temporalidad, mecanismo esperado, ejecucion fiel y ventana limpia: causalidad plausible, que se trata como hipotesis operativa y no como verdad confirmada. Sin control ni holdout no se llega a incremental.",
    checks: [
      lcheck("intervention", e.intervention_id ? "PASS" : "FAIL", "Se sabe que cambio."),
      lcheck("outcome", e.observed_effect ? "PASS" : "FAIL", "Hay una metrica concreta medida."),
      lcheck("expected_direction", e.expected_effect?.direction && e.observed_effect ? (e.expected_effect.direction === e.observed_effect.direction ? "PASS" : "FAIL") : "UNKNOWN", "El efecto va en la direccion que la recomendacion esperaba (7.15)."),
      lcheck("counterfactual", "FAIL", "No hay grupo de control ni holdout: la evidencia es observacional."),
      lcheck("platform_attribution", "PASS", "La atribucion de plataforma no se convierte en incrementalidad (ADR-0021)."),
    ],
    payload: { causal_level: level, max_reachable: "causal_plausible", confounders: confoundersOf(e, s) },
    next_evidence: level === "causal_plausible" ? ["Un test con control o holdout para pasar de plausible a respaldada."] : ["Efecto medido, ejecucion verificada y ventana sin confusores."],
  });
}

// --- 9.06 Confounders ------------------------------------------------------

export function evaluateConfounders(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.06", "Confounders e intervenciones concurrentes", { block_decision: "UNKNOWN", status: "WAITING_FOR_EVIDENCE", why: SIN_EXPERIENCIA, next_evidence: [needExperience] });
  const list = confoundersOf(e, s);
  const concurrent = list.filter((c) => c.startsWith("intervencion:"));
  const tracking = list.filter((c) => /tracking|medicion|measurement|pixel/i.test(c));
  const severity = concurrent.length || tracking.length || list.length >= 2 ? "SEVERE" : list.length === 1 ? "MINOR" : "NONE";
  return learningResult("9.06", "Confounders e intervenciones concurrentes", {
    block_decision: severity,
    status: severity === "NONE" ? "READY" : severity === "MINOR" ? "REVIEW_REQUIRED" : "BLOCKED",
    why: severity === "NONE"
      ? "No hay eventos de contexto ni otras intervenciones en la ventana causal."
      : severity === "MINOR"
        ? "Hay un evento en la ventana: la conclusion causal sigue, con esa salvedad escrita."
        : tracking.length
          ? "Cambio la medicion en la ventana: hay que separar cambio de negocio de cambio de medicion antes de concluir."
          : "Confusion material y no resoluble con lo que hay: no se atribuye causalidad fuerte.",
    checks: [
      lcheck("concurrent_interventions", concurrent.length ? "FAIL" : "PASS", concurrent.length ? `${concurrent.length} intervencion(es) a la vez.` : "Ninguna intervencion concurrente."),
      lcheck("context_events", list.length - concurrent.length ? "FAIL" : "PASS", `${list.length - concurrent.length} evento(s) de contexto en la ventana (D02).`),
      lcheck("tracking", tracking.length ? "FAIL" : "PASS", tracking.length ? "Cambio de instrumentacion en la ventana." : "Sin cambios de medicion declarados."),
    ],
    payload: { severity, confounders: list },
    next_evidence: severity === "SEVERE" ? ["Control, segmentacion, holdout o una ventana sin eventos concurrentes."] : [],
  });
}

// --- 9.07 Fuerza de evidencia y accion proporcional -------------------------

export function evaluateEvidenceStrength(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.07", "Experimentacion y fuerza de evidencia", { block_decision: "INSUFICIENTE", status: "WAITING_FOR_EVIDENCE", why: SIN_EXPERIENCIA, next_evidence: [needExperience] });
  const q = evidenceQualityOf(e, s).level;
  const causal = causalLevelOf(e, s);
  const confounders = confoundersOf(e, s).length;
  const replicas = e.observed_effect
    ? s.prior_learnings.filter((p) => p.status === "active" && p.experience_id !== e.id && p.metric === e.observed_effect!.metric && p.direction === e.observed_effect!.direction).length
    : 0;
  const strength = q === "UNKNOWN" ? "INSUFICIENTE"
    : q === "HIGH" && causal === "causal_plausible" && confounders === 0 ? (replicas >= 2 ? "MUY_FUERTE" : "FUERTE")
      : q !== "LOW" && confounders <= 1 ? "MODERADA"
        : "DEBIL";
  const action = { INSUFICIENTE: "NO_PROMOVER", DEBIL: "HIPOTESIS_O_TEST_PEQUENO", MODERADA: "ROLLOUT_LIMITADO", FUERTE: "RECOMENDACION_AMPLIA", MUY_FUERTE: "REUTILIZABLE_DENTRO_DE_LIMITES" }[strength];
  return learningResult("9.07", "Experimentacion y fuerza de evidencia", {
    block_decision: action,
    status: strength === "FUERTE" || strength === "MUY_FUERTE" ? "READY" : strength === "MODERADA" ? "REVIEW_REQUIRED" : "WAITING_FOR_EVIDENCE",
    confidence: strength === "MUY_FUERTE" ? "HIGH" : strength === "FUERTE" || strength === "MODERADA" ? "MEDIUM" : "LOW",
    why: `Fuerza ${strength.toLowerCase()}: calidad ${q}, nivel causal ${causal}, ${confounders} confusor(es), ${replicas} replica(s) previas. La accion se ajusta a esa fuerza.`,
    payload: { strength, proportional_action: action, evidence_quality: q, causal_level: causal, replications: replicas },
    next_evidence: strength === "MUY_FUERTE" ? [] : ["Replicar en otra experiencia comparable, con control si es posible."],
  });
}

// --- 9.08 Madurez del outcome ------------------------------------------------

export function evaluateOutcomeMaturity(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.08", "Ventanas temporales y madurez del resultado", { block_decision: "IMMATURE", status: "WAITING_FOR_EVIDENCE", why: SIN_EXPERIENCIA, next_evidence: [needExperience] });
  const maturity = maturityOf(e, s.as_of);
  const nextReview = new Date(new Date(e.closed_at).getTime() + OUTCOME_HORIZON_DAYS * 86_400_000).toISOString();
  return learningResult("9.08", "Ventanas temporales y madurez del resultado", {
    block_decision: maturity,
    status: maturity === "MATURE" ? "READY" : maturity === "INTERIM" ? "REVIEW_REQUIRED" : "WAITING_FOR_EVIDENCE",
    why: {
      IMMATURE: "El outcome no ha tenido tiempo de producirse: no se usa como aprendizaje.",
      EARLY_SIGNAL: "Senal temprana: orienta hipotesis y decisiones reversibles, nada mas.",
      INTERIM: "Resultado intermedio: soporta una conclusion provisional.",
      MATURE: "El outcome ha madurado: puede alimentar aprendizaje con la fuerza que permita el resto de la evidencia.",
    }[maturity],
    payload: { maturity, closure_maturity: e.closure_maturity, horizon_days: OUTCOME_HORIZON_DAYS, next_review_at: maturity === "MATURE" ? null : nextReview },
    next_evidence: maturity === "MATURE" ? [] : [`Revisar de nuevo a partir de ${nextReview.slice(0, 10)}.`],
  });
}

// --- 9.09 Learning confidence ----------------------------------------------

const rankC: Record<LearningConfidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const minC = (...cs: LearningConfidence[]) => cs.reduce((a, b) => (rankC[a] <= rankC[b] ? a : b));

export function evaluateLearningConfidence(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.09", "Learning confidence", { block_decision: "LOW", status: "WAITING_FOR_EVIDENCE", why: SIN_EXPERIENCIA, next_evidence: [needExperience] });
  const q = evidenceQualityOf(e, s);
  const fidelity = fidelityOf(e);
  const causal = causalLevelOf(e, s);
  const contradicted = e.observed_effect
    ? s.prior_learnings.some((p) => p.status === "active" && p.experience_id !== e.id && p.metric === e.observed_effect!.metric && p.direction && p.direction !== e.observed_effect!.direction)
    : false;
  const ceilings: { driver: string; cap: LearningConfidence }[] = [
    { driver: `calidad de evidencia ${q.level}`, cap: confidenceFrom(q.level) },
    { driver: `fidelidad ${fidelity}`, cap: fidelity === "HIGH" ? "HIGH" : fidelity === "PARTIAL" ? "MEDIUM" : "LOW" },
    { driver: `madurez ${q.maturity}`, cap: q.maturity === "MATURE" ? "HIGH" : q.maturity === "INTERIM" ? "MEDIUM" : "LOW" },
    { driver: `nivel causal ${causal}`, cap: causal === "causal_plausible" ? "MEDIUM" : causal === "asociativa" ? "MEDIUM" : "LOW" },
    { driver: contradicted ? "contradice un aprendizaje previo" : "sin contradicciones", cap: contradicted ? "LOW" : "HIGH" },
  ];
  const confidence = minC(...ceilings.map((c) => c.cap));
  const binding = ceilings.filter((c) => c.cap === confidence).map((c) => c.driver);
  const previous = e.observed_effect ? s.prior_learnings.filter((p) => p.metric === e.observed_effect!.metric && p.experience_id !== e.id).sort((a, b) => b.evaluated_at.localeCompare(a.evaluated_at))[0] : undefined;
  return learningResult("9.09", "Learning confidence", {
    block_decision: confidence,
    status: confidence === "LOW" ? "WAITING_FOR_EVIDENCE" : "READY",
    confidence,
    why: `Confianza ${confidence}: la limita ${binding.join(", ")}. No es una probabilidad: es el techo que permite la evidencia mas debil.`,
    payload: { drivers: ceilings, ceiling_by: binding, previous_confidence: previous?.confidence ?? null, direction_of_change: previous ? (rankC[confidence] > rankC[previous.confidence] ? "up" : rankC[confidence] < rankC[previous.confidence] ? "down" : "same") : null },
    next_evidence: confidence === "HIGH" ? [] : binding.map((b) => `Levantar el techo que pone ${b}.`),
  });
}

// --- 9.12 Clasificacion del outcome ----------------------------------------

export function evaluateOutcomeClassification(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.12", "Outcomes positivos, negativos, neutros e inconclusos", { block_decision: "INCONCLUSIVE", status: "WAITING_FOR_EVIDENCE", why: SIN_EXPERIENCIA, next_evidence: [needExperience] });
  const q = evidenceQualityOf(e, s);
  const causal = causalLevelOf(e, s);
  const sufficient = (q.level === "MEDIUM" || q.level === "HIGH") && (q.maturity === "MATURE" || q.maturity === "INTERIM");
  let classification: LearningClassification = "INCONCLUSIVE";
  let decision = "INCONCLUSIVE";
  if (e.observed_effect && sufficient) {
    if (!e.observed_effect.material) {
      classification = "NEUTRAL";
      decision = "NEUTRAL";
    } else if (causal !== "causal_plausible") {
      decision = e.observed_effect.direction === e.expected_effect?.direction ? "POSITIVO_NO_ATRIBUIBLE" : "NEGATIVO_NO_ATRIBUIBLE";
    } else {
      classification = e.observed_effect.direction === e.expected_effect?.direction ? "POSITIVE" : "NEGATIVE";
      decision = classification;
    }
  }
  return learningResult("9.12", "Outcomes positivos, negativos, neutros e inconclusos", {
    block_decision: decision,
    classification,
    confidence: classification === "INCONCLUSIVE" ? "LOW" : confidenceFrom(q.level),
    status: classification === "INCONCLUSIVE" ? "WAITING_FOR_EVIDENCE" : "READY",
    why: decision === "INCONCLUSIVE"
      ? "Evidencia insuficiente para clasificar. INCONCLUSIVE no es NEUTRAL: falta evidencia, no hay prueba de ausencia de efecto."
      : decision.endsWith("NO_ATRIBUIBLE")
        ? "El negocio se movio, pero la atribucion no alcanza para decir que fue la intervencion: no se clasifica como resultado suyo."
        : decision === "NEUTRAL"
          ? "Evidencia suficiente de que no hubo efecto material."
          : `Resultado ${classification} de la intervencion, sostenido por la evidencia disponible.`,
    payload: { classification, operational_outcome: e.operational_outcome, evidence_quality: q.level, maturity: q.maturity, causal_level: causal, metric: e.observed_effect?.metric ?? null, direction: e.observed_effect?.direction ?? null, mixed_detection: "requiere varias metricas por experiencia; hoy se mide una" },
    next_evidence: classification === "INCONCLUSIVE" ? [...q.missing, "Outcome maduro con calidad de evidencia media o alta."] : [],
  });
}
