/**
 * FASE 3 / D04 — Salud por capacidad.
 *
 * Fuentes: conocimiento/fase-03/02-contratos-IA/d04-requisitos-contrato-health.md
 *          conocimiento/fase-03/04-policies-guardrails/d04-guardrails-health.md
 *
 * D03 dijo de que es capaz el negocio. D04 dice como esta **hoy**. Una capacidad
 * puede ser madura y estar rota esta semana, o ser joven y funcionar bien.
 *
 * Diez de los cincuenta guardrails son `X != SALUD` -- madurez, un KPI suelto,
 * las ventas, la causa, la prioridad, la severidad, la disposicion a escalar, lo
 * no optimo, la ausencia de datos y un heatmap -- y se cumplen igual que en D03:
 * **no existe el campo**. Los tests estructurales del final lo fijan.
 *
 * Catalogos identicos a las check constraints de
 * `20260915140000_f3_d04_salud_por_capacidad.sql`. Si cambia uno, cambian los dos.
 */
import { z } from "zod";

import { type DiagnosticInvariantViolation } from "./diagnostics.js";
import { CAPABILITIES } from "./maturity.js";
import { type DataQualityAssessment } from "./data-quality.js";

// --- Catalogos --------------------------------------------------------------

/** Contrato apartado 1. `not_assessable` no es un fallo: es una respuesta. */
export const HEALTH_STATES = [
  "elite",
  "healthy",
  "fragile",
  "bad",
  "critical",
  "disaster",
  "unknown",
  "not_assessable",
] as const;

/** Contrato apartado 3. Separada de la salud a proposito. */
export const HEALTH_TRAJECTORIES = [
  "improving",
  "stable",
  "deteriorating",
  "rapidly_deteriorating",
  "recovering",
  "volatile",
] as const;

export const RISK_LEVELS = ["none", "low", "moderate", "high", "critical"] as const;

/** Contrato apartado 7. */
export const RISK_HORIZONS = ["now", "7d", "30d", "90d"] as const;

/** Contrato apartado 12. La fuente no define umbrales temporales y aqui tampoco. */
export const CHRONICITY_STATES = [
  "acute_failure",
  "chronic_weakness",
  "chronic_fragility",
  "health_debt",
] as const;

/**
 * Contrato apartado 9. Los nombres dicen "suspected" a proposito: el guardrail
 * 31 permite registrar la sospecha y el 30 prohibe afirmar causalidad.
 */
export const ISSUE_ROLES = ["primary_suspected", "downstream_suspected", "unclear"] as const;

/** Contrato apartado 6. D4 debe poder funcionar sin `external_benchmark` (guardrail 13). */
export const HEALTH_REFERENCE_TYPES = [
  "self_baseline",
  "adjusted_baseline",
  "business_target",
  "economic_guardrail",
  "external_benchmark",
] as const;

export const BUSINESS_EXPOSURES = [
  "minimal",
  "low",
  "moderate",
  "high",
  "existential",
] as const;

/** Estados que afirman que algo va mal. Varios invariantes solo aplican aqui. */
const DEGRADED: readonly string[] = ["bad", "critical", "disaster"];
/** Estados que afirman que algo va bien. */
const SOUND: readonly string[] = ["elite", "healthy"];

export type HealthState = (typeof HEALTH_STATES)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type IssueRole = (typeof ISSUE_ROLES)[number];
export type HealthReferenceType = (typeof HEALTH_REFERENCE_TYPES)[number];
export type BusinessExposure = (typeof BUSINESS_EXPOSURES)[number];

// --- Esquemas ---------------------------------------------------------------

export const healthEvidenceSchema = z.object({
  /** Guardrails 26 y 27: la positiva cuenta y la que contradice no se tira. */
  relation: z.enum(["supporting", "contradicting", "positive"]).default("supporting"),
  metric: z.string().min(1),
  observation: z.string().min(1),
  value: z.number().nullable().optional(),
  /** Guardrail 25: sin adelantados no hay aviso temprano posible. */
  indicator_type: z.enum(["leading", "lagging"]).default("lagging"),
  reference_type: z.enum(HEALTH_REFERENCE_TYPES).nullable().optional(),
  source: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low", "insufficient_data"]).default("low"),
});

