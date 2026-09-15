/**
 * FASE 3 / D02: los invariantes de la contextualizacion.
 *
 * Cada test reproduce una lectura que un guardrail de D02 prohibe, citando su
 * numero. El mas importante no es un rechazo sino un calculo: la paradoja de
 * Simpson, que es el unico sitio de este bloque donde el sistema puede afirmar
 * algo definitivo -- y lo afirma en negativo ("esto no es rendimiento").
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assessContext,
  buildMixSegments,
  checkContextInvariants,
  checkTemporalComparability,
  classifyAggregate,
  combineInterpretations,
  contextAssessmentFields,
  contextAssessmentSchema,
  changeEventRefSchema,
  confounderSchema,
  detectSimpsonReversal,
  mixSegmentSchema,
  selectBaseline,
  type ContextAssessment,
  type ContextCheckInput,
  type MixSegment,
  type SegmentObservation,
} from "./context.js";
import { dataQualityAssessmentSchema } from "./data-quality.js";

/** Lectura contextual bien sostenida. Cada test la rompe por un sitio. */
function lecturaSana(): ContextAssessment {
  return contextAssessmentSchema.parse({
    assessment_id: "CTX-001",
    scope: "conversion",
    baseline_type: "year_over_year",
    baseline_rationale: "Mismo periodo del ano anterior, sin promocion en ninguno",
    comparability: "comparable",
    aggregate_interpretation: "undetermined",
    context_sufficient: true,
    context_depth: "standard",
  });
}

const reglas = (over: Partial<ContextCheckInput> = {}) =>
  checkContextInvariants({ assessment: lecturaSana(), ...over }).map((x) => x.rule);

test("una lectura contextual bien sostenida no dispara nada", () => {
  assert.deepEqual(reglas(), []);
});

test("§6: no se afirma un cambio de rendimiento sin descomponer el mix", () => {
  const r = reglas({
    assessment: { ...lecturaSana(), aggregate_interpretation: "performance_change" },
  });
  assert.ok(r.includes("mix_comprobado"));
});

// --- Simpson ---------------------------------------------------------------

/**
 * Caso real de manual: todos los canales mejoran su conversion, pero el peso
 * se desplaza hacia el que convierte peor, y el agregado cae.
 */
const simpsonMix: MixSegment[] = [
  mixSegmentSchema.parse({
    dimension: "channel",
    segment: "email",
    weight_before: 0.5,
    weight_after: 0.1,
    performance_before: 0.08,
    performance_after: 0.09,
  }),
  mixSegmentSchema.parse({
    dimension: "channel",
    segment: "paid_social",
    weight_before: 0.5,
    weight_after: 0.9,
    performance_before: 0.02,
    performance_after: 0.025,
  }),
];

test("§8: la paradoja de Simpson se calcula, no se advierte", () => {
  const detectada = detectSimpsonReversal(simpsonMix);
  assert.ok(detectada, "deberia detectar la inversion");
  assert.equal(detectada.segmentDirection, "up");
  assert.ok(detectada.aggregateDelta < 0);
});

test("§8: con Simpson encima, llamarlo cambio de rendimiento es una violacion", () => {
  const r = reglas({
    assessment: { ...lecturaSana(), aggregate_interpretation: "performance_change" },
    mix: simpsonMix,
  });
  assert.ok(r.includes("paradoja_de_simpson"));
});

test("§8: clasificarlo como mix_shift es justo lo que pide el guardrail", () => {
  const r = reglas({
    assessment: { ...lecturaSana(), aggregate_interpretation: "mix_shift" },
    mix: simpsonMix,
  });
  assert.deepEqual(r, []);
});

test("§8: sin inversion no hay paradoja que declarar", () => {
  const normal = [
    mixSegmentSchema.parse({
      dimension: "channel",
      segment: "email",
      weight_before: 0.5,
      weight_after: 0.5,
      performance_before: 0.08,
      performance_after: 0.06,
    }),
    mixSegmentSchema.parse({
      dimension: "channel",
      segment: "paid_social",
      weight_before: 0.5,
      weight_after: 0.5,
      performance_before: 0.02,
      performance_after: 0.015,
    }),
  ];
  assert.equal(detectSimpsonReversal(normal), null);
});

test("§8: con un solo segmento no se afirma nada -- no detectar no es descartar", () => {
  assert.equal(detectSimpsonReversal([simpsonMix[0]!]), null);
});

// --- Resto de invariantes --------------------------------------------------

