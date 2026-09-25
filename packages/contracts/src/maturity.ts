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

// ---------------------------------------------------------------------------
// EL MOTOR (pasos 2, 3, 4 y 17 del runtime)
// ---------------------------------------------------------------------------
//
// Todo lo que sigue es puro: entran hechos medidos de la tienda y salen
// capacidades observadas con su evidencia. La parte sucia --leer Supabase,
// escribir filas-- vive en `apps/api/src/maturity-engine.ts`.
//
// LA DECISION QUE ORDENA EL BLOQUE, y es una decision sobre lo que **no** se
// hace. El apartado 19 del artefacto dice, con todas las letras, que el
// algoritmo de scoring, los umbrales y las ponderaciones **no estan
// definidos**. Asi que este motor no calcula `required_level` ni emite
// hallazgos de brecha: inventar esos umbrales seria fabricar la respuesta y
// presentarla como derivada del documento. Lo que si puede hacer, y hace, es
// **mirar el dato del negocio y decir que capacidades demuestra** --con el
// numero delante-- y, sobre todo, **cuales no puede ver y por que**.
//
// LO SEGUNDO, QUE VALE TANTO COMO LO PRIMERO: una capacidad que el dato no
// puede ver **no se escribe**. La tentacion es ponerla en `absent`, y `absent`
// es una afirmacion --"esto no existe"-- que ningun dato ausente sostiene. "No
// lo se" y "no lo hay" son cosas distintas, y confundirlas en un diagnostico es
// como se le dice a un cliente que no tiene algo que si tiene. Las no
// observables salen aparte, con el motivo y el numero.
//
// EL TECHO ES `defined`, Y ES ESTRUCTURAL. `measured` y todo lo que hay por
// encima exigen `influences_decisions` (guardrail 20), y eso **no se puede
// observar desde la base de datos**: el dato puede demostrar que algo se mide;
// no puede demostrar que alguien lo mire. Ese salto lo da una persona.

/** Los hechos del negocio, medidos en SQL. Ninguno es una opinion. */
export type BusinessFacts = {
  window_days: number;
  orders: number;
  net_sales: number;
  /** Pedidos con `first_visit_source_type` informado, y cuantos canales hay. */
  orders_with_attribution: number;
  channels: number;
  currencies: number;
  repeat_orders: number;
  orders_with_repeat_flag: number;
  customers: number;
  repeat_customers: number;
  products: number;
  variants: number;
  session_days: number;
  sessions: number;
  fulfillments: number;
  fulfilled_orders: number;
  inventory_items: number;
  inventory_items_with_cost: number;
  inventory_snapshots: number;
  discounts: number;
  discounts_used: number;
  active_months: number;
};

/**
 * Cobertura minima para que un campo pueda sostener una afirmacion.
 *
 * **Este numero es nuestro, no del artefacto.** Por debajo de el, un campo
 * informado en unos pocos pedidos no describe al negocio: describe a esos
 * pedidos. Exportado para poder calibrarlo cuando haya varias tiendas delante.
 */
export const COBERTURA_MINIMA = 0.6;

/** Meses con actividad para poder hablar de consistencia y no de una racha. */
export const MESES_PARA_CONSISTENCIA = 3;

/** Una medida de complejidad: un hecho con su numero y su unidad. */
export type ComplexityMeasure = {
  key: string;
  label: string;
  value: number;
  unit: string;
};

/**
 * Paso 2 del runtime: medir la complejidad actual.
 *
 * Son medidas, no puntuaciones. El artefacto pide volumen, SKUs, mercados,
 * canales, base de clientes y crecimiento; lo que no se puede medir con el dato
 * de la tienda --equipo, exposicion de caja-- no aparece inventado con un cero.
 */
