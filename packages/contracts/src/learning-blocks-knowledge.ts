/**
 * F9, ciclo de vida del conocimiento: 9.10, 9.11, 9.22-9.29, 9.33 y 9.38.
 *
 * El "conocimiento" aqui son los aprendizajes previos del propio F9 (los que
 * 9.12 dejo con gate). Estos bloques deciden si se pueden reutilizar en el
 * contexto de hoy, si se contradicen, si caducaron, si alguno es candidato a
 * promocion o a retirada. Ninguno promociona, sustituye ni retira nada por si
 * mismo: proponen, y la decision es de gobernanza.
 */
import {
  ageDays,
  causalLevelOf,
  confoundersOf,
  evidenceQualityOf,
  fidelityOf,
  focusExperience,
  lcheck,
  learningResult,
  maturityOf,
  measurementLevel,
  type LearningBlockResult,
  type LearningSnapshot,
  type PriorLearning,
} from "./learning-snapshot.js";

const active = (s: LearningSnapshot) => s.prior_learnings.filter((p) => p.status === "active");
const SIN_APRENDIZAJES = "Todavia no hay aprendizajes previos con gate: nada que reutilizar, contrastar ni mantener.";
export const STALE_AFTER_DAYS = 90;
const NEED_LEARNINGS = ["Aprendizajes previos con gate: outcomes clasificados por 9.12 sobre experiencias maduras."];

/** Dimensiones de contexto en que el aprendizaje y el presente difieren. */
function contextMismatches(p: PriorLearning, current: Record<string, string>): string[] {
  return Object.keys(p.context).filter((k) => current[k] !== undefined && current[k] !== p.context[k]);
}

// --- 9.10 Generalizacion y limites de aplicabilidad ------------------------

export function evaluateGeneralizationBoundary(s: LearningSnapshot): LearningBlockResult {
  const learnings = active(s);
  if (!learnings.length) return learningResult("9.10", "Generalizacion y limites de aplicabilidad", { block_decision: "SIN_APRENDIZAJES", status: "WAITING_FOR_EVIDENCE", why: SIN_APRENDIZAJES, next_evidence: NEED_LEARNINGS });
  const assessed = learnings.map((p) => {
    const mismatches = contextMismatches(p, s.current_context);
    const unknownBoundary = Object.keys(p.context).length === 0;
    return { id: p.id, decision: unknownBoundary ? "REVALIDAR" : mismatches.length ? "FUERA_DEL_LIMITE" : "REUTILIZACION_DIRECTA", mismatches };
  });
  const outside = assessed.filter((a) => a.decision !== "REUTILIZACION_DIRECTA");
  return learningResult("9.10", "Generalizacion y limites de aplicabilidad", {
    block_decision: outside.length ? "REVALIDACION_NECESARIA" : "DENTRO_DEL_LIMITE",
    status: outside.length ? "REVIEW_REQUIRED" : "READY",
    why: outside.length
      ? `${outside.length} aprendizaje(s) se aplicarian fuera de su contexto de origen: eso es una transferencia explicita que hay que revalidar, no una reutilizacion silenciosa.`
      : "Todos los aprendizajes vigentes estan dentro de su limite: el contexto de hoy coincide con el de origen.",
    payload: { learnings: assessed },
  });
}

// --- 9.11 Contextual learning -------------------------------------------------

