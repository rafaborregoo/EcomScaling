/**
 * FASE 3 / D05 — Motor de senales y anomalias.
 *
 * Fuentes: conocimiento/fase-03/02-contratos-IA/d05-requisitos-contrato-senales.md
 *          conocimiento/fase-03/04-policies-guardrails/d05-guardrails-senales.md
 *          conocimiento/fase-03/03-runtime/d05-flujo-motor-senales.md
 *
 * El primer bloque que mira cifras reales y dice "esto ha cambiado". Su frontera
 * la fija el propio artefacto con un ejemplo que no admite interpretacion:
 * **D5 puede decir "el CTR se esta deteriorando"; no puede decir "fatiga
 * creativa confirmada"** (guardrails 49 y 50). Por eso el tipo de salida no
 * tiene `symptom`, `cause`, `action` ni `recommendation`, y hay un test que
 * falla si aparecen.
 *
 * Este fichero tiene dos mitades:
 *
 *   1. el **contrato** -- catalogos, esquemas e invariantes, como en D00..D04;
 *   2. el **detector** -- `detectSignals`, que es runtime de verdad pero puro:
 *      entra una serie de numeros y sale una lista de senales candidatas, sin
 *      base de datos ni reloj. Asi el motor se puede probar sin montar nada.
 *
 * Catalogos identicos a las check constraints de
 * `20260916090000_f3_d05_motor_de_senales.sql`.
 */
import { z } from "zod";

import { type DiagnosticInvariantViolation } from "./diagnostics.js";
import { CAPABILITIES } from "./maturity.js";
import { BUSINESS_EXPOSURES } from "./health.js";

// --- Catalogos --------------------------------------------------------------

/** Contrato apartado 2. La fuente avisa de que no es un enum cerrado final. */
export const SIGNAL_TYPES = [
  "level",
  "trend",
  "change",
  "rate",
  "volatility",
  "concentration",
  "mix",
  "ratio",
  "capacity",
  "dependency",
  "regression",
  "positive",
  "risk",
] as const;

/** Contrato apartado 3. Nullable en la senal: el guardrail 3 dice que no son lo mismo. */
export const ANOMALY_TYPES = [
  "point",
  "contextual",
  "collective",
  "sequence",
  "periodic",
  "localized",
] as const;

/** Contrato apartado 4. */
export const PERSISTENCE_STATES = ["transient", "emerging", "persistent", "chronic"] as const;

/** Contrato apartado 6. */
export const REGIMES = ["normal_regime", "anomaly", "new_regime", "regime_shift"] as const;

/** Contrato apartado 9, guardrail 20: acercarse cuenta, no solo traspasar. */
export const GUARDRAIL_STATUSES = ["within", "approaching", "breached", "crossed"] as const;

/** Contrato apartado 24. */
export const NOVELTY_STATES = ["first_ever", "rare", "common", "recurring"] as const;

export const SUPPRESSION_STATES = ["none", "reduce_attention", "suppress"] as const;

/** Guardrail 35: el enlace con un evento es temporal, nunca causal. */
export const EVENT_LINK_STATUSES = [
  "within_window",
  "outside_window",
  "lagged",
  "unclear",
] as const;

export const SEGMENT_ELIGIBILITY = [
  "meets_minimum",
  "critical_segment",
  "high_value",
  "below_minimum",
] as const;

export const RELEVANCE_LEVELS = ["low", "medium", "high", "critical"] as const;

/** Exposiciones que el guardrail 8 considera materiales para subir la relevancia. */
const MATERIAL_EXPOSURES: readonly string[] = ["moderate", "high", "existential"];

export type SignalType = (typeof SIGNAL_TYPES)[number];
export type Persistence = (typeof PERSISTENCE_STATES)[number];
export type Regime = (typeof REGIMES)[number];
export type RelevanceLevel = (typeof RELEVANCE_LEVELS)[number];

// --- Esquemas ---------------------------------------------------------------