test("§22: dos confusores materiales no dejan una comparacion limpia", () => {
  const r = reglas({
    confounders: [
      confounderSchema.parse({
        variable: "competidor bajo precios",
        knowledge_state: "known",
        occurred_at: "2026-09-01T00:00:00Z",
        material: true,
      }),
      confounderSchema.parse({
        variable: "cambio de agencia",
        knowledge_state: "suspected",
        material: true,
      }),
    ],
  });
  assert.ok(r.includes("confounders_reducen_comparabilidad"));
});

test("§22: confusores no materiales no degradan nada", () => {
  const r = reglas({
    confounders: [
      confounderSchema.parse({ variable: "ola de calor", material: false }),
      confounderSchema.parse({ variable: "festivo local", material: false }),
    ],
  });
  assert.deepEqual(r, []);
});

test("§18: un baseline anterior a un regime change no es baseline limpio", () => {
  const r = reglas({
    breaks: [
      {
        break_type: "regime_change" as const,
        subtype: "international_expansion",
        description: "Apertura de Francia e Italia",
        effective_from: "2026-06-01T00:00:00Z",
        invalidates_history_before: true,
        affected_metrics: [],
      },
    ],
  });
  assert.ok(r.includes("baseline_tras_ruptura"));
});

test("§19: una discontinuidad de medicion hace lo mismo que un regime change", () => {
  const r = reglas({
    breaks: [
      {
        break_type: "measurement_discontinuity" as const,
        subtype: "attribution_window_change",
        description: "De 7d-click a 1d-click",
        effective_from: "2026-08-01T00:00:00Z",
        invalidates_history_before: true,
        affected_metrics: ["meta_conversions"],
      },
    ],
  });
  assert.ok(r.includes("baseline_tras_ruptura"));
});

test("§15: una promocion en el periodo tiene que aparecer en la lectura", () => {
  const r = reglas({
    changeEvents: [
      changeEventRefSchema.parse({
        event_type: "promotion",
        description: "Rebajas de enero",
        occurred_at: "2026-01-07T00:00:00Z",
        temporal_relation: "concurrent",
      }),
    ],
  });
  assert.ok(r.includes("promocion_no_es_estructural"));
});

test("§15: recogerla como factor satisface la regla", () => {
  const r = reglas({
    assessment: {
      ...lecturaSana(),
      primary_factors: ["Rebajas de enero solapan la ventana analizada"],
    },
    changeEvents: [
      changeEventRefSchema.parse({
        event_type: "promotion",
        description: "Rebajas de enero",
        occurred_at: "2026-01-07T00:00:00Z",
        temporal_relation: "concurrent",
      }),
    ],
  });
  assert.deepEqual(r, []);
});

test("§28: una contradiccion declarado/observado no se resuelve en silencio", () => {
  const r = reglas({
    contradictions: [
      {
        dimension: "business_model",
        declared_value: "subscription",
        observed_value: "one_off_dtc",
        material: true,
      },
    ],
  });
  assert.ok(r.includes("contradiccion_no_silenciada"));
});

test("§29: D02 hereda la incertidumbre de D01, no la pierde por el camino", () => {
  const r = reglas({
    dataQuality: [
      dataQualityAssessmentSchema.parse({
        source: "ga4",
        dataset: "events",
        phenomenon: "cvr",
        role: "primary",
        freshness: "fresh",
        reliability: "low",
        degradation_reasons: ["consent rate del 41%"],
      }),
    ],
  });
  assert.ok(r.includes("hereda_incertidumbre_de_d1"));
});

// --- Invariantes del esquema -----------------------------------------------

test("§3: elegir baseline sin escribir por que es comparar por cercania", () => {
  assert.throws(() =>
    contextAssessmentSchema.parse({
      assessment_id: "CTX-2",
      baseline_type: "previous_period",
      comparability: "comparable",
      context_sufficient: true,
    }),
  );
});

test("§25: declarar el contexto insuficiente exige decir que falta", () => {
  assert.throws(() =>
    contextAssessmentSchema.parse({
      assessment_id: "CTX-3",
      comparability: "limited",
      comparability_reasons: ["falta calendario"],
      context_sufficient: false,
    }),
  );
});

test("§26: con incognitas criticas la comparacion no se declara limpia", () => {
  assert.throws(() =>
    contextAssessmentSchema.parse({
      assessment_id: "CTX-4",
      comparability: "comparable",
      context_sufficient: true,
      critical_unknowns: ["no se conoce el calendario promocional"],
    }),
  );
});

test("§17: un lag hacia atras en el tiempo no existe", () => {
  assert.throws(() =>
    changeEventRefSchema.parse({
      event_type: "deployment",
      description: "despliegue",
      occurred_at: "2026-09-10T00:00:00Z",
      temporal_relation: "after",
      lag_days: 3,
    }),
  );
});