export function evaluateContextualLearning(s: LearningSnapshot): LearningBlockResult {
  const learnings = active(s);
  if (!learnings.length) return learningResult("9.11", "Contextual learning", { block_decision: "SIN_APRENDIZAJES", status: "WAITING_FOR_EVIDENCE", why: SIN_APRENDIZAJES, next_evidence: NEED_LEARNINGS });
  const byMetric = new Map<string, PriorLearning[]>();
  for (const p of learnings) if (p.metric) byMetric.set(p.metric, [...(byMetric.get(p.metric) ?? []), p]);
  const decisions = learnings.map((p) => {
    const siblings = (p.metric && byMetric.get(p.metric)) || [];
    const splits = siblings.some((o) => o.id !== p.id && o.direction !== p.direction && contextMismatches(o, p.context).length > 0);
    const mismatches = contextMismatches(p, s.current_context);
    const decision = !Object.keys(p.context).length ? "REVALIDATE" : splits ? "SPLIT" : mismatches.length ? "ADAPT" : "REUSE";
    return { id: p.id, metric: p.metric, decision, moderators: mismatches };
  });
  const worst = ["REVALIDATE", "SPLIT", "ADAPT", "REUSE"].find((d) => decisions.some((x) => x.decision === d))!;
  return learningResult("9.11", "Contextual learning", {
    block_decision: worst,
    status: worst === "REUSE" ? "READY" : "REVIEW_REQUIRED",
    why: {
      REUSE: "El contexto relevante es equivalente: los aprendizajes se reutilizan tal cual.",
      ADAPT: "El mecanismo parece portable pero el contexto cambio en alguna dimension: hay que adaptar.",
      SPLIT: "La misma metrica se movio distinto en contextos distintos: el aprendizaje se parte por contexto.",
      REVALIDATE: "Hay aprendizajes sin contexto de origen: no se usan descontextualizados, se revalidan.",
    }[worst]!,
    payload: { learnings: decisions },
  });
}

// --- 9.22 Contradicciones entre aprendizajes ------------------------------------

export function evaluateLearningContradictions(s: LearningSnapshot): LearningBlockResult {
  const learnings = active(s);
  const pairs: { a: string; b: string; metric: string; kind: "CONTEXTUAL" | "REAL" }[] = [];
  for (let i = 0; i < learnings.length; i += 1) {
    for (let j = i + 1; j < learnings.length; j += 1) {
      const a = learnings[i]!;
      const b = learnings[j]!;
      if (!a.metric || a.metric !== b.metric || !a.direction || !b.direction || a.direction === b.direction) continue;
      pairs.push({ a: a.id, b: b.id, metric: a.metric, kind: contextMismatches(a, b.context).length ? "CONTEXTUAL" : "REAL" });
    }
  }
  const real = pairs.filter((p) => p.kind === "REAL");
  return learningResult("9.22", "Contradicciones entre aprendizajes", {
    block_decision: real.length ? "CONTRADICCION_SIN_RESOLVER" : pairs.length ? "CONTRADICCION_APARENTE" : "SIN_CONTRADICCIONES",
    status: real.length ? "REVIEW_REQUIRED" : learnings.length ? "READY" : "WAITING_FOR_EVIDENCE",
    why: real.length
      ? `${real.length} par(es) de aprendizajes dicen lo contrario en el mismo contexto: no se elige uno a ciegas, se baja la confianza y se pide mas evidencia. Un unico numero de confianza no puede esconder el conflicto.`
      : pairs.length
        ? "Hay direcciones opuestas, pero en contextos distintos: se conservan ambos con sus condiciones de aplicacion."
        : learnings.length
          ? "Los aprendizajes vigentes no se contradicen."
          : SIN_APRENDIZAJES,
    payload: { pairs },
    next_evidence: real.length ? ["Evidencia nueva en ese contexto para decidir entre los dos aprendizajes."] : learnings.length ? [] : NEED_LEARNINGS,
  });
}

// --- 9.23 Decay, obsolescencia y drift ------------------------------------------

const STRUCTURAL = /price|precio|channel|canal|platform|plataforma|tracking|catalog|catalogo|business_model|modelo/i;

