/**
 * FASE 3 / D06 — El motor de sintomas.
 *
 * Fuentes: `02-contratos-IA/d06-requisitos-contrato-sintomas.md` (23 apartados),
 * `04-policies-guardrails/d06-guardrails-sintomas.md` (48 guardrails),
 * `03-runtime/d06-flujo-motor-sintomas.md` (24 pasos).
 *
 * D05 puede decir "el CTR cae un 34%". D06 es el que puede decir "hay un patron
 * de deterioro en prospecting de Francia" -- y sigue sin poder decir por que
 * (D07-D09) ni que hacer (F5+).
 *
 * LA FRONTERA SE GARANTIZA POR AUSENCIA. No hay `hypothesis`, `cause`,
 * `root_cause`, `action`, `recommendation`, `priority` ni `severity`. Y, lo mas
 * importante, **no hay `direction`**: el guardrail 22 dice que "CAC arriba" no
 * es automaticamente negativo, y si la direccion estuviera aqui, derivar la
 * valencia de ella seria lo natural. Vive en las senales de D05, a un join de
 * distancia.
 *
 * Lo que este fichero comprueba es lo que un check de columna no alcanza:
 * reglas que miran el sintoma junto a sus senales, su evidencia, sus hijos y su
 * episodio anterior.
 */
import { z } from "zod";

import { type DiagnosticInvariantViolation } from "./diagnostics.js";
import { CAPABILITIES } from "./maturity.js";

/** Apartado 2. Las catorce familias de dominio. */
export const SYMPTOM_FAMILIES = [
  "acquisition",
  "creative",
  "conversion",
  "offer",
  "product",
  "retention",
  "inventory",
  "operations",
  "financial",
  "data",
  "technology",
  "team",
  "strategy",
  "cross_capability",
] as const;

/** Apartado 3. Contextual: el guardrail 21 prohibe deducirla de una direccion. */
export const SYMPTOM_VALENCES = ["negative", "positive", "neutral", "mixed"] as const;

/** Apartado 6. */
export const SYMPTOM_SCOPES = [
  "business",
  "capability",
  "subcapability",
  "channel",
  "market",
  "product",
  "segment",
] as const;

/** Apartado 8. Ninguno implica causa raiz. */
export const DIAGNOSTIC_DEPTHS = ["surface", "intermediate", "deep"] as const;

/** Apartado 9. */
export const PROCESS_POSITIONS = ["upstream", "midstream", "downstream"] as const;

/** Apartado 10. */
export const TIME_ROLES = ["leading", "coincident", "lagging"] as const;

/** Apartado 11. La fuente no define umbrales temporales universales. */
export const SYMPTOM_PERSISTENCE = ["acute", "recurring", "chronic", "persistent"] as const;

/** Paso 3 del runtime y guardrail 10: las clases de relacion que valen. */
export const COHERENCE_RELATIONSHIPS = [
  "temporal",
  "mathematical",
  "funnel",
  "functional",
  "economic",
  "operational",
] as const;

/** Apartado 5. `contradicting` existe porque el guardrail 13 obliga a conservarla. */
export const SIGNAL_ROLES = ["required", "supporting", "contradicting", "neutral"] as const;

/** Apartado 17. */
export const EVIDENCE_SOURCES = [
  "metric",
  "review",
  "ticket",
  "call",
  "survey",
  "log",
  "other",
] as const;

/**
 * Apartado 12. **El catalogo entero de relaciones que D06 puede afirmar.**
 *
 * No contiene `causes` ni `caused_by`, y esa ausencia es el guardrail 18: una
 * relacion candidata no es una arista causal. Anadir causalidad aqui exigiria
 * tocar este array, el check de la tabla y un test -- que es exactamente la
 * friccion que se busca. El grafo causal es D07.
 */
export const SYMPTOM_RELATIONS = [
  "may_precede",
  "may_follow",
  "often_cooccurs",
  "related",
] as const;

export const CONFIDENCE_LEVELS = ["insufficient_data", "low", "medium", "high"] as const;

/**
 * Los campos del sintoma, sin refinamientos, para poder inspeccionar `.shape`.
 *
 * (Zod v4: encadenar `.refine()` produce un `ZodEffects` que ya no expone
 * `.shape`, y los tests estructurales necesitan leer las claves.)
 */
