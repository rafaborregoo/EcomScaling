/**
 * FASE 3 / D02 — Contextualizacion.
 *
 * Fuentes: conocimiento/fase-03/02-contratos-IA/d02-requisitos-contrato-contextualizacion.md
 *          conocimiento/fase-03/04-policies-guardrails/d02-guardrails-contextualizacion.md
 *
 * D01 pregunta si el dato es fiable. D02 pregunta que significa **aqui**: la
 * misma caida de CVR es un fallo en una tienda y un trade-off deliberado en
 * otra que acaba de retirar un descuento para recuperar margen.
 *
 * El limite del bloque es explicito en el artefacto: "D2 no debe cerrar
 * causalidad". Sirve para eliminar comparaciones invalidas, elegir baseline,
 * localizar cambios y acotar hipotesis. Por eso el tipo de salida no tiene
 * `root_cause` ni nada que se le parezca, y hay un test que falla si aparece.
 *
 * Los catalogos son los mismos que las check constraints de
 * `20260914190000_f3_d02_contextualizacion.sql`. Si cambia uno, cambian los dos.
 */
import { z } from "zod";

import { type DiagnosticInvariantViolation } from "./diagnostics.js";
import { type DataQualityAssessment } from "./data-quality.js";

// --- Catalogos --------------------------------------------------------------

/** Contrato apartado 17. */
export const CONTEXT_COMPARABILITIES = ["comparable", "limited", "not_comparable"] as const;

/** Contrato apartado 3: la pregunta central de la contextualizacion. */
export const AGGREGATE_INTERPRETATIONS = [
  "performance_change",
  "mix_shift",
  "mixed",
  "undetermined",
] as const;

/** Guardrail 27: la profundidad se adapta a la pregunta. */
export const CONTEXT_DEPTHS = ["shallow", "standard", "deep"] as const;

/** Contrato apartado 12 / tenant apartado 22. */
export const CONTEXT_SOURCES = ["declared", "observed"] as const;

/** Contrato apartado 4 / tenant apartado 19. */
export const CHANGE_EVENT_TYPES = [
  "deployment",
  "checkout_change",
  "tracking_change",
  "theme_change",
  "platform_change",
  "promotion",
  "sale_event",
  "price_change",
  "free_shipping",
  "bundle_change",
  "launch",
  "discount_policy_change",
  "campaign_change",
  "creative_change",
  "agency_change",
  "email_flow_change",
  "influencer_activation",
  "budget_change",
  "product_mix_change",
  "inventory_event",
  "warehouse_change",
  "shipping_change",
  "supplier_change",
  "market_launch",
  "channel_launch",
  "external_event",
] as const;

/**
 * Cambios comerciales cuyo efecto es temporal por naturaleza. Guardrails 15 y
 * 16: un lift promocional no es mejora estructural, y la caida posterior no es
 * destruccion de demanda sin considerar el pull-forward.
 */
export const PROMOTIONAL_EVENT_TYPES = [
  "promotion",
  "sale_event",
  "free_shipping",
  "discount_policy_change",
] as const;

/**
 * Lo que el cliente puede declarar de su negocio (tenant apartado 22). El
 * catalogo de la tabla es abierto; este es el que la pantalla ofrece hoy.
 * `main_channel` es el unico que el dato puede contrastar (paso 13).
 */
export const DECLARED_CONTEXT_DIMENSIONS = [
  "main_channel",
  "business_model",
  "main_market",
  "price_positioning",
  "seasonality",
  "growth_goal",
] as const;

export const declaredContextFactSchema = z.object({
  dimension: z.enum(DECLARED_CONTEXT_DIMENSIONS),
  value: z.string().trim().min(1).max(200),
});