export function evaluateDecayDrift(s: LearningSnapshot): LearningBlockResult {
  const learnings = active(s);
  if (!learnings.length) return learningResult("9.23", "Decay, obsolescencia y drift", { block_decision: "SIN_APRENDIZAJES", status: "WAITING_FOR_EVIDENCE", why: SIN_APRENDIZAJES, next_evidence: NEED_LEARNINGS });
  const assessed = learnings.map((p) => {
    const stale = (ageDays(p.evaluated_at, s.as_of) ?? 0) > STALE_AFTER_DAYS;
    const breaks = s.context_events.filter((e) => e.occurred_at > p.evaluated_at && STRUCTURAL.test(e.event_type)).map((e) => e.event_type);
    const drift = s.signals_30d.some((sig) => sig.metric === p.metric && p.direction && sig.direction !== p.direction);
    const state = breaks.length ? "RUPTURA_ESTRUCTURAL" : drift ? "DRIFT" : stale ? "STALE" : "VIGENTE";
    return { id: p.id, state, breaks, drift, stale };
  });
  const worst = ["RUPTURA_ESTRUCTURAL", "DRIFT", "STALE", "VIGENTE"].find((st) => assessed.some((a) => a.state === st))!;
  return learningResult("9.23", "Decay, obsolescencia y drift", {
    block_decision: worst,
    status: worst === "VIGENTE" ? "READY" : worst === "STALE" ? "WAITING_FOR_EVIDENCE" : "REVIEW_REQUIRED",
    why: {
      RUPTURA_ESTRUCTURAL: "Cambio algo estructural despues del aprendizaje: no se asume que siga valiendo; se limita su uso hasta revalidar.",
      DRIFT: "Las senales recientes van en contra de lo aprendido: se reduce la confianza o el alcance.",
      STALE: `Hay aprendizajes sin revalidar en mas de ${STALE_AFTER_DAYS} dias: se usan con menos confianza y se busca evidencia reciente.`,
      VIGENTE: "Los aprendizajes siguen vigentes en el contexto actual.",
    }[worst]!,
    payload: { learnings: assessed, stale_after_days: STALE_AFTER_DAYS },
  });
}

// --- 9.24 Exploration vs exploitation ---------------------------------------------

export function evaluateExplorationExploitation(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  const measurementOk = measurementLevel(s) !== "LOW" && measurementLevel(s) !== "UNKNOWN";
  if (!e && !active(s).length) return learningResult("9.24", "Exploration vs exploitation", { block_decision: "SIN_BASE", status: "WAITING_FOR_EVIDENCE", why: "Sin experiencias ni aprendizajes no hay nada que explotar ni incertidumbre medida que explorar.", next_evidence: ["Una intervencion cerrada o un aprendizaje previo."] });
  const strong = e ? evidenceQualityOf(e, s).level === "HIGH" && causalLevelOf(e, s) === "causal_plausible" : false;
  const drifting = active(s).some((p) => s.signals_30d.some((sig) => sig.metric === p.metric && sig.direction !== p.direction));
  const decision = !measurementOk ? "EXPLORACION_BLOQUEADA" : strong && !drifting ? "EXPLOTAR" : "EXPLORAR_ACOTADO";
  return learningResult("9.24", "Exploration vs exploitation", {
    block_decision: decision,
    status: decision === "EXPLORACION_BLOQUEADA" ? "BLOCKED" : "READY",
    why: decision === "EXPLOTAR"
      ? "Evidencia fuerte, contexto estable y sin drift: se explota lo conocido."
      : decision === "EXPLORAR_ACOTADO"
        ? "Hay incertidumbre o drift: se explora, con exposicion limitada, presupuesto y condiciones de parada."
        : "La medicion no es fiable: explorar sin poder medir no aporta informacion.",
    checks: [lcheck("measurement", measurementOk ? "PASS" : "FAIL", "Medicion valida antes de explorar.")],
    payload: { strong_evidence: strong, drift: drifting },
  });
}

// --- 9.25 Learning loops ------------------------------------------------------------

export function evaluateLearningLoops(s: LearningSnapshot): LearningBlockResult {
  if (!s.experiences.length) return learningResult("9.25", "Learning loops", { block_decision: "SIN_LOOPS", status: "WAITING_FOR_EVIDENCE", why: "Ninguna intervencion ha abierto un ciclo de aprendizaje.", next_evidence: ["Una intervencion ejecutada y cerrada por F8."] });
  const loops = s.experiences.map((e) => {
    const fidelity = fidelityOf(e);
    const maturity = maturityOf(e, s.as_of);
    const q = evidenceQualityOf(e, s).level;
    const state = fidelity === "LOW" || fidelity === "NOT_EXECUTED" ? "FAILED_EXECUTION"
      : maturity !== "MATURE" || !e.observed_effect ? "OPEN"
        : q === "MEDIUM" || q === "HIGH" ? "LEARNED" : "INCONCLUSIVE";
    return { experience_id: e.id, state };
  });
  const open = loops.filter((l) => l.state === "OPEN").length;
  const learned = loops.filter((l) => l.state === "LEARNED").length;
  return learningResult("9.25", "Learning loops", {
    block_decision: learned ? "LOOPS_CERRADOS_CON_APRENDIZAJE" : open ? "LOOPS_ABIERTOS" : "LOOPS_CERRADOS_SIN_APRENDIZAJE",
    status: learned ? "READY" : "WAITING_FOR_EVIDENCE",
    why: open
      ? `${open} ciclo(s) siguen abiertos: no se cierran hasta saber que se hizo y que ocurrio.`
      : learned
        ? `${learned} ciclo(s) cerrados con aprendizaje.`
        : "Los ciclos se cerraron como inconclusos o con ejecucion fallida.",
    next_evidence: open ? ["Outcome maduro y medido de los ciclos abiertos."] : learned ? [] : ["Ejecuciones fieles con outcome medido."],
    payload: { loops, by_state: loops.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.state]: (acc[l.state] ?? 0) + 1 }), {}) },
  });
}