export const healthFindingSchema = z
  .object({
    kind: z.enum(["issue", "opportunity"]).default("issue"),
    description: z.string().min(1),
    severity: z.enum(["info", "low", "moderate", "high", "critical", "business_threat"]),
    scope: z.string().default("global"),
    impact: z.string().nullable().optional(),
    confidence: z.enum(["high", "medium", "low", "insufficient_data"]).default("low"),
  })
  // Guardrail 46: una oportunidad no se convierte en enfermedad subiendole la
  // severidad. Si de verdad hace dano, es un `issue`.
  .refine((f) => f.kind !== "opportunity" || ["info", "low"].includes(f.severity), {
    message: "una oportunidad de mejora no es una enfermedad",
  });

export const healthCardFields = z.object({
  card_id: z.string().min(1),
  capability: z.enum(CAPABILITIES),
  scope: z.string().default("global"),

  parent_card_id: z.string().nullable().optional(),
  suspected_downstream_of: z.string().nullable().optional(),

  health_state: z.enum(HEALTH_STATES),
  trajectory: z.enum(HEALTH_TRAJECTORIES).nullable().optional(),

  near_term_risk: z.enum(RISK_LEVELS).default("none"),
  risk_horizon: z.enum(RISK_HORIZONS).nullable().optional(),
  has_leading_signals: z.boolean().default(false),
  /** Apartado 11: convive con la salud actual sin tener que coincidir (guardrail 22). */
  structural_risk: z.enum(RISK_LEVELS).default("none"),

  chronicity: z.enum(CHRONICITY_STATES).nullable().optional(),
  issue_role: z.enum(ISSUE_ROLES).nullable().optional(),

  impact_vector: z.array(z.string()).default([]),
  current_failure: z.string().nullable().optional(),

  confidence: z.enum(["high", "medium", "low", "insufficient_data"]).default("low"),
  assessment_blocker: z.string().nullable().optional(),
  contradiction_resolution: z.string().nullable().optional(),
  state_justification: z.string().nullable().optional(),

  /** Del tenant-context, copiada aqui para poder razonar sobre agregacion. */
  business_exposure: z.enum(BUSINESS_EXPOSURES).nullable().optional(),

  evidence: z.array(healthEvidenceSchema).default([]),
  findings: z.array(healthFindingSchema).default([]),
});

export const healthCardSchema = healthCardFields
  // Guardrail 9 y apartado 21: la ausencia de datos no es salud.
  .refine(
    (c) =>
      c.confidence !== "insufficient_data" ||
      ["not_assessable", "unknown"].includes(c.health_state),
    { message: "sin datos suficientes el estado no puede ser sano" },
  )
  .refine((c) => c.health_state !== "not_assessable" || c.assessment_blocker != null, {
    message: "no evaluable exige decir que falta",
  })
  // Guardrail 25.
  .refine((c) => !["high", "critical"].includes(c.near_term_risk) || c.has_leading_signals, {
    message: "un riesgo alto a corto plazo exige indicadores adelantados",
  })
  // Guardrails 48, 49 y 50: los estados extremos no son un recurso retorico.
  .refine(
    (c) =>
      !["critical", "disaster"].includes(c.health_state) ||
      (c.state_justification != null && c.impact_vector.length > 0),
    { message: "critical y disaster exigen justificacion e impacto declarado" },
  )
  .refine(
    (c) => c.issue_role !== "downstream_suspected" || c.suspected_downstream_of != null,
    { message: "decir que algo es arrastrado exige decir de donde" },
  );

export type HealthEvidence = z.infer<typeof healthEvidenceSchema>;
export type HealthFinding = z.infer<typeof healthFindingSchema>;
export type HealthCard = z.infer<typeof healthCardSchema>;

export type HealthCheckInput = {
  cards: HealthCard[];
  /** Metricas con guardrail economico o target declarado, por capacidad. */
  economicReferences?: { capability: string; reference_type: HealthReferenceType }[];
  /** La evaluacion de D01 que sostiene estas lecturas (guardrail 14). */
  dataQuality?: DataQualityAssessment[];
};

