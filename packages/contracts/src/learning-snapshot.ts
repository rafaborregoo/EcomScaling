/**
 * F9: la foto que leen los 40 bloques de aprendizaje continuo.
 *
 * Hasta el 2026-09-25 los 40 bloques compartian un unico evaluador en el que
 * `block_code` no cambiaba la logica. Ahora cada bloque tiene su evaluador y
 * todos leen esta misma foto, construida por el motor desde tablas reales:
 * cierres de F8 (la experiencia), planes, transiciones del ciclo de vida,
 * aprobaciones humanas, readiness, autonomia, priorizacion, playbooks, calidad
 * del dato (D01), eventos de contexto (D02), senales (D05) y los aprendizajes
 * previos del propio F9.
 *
 * Dos invariantes que ningun bloque puede romper (IMPLEMENTACION F9 y 9.19,
 * 9.26, 9.30): ningun resultado promociona conocimiento por si mismo ni cambia
 * la autoridad de la IA. Por eso `promotes_knowledge` y `changes_authority`
 * son literales `false`.
 */

export const F9_BLOCK_CODES = [
  "9.00", "9.01", "9.03", "9.04", "9.05", "9.06", "9.07", "9.08", "9.09", "9.10", "9.11", "9.12",
  "9.13", "9.14", "9.15", "9.16", "9.17", "9.18", "9.19", "9.20", "9.22", "9.23", "9.24", "9.25",
  "9.26", "9.27", "9.28", "9.29", "9.30", "9.31", "9.32", "9.33", "9.34", "9.35", "9.36", "9.37",
  "9.38", "9.39", "9.40", "9.41",
] as const;
export type F9BlockCode = (typeof F9_BLOCK_CODES)[number];

export const LEARNING_CLASSIFICATIONS = ["POSITIVE", "NEGATIVE", "NEUTRAL", "INCONCLUSIVE", "MIXED"] as const;
export const LEARNING_STATUSES = ["READY", "WAITING_FOR_EVIDENCE", "BLOCKED", "REVIEW_REQUIRED"] as const;
export const LEARNING_CONFIDENCE = ["LOW", "MEDIUM", "HIGH"] as const;
export type LearningClassification = (typeof LEARNING_CLASSIFICATIONS)[number];
export type LearningStatus = (typeof LEARNING_STATUSES)[number];
export type LearningConfidence = (typeof LEARNING_CONFIDENCE)[number];

export type EvidenceLevel = "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH";

/** Una experiencia: una intervencion cerrada por F8 con su contexto. */
export type LearningExperience = {
  id: string;
  intervention_id: string;
  recommendation_id: string | null;
  started_at: string | null;
  closed_at: string;
  closure_state: string;
  /** SUCCESS, PARTIAL_SUCCESS, FAILED, ABORTED, ROLLED_BACK, INCONCLUSIVE, NOT_EXECUTED. */
  operational_outcome: string;
  /** VERIFIED, PARTIALLY_VERIFIED, FAILED, INCONCLUSIVE, UNKNOWN. */
  verification_status: string;
  /** EARLY, MATURE, INCOMPLETE (vocabulario de 8.16). */
  closure_maturity: string;
  tasks: { total: number; completed: number; blocked: number } | null;
  planned_actions: number | null;
  rolled_back: boolean;
  incident: boolean;
  /** Estado esperado y real que F8 dejo escritos al cerrar. */
  expected_state: string | null;
  actual_state: string | null;
  /** Efecto de negocio medido sobre la metrica objetivo. Hoy no hay fuente: null. */
  observed_effect: { metric: string; direction: "up" | "down" | "flat"; material: boolean } | null;
  expected_effect: { metric: string | null; direction: "up" | "down" | null } | null;
  sample_sufficient: boolean | null;
  human: { approved: boolean | null; modified: boolean; rejected: boolean };
  unknowns: string[];
};

/** Un aprendizaje previo del propio F9 (lo que 9.12 dejo con gate). */
export type PriorLearning = {
  id: string;
  experience_id: string;
  metric: string | null;
  direction: "up" | "down" | "flat" | null;
  classification: LearningClassification;
  confidence: LearningConfidence;
  context: Record<string, string>;
  evaluated_at: string;
  status: "active" | "superseded" | "withdrawn";
};