// --- 9.26 Knowledge promotion ---------------------------------------------------

export const PROMOTION_MIN_EXPERIENCES = 3;

export function promotionCandidates(s: LearningSnapshot) {
  const groups = new Map<string, PriorLearning[]>();
  for (const p of active(s)) {
    if (!p.metric || !p.direction || (p.classification !== "POSITIVE" && p.classification !== "NEGATIVE")) continue;
    const key = `${p.metric}:${p.direction}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()]
    .filter(([, ps]) => new Set(ps.map((p) => p.experience_id)).size >= PROMOTION_MIN_EXPERIENCES)
    .map(([key, ps]) => ({ key, experiences: [...new Set(ps.map((p) => p.experience_id))], target: "tenant" as const }));
}

export function evaluateKnowledgePromotion(s: LearningSnapshot): LearningBlockResult {
  const candidates = promotionCandidates(s);
  const contradicted = evaluateLearningContradictions(s).block_decision === "CONTRADICCION_SIN_RESOLVER";
  return learningResult("9.26", "Knowledge promotion", {
    block_decision: !candidates.length ? "SIN_CANDIDATOS" : contradicted ? "CANDIDATO_CON_CONTRADICCION" : "CANDIDATO_A_REVISION",
    status: candidates.length ? "REVIEW_REQUIRED" : "WAITING_FOR_EVIDENCE",
    why: !candidates.length
      ? `Ningun patron se repite en ${PROMOTION_MIN_EXPERIENCES} experiencias independientes: no hay candidato a promocion.`
      : contradicted
        ? "Hay candidatos, pero conviven con una contradiccion sin resolver: se contextualizan y se mantienen como candidatos."
        : "Hay patrones repetidos: se proponen a revision como conocimiento de esta tienda. La promocion nunca es automatica.",
    checks: [lcheck("auto_promotion", "PASS", "Nada se promociona sin revision.")],
    payload: { candidates, min_experiences: PROMOTION_MIN_EXPERIENCES },
    next_evidence: candidates.length ? [] : [`El mismo patron en ${PROMOTION_MIN_EXPERIENCES} experiencias independientes.`],
  });
}

// --- 9.27 Contradiccion y supersession --------------------------------------------

export function evaluateSupersession(s: LearningSnapshot): LearningBlockResult {
  const learnings = active(s);
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  const proposals: { predecessor: string; successor: string; metric: string }[] = [];
  for (const newer of learnings) {
    for (const older of learnings) {
      if (newer.id === older.id || newer.metric !== older.metric || !newer.metric) continue;
      if (newer.evaluated_at <= older.evaluated_at || newer.direction === older.direction) continue;
      if (contextMismatches(older, newer.context).length) continue;
      if (rank[newer.confidence] > rank[older.confidence]) proposals.push({ predecessor: older.id, successor: newer.id, metric: newer.metric });
    }
  }
  return learningResult("9.27", "Contradiccion de conocimiento y supersession", {
    block_decision: proposals.length ? "SUPERSESSION_PROPUESTA" : learnings.length ? "COEXISTENCIA" : "SIN_CONOCIMIENTO",
    status: proposals.length ? "REVIEW_REQUIRED" : learnings.length ? "READY" : "WAITING_FOR_EVIDENCE",
    why: proposals.length
      ? "Un aprendizaje mas reciente y con mas confianza contradice a otro en el mismo contexto: se propone sustituirlo, conservando el linaje y el historico."
      : learnings.length
        ? "No hay conflicto que justifique sustituir conocimiento."
        : SIN_APRENDIZAJES,
    payload: { proposals },
    next_evidence: learnings.length ? [] : NEED_LEARNINGS,
  });
}

// --- 9.28 Anti-learning ----------------------------------------------------------------

export function evaluateAntiLearning(s: LearningSnapshot): LearningBlockResult {
  const e = focusExperience(s);
  if (!e) return learningResult("9.28", "Anti-learning y proteccion frente a conclusiones erroneas", { block_decision: "ABSTENERSE", status: "WAITING_FOR_EVIDENCE", why: "Sin experiencia no hay conclusion que filtrar.", next_evidence: ["Una intervencion cerrada con outcome medido."] });
  const measurement = measurementLevel(s);
  const fidelity = fidelityOf(e);
  const maturity = maturityOf(e, s.as_of);
  const confounders = confoundersOf(e, s).length;
  const onlySuccess = s.experiences.length >= 3 && s.experiences.every((x) => x.operational_outcome === "SUCCESS");
  const gates = [
    lcheck("data_quality", measurement === "UNKNOWN" ? "UNKNOWN" : measurement === "LOW" ? "FAIL" : "PASS", `D01: ${measurement}.`),
    lcheck("execution", fidelity === "HIGH" || fidelity === "PARTIAL" ? "PASS" : fidelity === "UNKNOWN" ? "UNKNOWN" : "FAIL", `Fidelidad: ${fidelity}.`),
    lcheck("outcome", e.observed_effect && (maturity === "MATURE" || maturity === "INTERIM") ? "PASS" : "FAIL", `Outcome ${e.observed_effect ? "medido" : "sin medir"}, madurez ${maturity}.`),
    lcheck("attribution", confounders ? "FAIL" : "PASS", `${confounders} confusor(es) en la ventana.`),
    lcheck("bias", onlySuccess ? "FAIL" : "PASS", onlySuccess ? "Solo se ven exitos: posible sesgo de supervivencia." : "Sin sesgo de seleccion evidente."),
  ];
  const veto = measurement === "LOW" || fidelity === "NOT_EXECUTED" || fidelity === "UNKNOWN";
  const failed = gates.filter((g) => g.status !== "PASS").length;
  const decision = veto ? "CUARENTENA" : !e.observed_effect ? "ABSTENERSE" : failed === 0 ? "VALIDAR" : failed === 1 ? "REDUCIR_CONFIANZA" : "RECHAZAR";
  return learningResult("9.28", "Anti-learning y proteccion frente a conclusiones erroneas", {
    block_decision: decision,
    status: decision === "VALIDAR" ? "READY" : decision === "REDUCIR_CONFIANZA" ? "REVIEW_REQUIRED" : decision === "ABSTENERSE" ? "WAITING_FOR_EVIDENCE" : "BLOCKED",
    why: {
      VALIDAR: "La cadena de evidencia pasa todos los filtros.",
      REDUCIR_CONFIANZA: "Un filtro no pasa: la conclusion se debilita antes de reforzar la historia.",
      RECHAZAR: "Varios filtros fallan: la conclusion no se acepta.",
      CUARENTENA: "El dato o la ejecucion no son fiables: el aprendizaje queda en cuarentena y con veto de promocion.",
      ABSTENERSE: "Sin outcome medido no hay conclusion: abstenerse es la salida correcta.",
    }[decision]!,
    checks: gates,
    payload: { promotion_veto: veto },
    next_evidence: gates.filter((g) => g.status !== "PASS").map((g) => g.detail),
  });
}

// --- 9.29 Feedback loops peligrosos --------------------------------------------------

export function evaluateDangerousFeedbackLoops(s: LearningSnapshot): LearningBlockResult {
  if (s.experiences.length < 3) return learningResult("9.29", "Feedback loops peligrosos", { block_decision: "SIN_VOLUMEN", status: "WAITING_FOR_EVIDENCE", why: "Con menos de tres intervenciones no se puede ver amplificacion ni concentracion.", next_evidence: ["Al menos tres intervenciones cerradas."] });
  const recentIncidents = s.experiences.filter((e) => (e.incident || e.rolled_back) && (ageDays(e.closed_at, s.as_of) ?? 999) <= 30).length;
  const byRecommendation = s.experiences.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.recommendation_id ?? "?"]: (acc[e.recommendation_id ?? "?"] ?? 0) + 1 }), {});
  const top = Math.max(...Object.values(byRecommendation));
  const concentration = top / s.experiences.length;
  const decision = recentIncidents >= 2 ? "CIRCUIT_BREAKER" : concentration > 0.7 ? "CONCENTRACION" : "SIN_AMPLIFICACION";
  return learningResult("9.29", "Feedback loops peligrosos", {
    block_decision: decision,
    status: decision === "CIRCUIT_BREAKER" ? "BLOCKED" : decision === "CONCENTRACION" ? "REVIEW_REQUIRED" : "READY",
    why: decision === "CIRCUIT_BREAKER"
      ? `${recentIncidents} incidentes en 30 dias: se frena la amplificacion antes de seguir aprendiendo.`
      : decision === "CONCENTRACION"
        ? "Casi todas las intervenciones repiten la misma recomendacion: la exposicion propia no es prueba de que haya que exponer mas; se mantiene exploracion."
        : "No hay concentracion ni amplificacion.",
    payload: { concentration, recent_incidents: recentIncidents },
  });
}

// --- 9.33 Forgetting, invalidacion y retirada ----------------------------------------

export function evaluateForgettingWithdrawal(s: LearningSnapshot): LearningBlockResult {
  const invalidExperiences = new Set(
    s.experiences.filter((e) => e.verification_status === "FAILED" || fidelityOf(e) === "NOT_EXECUTED").map((e) => e.id),
  );
  const toWithdraw = active(s).filter((p) => invalidExperiences.has(p.experience_id)).map((p) => p.id);
  const lingering = s.prior_learnings.filter((p) => p.status !== "active").length;
  return learningResult("9.33", "Forgetting, invalidacion y retirada", {
    block_decision: toWithdraw.length ? "RETIRADA_PROPUESTA" : "NADA_QUE_RETIRAR",
    status: toWithdraw.length ? "REVIEW_REQUIRED" : "READY",
    why: toWithdraw.length
      ? `${toWithdraw.length} aprendizaje(s) se apoyan en experiencias que resultaron invalidas: se propone retirarlos, dejando constancia minima de que existieron.`
      : "Ningun aprendizaje vigente se apoya en evidencia invalidada.",
    payload: { withdraw: toWithdraw, retired_or_superseded: lingering },
  });
}

// --- 9.38 Aprendizaje a largo plazo ------------------------------------------------

export function evaluateLongTermLearning(s: LearningSnapshot): LearningBlockResult {
  const learnings = active(s);
  if (!learnings.length) return learningResult("9.38", "Aprendizaje a largo plazo", { block_decision: "SIN_HISTORIA", status: "WAITING_FOR_EVIDENCE", why: SIN_APRENDIZAJES, next_evidence: NEED_LEARNINGS });
  const groups = new Map<string, PriorLearning[]>();
  for (const p of learnings) if (p.metric && p.direction) groups.set(`${p.metric}:${p.direction}`, [...(groups.get(`${p.metric}:${p.direction}`) ?? []), p]);
  const consolidable = [...groups.entries()]
    .filter(([, ps]) => ps.length >= 3 && (ageDays(ps.map((p) => p.evaluated_at).sort()[0]!, s.as_of) ?? 0) >= 90)
    .map(([key]) => key);
  const dormant = learnings.filter((p) => s.context_events.some((e) => e.occurred_at > p.evaluated_at && STRUCTURAL.test(e.event_type))).map((p) => p.id);
  return learningResult("9.38", "Aprendizaje a largo plazo", {
    block_decision: consolidable.length ? "CONSOLIDABLE" : dormant.length ? "DORMANT" : "REVALIDACION_PROGRAMADA",
    status: consolidable.length || dormant.length ? "REVIEW_REQUIRED" : "READY",
    why: consolidable.length
      ? "Hay patrones que se repiten a lo largo de mas de tres meses: se pueden consolidar conservando alcance, excepciones y procedencia."
      : dormant.length
        ? "Parte del conocimiento se quedo fuera de contexto tras un cambio estructural: pasa a dormido hasta que el contexto vuelva."
        : "El conocimiento es reciente: se revalida segun su volatilidad.",
    payload: { consolidable, dormant },
  });
}