// --- Invariantes ------------------------------------------------------------

const materialmenteExpuesta = (c: HealthCard) =>
  c.business_exposure != null && ["moderate", "high", "existential"].includes(c.business_exposure);

/**
 * Comprueba que una lectura de salud no afirma mas de lo que su evidencia
 * sostiene. Devuelve las violaciones, no lanza: mismo contrato que el resto de
 * la fase.
 *
 * Lo que NO esta aqui, y por que:
 *
 * - **La politica de agregacion** (guardrails 17 a 21). El apartado 23 dice que
 *   no esta definida, y los guardrails 17 ("no esconder un desastre local") y 18
 *   ("no degradar el todo por un subsegmento pequeno") tiran en direcciones
 *   opuestas: cualquier formula que escribiera aqui seria una invencion mia
 *   presentada como derivada del documento. Lo que si se comprueba es que la
 *   relacion entre padre e hijo **se haya declarado**, en las dos direcciones.
 * - **Los umbrales de estado** (guardrails 11, 48, 49). Cuando un CAC pasa de
 *   sano a critico depende de la economia de cada tienda (guardrails 39 y 40) y
 *   la fuente no da formula. La base exige que los extremos se justifiquen; que
 *   la justificacion sea buena es juicio humano.
 * - **Guardrails 42 a 44** (criticidad por modelo de negocio) viven en
 *   `tenant_capability_config`, no en una funcion.
 */