test("§8: un confusor conocido sin fecha no se puede contrastar", () => {
  assert.throws(() =>
    confounderSchema.parse({ variable: "price war", knowledge_state: "known" }),
  );
});

test("el limite funcional de D02 es estructural: no tiene donde escribir una causa", () => {
  // "D2 no debe cerrar causalidad". La garantia no es una instruccion en el
  // prompt: es que el campo no existe. Este test obliga a pasar por aqui y
  // leer el limite funcional del artefacto antes de anadir uno.
  const campos = Object.keys(contextAssessmentFields.shape);
  for (const prohibido of [
    "root_cause",
    "cause",
    "causes",
    "explanation",
    "confirmed",
    "recommendation",
  ]) {
    assert.ok(
      !campos.includes(prohibido),
      `la salida de D02 no puede exponer "${prohibido}" (limite funcional del artefacto)`,
    );
  }
});

// ---------------------------------------------------------------------------
// EL MOTOR — `assessContext` y sus piezas
// ---------------------------------------------------------------------------
//
// El fallo que estos tests persiguen es siempre el mismo: leer como deterioro
// del negocio algo que solo fue un cambio de composicion, o al reves. Es el
// error mas caro de la fase porque no parece un error -- las cifras son
// correctas y la conclusion es falsa.

/** Semana natural: lunes a domingo, siete dias. */
const SEMANA = { start: "2026-09-14T00:00:00.000Z", end: "2026-09-21T00:00:00.000Z" };

const seg = (
  segment: string,
  volume: number,
  performance: number | null,
  dimension = "channel",
): SegmentObservation => ({ dimension, segment, volume, performance });

// --- Paso 3: baseline -------------------------------------------------------

test("D02 motor: el baseline por defecto es el anterior de la misma duracion, y dice por que", () => {
  const b = selectBaseline(SEMANA);
  assert.equal(b.baseline_period_end, SEMANA.start);
  assert.equal(b.baseline_period_start, "2026-09-07T00:00:00.000Z");
  // El guardrail 3 prohibe elegir baseline sin motivo escrito.
  assert.ok(b.baseline_rationale.length > 0);
});

// --- Paso 4: comparabilidad temporal ----------------------------------------

test("D02 motor: dos semanas alineadas son comparables", () => {
  const b = selectBaseline(SEMANA);
  const r = checkTemporalComparability({
    analysis: SEMANA,
    baseline: { start: b.baseline_period_start, end: b.baseline_period_end },
  });
  assert.equal(r.comparability, "comparable");
  assert.deepEqual(r.reasons, []);
});

test("D02 motor: comparar seis dias contra siete no es comparar", () => {
  const r = checkTemporalComparability({
    analysis: { start: "2026-09-15T00:00:00.000Z", end: "2026-09-21T00:00:00.000Z" },
    baseline: { start: "2026-09-07T00:00:00.000Z", end: "2026-09-14T00:00:00.000Z" },
  });
  assert.equal(r.comparability, "limited");
  assert.ok(r.reasons.some((x) => x.includes("dias")));
});

test("D02 motor: distinta mezcla de dias de la semana degrada aunque midan igual", () => {
  // Ocho dias contra ocho: misma longitud, pero uno lleva dos lunes y el otro
  // dos martes. La diferencia que salga de ahi no es del negocio.
  const r = checkTemporalComparability({
    analysis: { start: "2026-09-14T00:00:00.000Z", end: "2026-09-22T00:00:00.000Z" },
    baseline: { start: "2026-09-06T00:00:00.000Z", end: "2026-09-14T00:00:00.000Z" },
  });
  assert.equal(r.comparability, "limited");
  assert.ok(r.reasons.some((x) => x.includes("dias de la semana")));
});

test("D02 motor: una ruptura en medio no degrada la comparacion, la invalida", () => {
  const b = selectBaseline(SEMANA);
  const r = checkTemporalComparability({
    analysis: SEMANA,
    baseline: { start: b.baseline_period_start, end: b.baseline_period_end },
    breaks: [
      {
        effective_from: "2026-09-10T00:00:00.000Z",
        description: "cambio de ventana de atribucion",
      },
    ],
  });
  assert.equal(r.comparability, "not_comparable");
});

