/**
 * FASE 3 / D03 — Deteccion de etapa de madurez.
 *
 * Fuentes: conocimiento/fase-03/02-contratos-IA/d03-requisitos-contrato-madurez.md
 *          conocimiento/fase-03/04-policies-guardrails/d03-guardrails-madurez.md
 *          conocimiento/fase-03/05-experience-learning/d03-aprendizaje-y-evolucion-madurez.md
 *
 * D03 contesta "¿que es capaz de hacer este negocio?", que no es "¿como le va?".
 * Un ecommerce puede facturar mucho con capacidades fragiles y otro poco con un
 * sistema solido y joven.
 *
 * Los 30 guardrails son casi todos la misma frase — `X != MADUREZ` — y se
 * cumplen igual: **no hay donde escribir X**. Ni facturacion, ni rendimiento, ni
 * herramientas, ni tamano de equipo, ni una puntuacion global. Hay tests que
 * fallan si alguien anade alguno de esos campos.
 *
 * Catalogos identicos a las check constraints de
 * `20260915090000_f3_d03_madurez_por_capacidad.sql`. Si cambia uno, cambian los dos.
 */
import { z } from "zod";

import { type DiagnosticInvariantViolation } from "./diagnostics.js";

// --- Catalogos --------------------------------------------------------------

/**
 * Contrato apartado 4. **El orden importa**: es una escalera, y casi todas las
 * comprobaciones de este fichero comparan posiciones en ella.
 */
export const MATURITY_LEVELS = [
  "absent",
  "ad_hoc",
  "repeatable",
  "defined",
  "measured",
  "optimized",
  "adaptive",
] as const;

/** Contrato apartado 3. Las capacidades de la fase 1. */
export const CAPABILITIES = [
  "market",
  "product",
  "offer",
  "unit_economics",
  "acquisition",
  "creative",
  "conversion",
  "retention",
  "inventory",
  "operations",
  "finance",
  "data",
  "technology",
  "team",
  "strategy",
] as const;

/**
 * Contrato apartado 10, **en orden de fuerza descendente**. `tool_presence` no
 * esta en la lista del artefacto: se anade porque los guardrails 3 y 14 avisan
 * de el explicitamente y sin tipo propio se colaria como dato del sistema.
 * Tener Klaviyo no es saber hacer email marketing.
 */
export const EVIDENCE_TYPES = [
  "observed_behavior",
  "system_data",
  "documented_process",
  "tool_presence",
  "user_claim",
] as const;

/**
 * Los dos tipos que el guardrail 16 llama "observed system behavior" frente a
 * documentacion y autopercepcion. A partir de `defined` hace falta uno.
 */
export const OBJECTIVE_EVIDENCE_TYPES = ["observed_behavior", "system_data"] as const;

/** Contrato apartado 8. */
export const MATURITY_FINDINGS = [
  "capability_not_yet_developed",
  "structural_weakness",
  "growth_system_gap",
  "overengineering",
  "structural_debt",
  "fragile_growth",
  "sustainable_growth",
  "maturity_bottleneck",
  "maturity_regression",
  "latent_structural_risk",
  "structural_imbalance",
  "complexity_theater",
  "premature_scaling",
  "appropriate",
  "critically_behind",
] as const;

/** Contrato apartado 7. */
export const EXPECTATION_BANDS = ["minimum_viable", "minimum", "expected", "advanced"] as const;

/**
 * Experience apartado 1. El ejemplo del documento: "Finance E3-E5 con confianza
 * baja" pasando a "Finance E4 con confianza alta" es mejor observacion, no
 * mejora real. Sin esta distincion el sistema celebra progresos inexistentes.
 */
export const MATURITY_CHANGE_TYPES = [
  "initial",
  "real_change",
  "uncertainty_reduction",
  "confidence_increase",
] as const;

export type MaturityLevel = (typeof MATURITY_LEVELS)[number];
export type Capability = (typeof CAPABILITIES)[number];
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];
export type MaturityFinding = (typeof MATURITY_FINDINGS)[number];
export type MaturityChangeType = (typeof MATURITY_CHANGE_TYPES)[number];

/** Posicion en la escalera. Comparar niveles por string no significa nada. */
export function maturityRank(level: MaturityLevel): number {
  return MATURITY_LEVELS.indexOf(level);
}

// --- Esquemas ---------------------------------------------------------------