export function checkHealthInvariants(
  input: HealthCheckInput,
): DiagnosticInvariantViolation[] {
  const { cards } = input;
  const economicas = input.economicReferences ?? [];
  const dataQuality = input.dataQuality ?? [];

  const v: DiagnosticInvariantViolation[] = [];
  const push = (rule: string, source: string, message: string) =>
    v.push({ rule, source, message });

  const porId = new Map(cards.map((c) => [c.card_id, c]));
  const hijos = new Map<string, HealthCard[]>();
  for (const c of cards) {
    if (c.parent_card_id == null) continue;
    hijos.set(c.parent_card_id, [...(hijos.get(c.parent_card_id) ?? []), c]);
  }

  for (const c of cards) {
    const metricas = new Set(
      c.evidence.filter((e) => e.relation !== "positive").map((e) => e.metric),
    );

    // Guardrail 2 -- un KPI no es la salud de una capacidad. Declarar algo roto
    // mirando una sola metrica es exactamente lo que el guardrail prohibe.
    if (DEGRADED.includes(c.health_state) && metricas.size < 2) {
      push(
        "una_metrica_no_es_salud",
        "D04 guardrail 2",
        `"${c.capability}" se declara ${c.health_state} sobre ${metricas.size} metrica(s): un KPI suelto no es la salud de una capacidad`,
      );
    }

    // Guardrail 26 -- afirmar que algo esta sano exige evidencia positiva, no
    // solo ausencia de anomalias. "No hemos visto nada raro" no es salud.
    if (SOUND.includes(c.health_state) && !c.evidence.some((e) => e.relation === "positive")) {
      push(
        "evidencia_positiva",
        "D04 guardrail 26",
        `"${c.capability}" se declara ${c.health_state} sin ninguna evidencia positiva: no ver anomalias no es estar sano`,
      );
    }

    // Guardrail 28 -- si hay senales que contradicen el estado, se resuelve la
    // inconsistencia por escrito. Ignorarlas es elegir la version que gusta.
    if (
      DEGRADED.includes(c.health_state) &&
      c.evidence.some((e) => e.relation === "contradicting") &&
      c.contradiction_resolution == null
    ) {
      push(
        "contradiccion_resuelta",
        "D04 guardrail 28",
        `"${c.capability}" se degrada a ${c.health_state} con evidencia que lo contradice y sin resolver la inconsistencia`,
      );
    }

    // Guardrails 45, 46 y 47 -- HEALTHY no significa optimizado, y una lista de
    // mejoras posibles no enferma una capacidad. Si todo lo que hay son
    // oportunidades, el estado no puede ser malo.
    if (
      DEGRADED.includes(c.health_state) &&
      c.findings.length > 0 &&
      c.findings.every((f) => f.kind === "opportunity")
    ) {
      push(
        "oportunidad_no_es_enfermedad",
        "D04 guardrails 45 a 47",
        `"${c.capability}" esta en ${c.health_state} y todos sus hallazgos son oportunidades de mejora: D4 diagnostica salud, no perfeccion`,
      );
    }

    // Guardrail 24 -- marcar que hay senales adelantadas y no aportar ninguna
    // convierte el aviso temprano en una casilla.
    if (
      ["high", "critical"].includes(c.near_term_risk) &&
      !c.evidence.some((e) => e.indicator_type === "leading")
    ) {
      push(
        "riesgo_adelantado_real",
        "D04 guardrails 24 y 25",
        `"${c.capability}" declara riesgo ${c.near_term_risk} a corto plazo sin ningun indicador adelantado que lo sostenga`,
      );
    }

    // Guardrail 38 -- no se clasifica adquisicion sin economia del producto. Un
    // CAC alto puede ser sano (39) y uno bajo critico (40): sin el guardrail
    // economico del tenant, la cifra sola no dice nada.
    if (
      c.capability === "acquisition" &&
      !["not_assessable", "unknown"].includes(c.health_state) &&
      !economicas.some(
        (r) =>
          r.capability === "acquisition" &&
          ["economic_guardrail", "business_target"].includes(r.reference_type),
      )
    ) {
      push(
        "adquisicion_exige_economia",
        "D04 guardrail 38",
        "se clasifica la salud de adquisicion sin guardrail economico ni objetivo declarados: un CAC sin economia detras no es bueno ni malo",
      );
    }

    // Guardrail 32 -- no se degrada adquisicion solo porque caiga el revenue.
    // El revenue es el efecto; degradar la capacidad que lo alimenta sin mas
    // evidencia es saltar de sintoma a culpable.
    if (
      c.capability === "acquisition" &&
      DEGRADED.includes(c.health_state) &&
      metricas.size > 0 &&
      [...metricas].every((m) => m.includes("revenue") || m.includes("sales"))
    ) {
      push(
        "revenue_no_degrada_adquisicion",
        "D04 guardrails 3 y 32",
        "adquisicion se degrada apoyandose solo en metricas de ingresos: las ventas son el resultado, no la salud del canal",
      );
    }

    // Guardrail 17 -- un desastre local no se esconde detras de un padre sano.
    // La combinacion esta permitida (apartado 4) pero tiene que estar dicha.
    if (SOUND.includes(c.health_state)) {
      const criticos = (hijos.get(c.card_id) ?? []).filter(
        (h) => ["critical", "disaster"].includes(h.health_state) && materialmenteExpuesta(h),
      );
      if (criticos.length > 0 && c.contradiction_resolution == null) {
        push(
          "desastre_local_no_se_oculta",
          "D04 guardrail 17",
          `"${c.capability}" se declara ${c.health_state} mientras ${criticos
            .map((h) => h.scope)
            .join(", ")} esta en estado critico con exposicion material, y no se dice`,
        );
      }
    }

    // Guardrail 18 -- ni se degrada una capacidad entera por un subsegmento
    // pequeno. Es el error simetrico del anterior.
    if (DEGRADED.includes(c.health_state)) {
      const descendientes = hijos.get(c.card_id) ?? [];
      const degradados = descendientes.filter((h) => DEGRADED.includes(h.health_state));
      if (
        descendientes.length > 0 &&
        degradados.length > 0 &&
        degradados.every(
          (h) =>
            h.business_exposure != null && ["minimal", "low"].includes(h.business_exposure),
        )
      ) {
        push(
          "subsegmento_no_degrada_el_todo",
          "D04 guardrail 18",
          `"${c.capability}" se degrada entera cuando lo unico degradado son segmentos de exposicion baja (${degradados
            .map((h) => h.scope)
            .join(", ")})`,
        );
      }
    }

    // Guardrails 33 y 34 -- dos efectos arrastrados del mismo origen no son dos
    // problemas independientes. Si esta declarado como downstream de otro, no
    // puede ser tambien un problema de origen.
    if (c.suspected_downstream_of != null && c.issue_role === "primary_suspected") {
      const origen = porId.get(c.suspected_downstream_of);
      push(
        "downstream_no_cuenta_dos_veces",
        "D04 guardrails 33 y 34",
        `"${c.capability}" se marca como problema de origen y a la vez como arrastrado desde ${origen?.capability ?? "otra capacidad"}`,
      );
    }
  }

  // Guardrail 14 -- D4 hereda la incertidumbre de D1. Una fuente que D1 degrado
  // no sostiene una lectura de salud con confianza alta.
  const degradadas = dataQuality.filter(
    (a) => a.role === "primary" && ["low", "unusable"].includes(a.reliability),
  );
  if (degradadas.length > 0) {
    const confiadas = cards.filter((c) => c.confidence === "high");
    if (confiadas.length > 0) {
      push(
        "hereda_incertidumbre_de_d1",
        "D04 guardrail 14",
        `${confiadas.length} lectura(s) de salud con confianza alta sobre fuentes que D01 degrado`,
      );
    }
  }

  return v;
}

