/**
 * FASE 3 / D04 — de la salud de una capacidad a lo que se lee en pantalla.
 *
 * Aparte del componente, como el resto de la fase: aqui estan las decisiones, y
 * las decisiones se prueban sin montar React.
 *
 * LAS DOS DECISIONES DE FONDO:
 *
 * 1. **Estado y trayectoria no se funden nunca.** El apartado 3 lo dice con el
 *    ejemplo que lo explica todo: BAD mejorando y HEALTHY cayendo en picado son
 *    situaciones muy distintas, y una sola etiqueta las iguala. En pantalla son
 *    dos cosas separadas, y `trajectoryLabel` devuelve `null` cuando no se sabe
 *    en vez de inventarse "estable".
 *
 * 2. **La severidad es del hallazgo, no de la capacidad** (apartado 13,
 *    guardrail 6). Un problema grave y localizado no pinta de rojo una capacidad
 *    que funciona, asi que el color de la tarjeta sale del `health_state` y
 *    nunca del peor de sus hallazgos.
 *
 * Y la tercera, que hoy es la que mas se ve: `not_assessable` **no es un error
 * ni un hueco**. Es una respuesta, y su contenido principal es lo que falta
 * declarar. Se lee como una instruccion, no como un fallo del sistema.
 */

export type HealthTone = "neutral" | "brand" | "success" | "warn" | "danger";

export type HealthFindingView = {
  kind: string;
  description: string;
  severity: string;
  scope: string;
  impact: string | null;
  trajectory: string | null;
  confidence: string;
};

export type HealthEvidenceView = {
  relation: string;
  metric: string;
  observation: string;
  indicator_type: string;
  window_start: string | null;
  window_end: string | null;
  source: string | null;
  confidence: string;
};

export type CapabilityHealthView = {
  id: string;
  organization_name: string | null;
  capability: string;
  scope: string;
  health_state: string;
  trajectory: string | null;
  near_term_risk: string;
  risk_horizon: string | null;
  has_leading_signals: boolean;
  structural_risk: string;
  chronicity: string | null;
  issue_role: string | null;
  impact_vector: string[];
  current_failure: string | null;
  maturity_profile_id: string | null;
  confidence: string;
  assessment_blocker: string | null;
  contradiction_resolution: string | null;
  state_justification: string | null;
  assessed_at: string;
  findings: HealthFindingView[];
  evidence: HealthEvidenceView[];
};

const CAPACIDAD_EN_PALABRAS: Record<string, string> = {
  market: "Mercado",
  product: "Producto",
  offer: "Oferta",
  unit_economics: "Economía unitaria",
  acquisition: "Adquisición",
  creative: "Creatividades",
  conversion: "Conversión",
  retention: "Retención",
  inventory: "Inventario",
  operations: "Operativa",
  finance: "Finanzas",
  data: "Datos",
  technology: "Tecnología",
  team: "Equipo",
  strategy: "Estrategia",
};

export function capabilityLabel(capability: string): string {
  return CAPACIDAD_EN_PALABRAS[capability] ?? capability;
}

/**
 * El estado, dicho como lo que permite hacer.
 *
 * `not_assessable` no lleva tono de peligro: no saber no es una mala noticia
 * sobre el negocio, es una tarea nuestra. Pintarlo de rojo le diria al consultor
 * que la tienda va mal cuando lo que pasa es que falta una declaracion.
 */
export function stateLabel(state: string): { label: string; tone: HealthTone } {
  switch (state) {
    case "elite":
      return { label: "Élite", tone: "success" };
    case "healthy":
      return { label: "Sana", tone: "success" };
    case "fragile":
      return { label: "Frágil", tone: "warn" };
    case "bad":
      return { label: "Mal", tone: "danger" };
    case "critical":
      return { label: "Crítica", tone: "danger" };
    case "disaster":
      return { label: "Desastre", tone: "danger" };
    case "unknown":
      return { label: "Sin determinar", tone: "neutral" };
    default:
      return { label: "No evaluable", tone: "neutral" };
  }
}

/**
 * La trayectoria, **aparte** del estado.
 *
 * Devuelve `null` cuando no consta, y la pantalla entonces no escribe nada. Un
 * "estable" por defecto seria afirmar que no se mueve, que es una afirmacion y
 * no la tenemos.
 */