export function measureComplexity(facts: BusinessFacts): ComplexityMeasure[] {
  const medidas: ComplexityMeasure[] = [
    { key: "orders", label: "Pedidos en la ventana", value: facts.orders, unit: "pedidos" },
    { key: "net_sales", label: "Ventas netas", value: facts.net_sales, unit: "EUR" },
    { key: "skus", label: "Referencias vivas", value: facts.variants, unit: "variantes" },
    { key: "products", label: "Productos", value: facts.products, unit: "productos" },
    { key: "customers", label: "Clientes", value: facts.customers, unit: "clientes" },
    { key: "currencies", label: "Monedas de venta", value: facts.currencies, unit: "monedas" },
    { key: "active_months", label: "Meses con actividad", value: facts.active_months, unit: "meses" },
  ];
  // Los canales solo se cuentan si la atribucion cubre lo suficiente. Decir
  // "1 canal" cuando el 96% de los pedidos no tiene origen no es medir: es
  // confundir un hueco de datos con un negocio monocanal.
  if (proporcion(facts.orders_with_attribution, facts.orders) >= COBERTURA_MINIMA) {
    medidas.push({
      key: "channels",
      label: "Canales de adquisicion",
      value: facts.channels,
      unit: "canales",
    });
  }
  return medidas;
}

function proporcion(parte: number, total: number): number {
  return total > 0 ? parte / total : 0;
}

function pct(parte: number, total: number): string {
  return `${Math.round(proporcion(parte, total) * 100)}%`;
}

/** Una capacidad que el dato no puede ver, y por que. */
export type UnobservedCapability = {
  capability: Capability;
  reason: string;
};

export type MaturityObservation = {
  observed: CapabilityMaturity[];
  unobserved: UnobservedCapability[];
  complexity: ComplexityMeasure[];
};

/**
 * El techo de lo observable desde la base de datos.
 *
 * Guardrail 20: `measured` exige medir **y** que la medida cambie decisiones.
 * Lo segundo no esta en ninguna tabla. Subir de aqui es trabajo de una persona
 * mirando, y por eso la pantalla lo pide en vez de rellenarlo.
 */
export const TECHO_OBSERVABLE: MaturityLevel = "defined";

type Dimensiones = {
  existence: boolean;
  consistency: boolean;
  repeatability: boolean;
  measurement: boolean;
};

/**
 * De las dimensiones observadas al nivel, sin saltarse la escalera.
 *
 * No hay atajo: cada peldano exige el anterior. Un negocio que mide pero no
 * repite no es `defined`, es `ad_hoc` con un panel.
 */
export function levelFromDimensions(d: Dimensiones): MaturityLevel | null {
  if (!d.existence) return null;
  if (!d.consistency) return "ad_hoc";
  if (!d.repeatability) return "repeatable";
  if (!d.measurement) return "repeatable";
  return TECHO_OBSERVABLE;
}

function capacidad(
  capability: Capability,
  d: Dimensiones,
  descripcion: string,
  extra: Partial<CapabilityMaturity> = {},
): CapabilityMaturity | null {
  const level = levelFromDimensions(d);
  if (level == null) return null;
  return capabilityMaturitySchema.parse({
    capability,
    current_level: level,
    has_existence: d.existence,
    has_consistency: d.consistency,
    has_repeatability: d.repeatability,
    has_measurement: d.measurement,
    // Lo demas no se observa desde el dato y por eso se queda en false: son
    // los campos que una persona rellena, no huecos que el motor deba adivinar.
    influences_decisions: false,
    // Nunca `high`: el dato del sistema es la segunda fuente de evidencia, no la
    // primera (apartado 10). Para `high` hace falta comportamiento observado.
    confidence: d.measurement ? "medium" : "low",
    evidence: [
      {
        evidence_type: "system_data",
        description: descripcion,
        source: "shopify",
        supports: "current_level",
        persistent: true,
      },
    ],
    ...extra,
  });
}

/**
 * Pasos 3 y 4: construir el perfil mirando lo que el dato demuestra.
 *
 * Devuelve tres cosas y las tres importan: lo observado, **lo que no se puede
 * observar con su motivo**, y las medidas de complejidad que sostienen ambas.
 */