// --- El motor ---------------------------------------------------------------

/**
 * EL MOTOR DE SALUD. Decision de diseno, y es la unica que hay que entender:
 * **este motor no tiene ni un solo umbral propio**.
 *
 * El guardrail 11 prohibe clasificar CAC, CVR o refund rate por umbral global y
 * el 13 prohibe depender de benchmarks externos. Un CAC alto puede ser sano si
 * cabe en la economia (guardrail 39) y uno bajo puede ser critico si destruye
 * contribucion (40). Ninguna de las dos cosas se sabe sin que alguien declare
 * contra que se juzga esa metrica **en esta tienda**, y eso es
 * `health_references`.
 *
 * De ahi sale todo lo demas:
 *
 *   - sin referencia declarada, la capacidad sale `not_assessable` y el motor
 *     **dice que falta** (lo exige el esquema, no solo el buen gusto);
 *   - con referencia, el estado no lo calcula este motor: lo trae
 *     `guardrail_status` de la senal, que D05 ya evaluo contra esa misma
 *     referencia. Aqui solo se traduce;
 *   - **no ver anomalias no es estar sano** (guardrail 9). Para decir `healthy`
 *     hace falta que la metrica se haya medido de verdad en la ventana, y por
 *     eso el motor recibe `measuredMetrics` y no lo deduce de la ausencia de
 *     senales.
 *
 * Hoy `health_references` esta vacia en las dos bases, asi que todo sale
 * `not_assessable`. **Eso es el resultado correcto, no un fallo**: es la lista
 * exacta de lo que hay que declarar para que este negocio se pueda juzgar.
 */

/** Una senal de D05, en lo que le hace falta a D04. */
export type SignalForHealth = {
  signal_id: string;
  capability: string | null;
  metric: string;
  direction: string;
  trajectory: string | null;
  guardrail_status: string | null;
  business_relevance: string;
  business_exposure: string | null;
  is_leading_indicator: boolean;
  data_confidence: string;
  window_start: string;
  window_end: string;
  description: string;
};

/** Un sintoma de D06, en lo que le hace falta a D04. */
export type SymptomForHealth = {
  symptom_id: string;
  capability: string | null;
  label: string;
  valence: string;
  confidence: string;
  persistence: string;
};

/** Una referencia declarada. Sin esto no se clasifica nada. */
export type HealthReferenceRow = {
  capability: string | null;
  metric: string;
  reference_type: HealthReferenceType;
};

export type HealthEngineInput = {
  /** Las capacidades que se intentan evaluar. Normalmente las que D03 observo. */
  capabilities: readonly string[];
  references: HealthReferenceRow[];
  signals: SignalForHealth[];
  symptoms: SymptomForHealth[];
  /**
   * Metricas que produjeron serie en la ventana. Es lo que separa "medido y
   * dentro de rango" de "no mirado", y sin ello `healthy` seria una suposicion.
   */
  measuredMetrics: readonly string[];
  /** Referencia al perfil de D03. **Enlace, no copia**: apartado 16 de D03. */
  maturityProfileId?: string | null;
  dataQuality?: DataQualityAssessment[];
};