export const engineSymptomFields = z.object({
  symptom_id: z.string().min(1),
  symptom_family: z.enum(SYMPTOM_FAMILIES),
  canonical_type: z.string().min(1),
  label: z.string().min(1),
  valence: z.enum(SYMPTOM_VALENCES),
  capability: z.enum(CAPABILITIES).optional(),

  scope: z.enum(SYMPTOM_SCOPES).default("business"),
  scope_detail: z.record(z.string(), z.unknown()).default({}),

  diagnostic_depth: z.enum(DIAGNOSTIC_DEPTHS).default("surface"),
  process_position: z.enum(PROCESS_POSITIONS).optional(),
  time_role: z.enum(TIME_ROLES).optional(),
  persistence: z.enum(SYMPTOM_PERSISTENCE).default("acute"),
  recurrence_count: z.number().int().min(0).default(0),

  same_time_window: z.boolean().default(false),
  compatible_scope: z.boolean().default(false),
  compatible_direction: z.boolean().default(false),
  known_relationship: z.boolean().default(false),
  sufficient_signal_quality: z.boolean().default(false),
  coherence_relationship: z.enum(COHERENCE_RELATIONSHIPS).optional(),

  confidence: z.enum(CONFIDENCE_LEVELS).default("low"),
  data_confidence: z.enum(CONFIDENCE_LEVELS).default("low"),
  context_reviewed: z.boolean().default(false),

  parent_symptom_id: z.string().optional(),
  previous_symptom_id: z.string().optional(),
  status: z.enum(["active", "resolved", "superseded"]).default("active"),
});

export const engineSymptomSchema = engineSymptomFields
  // Guardrails 9 y 10: afirmar que hay relacion obliga a decir de que clase.
  // "Pasaron a la vez" no es una clase de relacion.
  .refine((s) => !s.known_relationship || s.coherence_relationship != null, {
    message:
      "Un sintoma que afirma relacion conocida tiene que decir de que clase es (guardrails 9 y 10).",
  })
  // Guardrails 12 y 34: no elevar un cluster debil a sintoma fuerte.
  .refine(
    (s) =>
      s.confidence !== "high" ||
      (s.sufficient_signal_quality && s.known_relationship && s.compatible_scope),
    {
      message:
        "Confianza alta exige calidad de senal suficiente, relacion conocida y scope compatible (guardrails 12 y 34).",
    },
  )
  // Guardrail 33: D01 manda. La confianza del sintoma no supera a la del dato.
  .refine(
    (s) =>
      s.data_confidence !== "insufficient_data" ||
      s.confidence === "insufficient_data" ||
      s.confidence === "low",
    { message: "Sin dato fiable no se puede afirmar un sintoma con fuerza (guardrail 33)." },
  )
  // Guardrails 19 y 20: asi se fabrican los sintomas falsos de temporada o mix.
  .refine((s) => s.confidence !== "high" || s.context_reviewed, {
    message: "Confianza alta sin haber revisado el contexto de D02 (guardrails 19 y 20).",
  })
  // Guardrails 23, 25 y 26: si no es global, hay que decir donde.
  .refine(
    (s) => s.scope === "business" || Object.keys(s.scope_detail ?? {}).length > 0,
    {
      message:
        "Un sintoma localizado tiene que decir donde ocurre (guardrails 23, 25 y 26).",
    },
  )
  .refine((s) => s.persistence !== "recurring" || s.recurrence_count >= 2, {
    message: "Recurrente exige haberlo visto mas de una vez.",
  });

export type EngineSymptom = z.infer<typeof engineSymptomSchema>;

export const symptomSignalLinkSchema = z.object({
  symptom_id: z.string().min(1),
  signal_id: z.string().min(1),
  /** El scope de la senal, para poder detectar generalizaciones indebidas. */
  signal_scope: z.string().optional(),
  role: z.enum(SIGNAL_ROLES).default("supporting"),
});

export type SymptomSignalLink = z.infer<typeof symptomSignalLinkSchema>;

export const symptomEvidenceSchema = z
  .object({
    symptom_id: z.string().min(1),
    source_kind: z.enum(EVIDENCE_SOURCES),
    stance: z.enum(["supporting", "contradicting"]).default("supporting"),
    observation: z.string().min(1),
    representativeness: z.enum(["unknown", "low", "medium", "high"]).optional(),
    sample_size: z.number().int().min(0).optional(),
  })
  // Guardrail 35: tres resenas no son trescientas, y callarlo es lo que las
  // hace parecer lo mismo.
  .refine(
    (e) =>
      !["review", "ticket", "call", "survey"].includes(e.source_kind) ||
      e.representativeness != null,
    {
      message:
        "La evidencia cualitativa tiene que declarar a cuanto representa, aunque sea `unknown` (guardrail 35).",
    },
  )
  .refine(
    (e) =>
      e.representativeness == null ||
      !["medium", "high"].includes(e.representativeness) ||
      e.sample_size != null,
    { message: "Afirmar representatividad media o alta exige decir sobre cuantos casos." },
  );

export type SymptomEvidence = z.infer<typeof symptomEvidenceSchema>;

export const symptomRelationSchema = z
  .object({
    from_symptom_id: z.string().min(1),
    to_symptom_id: z.string().min(1),
    relation: z.enum(SYMPTOM_RELATIONS),
    rationale: z.string().optional(),
  })
  .refine((r) => r.from_symptom_id !== r.to_symptom_id, {
    message: "Una relacion candidata necesita dos sintomas distintos.",
  });

export type SymptomRelation = z.infer<typeof symptomRelationSchema>;

export type SymptomCheckInput = {
  symptoms: EngineSymptom[];
  signals?: SymptomSignalLink[];
  evidence?: SymptomEvidence[];
  relations?: SymptomRelation[];
};