export const engineSignalEvidenceSchema = z
  .object({
    source: z.string().min(1),
    metric: z.string().min(1),
    observation: z.string().min(1),
    value: z.number().nullable().optional(),
    /** Guardrail 26: solo sube la confianza si es de verdad independiente. */
    independent: z.boolean().default(false),
    independence_rationale: z.string().nullable().optional(),
  })
  .refine((e) => !e.independent || e.independence_rationale != null, {
    message: "declarar independencia exige justificarla",
  });

export const engineSignalFields = z.object({
  signal_id: z.string().min(1),
  signal_type: z.enum(SIGNAL_TYPES),
  anomaly_type: z.enum(ANOMALY_TYPES).nullable().optional(),

  capability: z.enum(CAPABILITIES).nullable().optional(),
  metric: z.string().min(1),
  scope: z.string().default("global"),

  direction: z.enum(["up", "down", "flat", "diverging", "unstable"]),
  observed_value: z.number().nullable().optional(),
  baseline_value: z.number().nullable().optional(),
  magnitude_relative: z.number().nullable().optional(),
  expected_low: z.number().nullable().optional(),
  expected_high: z.number().nullable().optional(),

  persistence: z.enum(PERSISTENCE_STATES).default("transient"),
  regime: z.enum(REGIMES).default("normal_regime"),
  baseline_kind: z.string().nullable().optional(),
  baseline_conflict: z.boolean().default(false),

  guardrail_status: z.enum(GUARDRAIL_STATUSES).nullable().optional(),

  sample_size: z.number().nullable().optional(),
  low_sample: z.boolean().default(false),
  statistical_method: z.string().nullable().optional(),
  statistical_strength: z.enum(["none", "weak", "moderate", "strong"]).nullable().optional(),

  business_relevance: z.enum(RELEVANCE_LEVELS).default("low"),
  business_exposure: z.enum(BUSINESS_EXPOSURES).nullable().optional(),
  impact_estimate: z.enum(RELEVANCE_LEVELS).nullable().optional(),

  data_confidence: z.enum(["high", "medium", "low", "insufficient_data"]).default("low"),
  context_confidence: z.enum(["high", "medium", "low", "insufficient_data"]).default("low"),
  signal_confidence: z.enum(["high", "medium", "low", "insufficient_data"]).default("low"),

  is_composite: z.boolean().default(false),
  composite_inputs: z
    .array(z.object({ metric: z.string().min(1), contribution: z.number() }))
    .default([]),
  composite_explanation: z.string().nullable().optional(),

  novelty: z.enum(NOVELTY_STATES).nullable().optional(),
  matched_pattern: z.string().nullable().optional(),
  suppression: z.enum(SUPPRESSION_STATES).default("none"),

  linked_event: z.string().nullable().optional(),
  event_link_status: z.enum(EVENT_LINK_STATUSES).nullable().optional(),

  is_leading_indicator: z.boolean().default(false),
  downstream_metric: z.string().nullable().optional(),

  segment_eligibility: z.enum(SEGMENT_ELIGIBILITY).nullable().optional(),

  /** Descriptivo, nunca interpretativo (guardrails 49 y 50). */
  description: z.string().min(1),
  evidence: z.array(engineSignalEvidenceSchema).default([]),
});