export type HealthAssessment = {
  capability: string;
  health_state: HealthState;
  trajectory: string | null;
  near_term_risk: RiskLevel;
  risk_horizon: string | null;
  has_leading_signals: boolean;
  structural_risk: RiskLevel;
  confidence: "high" | "medium" | "low" | "insufficient_data";
  assessment_blocker: string | null;
  state_justification: string | null;
  impact_vector: string[];
  current_failure: string | null;
  maturity_profile_id: string | null;
  findings: {
    kind: "issue" | "opportunity";
    description: string;
    severity: string;
    trajectory: string | null;
    confidence: string;
  }[];
  evidence: HealthEvidenceRow[];
};

/**
 * Una fila de evidencia, con la forma que el esquema exige.
 *
 * `relation` no es decorativa: los guardrails 26 y 27 dicen que la evidencia
 * positiva cuenta y que la que contradice **no se tira**. Un diagnostico que
 * solo recoge anomalias no es un diagnostico, es una lista de quejas.
 *
 * `indicator_type` viene declarado por D05 (`is_leading_indicator`), no se
 * adivina aqui: el guardrail 25 separa el indicador que avisa del que confirma,
 * y confundirlos es prometer un aviso temprano que no existe.
 */
export type HealthEvidenceRow = {
  relation: "supporting" | "contradicting" | "positive";
  metric: string;
  observation: string;
  indicator_type: "leading" | "lagging";
  window_start: string | null;
  window_end: string | null;
  source: string;
  confidence: string;
};

/**
 * Si una senal apoya el estado leido o lo contradice.
 *
 * Guardrail 28: cuando hay senales que contradicen el estado, la inconsistencia
 * se resuelve por escrito en vez de ignorarse. Para poder resolverla primero hay
 * que **guardarla**, y eso es lo que hace esta funcion: una senal que mejora
 * dentro de una capacidad en mal estado, o que empeora dentro de una sana, se
 * marca como contradictoria en vez de sumarse al monton.
 */
export function evidenceRelation(
  healthState: HealthState,
  trajectory: string | null,
): "supporting" | "contradicting" | "positive" {
  const mejora = ["improving", "recovering"].includes(trajectory ?? "");
  const empeora = ["deteriorating", "rapidly_deteriorating"].includes(trajectory ?? "");

  if (SOUND.includes(healthState)) return empeora ? "contradicting" : "positive";
  if (DEGRADED.includes(healthState)) return mejora ? "contradicting" : "supporting";
  return "supporting";
}

/**
 * De `guardrail_status` a estado de salud.
 *
 * Es una traduccion, no un umbral: el umbral lo puso el tenant al declarar la
 * referencia y D05 ya lo evaluo contra ella. `disaster` no aparece porque no hay
 * ninguna regla en la fuente que diga cuando se llega ahi, y los guardrails 48 a
 * 50 dicen que los estados extremos no son un recurso retorico.
 */
const ESTADO_POR_GUARDRAIL: Record<string, HealthState> = {
  within: "healthy",
  approaching: "fragile",
  breached: "bad",
  crossed: "critical",
};

const ORDEN_GRAVEDAD: HealthState[] = [
  "elite",
  "healthy",
  "fragile",
  "bad",
  "critical",
  "disaster",
];

/** La severidad del hallazgo sale de la relevancia que ya declaro D05. */
const SEVERIDAD_POR_RELEVANCIA: Record<string, string> = {
  low: "low",
  medium: "moderate",
  high: "high",
  critical: "critical",
};

/**
 * La trayectoria, cuando las senales no se contradicen.
 *
 * Si unas mejoran y otras empeoran, la respuesta honesta es `volatile`, no la
 * media de las dos. Promediar trayectorias opuestas inventa una calma que no
 * existe.
 */
