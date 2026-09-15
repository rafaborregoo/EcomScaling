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