export const engineSignalSchema = engineSignalFields
  // Guardrails 8 y 57: un +200% en una campana minuscula no es relevante.
  .refine(
    (s) =>
      !["high", "critical"].includes(s.business_relevance) ||
      (s.business_exposure != null && MATERIAL_EXPOSURES.includes(s.business_exposure)),
    { message: "la relevancia alta exige exposicion material" },
  )
  // Guardrails 21 y 22.
  .refine((s) => !s.low_sample || s.business_relevance !== "critical", {
    message: "una muestra baja no sostiene una senal critica",
  })
  // Guardrails 40, 41 y 42.
  .refine(
    (s) => !s.is_composite || (s.composite_inputs.length > 0 && s.composite_explanation != null),
    { message: "un composite sin inputs es un score opaco" },
  )
  // Guardrails 14 y 44.
  .refine(
    (s) =>
      !["new_regime", "regime_shift"].includes(s.regime) ||
      ["persistent", "chronic"].includes(s.persistence),
    { message: "un periodo aislado no es un cambio de regimen" },
  )
  .refine((s) => s.suppression === "none" || s.matched_pattern != null, {
    message: "reducir atencion sin patron identificado es silenciar a ciegas",
  })
  // Guardrail 35.
  .refine((s) => s.linked_event == null || s.event_link_status != null, {
    message: "enlazar con un evento exige decir en que relacion temporal",
  })
  .refine((s) => !s.is_leading_indicator || s.downstream_metric != null, {
    message: "un indicador adelantado tiene que decir que adelanta",
  })
  // Guardrail 28: D01 manda sobre D05.
  .refine(
    (s) => s.data_confidence !== "insufficient_data" || s.business_relevance === "low",
    { message: "sin dato que lo sostenga no hay senal de negocio relevante" },
  );

export type EngineSignalEvidence = z.infer<typeof engineSignalEvidenceSchema>;
export type EngineSignal = z.infer<typeof engineSignalSchema>;

// --- Invariantes que necesitan ver mas de una senal -------------------------

export type SignalCheckInput = {
  signals: EngineSignal[];
  /** Metricas que comparten inputs: (metric, depends_on). Apartado 16. */
  metricDependencies?: { metric: string; depends_on: string }[];
  /** Agrupaciones ya formadas: id de cluster -> ids de senal. */
  clusters?: { cluster_id: string; signal_ids: string[] }[];
};

/**
 * Comprueba lo que una sola senal no puede saber de si misma.
 *
 * Lo que NO esta aqui, y por que:
 *
 * - **Los umbrales estadisticos** (guardrails 17 a 24). El apartado 29 dice que
 *   no estan definidos: ni formula de confianza, ni thresholds, ni pesos, ni
 *   seleccion de algoritmo. `detectSignals` usa un metodo robusto con un
 *   parametro explicito y un default documentado **como default tecnico**, que
 *   es justo lo que pide el guardrail 19; no como verdad de negocio.
 * - **La deduplicacion y el clustering** (guardrails 29 a 31) necesitan ventanas
 *   de correlacion que el tenant configura (tenant apartado 5) y que hoy nadie
 *   ha declarado. Lo que si se comprueba es el resultado: que dos senales
 *   dependientes no se cuenten como corroboracion.
 * - **Los pasos 15 a 18 del runtime** (drilldown, scan bottom-up, interacciones
 *   multidimensionales, descomposicion por el grafo de metricas) necesitan
 *   datos segmentados que hoy no llegan hasta aqui.
 */