export function observeMaturity(facts: BusinessFacts): MaturityObservation {
  const observed: CapabilityMaturity[] = [];
  const unobserved: UnobservedCapability[] = [];
  const consistente = facts.active_months >= MESES_PARA_CONSISTENCIA;
  const anade = (c: CapabilityMaturity | null, capability: Capability, motivo: string) => {
    if (c) observed.push(c);
    else unobserved.push({ capability, reason: motivo });
  };

  // --- Conversion: hay visitas y hay pedidos -------------------------------
  const coberturaSesiones = proporcion(facts.session_days, facts.window_days);
  anade(
    facts.sessions > 0 && facts.orders > 0
      ? capacidad(
          "conversion",
          {
            existence: true,
            consistency: consistente,
            repeatability: coberturaSesiones >= COBERTURA_MINIMA,
            measurement: coberturaSesiones >= COBERTURA_MINIMA,
          },
          `${facts.sessions} sesiones y ${facts.orders} pedidos en ${facts.window_days} dias; hay serie de visitas en el ${pct(facts.session_days, facts.window_days)} de los dias, asi que la conversion se puede calcular.`,
        )
      : null,
    "conversion",
    facts.sessions === 0
      ? "no hay serie de sesiones: sin visitas no se puede hablar de conversion"
      : "no hay pedidos en la ventana",
  );

  // --- Retencion: hay clientes que vuelven ---------------------------------
  const coberturaRepeticion = proporcion(facts.orders_with_repeat_flag, facts.orders);
  anade(
    coberturaRepeticion >= COBERTURA_MINIMA && facts.orders > 0
      ? capacidad(
          "retention",
          {
            existence: facts.repeat_orders > 0,
            consistency: consistente && facts.repeat_customers > 0,
            repeatability: proporcion(facts.repeat_orders, facts.orders) > 0,
            measurement: true,
          },
          `${facts.repeat_orders} de ${facts.orders} pedidos (${pct(facts.repeat_orders, facts.orders)}) son de clientes que ya habian comprado, y ${facts.repeat_customers} clientes tienen mas de un pedido.`,
        )
      : null,
    "retention",
    `solo el ${pct(facts.orders_with_repeat_flag, facts.orders)} de los pedidos dice si el cliente era nuevo`,
  );

  // --- Producto: hay catalogo ----------------------------------------------
  anade(
    facts.products > 0
      ? capacidad(
          "product",
          {
            existence: true,
            consistency: consistente,
            repeatability: facts.variants > facts.products,
            measurement: false,
          },
          `${facts.products} productos y ${facts.variants} variantes en catalogo.`,
        )
      : null,
    "product",
    "no hay productos sincronizados",
  );

  // --- Oferta: se usan descuentos de verdad --------------------------------
  anade(
    facts.discounts > 0
      ? capacidad(
          "offer",
          {
            existence: true,
            consistency: facts.discounts_used > 0,
            repeatability: facts.discounts_used > 1,
            measurement: false,
          },
          `${facts.discounts} descuentos creados, ${facts.discounts_used} con uso registrado. Crear un descuento y que alguien lo use son cosas distintas.`,
        )
      : null,
    "offer",
    "no hay descuentos creados",
  );

  // --- Operaciones: se preparan y se entregan pedidos ----------------------
  const coberturaFulfillment = proporcion(facts.fulfilled_orders, facts.orders);
  anade(
    facts.fulfillments > 0
      ? capacidad(
          "operations",
          {
            existence: true,
            consistency: coberturaFulfillment >= COBERTURA_MINIMA,
            repeatability: coberturaFulfillment >= COBERTURA_MINIMA,
            measurement: false,
          },
          `${facts.fulfillments} preparaciones sobre ${facts.orders} pedidos (${pct(facts.fulfilled_orders, facts.orders)} de los pedidos con preparacion registrada).`,
        )
      : null,
    "operations",
    "no hay preparaciones de pedido registradas",
  );

  // --- Inventario: se controla el stock ------------------------------------
  anade(
    facts.inventory_items > 0
      ? capacidad(
          "inventory",
          {
            existence: true,
            consistency: facts.inventory_snapshots > 0,
            repeatability: facts.inventory_snapshots > 0,
            // Sin historico de existencias no hay medicion: se sabe lo que hay
            // hoy, no lo que paso.
            measurement: facts.inventory_snapshots > 0,
          },
          `${facts.inventory_items} referencias con inventario y ${facts.inventory_snapshots} lecturas de existencias guardadas.`,
        )
      : null,
    "inventory",
    "no hay referencias con inventario",
  );

  // --- Adquisicion: solo si se sabe de donde vienen los pedidos ------------
  const coberturaAtribucion = proporcion(facts.orders_with_attribution, facts.orders);
  anade(
    coberturaAtribucion >= COBERTURA_MINIMA
      ? capacidad(
          "acquisition",
          {
            existence: true,
            consistency: consistente,
            repeatability: facts.channels > 1,
            measurement: true,
          },
          `${pct(facts.orders_with_attribution, facts.orders)} de los pedidos traen origen, repartidos en ${facts.channels} canales.`,
        )
      : null,
    "acquisition",
    `solo el ${pct(facts.orders_with_attribution, facts.orders)} de los pedidos dice de donde viene: no se puede saber que hace la adquisicion`,
  );

  // --- Unit economics: solo si hay coste ----------------------------------
  const coberturaCoste = proporcion(facts.inventory_items_with_cost, facts.inventory_items);
  anade(
    coberturaCoste >= COBERTURA_MINIMA
      ? capacidad(
          "unit_economics",
          {
            existence: true,
            consistency: consistente,
            repeatability: true,
            measurement: true,
          },
          `${facts.inventory_items_with_cost} de ${facts.inventory_items} referencias tienen coste unitario, asi que el margen se puede calcular.`,
        )
      : null,
    "unit_economics",
    `solo ${facts.inventory_items_with_cost} de ${facts.inventory_items} referencias tiene coste: sin coste no hay margen que evaluar`,
  );

  // --- Datos: la capacidad que se observa mirando a las demas -------------
  //
  // Es la unica que no se mide con sus propias filas sino con la cobertura de
  // todo lo anterior. Un negocio que factura y no sabe de donde vienen sus
  // pedidos ni cuanto le cuesta cada uno tiene un problema de datos, y el
  // numero que lo demuestra ya esta calculado aqui arriba.
  const huecos = [
    coberturaAtribucion < COBERTURA_MINIMA ? "origen de los pedidos" : null,
    coberturaCoste < COBERTURA_MINIMA ? "coste por referencia" : null,
    facts.inventory_snapshots === 0 ? "historico de existencias" : null,
    coberturaSesiones < COBERTURA_MINIMA ? "serie de visitas" : null,
  ].filter((x): x is string => x != null);

  anade(
    facts.orders > 0
      ? capacidad(
          "data",
          {
            existence: true,
            consistency: consistente,
            repeatability: huecos.length <= 2,
            measurement: huecos.length === 0,
          },
          huecos.length === 0
            ? "El negocio tiene origen de pedidos, coste por referencia, historico de existencias y serie de visitas."
            : `Faltan ${huecos.length} piezas para poder diagnosticar con el dato propio: ${huecos.join(", ")}.`,
        )
      : null,
    "data",
    "no hay pedidos con los que juzgar la cobertura del dato",
  );

  // --- Lo que la base de datos de una tienda no puede ver -----------------
  //
  // No es pereza: no hay ninguna fila en ningun sitio que hable de esto, y
  // deducirlo de la facturacion es justo lo que prohiben los guardrails 1 y 5.
  const fuera: [Capability, string][] = [
    ["market", "una sola moneda no demuestra un solo mercado; hace falta que alguien lo diga"],
    ["creative", "no hay piezas ni resultados creativos ingeridos"],
    ["finance", "no hay contabilidad ni tesoreria conectadas"],
    ["technology", "el stack no se deduce de los pedidos"],
    ["team", "quien hace que no esta en ninguna tabla, y el tamano del equipo no es madurez (guardrail 5)"],
    ["strategy", "la estrategia no se observa en el dato transaccional"],
  ];
  for (const [c, motivo] of fuera) unobserved.push({ capability: c, reason: motivo });

  return { observed, unobserved, complexity: measureComplexity(facts) };
}