export function combineTrajectories(
  trajectories: readonly (string | null)[],
): string | null {
  const presentes = [...new Set(trajectories.filter((t): t is string => t != null))];
  if (presentes.length === 0) return null;
  if (presentes.length === 1) return presentes[0] ?? null;

  const empeora = presentes.some((t) =>
    ["deteriorating", "rapidly_deteriorating"].includes(t),
  );
  const mejora = presentes.some((t) => ["improving", "recovering"].includes(t));
  return empeora && mejora ? "volatile" : empeora ? "deteriorating" : "improving";
}

/**
 * El riesgo a corto plazo, con el freno del guardrail 25.
 *
 * Un riesgo alto **exige** indicadores adelantados, porque mirando solo los
 * rezagados el aviso llega con el dano hecho. Sin ellos el riesgo se queda en
 * `low` por muy fea que sea la foto: decir "alto" sin nada que mire adelante es
 * una alarma que no se puede sostener.
 */
export function nearTermRisk(signals: readonly SignalForHealth[]): {
  risk: RiskLevel;
  horizon: string | null;
  has_leading_signals: boolean;
} {
  const adelantados = signals.filter((s) => s.is_leading_indicator);
  if (adelantados.length === 0) {
    return { risk: "low", horizon: null, has_leading_signals: false };
  }

  const graves = adelantados.filter(
    (s) =>
      ["high", "critical"].includes(s.business_relevance) &&
      ["deteriorating", "rapidly_deteriorating"].includes(s.trajectory ?? ""),
  );
  if (graves.length === 0) {
    return { risk: "low", horizon: "30d", has_leading_signals: true };
  }

  const critico = graves.some((s) => s.business_relevance === "critical");
  return {
    risk: critico ? "critical" : "high",
    horizon: "30d",
    has_leading_signals: true,
  };
}

/**
 * Que falta para poder juzgar esta capacidad.
 *
 * `not_assessable` exige decir **que** falta (apartado 21 y el propio esquema).
 * Una frase generica ahi no sirve de nada: la gracia es que quien la lea sepa
 * exactamente que declarar.
 */
export function assessmentBlocker(
  capability: string,
  tieneReferencia: boolean,
  metricasMedidas: readonly string[],
): string | null {
  if (!tieneReferencia) {
    return `No hay baseline propio, objetivo ni guardrail economico declarado para ${capability}. Sin saber contra que se juzga esta capacidad en esta tienda, clasificarla seria aplicar un umbral universal.`;
  }
  if (metricasMedidas.length === 0) {
    return `Hay referencia declarada para ${capability}, pero ninguna de sus metricas produjo serie en la ventana medida.`;
  }
  return null;
}

/**
 * La lectura de salud de cada capacidad.
 *
 * No escribe fila para lo que no puede juzgar **con contenido**: escribe la fila
 * diciendo que no puede, que es distinto. Una capacidad ausente de la tabla se
 * lee como "no aplica"; una `not_assessable` con blocker se lee como "esto es lo
 * que falta", que es lo unico util aqui.
 */
function construirEvidencia(
  healthState: HealthState,
  senales: readonly SignalForHealth[],
  sintomas: readonly SymptomForHealth[],
): HealthEvidenceRow[] {
  return [
    ...senales.map((s) => ({
      relation: evidenceRelation(healthState, s.trajectory),
      metric: s.metric,
      observation: s.description,
      indicator_type: (s.is_leading_indicator ? "leading" : "lagging") as
        | "leading"
        | "lagging",
      window_start: s.window_start,
      window_end: s.window_end,
      source: "d05_signal",
      confidence: s.data_confidence,
    })),
    ...sintomas.map((s) => ({
      // Un sintoma positivo es evidencia positiva, no una queja mas. Guardrail
      // 26: tirarla deja un diagnostico que solo sabe quejarse.
      relation: (s.valence === "positive" ? "positive" : "supporting") as
        | "supporting"
        | "contradicting"
        | "positive",
      metric: s.label,
      observation: s.label,
      indicator_type: "lagging" as const,
      window_start: null,
      window_end: null,
      source: "d06_symptom",
      confidence: s.confidence,
    })),
  ];
}