export function checkSignalInvariants(
  input: SignalCheckInput,
): DiagnosticInvariantViolation[] {
  const { signals } = input;
  const dependencias = input.metricDependencies ?? [];
  const clusters = input.clusters ?? [];

  const v: DiagnosticInvariantViolation[] = [];
  const push = (rule: string, source: string, message: string) =>
    v.push({ rule, source, message });

  const dependiente = (a: string, b: string) =>
    dependencias.some(
      (d) =>
        (d.metric === a && d.depends_on === b) || (d.metric === b && d.depends_on === a),
    );

  for (const s of signals) {
    // Guardrails 9 y 25 -- dos metricas que comparten inputs no son dos
    // evidencias independientes. Revenue por sesion y CVR se mueven juntas
    // porque una esta dentro de la otra.
    const falsaIndependencia = s.evidence.filter(
      (e) => e.independent && dependiente(e.metric, s.metric),
    );
    if (falsaIndependencia.length > 0) {
      push(
        "corroboracion_no_independiente",
        "D05 guardrails 9, 25 y 26",
        `"${s.metric}" se corrobora con ${falsaIndependencia
          .map((e) => e.metric)
          .join(", ")}, que comparte inputs con ella: es el mismo hecho contado dos veces`,
      );
    }

    // Guardrail 26 -- la confianza alta solo se gana con corroboracion
    // verdaderamente independiente.
    if (
      s.signal_confidence === "high" &&
      !s.evidence.some((e) => e.independent && !dependiente(e.metric, s.metric))
    ) {
      push(
        "confianza_exige_corroboracion",
        "D05 guardrail 26",
        `"${s.metric}" declara confianza alta sin ninguna fuente independiente que la respalde`,
      );
    }

    // Guardrail 34 -- un cambio explicado por el contexto sigue pudiendo ser
    // importante, pero uno suprimido no puede seguir siendo critico: si de
    // verdad importa, no se silencia.
    if (s.suppression === "suppress" && s.business_relevance === "critical") {
      push(
        "no_se_silencia_lo_critico",
        "D05 guardrails 33 y 34",
        `"${s.metric}" se silencia y a la vez se declara critica: si el patron conocido la explica, no es critica`,
      );
    }

    // Guardrail 46 -- que un patron historico coincida no confirma el desenlace.
    // Reducir la atencion apoyandose solo en eso, sin explicacion, es apostar.
    if (s.matched_pattern != null && s.suppression === "suppress" && s.novelty === "first_ever") {
      push(
        "patron_no_confirma_desenlace",
        "D05 guardrails 46 y 47",
        `"${s.metric}" se silencia por un patron y a la vez se declara nunca vista: no puede ser las dos cosas`,
      );
    }
  }

  // Guardrails 29, 30 y 31 -- varias senales del mismo fenomeno no se cuentan
  // como varios problemas. Si dos senales dependientes coinciden en scope y no
  // estan agrupadas, es un aviso duplicado esperando a ocurrir.
  for (let i = 0; i < signals.length; i += 1) {
    for (let j = i + 1; j < signals.length; j += 1) {
      const a = signals[i]!;
      const b = signals[j]!;
      if (a.scope !== b.scope || !dependiente(a.metric, b.metric)) continue;
      const agrupadas = clusters.some(
        (c) => c.signal_ids.includes(a.signal_id) && c.signal_ids.includes(b.signal_id),
      );
      if (!agrupadas) {
        push(
          "duplicado_sin_agrupar",
          "D05 guardrails 29 y 30",
          `"${a.metric}" y "${b.metric}" dependen entre si y comparten scope sin estar agrupadas: son el mismo fenomeno contado dos veces`,
        );
      }
    }
  }

  return v;
}

// --- El detector (runtime puro) ---------------------------------------------

export type SeriesPoint = { date: string; value: number; sample?: number };

export type DetectOptions = {
  /**
   * Cuantas desviaciones absolutas medianas marcan el rango esperado.
   *
   * **Es un default tecnico, no una verdad de negocio.** El guardrail 17
   * prohibe los umbrales de gurú y el 19 avisa de que incluso un umbral tecnico
   * casi universal necesita configuracion. 3 x MAD es el equivalente robusto de
   * "tres sigmas" y se elige por eso: la mediana y la MAD no se mueven cuando
   * hay un outlier, que es lo que pide el guardrail 24. Cambiarlo por tenant es
   * legitimo y esperable.
   */
  madMultiplier?: number;
  /** Puntos minimos para que la serie sostenga algo. Por debajo, low_sample. */
  minimumPoints?: number;
  /** Eventos minimos por punto para no marcar muestra baja (guardrails 21, 22). */
  minimumSample?: number;
  /**
   * Que desviacion relativa cuenta cuando la serie no tiene ninguna variacion.
   *
   * Una serie perfectamente plana tiene MAD 0, y entonces el rango esperado se
   * cierra sobre un unico valor: sin esto, un cambio del 0,1% seria una
   * anomalia y -- peor -- una guarda contra esa hipersensibilidad silenciaba la
   * senal mas obvia que existe (13 dias en 100 y de golpe 40). Otro default
   * tecnico, del guardrail 19.
   */
  flatToleranceRelative?: number;
  /** Cuanto pesa esta metrica en el negocio (guardrail 8 y 57). */
  exposure?: (typeof BUSINESS_EXPOSURES)[number];
};