/**
 * Paso 16 y guardrail 28: **por que cambia** el perfil respecto al anterior.
 *
 * El ejemplo es del propio artefacto: pasar de "Finance E3-E5 con confianza
 * baja" a "Finance E4 con confianza alta" **no es una mejora del negocio**, es
 * una mejora de la observacion. Si no se distinguen, el sistema celebra
 * progresos que no existieron -- y el consultor felicita al cliente por algo
 * que no ha hecho.
 *
 * Aqui se distinguen mirando dos cosas distintas: si cambio algun nivel (eso es
 * el negocio) o si solo cambio lo que se ve de el (eso somos nosotros).
 *
 * Devolver `null` es una respuesta y es la util: si nada cambio, el motor no
 * escribe un perfil nuevo para repetir lo de ayer.
 */
export function classifyProfileChange(
  previous: { capabilities: CapabilityMaturity[] } | null,
  next: { capabilities: CapabilityMaturity[] },
): { change_type: MaturityChangeType; change_summary: string } | null {
  if (!previous) {
    return { change_type: "initial", change_summary: "Primer perfil observado." };
  }

  const antes = new Map(previous.capabilities.map((c) => [c.capability, c]));
  const ahora = new Map(next.capabilities.map((c) => [c.capability, c]));

  const movidas: string[] = [];
  for (const [nombre, c] of ahora) {
    const previa = antes.get(nombre);
    if (previa && previa.current_level !== c.current_level) {
      movidas.push(`${nombre}: ${previa.current_level} -> ${c.current_level}`);
    }
  }
  if (movidas.length > 0) {
    return { change_type: "real_change", change_summary: movidas.join("; ") };
  }

  // Nadie se movio de nivel. Lo que puede haber cambiado es cuanto vemos.
  const nuevas = [...ahora.keys()].filter((n) => !antes.has(n));
  const perdidas = [...antes.keys()].filter((n) => !ahora.has(n));
  if (nuevas.length > 0 || perdidas.length > 0) {
    return {
      change_type: "uncertainty_reduction",
      change_summary: [
        nuevas.length > 0 ? `ahora se pueden ver: ${nuevas.join(", ")}` : null,
        perdidas.length > 0 ? `han dejado de verse: ${perdidas.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join("; "),
    };
  }

  const subeConfianza = [...ahora].some(([nombre, c]) => {
    const previa = antes.get(nombre);
    return previa != null && confianzaRank(c.confidence) > confianzaRank(previa.confidence);
  });
  if (subeConfianza) {
    return {
      change_type: "confidence_increase",
      change_summary: "Mismos niveles, mas confianza: se ve mejor, no se hace mejor.",
    };
  }

  return null;
}

const ORDEN_CONFIANZA_MADUREZ = ["insufficient_data", "low", "medium", "high"];
function confianzaRank(c: string): number {
  return ORDEN_CONFIANZA_MADUREZ.indexOf(c);
}

// --- Lo que declara una persona ---------------------------------------------
//
// El techo observable es `defined` porque `measured` exige que la medida cambie
// decisiones (guardrail 20), y eso no esta en ninguna tabla. Lo dice el
// consultor: `influences_decisions` y `has_ownership`. La declaracion vive
// aparte del perfil (el motor lo reescribe en cada pasada) y se aplica aqui.
//
// Una declaracion solo puede subir a `measured`, y solo si el dato ya demuestra
// medicion: afirmar que una medida cambia decisiones no crea la medida.
// `optimized` sigue exigiendo `has_optimization`, que tampoco se observa, asi
// que no se alcanza por declaracion.

export const maturityDeclarationSchema = z.object({
  capability: z.enum(CAPABILITIES),
  influences_decisions: z.boolean(),
  has_ownership: z.boolean(),
  owner_role: z.string().trim().min(1).max(60).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  /**
   * Lo que ESTE negocio necesita de la capacidad. Lo fija el consultor por
   * tienda (decision 2026-09-24): el apartado 19 del artefacto no define
   * algoritmo para derivarlo, asi que es juicio humano declarado, no calculo.
   */
  required_level: z.enum(MATURITY_LEVELS).nullable().optional(),
});

const NIVEL_ES: Record<MaturityLevel, string> = {
  absent: "inexistente",
  ad_hoc: "a ratos",
  repeatable: "siempre igual",
  defined: "con metodo y medida",
  measured: "medido y decidiendo",
  optimized: "optimizado",
  adaptive: "adaptativo",
};

/**
 * El hallazgo que sale de la distancia entre lo que hay y lo que el negocio
 * necesita. Un peldano por encima es holgura sana, no sobreingenieria: solo a
 * partir de dos se llama complejidad que el negocio no pide (guardrail 25).
 */
export function findingForGap(
  current: MaturityLevel,
  required: MaturityLevel,
): { finding: MaturityFinding; gap_interpretation: string } {
  const d = maturityRank(current) - maturityRank(required);
  const par = `${NIVEL_ES[current]} frente a ${NIVEL_ES[required]}`;
  if (d <= -2) {
    return {
      finding: "critically_behind",
      gap_interpretation: `Le faltan ${-d} peldanos para lo que necesita este negocio (${par}).`,
    };
  }
  if (d === -1) {
    return {
      finding: "structural_weakness",
      gap_interpretation: `Le falta un peldano para lo que necesita este negocio (${par}).`,
    };
  }
  if (d >= 2) {
    return {
      finding: "overengineering",
      gap_interpretation: `Va ${d} peldanos por encima de lo que necesita: complejidad que el negocio no pide (${par}).`,
    };
  }
  return {
    finding: "appropriate",
    gap_interpretation: `Cubre lo que necesita este negocio (${par}).`,
  };
}

export type MaturityDeclaration = z.infer<typeof maturityDeclarationSchema>;

export function applyMaturityDeclarations(
  observed: CapabilityMaturity[],
  declarations: MaturityDeclaration[],
): CapabilityMaturity[] {
  const byCapability = new Map(declarations.map((d) => [d.capability, d]));
  return observed.map((c) => {
    const declared = byCapability.get(c.capability);
    if (!declared) return c;
    const raises =
      c.current_level === TECHO_OBSERVABLE && c.has_measurement && declared.influences_decisions;
    const level: MaturityLevel = raises ? "measured" : c.current_level;
    const gap = declared.required_level ? findingForGap(level, declared.required_level) : null;
    return capabilityMaturitySchema.parse({
      ...c,
      current_level: level,
      required_level: declared.required_level ?? c.required_level ?? null,
      finding: gap?.finding ?? c.finding ?? null,
      gap_interpretation: gap?.gap_interpretation ?? c.gap_interpretation ?? null,
      influences_decisions: declared.influences_decisions,
      has_ownership: declared.has_ownership,
      owner_role: declared.owner_role ?? c.owner_role ?? null,
      evidence: [
        ...c.evidence,
        {
          evidence_type: "user_claim",
          description: [
            declared.influences_decisions
              ? "El consultor declara que esta medida cambia decisiones"
              : "El consultor declara que esta medida no cambia decisiones",
            declared.has_ownership ? "con responsable asignado" : "sin responsable asignado",
            declared.note ? `(${declared.note})` : null,
          ]
            .filter(Boolean)
            .join(", "),
          source: "consultant_declaration",
          supports: raises ? "advancement" : "current_level",
          persistent: true,
        },
      ],
    });
  });
}