export const declaredChangeEventSchema = z
  .object({
    event_type: z.enum(CHANGE_EVENT_TYPES),
    description: z.string().trim().min(3).max(500),
    occurred_at: z.string().datetime({ offset: true }),
    ended_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((e) => !e.ended_at || e.ended_at >= e.occurred_at, {
    message: "un cambio no puede terminar antes de empezar",
  });

/** Guardrail 20: la relacion es temporal, nunca causal. */
export const TEMPORAL_RELATIONS = ["before", "concurrent", "after", "unknown"] as const;

export const CHANGE_CONSIDERATIONS = ["candidate", "plausible_factor", "ruled_out"] as const;

/** Contrato apartados 9 y 11. */
export const COMPARABILITY_BREAK_TYPES = [
  "regime_change",
  "measurement_discontinuity",
] as const;

/** Contrato apartado 8. El documento no define scoring causal, y aqui tampoco. */
export const CONFOUNDER_KNOWLEDGE_STATES = ["known", "suspected", "unknown"] as const;

export type ContextComparability = (typeof CONTEXT_COMPARABILITIES)[number];
export type AggregateInterpretation = (typeof AGGREGATE_INTERPRETATIONS)[number];
export type ChangeEventType = (typeof CHANGE_EVENT_TYPES)[number];
export type TemporalRelation = (typeof TEMPORAL_RELATIONS)[number];
export type ComparabilityBreakType = (typeof COMPARABILITY_BREAK_TYPES)[number];

// --- Esquemas ---------------------------------------------------------------

/** Contrato apartado 3. Los dos pesos son obligatorios: ver la migracion. */
export const mixSegmentSchema = z
  .object({
    dimension: z.string().min(1),
    segment: z.string().min(1),
    weight_before: z.number().min(0).max(1),
    weight_after: z.number().min(0).max(1),
    performance_before: z.number().nullable().optional(),
    performance_after: z.number().nullable().optional(),
  })
  .refine((s) => (s.performance_before == null) === (s.performance_after == null), {
    message: "un rendimiento a medias no compara nada",
  });

export const changeEventRefSchema = z
  .object({
    event_type: z.enum(CHANGE_EVENT_TYPES),
    description: z.string().min(1),
    occurred_at: z.string().min(1),
    ended_at: z.string().nullable().optional(),
    temporal_relation: z.enum(TEMPORAL_RELATIONS),
    lag_days: z.number().int().nullable().optional(),
    considered_as: z.enum(CHANGE_CONSIDERATIONS).default("candidate"),
    rule_out_reason: z.string().nullable().optional(),
  })
  // Guardrail 17: un lag solo tiene sentido si el cambio precede a la senal.
  .refine((e) => e.lag_days == null || e.temporal_relation === "before", {
    message: "lag_days exige temporal_relation 'before'",
  })
  .refine((e) => e.considered_as !== "ruled_out" || e.rule_out_reason != null, {
    message: "descartar un cambio exige decir por que",
  });

export const confounderSchema = z
  .object({
    variable: z.string().min(1),
    scope: z.string().default("global"),
    occurred_at: z.string().nullable().optional(),
    knowledge_state: z.enum(CONFOUNDER_KNOWLEDGE_STATES).default("suspected"),
    possible_relation: z.string().nullable().optional(),
    material: z.boolean().default(false),
  })
  .refine((c) => c.knowledge_state !== "known" || c.occurred_at != null, {
    message: "un confusor conocido sin fecha no se puede contrastar con la senal",
  });

export const comparabilityBreakSchema = z.object({
  break_type: z.enum(COMPARABILITY_BREAK_TYPES),
  subtype: z.string().nullable().optional(),
  description: z.string().min(1),
  effective_from: z.string().min(1),
  invalidates_history_before: z.boolean().default(true),
  affected_metrics: z.array(z.string()).default([]),
});

/** Contrato apartado 12: declarado y observado no se funden. */
export const contextContradictionSchema = z.object({
  dimension: z.string().min(1),
  declared_value: z.string().min(1),
  observed_value: z.string().min(1),
  material: z.boolean().default(true),
});

/**
 * Contrato apartado 17: la salida de D02.
 *
 * Fijate en lo que NO esta: `root_cause`, `cause`, `explanation`, `confirmed`.
 * El artefacto lo dice sin rodeos -- D2 acota hipotesis, no las cierra -- y la
 * garantia es estructural, no una instruccion en el prompt.
 */
export const contextAssessmentFields = z.object({
  assessment_id: z.string().min(1),
  scope: z.string().default("global"),

  baseline_type: z.string().nullable().optional(),
  baseline_period_start: z.string().nullable().optional(),
  baseline_period_end: z.string().nullable().optional(),
  baseline_rationale: z.string().nullable().optional(),

  comparability: z.enum(CONTEXT_COMPARABILITIES).default("limited"),
  comparability_reasons: z.array(z.string()).default([]),

  aggregate_interpretation: z.enum(AGGREGATE_INTERPRETATIONS).default("undetermined"),

  context_depth: z.enum(CONTEXT_DEPTHS).default("standard"),
  context_sufficient: z.boolean().default(false),
  missing_context: z.array(z.string()).default([]),
  critical_unknowns: z.array(z.string()).default([]),

  primary_factors: z.array(z.string()).default([]),
  declared_contradictions: z.array(z.string()).default([]),
  uncertainty_notes: z.string().nullable().optional(),
});

export const contextAssessmentSchema = contextAssessmentFields
  // Guardrail 3: comparar por cercania temporal, sin motivo escrito, es
  // exactamente lo que el guardrail prohibe.
  .refine((a) => a.baseline_type == null || a.baseline_rationale != null, {
    message: "elegir baseline exige escribir por que",
  })
  .refine((a) => a.comparability === "comparable" || a.comparability_reasons.length > 0, {
    message: "degradar la comparabilidad sin motivo no sirve aguas abajo",
  })
  // Guardrails 25 y 26: el contexto que falta no se rellena con supuestos.
  .refine((a) => a.context_sufficient || a.missing_context.length > 0, {
    message: "declarar el contexto insuficiente exige decir que falta",
  })
  .refine((a) => a.critical_unknowns.length === 0 || a.comparability !== "comparable", {
    message: "con incognitas criticas la comparacion no puede declararse limpia",
  });

export type MixSegment = z.infer<typeof mixSegmentSchema>;
export type ChangeEventRef = z.infer<typeof changeEventRefSchema>;
export type Confounder = z.infer<typeof confounderSchema>;
export type ComparabilityBreak = z.infer<typeof comparabilityBreakSchema>;
export type ContextContradiction = z.infer<typeof contextContradictionSchema>;
export type ContextAssessment = z.infer<typeof contextAssessmentSchema>;

export type ContextCheckInput = {
  assessment: ContextAssessment;
  mix?: MixSegment[];
  changeEvents?: ChangeEventRef[];
  confounders?: Confounder[];
  breaks?: ComparabilityBreak[];
  contradictions?: ContextContradiction[];
  /** La evaluacion de D01 que sostiene esta lectura (guardrails 29 y 30). */
  dataQuality?: DataQualityAssessment[];
};

// --- Paradoja de Simpson ----------------------------------------------------

/**
 * Guardrail 8. El agregado se mueve en una direccion y **todos** los segmentos
 * en la contraria: lo unico que cambio fue el peso de cada segmento.
 *
 * Es la unica forma en que este bloque puede decir algo definitivo sobre
 * causalidad, y lo dice en negativo: "esto no es un cambio de rendimiento".
 * Devuelve null cuando no hay datos suficientes para afirmarlo -- que no se
 * detecte la paradoja no significa que no la haya.
 */
export function detectSimpsonReversal(
  mix: MixSegment[],
): { aggregateDelta: number; segmentDirection: "up" | "down" } | null {
  const conRendimiento = mix.filter(
    (s) => s.performance_before != null && s.performance_after != null,
  );
  if (conRendimiento.length < 2) return null;

  const antes = conRendimiento.reduce(
    (acc, s) => acc + s.weight_before * (s.performance_before as number),
    0,
  );
  const despues = conRendimiento.reduce(
    (acc, s) => acc + s.weight_after * (s.performance_after as number),
    0,
  );
  const aggregateDelta = despues - antes;
  if (aggregateDelta === 0) return null;

  const deltas = conRendimiento.map(
    (s) => (s.performance_after as number) - (s.performance_before as number),
  );
  const todosSuben = deltas.every((d) => d > 0);
  const todosBajan = deltas.every((d) => d < 0);

  if (todosSuben && aggregateDelta < 0) return { aggregateDelta, segmentDirection: "up" };
  if (todosBajan && aggregateDelta > 0) return { aggregateDelta, segmentDirection: "down" };
  return null;
}

// --- Invariantes ------------------------------------------------------------

/**
 * Comprueba que una lectura contextual no afirma mas de lo que su contexto
 * sostiene. Devuelve las violaciones, no lanza: mismo contrato que
 * `checkDiagnosticInvariants` y `checkDataQualityGate`.
 *
 * Lo que NO esta aqui, y por que:
 *
 * - Guardrails 1, 2, 5, 10 a 14 (no leer una metrica aislada, no usar
 *   benchmarks genericos como verdad, no penalizar una decision estrategica
 *   deliberada) dependen de conocer el objetivo del negocio y de juzgar si una
 *   desviacion es intencionada. Eso es criterio, y el RAG es el sitio donde
 *   vive. Fingir que una funcion lo comprueba seria peor que decir que no.
 * - Guardrail 9 (no ocultar scopes locales tras promedios globales) es real y
 *   mecanizable, pero exigiria un umbral de materialidad que el artefacto no
 *   da y que seria inventado. `paradoja_de_simpson` cubre su caso peor.
 * - Guardrails 33 a 35 (disponibilidad antes que demanda) necesitan stock real
 *   por periodo, que hoy no llega hasta aqui. Vuelven con D05.
 */
export function checkContextInvariants(
  input: ContextCheckInput,
): DiagnosticInvariantViolation[] {
  const { assessment } = input;
  const mix = input.mix ?? [];
  const changeEvents = input.changeEvents ?? [];
  const confounders = input.confounders ?? [];
  const breaks = input.breaks ?? [];
  const contradictions = input.contradictions ?? [];
  const dataQuality = input.dataQuality ?? [];

  const v: DiagnosticInvariantViolation[] = [];
  const push = (rule: string, source: string, message: string) =>
    v.push({ rule, source, message });

  const comparableLimpia = assessment.comparability === "comparable";
  const dicePerformance = assessment.aggregate_interpretation === "performance_change";

  // Guardrail 6 -- no atribuir un cambio agregado a rendimiento interno sin
  // haber comprobado el mix. Sin descomposicion no hay nada que lo respalde.
  if (dicePerformance && mix.length === 0) {
    push(
      "mix_comprobado",
      "D02 guardrails 6 y 7",
      "se afirma un cambio de rendimiento sin descomponer el mix: el agregado pudo moverse solo porque cambiaron los pesos",
    );
  }

  // Guardrail 8 -- Simpson. Si todos los segmentos van en una direccion y el
  // agregado en la contraria, lo que cambio fue la composicion.
  const simpson = detectSimpsonReversal(mix);
  if (simpson && dicePerformance) {
    push(
      "paradoja_de_simpson",
      "D02 guardrail 8",
      `todos los segmentos ${simpson.segmentDirection === "up" ? "mejoran" : "empeoran"} y el agregado va al reves (${simpson.aggregateDelta.toFixed(4)}): es un cambio de composicion, no de rendimiento`,
    );
  }

  // Guardrails 22 y 23 -- cuantos mas cambios simultaneos, menor confianza
  // causal. Con confusores materiales sin resolver, la comparacion no es limpia.
  const confusoresMateriales = confounders.filter(
    (c) => c.material && c.knowledge_state !== "unknown",
  );
  if (comparableLimpia && confusoresMateriales.length >= 2) {
    push(
      "confounders_reducen_comparabilidad",
      "D02 guardrails 22 y 23",
      `${confusoresMateriales.length} confusores materiales coexisten con la senal y la comparabilidad sigue declarada como limpia`,
    );
  }

  // Guardrails 18 y 19 -- una ruptura entre el baseline y el periodo analizado
  // invalida la comparacion, venga del negocio o de la medicion.
  const rupturasRelevantes = breaks.filter((b) => b.invalidates_history_before);
  if (comparableLimpia && rupturasRelevantes.length > 0) {
    push(
      "baseline_tras_ruptura",
      "D02 guardrails 18 y 19",
      `hay ${rupturasRelevantes.length} ruptura(s) de comparabilidad (${rupturasRelevantes
        .map((b) => b.break_type)
        .join(", ")}) y el baseline se declara limpio`,
    );
  }

  // Guardrails 15 y 16 -- un lift promocional no es mejora estructural, y la
  // caida posterior no es demanda destruida. Si hay una promocion en juego y no
  // aparece entre los factores, la lectura esta incompleta.
  const promocionales = changeEvents.filter(
    (e) =>
      (PROMOTIONAL_EVENT_TYPES as readonly string[]).includes(e.event_type) &&
      e.considered_as !== "ruled_out",
  );
  if (promocionales.length > 0 && assessment.primary_factors.length === 0) {
    push(
      "promocion_no_es_estructural",
      "D02 guardrails 15 y 16",
      "hay actividad promocional en el periodo y la lectura no la recoge como factor: el lift y la caida posterior no son estructurales",
    );
  }

  // Guardrail 28 -- una contradiccion entre contexto declarado y observado no
  // se resuelve en silencio. O aparece en la salida, o se esta eligiendo una
  // version sin decirlo.
  const contradiccionesMateriales = contradictions.filter((c) => c.material);
  if (
    contradiccionesMateriales.length > 0 &&
    assessment.declared_contradictions.length === 0
  ) {
    push(
      "contradiccion_no_silenciada",
      "D02 guardrail 28",
      `${contradiccionesMateriales.length} contradiccion(es) entre contexto declarado y observado (${contradiccionesMateriales
        .map((c) => c.dimension)
        .join(", ")}) no aparecen en la salida`,
    );
  }

  // Guardrails 29 y 30 -- D2 hereda la incertidumbre de D1. Una fuente que D1
  // degrado no puede sostener sola una interpretacion contextual fuerte.
  const fuentesDegradadas = dataQuality.filter(
    (a) => a.role === "primary" && ["low", "unusable"].includes(a.reliability),
  );
  if (comparableLimpia && fuentesDegradadas.length > 0) {
    push(
      "hereda_incertidumbre_de_d1",
      "D02 guardrails 29 y 30",
      "la comparabilidad se declara limpia sobre fuentes que D01 degrado: la incertidumbre de D1 no se puede perder por el camino",
    );
  }

  return v;
}

// ---------------------------------------------------------------------------
// EL MOTOR — contextualizar una senal (runtime `d02-flujo-contextualizacion`)
// ---------------------------------------------------------------------------
//
// Puro, como el de D01 y el de D05: entran la senal, las series por segmento y
// lo que D01 dijo del dato, y sale una lectura contextual. La parte sucia vive
// en `apps/api/src/context-engine.ts`.
//
// QUE PASOS DEL RUNTIME CUBRE, de los 16:
//
//   paso 2  scope del fenomeno
//   paso 3  seleccion de baseline
//   paso 4  comparabilidad temporal (weekday mix, longitud, rupturas)
//   paso 6  analisis de mix -- el corazon del bloque
//   paso 12 discontinuidades de medicion, heredadas de D01
//   paso 15 completitud contextual
//   paso 16 emitir la salida
//
// Y las ramas A y D enteras: "CVR agregado cae" y "AOV baja" son las dos que se
// resuelven separando rendimiento de composicion.
//
// QUE NO CUBRE: los pasos 5, 7, 8, 10, 11 y 14 (contexto de negocio,
// trade-offs economicos, promociones, contexto externo, capacidad, experiencia
// historica) son criterio, no calculo -- el guardrail lo dice y el RAG es su
// sitio. Los pasos 9 y 13 (cambios internos, declarado contra observado)
// necesitan que alguien escriba en `context_change_events` y
// `tenant_context_facts`, que hoy estan vacias: el motor las lee si hay algo,
// y no inventa lo que no hay.

/** Milisegundos de un dia. */
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Cuando un efecto se lleva esta parte del movimiento total, se le llama por su
 * nombre; si no, la lectura es `mixed`.
 *
 * **El numero es nuestro, no del artefacto.** El documento dice que hay que
 * separar cambio dentro de segmentos de cambio en composicion, y no da umbral.
 * 0.75 es una eleccion conservadora: por debajo de eso, decir "esto fue el
 * mix" seria una simplificacion, y `mixed` es una respuesta honesta que aguas
 * abajo se puede seguir investigando. Queda a la vista para poder calibrarlo.
 */
export const DOMINANCIA_MINIMA = 0.75;

export type Ventana = { start: string; end: string };

/**
 * Paso 3 — el baseline por defecto: el periodo inmediatamente anterior, de la
 * misma longitud.
 *
 * No es el mejor baseline posible y no pretende serlo: el orden de preferencia
 * del artefacto empieza por "historico propio comparable", y sin saber que
 * periodos del pasado son comparables, el anterior de igual longitud es el
 * unico que se puede defender por escrito. Por eso sale con su `rationale`,
 * que es lo que el guardrail 3 exige, y por eso el paso 4 lo somete a examen
 * justo despues en vez de darlo por bueno.
 */
export function selectBaseline(analysis: Ventana): {
  baseline_type: string;
  baseline_period_start: string;
  baseline_period_end: string;
  baseline_rationale: string;
} {
  const inicio = Date.parse(analysis.start);
  const fin = Date.parse(analysis.end);
  const duracion = fin - inicio;

  return {
    baseline_type: "previous_period",
    baseline_period_start: new Date(inicio - duracion).toISOString(),
    baseline_period_end: analysis.start,
    baseline_rationale:
      "Periodo inmediatamente anterior de la misma duracion. Es el unico baseline que el motor puede justificar sin saber que periodos historicos son comparables; su comparabilidad se examina aparte.",
  };
}

/** Cuantos dias de cada dia de la semana caen dentro de la ventana. */
function mezclaSemanal(v: Ventana): number[] {
  const conteo = [0, 0, 0, 0, 0, 0, 0];
  const fin = Date.parse(v.end);
  for (let t = Date.parse(v.start); t < fin; t += DIA_MS) {
    const dia = new Date(t).getUTCDay();
    conteo[dia] = (conteo[dia] ?? 0) + 1;
  }
  return conteo;
}

/**
 * Paso 4 — comparabilidad temporal.
 *
 * De la lista del artefacto (weekday mix, trading days, estacionalidad,
 * festivos, pagas, promociones, lanzamientos, stock, expansion, atribucion,
 * estado de medicion) esto comprueba **las dos primeras y las dos ultimas**,
 * que son las unicas que se pueden calcular sin un calendario comercial ni un
 * historial de promociones. Las demas entran cuando alguien las declare, y
 * hasta entonces se dicen como contexto que falta, no como si estuvieran bien.
 *
 * Comparar siete dias contra seis, o una semana con dos sabados contra una con
 * uno, produce diferencias que no son del negocio. Es el fallo mas barato de
 * detectar y el que mas veces se cuela.
 */
export function checkTemporalComparability(input: {
  analysis: Ventana;
  baseline: Ventana;
  /** Rupturas conocidas que caen dentro del baseline o entre medias. */
  breaks?: { effective_from: string; description: string }[];
  /** Lo que D01 dijo del dato que sostiene esta lectura. */
  dataQuality?: { reliability: string; period_settlement: string; source: string }[];
}): { comparability: ContextComparability; reasons: string[] } {
  const razones: string[] = [];

  const diasAnalisis = Math.round(
    (Date.parse(input.analysis.end) - Date.parse(input.analysis.start)) / DIA_MS,
  );
  const diasBaseline = Math.round(
    (Date.parse(input.baseline.end) - Date.parse(input.baseline.start)) / DIA_MS,
  );

  if (diasAnalisis !== diasBaseline) {
    razones.push(
      `el periodo analizado tiene ${diasAnalisis} dias y su baseline ${diasBaseline}`,
    );
  }

  const mezclaA = mezclaSemanal(input.analysis);
  const mezclaB = mezclaSemanal(input.baseline);
  if (mezclaA.some((n, i) => n !== mezclaB[i])) {
    razones.push(
      "los dos periodos no tienen los mismos dias de la semana, asi que parte de la diferencia no es del negocio",
    );
  }

  // Una ruptura dentro del baseline lo invalida entero: el "antes" que se usa
  // para comparar pertenece a otro regimen o a otra forma de medir.
  const inicioBaseline = Date.parse(input.baseline.start);
  const finAnalisis = Date.parse(input.analysis.end);
  const rupturas = (input.breaks ?? []).filter((b) => {
    const t = Date.parse(b.effective_from);
    return t >= inicioBaseline && t <= finAnalisis;
  });
  for (const ruptura of rupturas) {
    razones.push(`hay una ruptura de comparabilidad en medio: ${ruptura.description}`);
  }

  // Paso 1 del runtime: "si D1 degrada una fuente, D2 debe conservar esa
  // incertidumbre". No se puede declarar limpia una comparacion construida
  // sobre un dato que D01 marco como degradado.
  for (const dq of input.dataQuality ?? []) {
    if (["low", "unusable"].includes(dq.reliability)) {
      razones.push(`D01 marco ${dq.source} como fiabilidad ${dq.reliability}`);
    }
    if (["open", "partially_settled"].includes(dq.period_settlement)) {
      razones.push(`el periodo de ${dq.source} todavia puede recibir datos tardios`);
    }
  }

  const insalvable =
    rupturas.length > 0 ||
    (input.dataQuality ?? []).some((d) => d.reliability === "unusable");

  if (insalvable) return { comparability: "not_comparable", reasons: razones };
  if (razones.length > 0) return { comparability: "limited", reasons: razones };
  return { comparability: "comparable", reasons: [] };
}

/** Una observacion agregada de un segmento en un periodo. */
export type SegmentObservation = {
  dimension: string;
  segment: string;
  /** Lo que pesa el segmento: pedidos, sesiones, clientes... */
  volume: number;
  /** La metrica dentro del segmento: AOV, CVR... `null` si no aplica. */
  performance?: number | null;
};

/**
 * Paso 6 — convertir dos fotos en pesos y rendimientos comparables.
 *
 * Los pesos se normalizan sobre el total de **su propio** periodo, que es lo
 * que permite que la resta signifique algo: un segmento puede crecer en
 * volumen absoluto y aun asi perder peso si el resto crece mas, y es
 * justamente ese caso el que se confunde con un deterioro.
 */
export function buildMixSegments(
  before: SegmentObservation[],
  after: SegmentObservation[],
): MixSegment[] {
  // Los totales son POR DIMENSION. Con canal y tipo de cliente en la misma
  // lista, un total global contaria cada pedido dos veces y los pesos sumarian
  // dos: la descomposicion seguiria cuadrando y no querria decir nada.
  const totalPorDimension = (xs: SegmentObservation[]) => {
    const totales = new Map<string, number>();
    for (const s of xs) totales.set(s.dimension, (totales.get(s.dimension) ?? 0) + s.volume);
    return totales;
  };
  const totalesAntes = totalPorDimension(before);
  const totalesDespues = totalPorDimension(after);

  const claves = new Set([
    ...before.map((s) => `${s.dimension}|${s.segment}`),
    ...after.map((s) => `${s.dimension}|${s.segment}`),
  ]);

  const segmentos: MixSegment[] = [];
  for (const clave of claves) {
    const [dimension, segment] = clave.split("|") as [string, string];
    const a = before.find((s) => s.dimension === dimension && s.segment === segment);
    const d = after.find((s) => s.dimension === dimension && s.segment === segment);

    // Un rendimiento a medias no compara nada (misma regla que la check
    // constraint): si falta en un lado, van los dos a null y queda el peso,
    // que es lo unico que ahi se puede afirmar.
    const hayRendimiento = a?.performance != null && d?.performance != null;

    const totalAntes = totalesAntes.get(dimension) ?? 0;
    const totalDespues = totalesDespues.get(dimension) ?? 0;
    // Una dimension sin volumen en alguno de los dos periodos no compara nada.
    if (totalAntes === 0 || totalDespues === 0) continue;

    segmentos.push({
      dimension,
      segment,
      weight_before: (a?.volume ?? 0) / totalAntes,
      weight_after: (d?.volume ?? 0) / totalDespues,
      performance_before: hayRendimiento ? (a?.performance as number) : null,
      performance_after: hayRendimiento ? (d?.performance as number) : null,
    });
  }

  return segmentos.sort((x, y) => y.weight_after - x.weight_after);
}

/**
 * Paso 6, la pregunta central del bloque: ¿cambio el rendimiento o cambio la
 * composicion?
 *
 * Descomposicion clasica de shift-share sobre el agregado ponderado:
 *
 *   dentro = Σ peso_antes × (rendimiento_despues − rendimiento_antes)
 *   mix    = Σ (peso_despues − peso_antes) × rendimiento_despues
 *
 * La suma de las dos es exactamente el movimiento del agregado, asi que
 * repartir el merito entre ellas no es una heuristica: es aritmetica. Lo unico
 * elegido es el umbral a partir del cual una domina (`DOMINANCIA_MINIMA`).
 *
 * Devuelve `undetermined` cuando no hay con que responder -- que es una
 * respuesta, no un fallo. El guardrail 6 prohibe afirmarlo sin descomponer.
 */
export function classifyAggregate(mix: MixSegment[]): {
  interpretation: AggregateInterpretation;
  within_effect: number;
  mix_effect: number;
} {
  const conRendimiento = mix.filter(
    (s) => s.performance_before != null && s.performance_after != null,
  );
  if (conRendimiento.length < 2) {
    return { interpretation: "undetermined", within_effect: 0, mix_effect: 0 };
  }

  let dentro = 0;
  let composicion = 0;
  for (const s of conRendimiento) {
    const antes = s.performance_before as number;
    const despues = s.performance_after as number;
    dentro += s.weight_before * (despues - antes);
    composicion += (s.weight_after - s.weight_before) * despues;
  }

  // La paradoja de Simpson es la unica forma en que este bloque puede afirmar
  // algo en negativo con certeza: si todos los segmentos van en una direccion
  // y el agregado en la otra, lo unico que cambio fue el peso.
  if (detectSimpsonReversal(mix)) {
    return { interpretation: "mix_shift", within_effect: dentro, mix_effect: composicion };
  }

  const total = Math.abs(dentro) + Math.abs(composicion);
  if (total === 0) {
    return { interpretation: "undetermined", within_effect: 0, mix_effect: 0 };
  }

  if (Math.abs(dentro) / total >= DOMINANCIA_MINIMA) {
    return { interpretation: "performance_change", within_effect: dentro, mix_effect: composicion };
  }
  if (Math.abs(composicion) / total >= DOMINANCIA_MINIMA) {
    return { interpretation: "mix_shift", within_effect: dentro, mix_effect: composicion };
  }
  return { interpretation: "mixed", within_effect: dentro, mix_effect: composicion };
}

/** Lo que el motor necesita saber para contextualizar una senal. */
export type ContextEngineInput = {
  /** La senal que se intenta interpretar (paso 1). */
  metric: string;
  scope: string;
  analysis: Ventana;
  /** Observaciones por segmento en el periodo analizado y en el baseline. */
  segmentsBefore?: SegmentObservation[];
  segmentsAfter?: SegmentObservation[];
  breaks?: { effective_from: string; description: string }[];
  dataQuality?: { reliability: string; period_settlement: string; source: string }[];
  /** Cambios internos declarados, si alguien los ha escrito (paso 9). */
  declaredChanges?: { occurred_at: string; description: string }[];
  /** Declarado contra observado, ya comparado (paso 13). */
  contradictions?: ContextContradiction[];
  /** Dimensiones que el motor sabe que existen pero hoy no puede mirar. */
  blindDimensions?: string[];
};

export type ContextEngineOutput = {
  assessment: ContextAssessment;
  mix: MixSegment[];
  within_effect: number;
  mix_effect: number;
};

/**
 * Pasos 2, 3, 4, 6, 12, 15 y 16 juntos: la lectura contextual de una senal.
 *
 * Fijate en lo que no devuelve: ninguna causa. D02 acota hipotesis y no las
 * cierra, y aqui la garantia es la misma que en la tabla -- no existe el campo.
 */
export function assessContext(input: ContextEngineInput): ContextEngineOutput {
  const baseline = selectBaseline(input.analysis);
  const comparabilidad = checkTemporalComparability({
    analysis: input.analysis,
    baseline: { start: baseline.baseline_period_start, end: baseline.baseline_period_end },
    ...(input.breaks ? { breaks: input.breaks } : {}),
    ...(input.dataQuality ? { dataQuality: input.dataQuality } : {}),
  });

  const mix = buildMixSegments(input.segmentsBefore ?? [], input.segmentsAfter ?? []);

  // Cada dimension se clasifica por separado y luego se combinan: el canal
  // puede decir una cosa y el tipo de cliente otra, y las dos pueden ser
  // ciertas. Mezclarlas en un solo calculo las anularia entre si.
  const dimensiones = [...new Set(mix.map((m) => m.dimension))];
  const porDimension = dimensiones.map((d) =>
    classifyAggregate(mix.filter((m) => m.dimension === d)),
  );
  const clasificacion = {
    interpretation: combineInterpretations(porDimension.map((x) => x.interpretation)),
    within_effect: porDimension.reduce((acc, x) => acc + x.within_effect, 0),
    mix_effect: porDimension.reduce((acc, x) => acc + x.mix_effect, 0),
  };

  // Paso 15 -- lo que falta se dice, no se rellena con supuestos.
  const falta: string[] = [];
  if (mix.length === 0) {
    falta.push("no hay descomposicion por segmentos para este fenomeno");
  }
  for (const dimension of input.blindDimensions ?? []) {
    falta.push(`no se puede mirar el mix por ${dimension}`);
  }
  if ((input.declaredChanges ?? []).length === 0) {
    falta.push("no hay cambios internos declarados para este periodo");
  }

  // Una incognita critica es la que impide responder la pregunta del bloque.
  const incognitas =
    clasificacion.interpretation === "undetermined"
      ? ["no se puede distinguir cambio de rendimiento de cambio de composicion"]
      : [];

  // Paso 13 -- la contradiccion no se resuelve eligiendo un lado (guardrail
  // 28): se nombra, y como es contexto que no se sabe cual es el bueno, resta
  // suficiencia.
  const contradicciones = (input.contradictions ?? []).map(
    (c) =>
      `${c.dimension}: el cliente declara "${c.declared_value}" y el dato muestra "${c.observed_value}"`,
  );
  if (contradicciones.length > 0) {
    falta.push("el contexto declarado contradice al observado y no se sabe cual rige");
  }

  const factores: string[] = [];
  for (const cambio of input.declaredChanges ?? []) {
    factores.push(`${cambio.description} (${cambio.occurred_at.slice(0, 10)})`);
  }
  if (clasificacion.interpretation === "mix_shift") {
    factores.push("el movimiento del agregado se explica sobre todo por el cambio de composicion");
  }
  if (clasificacion.interpretation === "performance_change") {
    factores.push("el movimiento ocurre dentro de los segmentos, no en sus pesos");
  }

  // No se puede llamar limpia a una comparacion que no sabe si esta mirando un
  // cambio de rendimiento o uno de composicion. Las ventanas encajaran, pero el
  // resultado no se puede leer -- y el contrato lo prohibe expresamente, que es
  // como salio esto a la luz.
  const razones = [...comparabilidad.reasons];
  let comparability = comparabilidad.comparability;
  if (incognitas.length > 0 && comparability === "comparable") {
    comparability = "limited";
    razones.push(...incognitas);
  }

  const assessment = contextAssessmentSchema.parse({
    assessment_id: `${input.metric}:${input.scope}:${input.analysis.start.slice(0, 10)}`,
    scope: input.scope,
    ...baseline,
    comparability,
    comparability_reasons: razones,
    aggregate_interpretation: clasificacion.interpretation,
    context_depth: mix.length > 0 ? "standard" : "shallow",
    context_sufficient: falta.length === 0,
    missing_context: falta,
    critical_unknowns: incognitas,
    primary_factors: factores,
    declared_contradictions: contradicciones,
    uncertainty_notes: razones.length > 0 ? razones.join("; ") : null,
  });

  return {
    assessment,
    mix,
    within_effect: clasificacion.within_effect,
    mix_effect: clasificacion.mix_effect,
  };
}

/**
 * Varias dimensiones, una sola lectura.
 *
 * El mix se descompone por canal y por tipo de cliente, y cada dimension puede
 * contar una historia distinta: el canal puede decir "cambio la composicion" y
 * el tipo de cliente "cambio el rendimiento". Las dos pueden ser ciertas.
 *
 * Cuando discrepan la respuesta es `mixed`, no la primera ni la mas llamativa.
 * Elegir una seria exactamente lo que el guardrail 6 prohibe: afirmar una
 * lectura del agregado que la descomposicion no sostiene entera.
 */
export function combineInterpretations(
  lecturas: AggregateInterpretation[],
): AggregateInterpretation {
  const decididas = new Set(lecturas.filter((x) => x !== "undetermined"));
  if (decididas.size === 0) return "undetermined";
  if (decididas.size === 1) return [...decididas][0] as AggregateInterpretation;
  return "mixed";
}

/**
 * Paso 13: declarado contra observado, dimension a dimension.
 *
 * Solo se comparan los hechos vigentes, y solo cuando existen los dos lados:
 * sin observacion no hay contradiccion, hay contexto sin contrastar. La
 * comparacion ignora mayusculas y espacios; cualquier otra diferencia se
 * conserva como contradiccion (guardrail 28), sin decidir quien tiene razon.
 */
export function findContextContradictions(
  facts: { dimension: string; value: string; source: string; effective_to?: string | null }[],
): ContextContradiction[] {
  const vigentes = facts.filter((f) => !f.effective_to);
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const contradicciones: ContextContradiction[] = [];
  for (const dimension of [...new Set(vigentes.map((f) => f.dimension))].sort()) {
    const declarado = vigentes.find((f) => f.dimension === dimension && f.source === "declared");
    const observado = vigentes.find((f) => f.dimension === dimension && f.source === "observed");
    if (!declarado || !observado || norm(declarado.value) === norm(observado.value)) continue;
    contradicciones.push(
      contextContradictionSchema.parse({
        dimension,
        declared_value: declarado.value,
        observed_value: observado.value,
        material: true,
      }),
    );
  }
  return contradicciones;
}

/**
 * El canal principal observado: el segmento de canal con mas pedidos. Es la
 * unica dimension del contexto declarado que el dato de pedidos sostiene hoy.
 * Sin pedidos, o con dos canales empatados, no se afirma ninguno.
 */
export function observedMainChannel(segments: SegmentObservation[]): string | null {
  const canales = segments
    .filter((s) => s.dimension === "channel" && s.volume > 0)
    .sort((a, b) => b.volume - a.volume);
  if (canales.length === 0) return null;
  if (canales.length > 1 && canales[0]!.volume === canales[1]!.volume) return null;
  return canales[0]!.segment;
}