export type LearningSnapshot = {
  organization_id: string;
  as_of: string;
  experiences: LearningExperience[];
  prior_learnings: PriorLearning[];
  approvals: { decision: "approved" | "rejected"; reason_category: string | null; decided_at: string }[];
  readiness: { decision: string; blockers: string[]; evaluated_at: string }[];
  autonomy: { autonomy_level: string; approval_state: string; execution_state: string; evaluated_at: string }[];
  prioritization: { primary_candidate_id: string | null; disposition: string; evaluated_at: string }[];
  playbooks: { domain: string; disposition: string; evaluated_at: string }[];
  data_quality: { reliability: string | null; coverage: string | null } | null;
  context_events: { event_type: string; source: string; occurred_at: string; ended_at: string | null }[];
  current_context: Record<string, string>;
  signals_30d: { metric: string; direction: string; trajectory: string | null }[];
  expected_outcomes_available: boolean;
  /** Fuentes de otras tiendas en la foto. El motor nunca las carga: siempre 0. */
  cross_tenant_sources: number;
};

// --- Resultado comun --------------------------------------------------------

export type LearningCheck = { id: string; status: "PASS" | "FAIL" | "UNKNOWN"; detail: string };

export type LearningBlockResult = {
  block: F9BlockCode;
  title: string;
  /** El estado propio del bloque, en su vocabulario. */
  block_decision: string;
  status: LearningStatus;
  classification: LearningClassification;
  confidence: LearningConfidence;
  gate: boolean;
  why: string;
  checks: LearningCheck[];
  payload: Record<string, unknown>;
  next_evidence: string[];
  promotes_knowledge: false;
  changes_authority: false;
};

export const lcheck = (id: string, status: LearningCheck["status"], detail: string): LearningCheck => ({ id, status, detail });

export function learningResult(
  block: F9BlockCode,
  title: string,
  fields: {
    block_decision: string;
    status: LearningStatus;
    why: string;
    checks?: LearningCheck[];
    payload?: Record<string, unknown>;
    next_evidence?: string[];
    classification?: LearningClassification;
    confidence?: LearningConfidence;
  },
): LearningBlockResult {
  const status = fields.status;
  return {
    block,
    title,
    block_decision: fields.block_decision,
    status,
    classification: fields.classification ?? "INCONCLUSIVE",
    confidence: fields.confidence ?? "LOW",
    gate: status === "READY",
    why: fields.why,
    checks: fields.checks ?? [],
    payload: fields.payload ?? {},
    next_evidence: [...new Set((fields.next_evidence ?? []).filter(Boolean))],
    promotes_knowledge: false,
    changes_authority: false,
  };
}

// --- Derivados compartidos ---------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
export const ageDays = (from: string | null, to: string) =>
  from ? Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / DAY) : null;

/** Experiencias ordenadas de la mas reciente a la mas antigua. */
export const byRecency = (s: LearningSnapshot) =>
  [...s.experiences].sort((a, b) => b.closed_at.localeCompare(a.closed_at));

/** La experiencia sobre la que se razona: la ultima cerrada. */
export const focusExperience = (s: LearningSnapshot) => byRecency(s)[0] ?? null;

/**
 * 9.03: fidelidad de ejecucion. Se mide contra las tareas que F8 conto al
 * cerrar; sin ese recuento es UNKNOWN, nunca "se ejecuto el plan".
 */
export type Fidelity = "HIGH" | "PARTIAL" | "LOW" | "ROLLED_BACK" | "NOT_EXECUTED" | "UNKNOWN";
export function fidelityOf(e: LearningExperience): Fidelity {
  if (e.operational_outcome === "NOT_EXECUTED") return "NOT_EXECUTED";
  if (e.rolled_back || e.operational_outcome === "ROLLED_BACK") return "ROLLED_BACK";
  if (!e.tasks || e.tasks.total === 0) return "UNKNOWN";
  const ratio = e.tasks.completed / e.tasks.total;
  if (ratio >= 1 && e.verification_status === "VERIFIED") return "HIGH";
  if (ratio >= 0.5) return "PARTIAL";
  return "LOW";
}

/**
 * 9.08: madurez del outcome. La de F8 es operacional; el efecto de negocio
 * necesita ademas tiempo desde el cierre. Se queda con la mas prudente.
 */