/**
 * Lo que un check de columna no alcanza: reglas que miran el sintoma junto a
 * sus senales, su evidencia y sus hijos.
 */
export function checkSymptomInvariants(
  input: SymptomCheckInput,
): DiagnosticInvariantViolation[] {
  const violations: DiagnosticInvariantViolation[] = [];
  const signals = input.signals ?? [];
  const evidence = input.evidence ?? [];
  const relations = input.relations ?? [];

  const porId = new Map(input.symptoms.map((s) => [s.symptom_id, s]));

  for (const s of input.symptoms) {
    const suyas = signals.filter((x) => x.symptom_id === s.symptom_id);
    const sostienen = suyas.filter(
      (x) => x.role === "required" || x.role === "supporting",
    );
    const suEvidencia = evidence.filter((e) => e.symptom_id === s.symptom_id);
    const hijos = input.symptoms.filter((h) => h.parent_symptom_id === s.symptom_id);

    // Guardrails 9 y 10. Que varias senales coincidan en el tiempo no las
    // relaciona: hace falta una relacion declarada.
    if (sostienen.length >= 2 && !s.known_relationship) {
      violations.push({
        rule: "simultaneidad_no_es_sintoma",
        source: "D06 guardrails 9 y 10",
        message: `"${s.label}" agrupa ${sostienen.length} senales sin declarar que relacion las une. Coincidir en el tiempo no es una relacion.`,
      });
    }

    // Guardrail 13. Lo que contradice se conserva -- y si se conserva, no se
    // puede a la vez afirmar el sintoma con la confianza mas alta.
    const contradicen =
      suyas.some((x) => x.role === "contradicting") ||
      suEvidencia.some((e) => e.stance === "contradicting");
    if (s.confidence === "high" && contradicen) {
      violations.push({
        rule: "contradiccion_preservada",
        source: "D06 guardrail 13",
        message: `"${s.label}" se afirma con confianza alta teniendo evidencia que lo contradice sin resolver.`,
      });
    }

    // Guardrail 28. Un sintoma muy especifico sin nada que lo sostenga es
    // especificidad inventada.
    if (s.diagnostic_depth === "deep" && suEvidencia.length === 0) {
      violations.push({
        rule: "profundidad_exige_evidencia",
        source: "D06 guardrails 28 y 29",
        message: `"${s.label}" se declara profundo sin evidencia que lo sostenga.`,
      });
    }

    // Guardrail 23. Si todas sus senales vienen de un unico scope concreto, el
    // sintoma no es del negocio entero: es de ese scope.
    if (s.scope === "business" && sostienen.length > 0) {
      const scopes = new Set(
        sostienen.map((x) => x.signal_scope).filter((x): x is string => Boolean(x)),
      );
      if (scopes.size === 1 && !scopes.has("global") && !scopes.has("business")) {
        violations.push({
          rule: "local_no_se_generaliza",
          source: "D06 guardrail 23",
          message: `"${s.label}" se declara global pero todas sus senales vienen de "${[...scopes][0]}".`,
        });
      }
    }

    // Guardrail 36 y experience-learning 11. La memoria orienta; no sostiene.
    if (
      s.previous_symptom_id != null &&
      s.confidence === "high" &&
      suEvidencia.length === 0 &&
      sostienen.length === 0
    ) {
      violations.push({
        rule: "memoria_no_es_causa",
        source: "D06 guardrail 36",
        message: `"${s.label}" se apoya solo en que ya paso antes. Un historico parecido no confirma el mecanismo actual.`,
      });
    }

    // Guardrails 43 y 44. No detener el diagnostico en el resultado cuando hay
    // con que descomponerlo.
    if (
      s.process_position === "downstream" &&
      s.diagnostic_depth === "surface" &&
      s.status === "active" &&
      hijos.length === 0 &&
      sostienen.length >= 2
    ) {
      violations.push({
        rule: "downstream_no_detiene_la_investigacion",
        source: "D06 guardrails 43 y 44",
        message: `"${s.label}" es un sintoma de resultado y se queda en superficie teniendo ${sostienen.length} senales con las que descomponerlo.`,
      });
    }

    // Guardrail 32. Un positivo comercial no cancela un negativo economico.
    if (hijos.length > 0 && (s.valence === "positive" || s.valence === "neutral")) {
      const economicoNegativo = hijos.find(
        (h) => h.valence === "negative" && h.symptom_family === "financial",
      );
      if (economicoNegativo) {
        violations.push({
          rule: "economico_no_se_cancela",
          source: "D06 guardrail 32",
          message: `"${s.label}" se presenta como ${s.valence} conteniendo "${economicoNegativo.label}", que es un sintoma economico negativo.`,
        });
      }
    }

    // Guardrails 30 y 31. No forzar una narrativa unica: agrupar bajo un mismo
    // padre sintomas de familias distintas exige haber declarado la coherencia.
    if (hijos.length > 1 && !s.known_relationship) {
      const familias = new Set(hijos.map((h) => h.symptom_family));
      if (familias.size > 1) {
        violations.push({
          rule: "narrativa_unica_forzada",
          source: "D06 guardrails 30 y 31",
          message: `"${s.label}" agrupa sintomas de ${familias.size} familias distintas sin declarar que los relaciona. Pueden ser problemas independientes.`,
        });
      }
    }
  }

  // Una relacion candidata entre sintomas que no existen no dice nada.
  for (const r of relations) {
    if (porId.size > 0 && (!porId.has(r.from_symptom_id) || !porId.has(r.to_symptom_id))) {
      violations.push({
        rule: "relacion_huerfana",
        source: "D06 apartado 13",
        message: `Relacion "${r.relation}" entre sintomas que no estan en el conjunto evaluado.`,
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// EL MOTOR (pasos 1 a 22 del runtime)
// ---------------------------------------------------------------------------
//
// Todo lo que sigue es puro: entran senales de D05, la lectura de D02 y el
// catalogo de dependencias entre metricas, y salen sintomas candidatos. La
// parte sucia --leer Supabase, escribir filas-- vive en
// `apps/api/src/symptom-engine.ts`, igual que en D01, D02 y D05.
//
// LA DECISION QUE ORDENA EL RESTO: **la relacion entre dos senales no se
// adivina, se consulta**. El guardrail 9 prohibe crear un sintoma porque varias
// senales ocurran a la vez, y el 10 exige una relacion declarada (temporal,
// matematica, funnel, funcional, economica u operacional). En vez de inferirla
// de la forma de las series --que es exactamente el error que el guardrail
// describe-- se lee de `metric_dependencies`, la tabla de D05 donde alguien
// escribio que `net_sales` se compone de `orders_count` y por que. Si la
// relacion no esta declarada no hay sintoma compuesto: hay dos sintomas
// independientes y, como mucho, una relacion candidata `often_cooccurs`.

/** Una senal de D05, con lo que D06 necesita de ella. */
export type SignalForSymptom = {
  signal_id: string;
  metric: string;
  capability?: string;
  scope: string;
  direction: "up" | "down" | "flat" | "diverging" | "unstable";
  window_start: string;
  window_end: string;
  /** `transient | emerging | persistent | chronic` (catalogo de D05). */
  persistence: string;
  business_relevance: string;
  data_confidence: string;
  signal_confidence: string;
  low_sample: boolean;
};

/** Una fila de `metric_dependencies`: quien se compone de quien, y por que. */
export type MetricDependency = {
  metric: string;
  depends_on: string;
  relation: "component" | "derived_from" | "shares_input";
  rationale?: string;
};

/**
 * Una plantilla del paso 6: el patron experto reutilizable.
 *
 * **Aqui vive el juicio que el guardrail 21 exige.** La valencia no se deriva
 * de la direccion de la metrica; se deriva de que alguien escribio que, para
 * esta metrica y en esta direccion, el significado empresarial es ese. Son dos
 * cosas distintas y la diferencia es todo el guardrail 22: por eso existe
 * `contextual`, con el que una plantilla puede **negarse a decidir** --que es
 * lo que hay que hacer con un CAC que sube, porque puede ser el precio de
 * entrar en un mercado nuevo-- y entonces el sintoma sale `neutral`.
 */
export type SymptomTemplate = {
  canonical_type: string;
  metric: string;
  direction: "up" | "down";
  family: (typeof SYMPTOM_FAMILIES)[number];
  valence: "negative" | "positive" | "neutral" | "contextual";
  label: string;
  process_position?: (typeof PROCESS_POSITIONS)[number];
  time_role?: (typeof TIME_ROLES)[number];
};

/**
 * La libreria de patrones de hoy: las cinco metricas que D05 sabe emitir.
 *
 * Deliberadamente corta. Una libreria con entradas para metricas que nadie
 * calcula todavia solo sirve para que parezca que el motor cubre mas de lo que
 * cubre; anadir una entrada cuando la metrica exista es una linea.
 */
export const SYMPTOM_TEMPLATES: SymptomTemplate[] = [
  {
    canonical_type: "net_sales_decline",
    metric: "net_sales",
    direction: "down",
    family: "financial",
    valence: "negative",
    label: "Caida de ventas netas",
    // Guardrail 43: la facturacion es resultado. Llamarla `downstream` es lo
    // que obliga al invariante a exigir que se descomponga si hay con que.
    process_position: "downstream",
    time_role: "lagging",
  },
  {
    canonical_type: "net_sales_growth",
    metric: "net_sales",
    direction: "up",
    family: "financial",
    valence: "positive",
    label: "Crecimiento de ventas netas",
    process_position: "downstream",
    time_role: "lagging",
  },
  {
    canonical_type: "order_volume_decline",
    metric: "orders_count",
    direction: "down",
    family: "conversion",
    valence: "negative",
    label: "Caida del volumen de pedidos",
    process_position: "midstream",
    time_role: "coincident",
  },
  {
    canonical_type: "order_volume_growth",
    metric: "orders_count",
    direction: "up",
    family: "conversion",
    valence: "positive",
    label: "Crecimiento del volumen de pedidos",
    process_position: "midstream",
    time_role: "coincident",
  },
  // Ticket medio: `contextual` en las dos direcciones. Baja con una promocion
  // hecha a proposito y sube cuando desaparecen los pedidos pequenos: la
  // direccion sola no dice si es bueno (guardrail 22).
  {
    canonical_type: "average_order_value_decline",
    metric: "average_order_value",
    direction: "down",
    family: "offer",
    valence: "contextual",
    label: "Caida del ticket medio",
    process_position: "midstream",
    time_role: "coincident",
  },
  {
    canonical_type: "average_order_value_growth",
    metric: "average_order_value",
    direction: "up",
    family: "offer",
    valence: "contextual",
    label: "Subida del ticket medio",
    process_position: "midstream",
    time_role: "coincident",
  },
  {
    canonical_type: "traffic_decline",
    metric: "sessions",
    direction: "down",
    family: "acquisition",
    valence: "negative",
    label: "Caida del trafico",
    process_position: "upstream",
    time_role: "leading",
  },
  {
    canonical_type: "traffic_growth",
    metric: "sessions",
    direction: "up",
    family: "acquisition",
    valence: "positive",
    label: "Crecimiento del trafico",
    process_position: "upstream",
    time_role: "leading",
  },
  {
    canonical_type: "conversion_rate_decline",
    metric: "conversion_rate",
    direction: "down",
    family: "conversion",
    valence: "negative",
    label: "Caida de la conversion",
    process_position: "midstream",
    time_role: "coincident",
  },
  {
    canonical_type: "conversion_rate_growth",
    metric: "conversion_rate",
    direction: "up",
    family: "conversion",
    valence: "positive",
    label: "Mejora de la conversion",
    process_position: "midstream",
    time_role: "coincident",
  },
];

/**
 * Paso 2: revisar la calidad de la senal.
 *
 * Guardrail 33 -- D01 limita que senales pueden usarse. Una senal sin dato
 * fiable no se descarta en silencio: se devuelve el motivo y el motor lo
 * registra. Lo que no se ve no se puede revisar.
 */
export function reviewSignalQuality(signal: SignalForSymptom): {
  usable: boolean;
  degraded: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let usable = true;
  let degraded = false;

  if (signal.data_confidence === "insufficient_data") {
    usable = false;
    reasons.push(`D01 no da por utilizable el dato de ${signal.metric}`);
  }
  if (signal.data_confidence === "low") {
    degraded = true;
    reasons.push(`la fiabilidad del dato de ${signal.metric} es baja`);
  }
  if (signal.low_sample) {
    degraded = true;
    reasons.push("la muestra es demasiado pequena para afirmar con fuerza");
  }
  // `flat` no es un cambio y `unstable` no dice en que direccion. Ninguna de
  // las dos sostiene un patron empresarial por si sola.
  if (signal.direction === "flat" || signal.direction === "unstable") {
    usable = false;
    reasons.push(`la senal de ${signal.metric} no tiene direccion interpretable`);
  }

  return { usable, degraded, reasons };
}

/** Paso 4, primer factor: mirar al mismo tramo de tiempo. */
export function windowsOverlap(a: SignalForSymptom, b: SignalForSymptom): boolean {
  return (
    new Date(a.window_start).getTime() <= new Date(b.window_end).getTime() &&
    new Date(b.window_start).getTime() <= new Date(a.window_end).getTime()
  );
}

/**
 * Paso 3: buscar la relacion, no inventarla.
 *
 * Devuelve `null` cuando nadie ha declarado que estas dos metricas tengan que
 * ver. Que se muevan igual el mismo martes no cuenta: eso es el guardrail 9.
 */
export function findMetricRelationship(
  metricA: string,
  metricB: string,
  dependencies: MetricDependency[],
): {
  relationship: (typeof COHERENCE_RELATIONSHIPS)[number];
  rationale: string;
  dependent: string;
} | null {
  for (const d of dependencies) {
    const directa = d.metric === metricA && d.depends_on === metricB;
    const inversa = d.metric === metricB && d.depends_on === metricA;
    if (!directa && !inversa) continue;

    return {
      // Componerse de otra metrica es aritmetica; compartir un input es una
      // relacion funcional, mas debil, y por eso no se llaman igual.
      relationship: d.relation === "shares_input" ? "functional" : "mathematical",
      rationale: d.rationale ?? `${d.metric} ${d.relation} ${d.depends_on}`,
      // El dependiente es el de aguas abajo: `net_sales` se compone de pedidos,
      // luego el sintoma de ventas es el padre del de pedidos.
      dependent: d.metric,
    };
  }
  return null;
}

/**
 * Se mueven de forma compatible con la relacion que las une.
 *
 * Para una relacion matematica de composicion, moverse en el mismo sentido es
 * compatible. Moverse en sentidos opuestos **no invalida nada**: es informacion
 * -- si las ventas caen mientras los pedidos suben, lo que se hundio es el
 * ticket medio. Por eso el motor no descarta esa senal: la guarda con rol
 * `contradicting` (guardrail 13) y deja de poder afirmar con confianza alta.
 */
export function directionsAreCompatible(
  a: SignalForSymptom,
  b: SignalForSymptom,
  relationship: (typeof COHERENCE_RELATIONSHIPS)[number],
): boolean {
  if (relationship !== "mathematical") return true;
  return a.direction === b.direction;
}

const ORDEN_CONFIANZA = ["insufficient_data", "low", "medium", "high"] as const;

function minConfianza(
  a: (typeof CONFIDENCE_LEVELS)[number],
  b: (typeof CONFIDENCE_LEVELS)[number],
): (typeof CONFIDENCE_LEVELS)[number] {
  return ORDEN_CONFIANZA.indexOf(a) <= ORDEN_CONFIANZA.indexOf(b) ? a : b;
}

/**
 * La lectura de D02 sobre este movimiento, si existe.
 *
 * Guardrails 19 y 20: D02 tiene que poder corregir el patron. Si D02 dice que
 * lo que cambio fue la composicion y no el rendimiento, el "deterioro" puede no
 * existir.
 */
export type ContextReading = {
  aggregate_interpretation: string;
  comparability: string;
  context_assessment_id?: string;
};

export type PreviousEpisode = {
  symptom_id: string;
  canonical_type: string;
  status: string;
  first_seen_at: string;
  recurrence_count: number;
};

/** Lo que el motor devuelve, listo para escribirse. */
export type SymptomEngineOutput = {
  symptoms: EngineSymptom[];
  links: SymptomSignalLink[];
  evidence: SymptomEvidence[];
  relations: SymptomRelation[];
  /** Senales que no llegaron a sintoma, con el motivo. Nunca se tiran calladas. */
  skipped: { signal_id: string; metric: string; reason: string }[];
};

export type SymptomEngineInput = {
  signals: SignalForSymptom[];
  dependencies: MetricDependency[];
  /**
   * La lectura de D02, **por metrica** (paso 7).
   *
   * Por metrica y no una sola para toda la pasada: que D02 lea la caida de
   * ventas como un cambio de composicion no dice nada sobre el volumen de
   * pedidos, y degradar el segundo por lo que se sabe del primero seria
   * inventar una correccion que nadie hizo.
   */
  contexts?: Record<string, ContextReading>;
  /** `business` si la organizacion tiene una sola tienda; si no, el detalle. */
  scope: (typeof SYMPTOM_SCOPES)[number];
  scopeDetail?: Record<string, unknown>;
  templates?: SymptomTemplate[];
  /** Episodios anteriores del mismo tipo, para los pasos 19 y 21. */
  previous?: PreviousEpisode[];
  now?: string;
};

/** Cuantos dias activo convierten un patron en cronico. */
export const DIAS_PARA_CRONICO = 60;

/**
 * Paso 19: agudo, recurrente o cronico.
 *
 * `recurrence_count` cuenta **episodios, incluido este**: el primero vale 1. La
 * tabla exige `>= 2` para llamarlo recurrente, que es literalmente "haberlo
 * visto mas de una vez".
 */
export function classifyPersistence(input: {
  previous?: PreviousEpisode;
  signalPersistence: string;
  now: string;
}): {
  persistence: (typeof SYMPTOM_PERSISTENCE)[number];
  recurrence_count: number;
  new_episode: boolean;
} {
  const { previous } = input;
  const ahora = new Date(input.now).getTime();

  if (previous && previous.status === "active") {
    // El mismo episodio, que sigue abierto. Lo que decide si es cronico es
    // cuanto lleva, no cuantas veces ha pasado.
    const dias = (ahora - new Date(previous.first_seen_at).getTime()) / 86_400_000;
    const cronico = dias >= DIAS_PARA_CRONICO || input.signalPersistence === "chronic";
    const recurrente = previous.recurrence_count >= 2;
    return {
      persistence: cronico ? "chronic" : recurrente ? "recurring" : "acute",
      recurrence_count: Math.max(previous.recurrence_count, 1),
      new_episode: false,
    };
  }

  if (previous) {
    // Estaba resuelto y ha vuelto. Eso es exactamente lo que cuenta.
    const cuenta = previous.recurrence_count + 1;
    return {
      persistence: cuenta >= 2 ? "recurring" : "acute",
      recurrence_count: cuenta,
      new_episode: true,
    };
  }

  return {
    persistence: input.signalPersistence === "chronic" ? "chronic" : "acute",
    recurrence_count: 1,
    new_episode: true,
  };
}

/**
 * El motor. Pasos 1 a 22.
 *
 * Forma un sintoma por senal utilizable con plantilla, los encadena en jerarquia
 * cuando `metric_dependencies` dice que una metrica se compone de otra, y anota
 * como relaciones candidatas lo que solo coincide en el tiempo.
 */
export function buildSymptoms(input: SymptomEngineInput): SymptomEngineOutput {
  const templates = input.templates ?? SYMPTOM_TEMPLATES;
  const now = input.now ?? new Date().toISOString();
  const salida: SymptomEngineOutput = {
    symptoms: [],
    links: [],
    evidence: [],
    relations: [],
    skipped: [],
  };

  // --- Pasos 1 y 2 --------------------------------------------------------
  type Candidato = {
    signal: SignalForSymptom;
    template: SymptomTemplate;
    degraded: boolean;
    symptom_id: string;
  };
  const candidatos: Candidato[] = [];

  for (const signal of input.signals) {
    const calidad = reviewSignalQuality(signal);
    if (!calidad.usable) {
      salida.skipped.push({
        signal_id: signal.signal_id,
        metric: signal.metric,
        reason: calidad.reasons.join("; "),
      });
      continue;
    }

    // Paso 6. Sin patron declarado no se inventa uno: nombrar un sintoma que
    // nadie ha definido es la especificidad inventada del guardrail 26.
    const template = templates.find(
      (t) => t.metric === signal.metric && t.direction === signal.direction,
    );
    if (!template) {
      salida.skipped.push({
        signal_id: signal.signal_id,
        metric: signal.metric,
        reason: `no hay patron declarado para ${signal.metric} ${signal.direction}`,
      });
      continue;
    }

    candidatos.push({
      signal,
      template,
      degraded: calidad.degraded,
      symptom_id: `${template.canonical_type}:${signal.window_end.slice(0, 10)}`,
    });
  }

  if (candidatos.length === 0) return salida;

  // --- Pasos 3, 4 y 14: quien es padre de quien ----------------------------
  const padreDe = new Map<string, string>();
  const relacionDe = new Map<
    string,
    { relationship: (typeof COHERENCE_RELATIONSHIPS)[number]; rationale: string }
  >();
  const contradicen = new Map<string, Candidato[]>();
  const coocurren: [Candidato, Candidato][] = [];

  for (let i = 0; i < candidatos.length; i += 1) {
    for (let j = i + 1; j < candidatos.length; j += 1) {
      const a = candidatos[i]!;
      const b = candidatos[j]!;
      if (!windowsOverlap(a.signal, b.signal)) continue;

      const rel = findMetricRelationship(a.signal.metric, b.signal.metric, input.dependencies);
      if (!rel) {
        // Paso 20: coincidir sin relacion declarada no es un sintoma. Es una
        // relacion candidata, que es otra cosa y se guarda como tal.
        coocurren.push([a, b]);
        continue;
      }

      const padre = rel.dependent === a.signal.metric ? a : b;
      const hijo = padre === a ? b : a;
      // La relacion es de los dos, no solo del padre: el sintoma de pedidos
      // esta tan unido al de ventas como el de ventas al de pedidos, y decir en
      // pantalla que nadie ha declarado nada seria falso.
      for (const lado of [a, b]) {
        relacionDe.set(lado.symptom_id, {
          relationship: rel.relationship,
          rationale: rel.rationale,
        });
      }

      if (directionsAreCompatible(a.signal, b.signal, rel.relationship)) {
        padreDe.set(hijo.symptom_id, padre.symptom_id);
      } else {
        // Guardrail 13: no se descarta, se conserva como lo que es. Y se
        // conserva **en los dos**: cada uno contradice al otro, y anotarlo solo
        // en el padre dejaria "crecimiento de pedidos" pintado como una buena
        // noticia mientras la facturacion cae.
        contradicen.set(a.symptom_id, [...(contradicen.get(a.symptom_id) ?? []), b]);
        contradicen.set(b.symptom_id, [...(contradicen.get(b.symptom_id) ?? []), a]);
      }
    }
  }

  const hijosDe = new Map<string, Candidato[]>();
  for (const c of candidatos) {
    const padre = padreDe.get(c.symptom_id);
    if (padre) hijosDe.set(padre, [...(hijosDe.get(padre) ?? []), c]);
  }

  for (const c of candidatos) {
    // Paso 7. Si D02 lee el movimiento como un cambio de composicion, el
    // "deterioro" puede no existir: eso entra como evidencia que contradice, y
    // el invariante `contradiccion_preservada` hace el resto solo.
    const contexto = input.contexts?.[c.signal.metric];
    const contextoDesmiente =
      contexto?.aggregate_interpretation === "mix_shift" ||
      contexto?.comparability === "not_comparable";

    const hijos = hijosDe.get(c.symptom_id) ?? [];
    const opuestos = contradicen.get(c.symptom_id) ?? [];
    const rel = relacionDe.get(c.symptom_id);
    const esPadre = hijos.length > 0 || opuestos.length > 0;
    const esHijo = padreDe.has(c.symptom_id);

    // --- Paso 4: los cinco factores, uno a uno --------------------------
    const same_time_window = esPadre || esHijo;
    // Todas las senales de una pasada vienen del mismo scope; el dia que D05
    // emita senales por segmento, esto deja de ser una constante.
    const compatible_scope = true;
    const compatible_direction = esPadre ? opuestos.length === 0 : same_time_window;
    const known_relationship = rel != null;
    const sufficient_signal_quality = !c.degraded;

    // --- Paso 18: la confianza ------------------------------------------
    const coherente = known_relationship && compatible_scope && sufficient_signal_quality;
    let confidence: (typeof CONFIDENCE_LEVELS)[number] = "low";
    if (coherente && compatible_direction && !contextoDesmiente && contexto != null) {
      confidence = "high";
    } else if (coherente) {
      confidence = "medium";
    }
    // Guardrail 33: nunca por encima de lo que D01 permite.
    const data_confidence = (
      CONFIDENCE_LEVELS.includes(c.signal.data_confidence as (typeof CONFIDENCE_LEVELS)[number])
        ? c.signal.data_confidence
        : "low"
    ) as (typeof CONFIDENCE_LEVELS)[number];
    confidence = minConfianza(confidence, data_confidence);

    // --- Pasos 10 y 11: valencia y profundidad --------------------------
    // Guardrail 21. La plantilla puede negarse a decidir; y aunque decida, un
    // padre cuyos componentes se mueven en contra no es lo que parecia: que las
    // ventas suban mientras caen los pedidos no es una buena noticia sin mas.
    let valence: (typeof SYMPTOM_VALENCES)[number] =
      c.template.valence === "contextual" ? "neutral" : c.template.valence;
    if (opuestos.length > 0 || contextoDesmiente) valence = "mixed";

    const diagnostic_depth: (typeof DIAGNOSTIC_DEPTHS)[number] =
      esHijo || hijos.length > 0 ? "intermediate" : "surface";

    const anteriorMismoTipo = input.previous?.find(
      (p) => p.canonical_type === c.template.canonical_type,
    );
    const persistencia = classifyPersistence({
      ...(anteriorMismoTipo ? { previous: anteriorMismoTipo } : {}),
      signalPersistence: c.signal.persistence,
      now,
    });
    const anteriorCerrado = input.previous?.find(
      (p) => p.canonical_type === c.template.canonical_type && p.status !== "active",
    );

    salida.symptoms.push(
      engineSymptomFields.parse({
        symptom_id: c.symptom_id,
        symptom_family: c.template.family,
        canonical_type: c.template.canonical_type,
        label: c.template.label,
        valence,
        ...(c.signal.capability ? { capability: c.signal.capability } : {}),
        scope: input.scope,
        scope_detail: input.scopeDetail ?? {},
        diagnostic_depth,
        ...(c.template.process_position ? { process_position: c.template.process_position } : {}),
        ...(c.template.time_role ? { time_role: c.template.time_role } : {}),
        persistence: persistencia.persistence,
        recurrence_count: persistencia.recurrence_count,
        same_time_window,
        compatible_scope,
        compatible_direction,
        known_relationship,
        sufficient_signal_quality,
        ...(rel ? { coherence_relationship: rel.relationship } : {}),
        confidence,
        data_confidence,
        context_reviewed: contexto != null,
        ...(esHijo ? { parent_symptom_id: padreDe.get(c.symptom_id)! } : {}),
        ...(anteriorCerrado ? { previous_symptom_id: anteriorCerrado.symptom_id } : {}),
        status: "active",
      }),
    );

    // --- Paso 5: las senales que lo sostienen ---------------------------
    salida.links.push({
      symptom_id: c.symptom_id,
      signal_id: c.signal.signal_id,
      signal_scope: c.signal.scope,
      role: "required",
    });
    for (const hijo of hijos) {
      salida.links.push({
        symptom_id: c.symptom_id,
        signal_id: hijo.signal.signal_id,
        signal_scope: hijo.signal.scope,
        role: "supporting",
      });
    }
    for (const opuesto of opuestos) {
      salida.links.push({
        symptom_id: c.symptom_id,
        signal_id: opuesto.signal.signal_id,
        signal_scope: opuesto.signal.scope,
        role: "contradicting",
      });
      salida.evidence.push({
        symptom_id: c.symptom_id,
        source_kind: "metric",
        stance: "contradicting",
        observation: `${opuesto.signal.metric} se mueve en sentido contrario (${opuesto.signal.direction}). Relacion declarada: ${rel?.rationale ?? "las dos metricas estan relacionadas"}`,
      });
    }

    if (contextoDesmiente && contexto) {
      salida.evidence.push({
        symptom_id: c.symptom_id,
        source_kind: "metric",
        stance: "contradicting",
        observation:
          contexto.comparability === "not_comparable"
            ? "D02 no da la comparacion por valida, asi que el patron puede ser un artefacto de la propia comparacion."
            : "D02 lee el movimiento como un cambio de composicion, no de rendimiento.",
      });
    }
  }

  // --- Paso 20: relaciones candidatas -------------------------------------
  for (const [a, b] of coocurren) {
    salida.relations.push({
      from_symptom_id: a.symptom_id,
      to_symptom_id: b.symptom_id,
      relation: "often_cooccurs",
      rationale:
        "Coinciden en el tiempo y nadie ha declarado una relacion entre sus metricas. Coincidir no es estar relacionado.",
    });
  }

  return salida;
}