test("D02 motor: la incertidumbre de D01 se hereda, no se pierde por el camino", () => {
  const b = selectBaseline(SEMANA);
  const ventanas = {
    analysis: SEMANA,
    baseline: { start: b.baseline_period_start, end: b.baseline_period_end },
  };

  const degradado = checkTemporalComparability({
    ...ventanas,
    dataQuality: [{ source: "shopify", reliability: "low", period_settlement: "settled" }],
  });
  assert.equal(degradado.comparability, "limited");
  assert.ok(degradado.reasons.some((x) => x.includes("D01")));

  // Inutilizable no es "peor": es que no hay con que comparar.
  const inutilizable = checkTemporalComparability({
    ...ventanas,
    dataQuality: [{ source: "shopify", reliability: "unusable", period_settlement: "settled" }],
  });
  assert.equal(inutilizable.comparability, "not_comparable");
});

test("D02 motor: un periodo que aun recibe datos tardios no se declara limpio", () => {
  const b = selectBaseline(SEMANA);
  const r = checkTemporalComparability({
    analysis: SEMANA,
    baseline: { start: b.baseline_period_start, end: b.baseline_period_end },
    dataQuality: [{ source: "shopify", reliability: "high", period_settlement: "open" }],
  });
  assert.equal(r.comparability, "limited");
});

// --- Paso 6: mix ------------------------------------------------------------

test("D02 motor: los pesos se normalizan dentro de su propio periodo", () => {
  const mix = buildMixSegments(
    [seg("meta", 60, 50), seg("email", 40, 80)],
    [seg("meta", 150, 50), seg("email", 50, 80)],
  );
  const meta = mix.find((m) => m.segment === "meta");
  assert.equal(meta!.weight_before, 0.6);
  assert.equal(meta!.weight_after, 0.75);
});

test("D02 motor: un segmento que aparece solo en un periodo pesa cero en el otro", () => {
  const mix = buildMixSegments([seg("meta", 100, 50)], [seg("meta", 80, 50), seg("tiktok", 20, 30)]);
  const tiktok = mix.find((m) => m.segment === "tiktok");
  assert.equal(tiktok!.weight_before, 0);
  assert.equal(tiktok!.weight_after, 0.2);
});

test("D02 motor: un rendimiento a medias se anula en los dos lados", () => {
  const mix = buildMixSegments([seg("meta", 100, 50)], [seg("meta", 80, null)]);
  assert.equal(mix[0]!.performance_before, null);
  assert.equal(mix[0]!.performance_after, null);
});

// --- La pregunta del bloque -------------------------------------------------

test("D02 motor: la misma caida agregada se lee distinta segun de donde venga", () => {
  // Caso 1 -- cada canal rinde peor: es rendimiento.
  const rendimiento = classifyAggregate(
    buildMixSegments(
      [seg("meta", 50, 100), seg("email", 50, 100)],
      [seg("meta", 50, 80), seg("email", 50, 80)],
    ),
  );
  assert.equal(rendimiento.interpretation, "performance_change");

  // Caso 2 -- cada canal rinde IGUAL y el agregado cae: solo cambio el peso.
  // Sin descomponer, los dos casos son "el AOV ha bajado" y llevan a
  // diagnosticos opuestos.
  const composicion = classifyAggregate(
    buildMixSegments(
      [seg("meta", 50, 60), seg("email", 50, 140)],
      [seg("meta", 90, 60), seg("email", 10, 140)],
    ),
  );
  assert.equal(composicion.interpretation, "mix_shift");
});

test("D02 motor: cuando las dos cosas pesan, no se elige una", () => {
  const r = classifyAggregate(
    buildMixSegments(
      [seg("meta", 50, 100), seg("email", 50, 200)],
      [seg("meta", 70, 90), seg("email", 30, 190)],
    ),
  );
  assert.equal(r.interpretation, "mixed");
});

test("D02 motor: todos los segmentos suben y el agregado baja -- eso es Simpson", () => {
  const mix = buildMixSegments(
    [seg("meta", 20, 100), seg("email", 80, 200)],
    [seg("meta", 80, 110), seg("email", 20, 210)],
  );
  assert.ok(detectSimpsonReversal(mix), "el fixture tiene que ser una reversion real");
  assert.equal(classifyAggregate(mix).interpretation, "mix_shift");
});

test("D02 motor: sin descomponer no se afirma nada (guardrail 6)", () => {
  assert.equal(classifyAggregate([]).interpretation, "undetermined");
  const unSolo = buildMixSegments([seg("meta", 100, 50)], [seg("meta", 100, 40)]);
  assert.equal(classifyAggregate(unSolo).interpretation, "undetermined");
});