export type Maturity = "IMMATURE" | "EARLY_SIGNAL" | "INTERIM" | "MATURE";
export const OUTCOME_HORIZON_DAYS = 28;
export function maturityOf(e: LearningExperience, asOf: string): Maturity {
  const age = ageDays(e.closed_at, asOf) ?? 0;
  const byTime: Maturity = age < 3 ? "IMMATURE" : age < 14 ? "EARLY_SIGNAL" : age < OUTCOME_HORIZON_DAYS ? "INTERIM" : "MATURE";
  const byClosure: Maturity = e.closure_maturity === "MATURE" ? "MATURE" : e.closure_maturity === "EARLY" ? "EARLY_SIGNAL" : "IMMATURE";
  const order: Maturity[] = ["IMMATURE", "EARLY_SIGNAL", "INTERIM", "MATURE"];
  return order[Math.min(order.indexOf(byTime), order.indexOf(byClosure))]!;
}

/** D01 a nivel de calidad de medicion. */
export function measurementLevel(s: LearningSnapshot): EvidenceLevel {
  const r = s.data_quality?.reliability;
  if (!r) return "UNKNOWN";
  if (r === "high") return "HIGH";
  if (r === "medium") return "MEDIUM";
  return "LOW";
}

/** 9.06: lo que pasaba a la vez. Eventos de contexto y otras intervenciones en la ventana. */
export function confoundersOf(e: LearningExperience, s: LearningSnapshot): string[] {
  const start = new Date(e.started_at ?? e.closed_at).getTime() - 7 * DAY;
  const end = new Date(e.closed_at).getTime();
  const overlaps = (from: string, to: string | null) =>
    new Date(from).getTime() <= end && new Date(to ?? from).getTime() >= start;
  const events = s.context_events
    .filter((ev) => overlaps(ev.occurred_at, ev.ended_at))
    .map((ev) => `evento:${ev.event_type}`);
  const concurrent = s.experiences
    .filter((o) => o.id !== e.id && overlaps(o.started_at ?? o.closed_at, o.closed_at))
    .map((o) => `intervencion:${o.intervention_id}`);
  return [...new Set([...events, ...concurrent])];
}

/** 9.04: calidad de la evidencia de una experiencia, con sus razones. */
export function evidenceQualityOf(e: LearningExperience, s: LearningSnapshot) {
  const measurement = measurementLevel(s);
  const maturity = maturityOf(e, s.as_of);
  const missing: string[] = [];
  if (measurement === "UNKNOWN") missing.push("calidad de medicion (D01)");
  if (e.sample_sufficient === null) missing.push("tamano de muestra");
  if (!e.observed_effect) missing.push("efecto medido sobre la metrica objetivo");
  let level: EvidenceLevel;
  if (!e.observed_effect || measurement === "UNKNOWN") level = "UNKNOWN";
  else if (measurement === "LOW" || e.sample_sufficient === false || maturity === "IMMATURE") level = "LOW";
  else if (measurement === "HIGH" && e.sample_sufficient && maturity === "MATURE") level = "HIGH";
  else level = "MEDIUM";
  return { level, measurement, maturity, missing };
}

/**
 * 9.05: nivel causal alcanzable. Sin grupo de control ni holdout en la
 * plataforma, el techo es `causal_plausible`: temporalidad, mecanismo esperado,
 * ejecucion fiel y ningun confusor en la ventana. Nunca incremental.
 */
export type CausalLevel = "descriptiva" | "asociativa" | "causal_plausible" | "causal_respaldada" | "incremental_cuantificada";
export function causalLevelOf(e: LearningExperience, s: LearningSnapshot): CausalLevel {
  if (!e.observed_effect) return "descriptiva";
  const expectedMatches =
    e.expected_effect?.direction != null && e.expected_effect.direction === e.observed_effect.direction;
  if (!expectedMatches) return "asociativa";
  if (fidelityOf(e) === "HIGH" && confoundersOf(e, s).length === 0) return "causal_plausible";
  return "asociativa";
}

export const levelRank = (l: EvidenceLevel) => ({ UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3 })[l];
export const confidenceFrom = (l: EvidenceLevel): LearningConfidence => (l === "HIGH" ? "HIGH" : l === "MEDIUM" ? "MEDIUM" : "LOW");