export const maturityEvidenceSchema = z
  .object({
    evidence_type: z.enum(EVIDENCE_TYPES),
    description: z.string().min(1),
    source: z.string().nullable().optional(),
    observed_at: z.string().nullable().optional(),
    supports: z.enum(["current_level", "advancement", "regression"]).default("current_level"),
    persistent: z.boolean().default(false),
  })
  // Guardrails 13 y 26: una incidencia puntual no baja la madurez.
  .refine((e) => e.supports !== "regression" || (e.persistent && e.observed_at != null), {
    message: "una regresion exige evidencia persistente y fechada",
  });

export const capabilityMaturityFields = z.object({
  capability: z.enum(CAPABILITIES),
  current_level: z.enum(MATURITY_LEVELS),
  required_level: z.enum(MATURITY_LEVELS).nullable().optional(),
  expectation_band: z.enum(EXPECTATION_BANDS).nullable().optional(),

  finding: z.enum(MATURITY_FINDINGS).nullable().optional(),
  gap_interpretation: z.string().nullable().optional(),

  // Contrato apartado 5. Tres de estas sostienen un nivel por si solas.
  has_existence: z.boolean().default(false),
  has_consistency: z.boolean().default(false),
  has_repeatability: z.boolean().default(false),
  has_measurement: z.boolean().default(false),
  has_ownership: z.boolean().default(false),
  has_automation: z.boolean().default(false),
  has_predictability: z.boolean().default(false),
  has_optimization: z.boolean().default(false),
  has_resilience: z.boolean().default(false),
  has_learning: z.boolean().default(false),

  /** Guardrail 20: medir sin que cambie ninguna decision es un panel que nadie mira. */
  influences_decisions: z.boolean().default(false),

  owner_role: z.string().nullable().optional(),
  key_person_dependency: z.boolean().default(false),

  confidence: z.enum(["high", "medium", "low", "insufficient_data"]).default("low"),

  evidence: z.array(maturityEvidenceSchema).default([]),
});

export const capabilityMaturitySchema = capabilityMaturityFields
  .refine((c) => (c.current_level === "absent") === (c.has_existence === false), {
    message: "lo que no existe no tiene nivel, y lo que tiene nivel existe",
  })
  // Guardrails 20 y 21.
  .refine(
    (c) =>
      !["measured", "optimized", "adaptive"].includes(c.current_level) ||
      (c.has_measurement && c.influences_decisions),
    { message: "measured o superior exige medir y que la medida cambie decisiones" },
  )
  // Guardrail 29.
  .refine(
    (c) => !["optimized", "adaptive"].includes(c.current_level) || c.has_ownership,
    { message: "optimized o superior exige ownership" },
  )
  // Guardrail 30.
  .refine((c) => c.current_level !== "adaptive" || (c.has_learning && c.has_resilience), {
    message: "adaptive exige aprendizaje y resiliencia reales",
  })
  // Guardrail 11: la nota se cambia por interpretacion.
  .refine((c) => c.finding == null || c.gap_interpretation != null, {
    message: "un hallazgo sin interpretacion vuelve a ser una etiqueta vacia",
  });

export const capabilityDependencySchema = z.object({
  capability: z.enum(CAPABILITIES),
  depends_on: z.enum(CAPABILITIES),
  relation: z.enum(["requires", "ceiling"]).default("requires"),
  rationale: z.string().min(1),
});