export function assessHealth(input: HealthEngineInput): HealthAssessment[] {
  const {
    capabilities,
    references,
    signals,
    symptoms,
    measuredMetrics,
    maturityProfileId = null,
  } = input;

  return capabilities.map((capability) => {
    const refsDeLaCapacidad = references.filter(
      (r) => r.capability === capability,
    );
    const senales = signals.filter((s) => s.capability === capability);
    const sintomas = symptoms.filter((s) => s.capability === capability);

    const metricasDeclaradas = new Set(refsDeLaCapacidad.map((r) => r.metric));
    const medidas = measuredMetrics.filter((m) => metricasDeclaradas.has(m));

    const findings = sintomas.map((sintoma) => ({
      // Guardrail 46: una oportunidad no se convierte en enfermedad subiendole
      // la severidad. Un sintoma positivo es una oportunidad y se queda en
      // `info`, por mucho que el patron sea fuerte.
      kind: (sintoma.valence === "positive" ? "opportunity" : "issue") as
        | "issue"
        | "opportunity",
      description: sintoma.label,
      severity:
        sintoma.valence === "positive"
          ? "info"
          : (SEVERIDAD_POR_RELEVANCIA[
              senales.find((s) => ["high", "critical"].includes(s.business_relevance))
                ?.business_relevance ?? "low"
            ] ?? "low"),
      trajectory: combineTrajectories(senales.map((s) => s.trajectory)),
      confidence: sintoma.confidence,
    }));

    const trajectory = combineTrajectories(senales.map((s) => s.trajectory));
    const riesgo = nearTermRisk(senales);
    const blocker = assessmentBlocker(
      capability,
      refsDeLaCapacidad.length > 0,
      medidas,
    );

    const base = {
      capability,
      trajectory,
      near_term_risk: riesgo.risk,
      risk_horizon: riesgo.horizon,
      has_leading_signals: riesgo.has_leading_signals,
      // El riesgo estructural sale de la madurez, y no hay formula declarada
      // para derivarlo. Se deja en `none` y se enlaza el perfil de D03 para que
      // lo lea una persona: inventar el mapeo seria presentar una opinion como
      // derivada del documento.
      structural_risk: "none" as RiskLevel,
      maturity_profile_id: maturityProfileId,
      findings,
    };

    if (blocker) {
      return {
        ...base,
        evidence: construirEvidencia("not_assessable", senales, sintomas),
        health_state: "not_assessable" as HealthState,
        confidence: "insufficient_data" as const,
        assessment_blocker: blocker,
        state_justification: null,
        impact_vector: [],
        current_failure: null,
      };
    }

    // Con referencia y metrica medida, el estado lo dicta el guardrail que ya
    // evaluo D05 contra esa misma referencia. Si ninguna senal lo trae, la
    // metrica se midio y no se salio: eso si es `healthy`.
    const estados = senales
      .map((s) => (s.guardrail_status ? ESTADO_POR_GUARDRAIL[s.guardrail_status] : null))
      .filter((e): e is HealthState => e != null);

    const health_state =
      estados.length === 0
        ? ("healthy" as HealthState)
        : (estados.sort(
            (a, b) => ORDEN_GRAVEDAD.indexOf(b) - ORDEN_GRAVEDAD.indexOf(a),
          )[0] as HealthState);

    const peor = senales.find(
      (s) => s.guardrail_status && ESTADO_POR_GUARDRAIL[s.guardrail_status] === health_state,
    );

    // Guardrails 48 a 50: los estados extremos exigen justificacion e impacto
    // declarado. Se cumplen escribiendolos, no bajando el estado para esquivar
    // el requisito.
    const extremo = ["critical", "disaster"].includes(health_state);

    const confianzaDelDato = senales.some(
      (s) => s.data_confidence === "insufficient_data",
    );

    return {
      ...base,
      evidence: construirEvidencia(health_state, senales, sintomas),
      health_state,
      confidence: confianzaDelDato ? ("low" as const) : ("medium" as const),
      assessment_blocker: null,
      state_justification: extremo && peor
        ? `${peor.metric} cruzo el guardrail economico declarado para esta tienda. ${peor.description}`
        : null,
      impact_vector: extremo && peor ? [peor.metric] : [],
      current_failure: peor ? peor.description : null,
    };
  });
}