export function trajectoryLabel(trajectory: string | null): string | null {
  switch (trajectory) {
    case "improving":
      return "mejorando";
    case "recovering":
      return "recuperándose";
    case "stable":
      return "estable";
    case "deteriorating":
      return "empeorando";
    case "rapidly_deteriorating":
      return "empeorando rápido";
    case "volatile":
      return "inestable";
    default:
      return null;
  }
}

/**
 * El riesgo a corto, con la condicion del guardrail 25 dicha en pantalla.
 *
 * Si no hay indicadores adelantados, la pantalla lo avisa en vez de dar un
 * riesgo bajo por bueno: mirando solo los rezagados, el aviso llega con el dano
 * hecho, y eso hay que saberlo al leer el "bajo".
 */
export function riskNote(assessment: CapabilityHealthView): string | null {
  if (!assessment.has_leading_signals) {
    return "Sin indicadores adelantados: lo que se ve aquí confirma, no avisa.";
  }
  const horizonte = assessment.risk_horizon
    ? ` (horizonte ${assessment.risk_horizon})`
    : "";
  switch (assessment.near_term_risk) {
    case "critical":
      return `Riesgo crítico a corto plazo${horizonte}.`;
    case "high":
      return `Riesgo alto a corto plazo${horizonte}.`;
    case "moderate":
      return `Riesgo moderado a corto plazo${horizonte}.`;
    default:
      return null;
  }
}

/**
 * La severidad de un hallazgo, que es suya y no de la capacidad.
 *
 * `business_threat` existe en el esquema y se dice entero: acortarlo a "crítico"
 * lo confundiria con el estado de la capacidad, que es justo la mezcla que el
 * guardrail 6 prohibe.
 */
export function severityLabel(severity: string): { label: string; tone: HealthTone } {
  switch (severity) {
    case "business_threat":
      return { label: "Amenaza al negocio", tone: "danger" };
    case "critical":
      return { label: "Crítica", tone: "danger" };
    case "high":
      return { label: "Alta", tone: "warn" };
    case "moderate":
      return { label: "Moderada", tone: "brand" };
    case "low":
      return { label: "Baja", tone: "neutral" };
    default:
      return { label: "Informativa", tone: "neutral" };
  }
}

/**
 * Lo que contradice el estado, separado de lo que lo apoya.
 *
 * Guardrails 26, 27 y 28: la evidencia positiva cuenta, la que contradice no se
 * tira, y la inconsistencia se resuelve por escrito. Nada de eso se puede hacer
 * si la pantalla las funde en una lista.
 */
export function splitEvidence(assessment: CapabilityHealthView): {
  apoya: HealthEvidenceView[];
  contradice: HealthEvidenceView[];
  positiva: HealthEvidenceView[];
} {
  return {
    apoya: assessment.evidence.filter((e) => e.relation === "supporting"),
    contradice: assessment.evidence.filter((e) => e.relation === "contradicting"),
    positiva: assessment.evidence.filter((e) => e.relation === "positive"),
  };
}

/**
 * Las que se pueden juzgar y las que no, por separado.
 *
 * No se ordena por gravedad: ordenar capacidades de peor a mejor es pintar una
 * prioridad, y D04 no la tiene (es uno de los diez guardrails `X != SALUD`).
 * Dentro de cada grupo van alfabeticas por su nombre en pantalla, que es un
 * orden que no dice nada y por eso no miente.
 */
export function splitByAssessability(assessments: CapabilityHealthView[]): {
  evaluadas: CapabilityHealthView[];
  sinEvaluar: CapabilityHealthView[];
} {
  const porNombre = (a: CapabilityHealthView, b: CapabilityHealthView) =>
    capabilityLabel(a.capability).localeCompare(capabilityLabel(b.capability), "es");

  return {
    evaluadas: assessments
      .filter((a) => !["not_assessable", "unknown"].includes(a.health_state))
      .sort(porNombre),
    sinEvaluar: assessments
      .filter((a) => ["not_assessable", "unknown"].includes(a.health_state))
      .sort(porNombre),
  };
}