const DEFAULTS = {
  madMultiplier: 3,
  minimumPoints: 14,
  minimumSample: 30,
  flatToleranceRelative: 0.05,
} as const;

export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const ordenados = [...values].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 0
    ? (ordenados[medio - 1]! + ordenados[medio]!) / 2
    : ordenados[medio]!;
}

/**
 * Desviacion absoluta mediana. Se usa en vez de la desviacion tipica porque el
 * guardrail 24 pide metodos robustos: un Black Friday dentro de la ventana
 * dispara la desviacion tipica y esconde todo lo demas bajo un rango enorme.
 */
export function medianAbsoluteDeviation(values: number[]): number {
  const m = median(values);
  return median(values.map((x) => Math.abs(x - m)));
}

/** Cuantos puntos seguidos, contando desde el final, quedan fuera del rango. */
function consecutivosFuera(values: number[], low: number, high: number): number {
  let n = 0;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const x = values[i]!;
    if (x < low || x > high) n += 1;
    else break;
  }
  return n;
}

function persistenciaDe(consecutivos: number): Persistence {
  if (consecutivos >= 14) return "chronic";
  if (consecutivos >= 5) return "persistent";
  if (consecutivos >= 2) return "emerging";
  return "transient";
}

/**
 * Guardrail 8 y 57. La relevancia sale de la magnitud **y** de la exposicion, y
 * sin exposicion material no pasa de `medium` por mucho que el porcentaje
 * impresione. Un +200% en una campana de 40 EUR sigue siendo 80 EUR.
 */
function relevanciaDe(
  magnitudRelativa: number,
  exposure: DetectOptions["exposure"],
  lowSample: boolean,
): RelevanceLevel {
  const m = Math.abs(magnitudRelativa);
  const material = exposure != null && MATERIAL_EXPOSURES.includes(exposure);
  if (!material) return m >= 0.5 ? "medium" : "low";
  if (lowSample) return m >= 0.5 ? "high" : "medium";
  if (m >= 0.5) return "critical";
  if (m >= 0.2) return "high";
  if (m >= 0.1) return "medium";
  return "low";
}

export type DetectedSignal = Omit<EngineSignal, "signal_id" | "evidence"> & {
  evidence: EngineSignalEvidence[];
};

/**
 * Mira una serie y devuelve las senales candidatas. Puro: ni base de datos ni
 * reloj, asi que se puede probar con numeros a mano.
 *
 * Implementa los pasos 1, 2, 3, 5, 6 (level, trend y change), 9, 10 y 13 del
 * runtime. Los demas -- ajuste por estacionalidad, change points, drilldown por
 * segmento, corroboracion entre fuentes, clustering -- necesitan datos que hoy
 * no llegan aqui, y estan anotados en la bitacora en vez de fingidos.
 *
 * Nunca interpreta: devuelve "la metrica X cae un 34% frente a su mediana", no
 * "hay fatiga creativa".
 */