export const maturityProfileFields = z.object({
  profile_id: z.string().min(1),
  business_stage: z
    .enum(["e0", "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "e10", "e11", "e12"])
    .nullable()
    .optional(),
  change_type: z.enum(MATURITY_CHANGE_TYPES).nullable().optional(),
  change_summary: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low", "insufficient_data"]).default("low"),
  capabilities: z.array(capabilityMaturitySchema).default([]),
});

export const maturityProfileSchema = maturityProfileFields;

export type MaturityEvidence = z.infer<typeof maturityEvidenceSchema>;
export type CapabilityMaturity = z.infer<typeof capabilityMaturitySchema>;
export type CapabilityDependency = z.infer<typeof capabilityDependencySchema>;
export type MaturityProfile = z.infer<typeof maturityProfileSchema>;

export type MaturityCheckInput = {
  profile: MaturityProfile;
  /** El grafo de capacidades. Vacio mientras nadie lo declare. */
  dependencies?: CapabilityDependency[];
  /** El perfil anterior, si este lo sustituye (guardrail 28). */
  previous?: MaturityProfile;
};

// --- Invariantes ------------------------------------------------------------

const nivel = (c: CapabilityMaturity) => maturityRank(c.current_level);
const esObjetiva = (e: MaturityEvidence) =>
  (OBJECTIVE_EVIDENCE_TYPES as readonly string[]).includes(e.evidence_type);
const esDebil = (e: MaturityEvidence) =>
  e.evidence_type === "tool_presence" || e.evidence_type === "user_claim";

/**
 * Comprueba que un perfil de madurez no afirma mas de lo que su evidencia
 * sostiene. Devuelve las violaciones, no lanza: mismo contrato que el resto de
 * la fase.
 *
 * Lo que NO esta aqui, y por que:
 *
 * - **Guardrail 25** (no exigir capacidades enterprise a quien no las necesita)
 *   obliga a derivar `required_level` de la complejidad del negocio — volumen,
 *   SKUs, mercados, canales. El apartado 19 del artefacto dice expresamente que
 *   el algoritmo de scoring, los thresholds y las ponderaciones **no estan
 *   definidos**. Inventarlos aqui seria fabricar la respuesta y presentarla
 *   como derivada del documento. Lo que si se comprueba es la coherencia: si
 *   alguien declara un `required_level`, el hallazgo tiene que cuadrar con el.
 * - **Guardrails 1 a 6, 7 y 19** (`revenue`, `performance`, herramientas,
 *   automatizacion, tamano de equipo, documentacion, estado y prioridad no son
 *   madurez) son estructurales: ninguno de esos campos existe. Su test vive en
 *   `maturity.test.ts` y falla si aparecen.
 * - **Guardrail 22** (no usar frameworks externos como verdad del tenant) es
 *   una regla sobre de donde sale el contenido, no sobre la forma del perfil.
 */
export function checkMaturityInvariants(
  input: MaturityCheckInput,
): DiagnosticInvariantViolation[] {
  const { profile } = input;
  const dependencias = input.dependencies ?? [];
  const previo = input.previous;

  const v: DiagnosticInvariantViolation[] = [];
  const push = (rule: string, source: string, message: string) =>
    v.push({ rule, source, message });

  const porCapacidad = new Map(profile.capabilities.map((c) => [c.capability, c]));

  for (const c of profile.capabilities) {
    // Guardrails 15, 16 y 23 -- a partir de `defined` hace falta comportamiento
    // observado o dato del sistema. Un proceso documentado describe lo que
    // deberia pasar; lo que el cliente dice, lo que cree que pasa.
    if (nivel(c) >= maturityRank("defined") && !c.evidence.some(esObjetiva)) {
      push(
        "evidencia_por_encima_de_la_autopercepcion",
        "D03 guardrails 15, 16 y 23",
        `"${c.capability}" se declara ${c.current_level} sin comportamiento observado ni dato del sistema que lo sostenga`,
      );
    }

    // Guardrails 3 y 14 -- tener la herramienta no es tener la capacidad. Si
    // toda la evidencia es "usan Klaviyo" y "dicen que lo hacen", no hay
    // capacidad demostrada por encima de ad_hoc.
    if (
      nivel(c) > maturityRank("ad_hoc") &&
      c.evidence.length > 0 &&
      c.evidence.every(esDebil)
    ) {
      push(
        "herramienta_no_es_capacidad",
        "D03 guardrails 3 y 14",
        `"${c.capability}" se apoya solo en herramientas presentes o en lo que dice el cliente`,
      );
    }

    // Guardrails 13 y 26 -- declarar una regresion exige evidencia de deterioro
    // persistente, no la averia de esta semana.
    if (
      c.finding === "maturity_regression" &&
      !c.evidence.some((e) => e.supports === "regression" && e.persistent)
    ) {
      push(
        "regresion_exige_persistencia",
        "D03 guardrails 13 y 26",
        `"${c.capability}" se marca como regresion sin evidencia persistente de deterioro estructural`,
      );
    }

    // Guardrails 9, 10 y 25 -- el hallazgo tiene que cuadrar con la distancia
    // entre lo que hay y lo que hace falta. Llamar debilidad a una capacidad
    // que cubre lo que el negocio necesita penaliza la simplicidad; llamar
    // sobreingenieria a una que se queda corta premia la complejidad.
    if (c.required_level != null && c.finding != null) {
      const distancia = nivel(c) - maturityRank(c.required_level);
      const porDebajo: MaturityFinding[] = ["structural_weakness", "critically_behind"];
      const porEncima: MaturityFinding[] = ["overengineering", "complexity_theater"];

      if (porDebajo.includes(c.finding) && distancia >= 0) {
        push(
          "simplicidad_no_se_penaliza",
          "D03 guardrails 9 y 25",
          `"${c.capability}" esta en ${c.current_level} y necesita ${c.required_level}: cubre lo que el negocio requiere y no es una debilidad`,
        );
      }
      if (porEncima.includes(c.finding) && distancia <= 0) {
        push(
          "complejidad_no_se_premia",
          "D03 guardrail 10",
          `"${c.capability}" no llega a lo que necesita (${c.current_level} frente a ${c.required_level}) y no puede ser sobreingenieria`,
        );
      }
    }

    // Guardrails 17 y 18 -- una asimetria entre capacidades solo es un problema
    // si crea dependencia o riesgo. Sin dependencia declarada, es
    // especializacion sana.
    if (
      c.finding === "structural_imbalance" &&
      !dependencias.some((d) => d.capability === c.capability || d.depends_on === c.capability)
    ) {
      push(
        "asimetria_no_es_problema",
        "D03 guardrails 17 y 18",
        `"${c.capability}" se marca como desequilibrio estructural sin ninguna dependencia que lo convierta en riesgo: puede ser especializacion sana`,
      );
    }

    // Guardrail 24 -- no se escala sin capacidades base. Si una capacidad supera
    // lo que necesita mientras aquellas de las que depende no llegan a lo suyo,
    // eso es escalar sobre cimientos que no aguantan.
    const base = dependencias.filter(
      (d) => d.capability === c.capability && d.relation === "requires",
    );
    const flojas = base
      .map((d) => porCapacidad.get(d.depends_on))
      .filter(
        (dep): dep is CapabilityMaturity =>
          dep != null && dep.required_level != null && nivel(dep) < maturityRank(dep.required_level),
      );
    if (
      flojas.length > 0 &&
      c.required_level != null &&
      nivel(c) > maturityRank(c.required_level) &&
      c.finding !== "premature_scaling"
    ) {
      push(
        "escalado_sin_base",
        "D03 guardrail 24",
        `"${c.capability}" va por delante de lo que necesita mientras ${flojas
          .map((f) => f.capability)
          .join(", ")} no llega: escalar asi es premature_scaling`,
      );
    }

    // Contrato apartado 14 -- techo de capacidad. Si algo le pone techo y esta
    // por debajo, el crecimiento no puede declararse sostenible.
    const techos = dependencias
      .filter((d) => d.capability === c.capability && d.relation === "ceiling")
      .map((d) => porCapacidad.get(d.depends_on))
      .filter((dep): dep is CapabilityMaturity => dep != null && nivel(dep) < nivel(c));
    if (techos.length > 0 && ["sustainable_growth", "appropriate"].includes(c.finding ?? "")) {
      push(
        "techo_declarado",
        "D03 contrato apartado 14",
        `"${c.capability}" tiene techo en ${techos.map((t) => t.capability).join(", ")}, por debajo suyo: el crecimiento no es sostenible sin decirlo`,
      );
    }
  }

  // Guardrail 28 -- mas confianza no es mas madurez. El ejemplo del propio
  // artefacto: pasar de "Finance E3-E5, confianza baja" a "Finance E4,
  // confianza alta" es haber mirado mejor, no haber mejorado.
  if (
    previo &&
    (profile.change_type === "confidence_increase" ||
      profile.change_type === "uncertainty_reduction")
  ) {
    const anterior = new Map(previo.capabilities.map((c) => [c.capability, c]));
    const subidas = profile.capabilities.filter((c) => {
      const antes = anterior.get(c.capability);
      return antes != null && nivel(c) > nivel(antes);
    });
    if (subidas.length > 0) {
      push(
        "confianza_no_es_madurez",
        "D03 guardrail 28",
        `el perfil se declara "${profile.change_type}" pero sube el nivel de ${subidas
          .map((c) => c.capability)
          .join(", ")}: observar mejor no es haber mejorado`,
      );
    }
  }

  return v;
}