test("D02 motor: la descomposicion suma exactamente el movimiento del agregado", () => {
  // No es una heuristica: dentro + mix = delta. Si esto deja de cumplirse, el
  // reparto entre las dos lecturas es inventado.
  const mix = buildMixSegments(
    [seg("meta", 30, 120), seg("email", 70, 40)],
    [seg("meta", 60, 100), seg("email", 40, 55)],
  );
  const r = classifyAggregate(mix);
  const agregado = (m: MixSegment[], cuando: "before" | "after") =>
    m.reduce(
      (acc, s) =>
        acc +
        (cuando === "before"
          ? s.weight_before * (s.performance_before as number)
          : s.weight_after * (s.performance_after as number)),
      0,
    );
  const delta = agregado(mix, "after") - agregado(mix, "before");
  assert.ok(
    Math.abs(r.within_effect + r.mix_effect - delta) < 1e-9,
    `dentro (${r.within_effect}) + mix (${r.mix_effect}) deberia ser ${delta}`,
  );
});

// --- Todo junto -------------------------------------------------------------

test("D02 motor: la salida pasa el contrato y no contiene ninguna causa", () => {
  const salida = assessContext({
    metric: "aov",
    scope: "conversion",
    analysis: SEMANA,
    segmentsBefore: [seg("meta", 50, 100), seg("email", 50, 100)],
    segmentsAfter: [seg("meta", 50, 80), seg("email", 50, 80)],
  });

  contextAssessmentSchema.parse(salida.assessment);
  for (const s of salida.mix) mixSegmentSchema.parse(s);

  // La garantia estructural del bloque: D02 acota hipotesis, no las cierra.
  for (const prohibido of ["root_cause", "cause", "explanation", "confirmed"]) {
    assert.ok(
      !(prohibido in salida.assessment),
      `D02 no puede tener campo "${prohibido}": acota hipotesis, no las cierra`,
    );
  }
});

test("D02 motor: lo que no se puede mirar se declara, no se da por bueno", () => {
  const salida = assessContext({
    metric: "aov",
    scope: "conversion",
    analysis: SEMANA,
    blindDimensions: ["device", "market"],
  });

  assert.equal(salida.assessment.context_sufficient, false);
  assert.ok(salida.assessment.missing_context.some((x) => x.includes("device")));
  assert.ok(salida.assessment.missing_context.some((x) => x.includes("market")));
  // Sin mix no se puede responder la pregunta del bloque, y eso es critico.
  assert.equal(salida.assessment.aggregate_interpretation, "undetermined");
  assert.ok(salida.assessment.critical_unknowns.length > 0);
});

test("D02 motor: con incognitas criticas la comparacion nunca sale limpia", () => {
  // Lo garantiza el propio contrato; aqui se comprueba que el motor no produce
  // una combinacion que la tabla rechazaria.
  const salida = assessContext({ metric: "aov", scope: "conversion", analysis: SEMANA });
  if (salida.assessment.critical_unknowns.length > 0) {
    assert.notEqual(salida.assessment.comparability, "comparable");
  }
});

test("D02 motor: dos dimensiones que discrepan no se resuelven eligiendo una", () => {
  assert.equal(combineInterpretations(["mix_shift", "performance_change"]), "mixed");
  assert.equal(combineInterpretations(["mix_shift", "undetermined"]), "mix_shift");
  assert.equal(combineInterpretations(["undetermined", "undetermined"]), "undetermined");
  assert.equal(combineInterpretations([]), "undetermined");
});

test("D02 motor: dos dimensiones no se contaminan los pesos entre si", () => {
  // Los mismos 100 pedidos vistos por canal y por tipo de cliente. Si los pesos
  // se normalizaran sobre la lista entera, cada pedido contaria dos veces y
  // todos los pesos saldrian a la mitad.
  const mix = buildMixSegments(
    [
      seg("meta", 60, 100),
      seg("email", 40, 100),
      seg("nuevo", 70, 90, "customer_type"),
      seg("recurrente", 30, 130, "customer_type"),
    ],
    [
      seg("meta", 80, 100),
      seg("email", 20, 100),
      seg("nuevo", 50, 90, "customer_type"),
      seg("recurrente", 50, 130, "customer_type"),
    ],
  );

  const suma = (dimension: string, cuando: "weight_before" | "weight_after") =>
    mix.filter((m) => m.dimension === dimension).reduce((acc, m) => acc + m[cuando], 0);

  for (const dimension of ["channel", "customer_type"]) {
    assert.ok(Math.abs(suma(dimension, "weight_before") - 1) < 1e-9, `${dimension} antes`);
    assert.ok(Math.abs(suma(dimension, "weight_after") - 1) < 1e-9, `${dimension} despues`);
  }
});