export function detectSignals(
  metric: string,
  series: SeriesPoint[],
  options: DetectOptions = {},
): DetectedSignal[] {
  const k = options.madMultiplier ?? DEFAULTS.madMultiplier;
  const minimoPuntos = options.minimumPoints ?? DEFAULTS.minimumPoints;
  const minimoMuestra = options.minimumSample ?? DEFAULTS.minimumSample;
  const tolerancePlana = options.flatToleranceRelative ?? DEFAULTS.flatToleranceRelative;

  if (series.length < 3) return [];

  const valores = series.map((p) => p.value);
  const ultimo = series[series.length - 1]!;
  // El baseline se calcula SIN el punto que se esta juzgando: incluirlo
  // arrastra la mediana hacia el valor que queremos evaluar.
  const historico = valores.slice(0, -1);
  const base = median(historico);
  const mad = medianAbsoluteDeviation(historico);

  // Guardrails 21 y 22 -- con pocos puntos o pocos eventos, la aritmetica sigue
  // funcionando y el significado no.
  const muestraTotal = series.reduce((acc, p) => acc + (p.sample ?? 0), 0);
  const lowSample =
    series.length < minimoPuntos ||
    (muestraTotal > 0 && muestraTotal / series.length < minimoMuestra);

  const senales: DetectedSignal[] = [];
  const magnitudRelativa = base === 0 ? 0 : (ultimo.value - base) / Math.abs(base);
  // Cuando la serie no varia nada, el rango no puede ser un punto: se abre con
  // una tolerancia relativa. Sin esto, una caida del 60% sobre una serie plana
  // no generaba ninguna senal.
  const holgura = mad > 0 ? k * mad : Math.abs(base) * tolerancePlana;
  const low = base - holgura;
  const high = base + holgura;

  const comun = {
    metric,
    scope: "global",
    observed_value: ultimo.value,
    baseline_value: base,
    magnitude_relative: magnitudRelativa,
    expected_low: low,
    expected_high: high,
    baseline_kind: "self_baseline_median",
    sample_size: muestraTotal > 0 ? muestraTotal : null,
    low_sample: lowSample,
    statistical_method: `median +/- ${k} x MAD`,
    business_exposure: options.exposure ?? null,
    composite_inputs: [],
    evidence: [] as EngineSignalEvidence[],
  };

  // Paso 6 -- LEVEL: el ultimo valor se sale del rango esperado.
  if (holgura > 0 && (ultimo.value < low || ultimo.value > high)) {
    const consecutivos = consecutivosFuera(valores, low, high);
    const persistence = persistenciaDe(consecutivos);
    senales.push(
      engineSignalSchema.parse({
        ...comun,
        signal_id: `${metric}:level:${ultimo.date}`,
        signal_type: "level",
        // Guardrail 3 -- salirse del rango SI es una anomalia puntual, y se
        // dice; pero no toda senal lo es.
        anomaly_type: "point",
        direction: ultimo.value > high ? "up" : "down",
        persistence,
        // Guardrails 14 y 44 -- solo lo persistente puede ser un regimen nuevo.
        regime: ["persistent", "chronic"].includes(persistence) ? "new_regime" : "anomaly",
        business_relevance: relevanciaDe(magnitudRelativa, options.exposure, lowSample),
        statistical_strength: lowSample ? "weak" : "moderate",
        description: `${metric} en ${ultimo.value} frente a una mediana de ${base} (${(magnitudRelativa * 100).toFixed(1)}%), fuera del rango esperado [${low.toFixed(2)}, ${high.toFixed(2)}]`,
      }) as DetectedSignal,
    );
  }

  // Paso 6 -- TREND: varios puntos seguidos moviendose en la misma direccion.
  const cola = valores.slice(-5);
  if (cola.length === 5) {
    const subidas = cola.every((x, i) => i === 0 || x > cola[i - 1]!);
    const bajadas = cola.every((x, i) => i === 0 || x < cola[i - 1]!);
    if (subidas || bajadas) {
      const desde = cola[0]!;
      const cambio = desde === 0 ? 0 : (ultimo.value - desde) / Math.abs(desde);
      senales.push(
        engineSignalSchema.parse({
          ...comun,
          signal_id: `${metric}:trend:${ultimo.date}`,
          signal_type: subidas ? "positive" : "trend",
          direction: subidas ? "up" : "down",
          magnitude_relative: cambio,
          persistence: "persistent",
          business_relevance: relevanciaDe(cambio, options.exposure, lowSample),
          statistical_strength: lowSample ? "weak" : "moderate",
          description: `${metric} lleva 5 periodos ${subidas ? "subiendo" : "bajando"} sin interrupcion, de ${desde} a ${ultimo.value}`,
        }) as DetectedSignal,
      );
    }
  }

  return senales;
}
