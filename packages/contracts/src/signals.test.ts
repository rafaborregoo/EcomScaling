/**
 * FASE 3 / D05: el motor de senales.
 *
 * Dos clases de test. Los del contrato reproducen un salto que un guardrail
 * prohibe. Los del detector le dan numeros a mano y comprueban que lo que sale
 * es lo que el artefacto permite decir -- y, sobre todo, que **no** dice de mas:
 * "el CTR cae un 34%", nunca "fatiga creativa".
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkSignalInvariants,
  detectSignals,
  median,
  medianAbsoluteDeviation,
  engineSignalFields,
  engineSignalSchema,
  engineSignalEvidenceSchema,
  type EngineSignal,
  type SignalCheckInput,
} from "./signals.js";

function senal(over: Partial<EngineSignal> = {}): EngineSignal {
  return engineSignalSchema.parse({
    signal_id: "S-1",
    signal_type: "trend",
    metric: "meta_ctr",
    direction: "down",
    description: "El CTR cae un 34% desde el 3 de septiembre",
    ...over,
  });
}

const reglas = (over: Partial<SignalCheckInput> = {}) =>
  checkSignalInvariants({ signals: [senal()], ...over }).map((x) => x.rule);

// --- Contrato ---------------------------------------------------------------

test("una senal descriptiva y modesta no dispara nada", () => {
  assert.deepEqual(reglas(), []);
});

test("§8 y §57: un +200% en una campana minuscula no es una senal relevante", () => {
  assert.throws(() =>
    engineSignalSchema.parse({
      signal_id: "S-2",
      signal_type: "change",
      metric: "campaign_roas",
      direction: "up",
      description: "+200% en una campana de 40 EUR",
      business_relevance: "critical",
      business_exposure: "minimal",
    }),
  );
});

test("§22: un porcentaje extremo con cuatro eventos no es critico", () => {
  assert.throws(() =>
    engineSignalSchema.parse({
      signal_id: "S-3",
      signal_type: "rate",
      metric: "refund_rate",
      direction: "up",
      description: "Devoluciones al 50%",
      business_relevance: "critical",
      business_exposure: "high",
      low_sample: true,
    }),
  );
});

test("§40: un composite sin inputs es un score opaco", () => {
  assert.throws(() =>
    engineSignalSchema.parse({
      signal_id: "S-4",
      signal_type: "risk",
      metric: "health_index",
      direction: "down",
      description: "Indice de salud 62",
      is_composite: true,
    }),
  );
});

test("§44: un periodo aislado no es un cambio de regimen", () => {
  assert.throws(() =>
    engineSignalSchema.parse({
      signal_id: "S-5",
      signal_type: "level",
      metric: "cvr",
      direction: "up",
      description: "CVR al 4,1% esta semana",
      regime: "new_regime",
      persistence: "transient",
    }),
  );
});

test("§35: enlazar con un evento exige decir en que relacion temporal", () => {
  assert.throws(() =>
    engineSignalSchema.parse({
      signal_id: "S-6",
      signal_type: "change",
      metric: "orders",
      direction: "down",
      description: "Pedidos -22%",
      linked_event: "EV-1",
    }),
  );
});

test("§28: sin dato que lo sostenga no hay senal de negocio relevante", () => {
  assert.throws(() =>
    engineSignalSchema.parse({
      signal_id: "S-7",
      signal_type: "level",
      metric: "ga4_purchases",
      direction: "down",
      description: "Compras -60%",
      data_confidence: "insufficient_data",
      business_relevance: "high",
      business_exposure: "high",
    }),
  );
});

test("§25: dos metricas que comparten inputs no son dos evidencias", () => {
  const r = reglas({
    signals: [
      senal({
        metric: "revenue",
        evidence: [
          engineSignalEvidenceSchema.parse({
            source: "shopify",
            metric: "revenue_per_session",
            observation: "Tambien cae",
            independent: true,
            independence_rationale: "Otra metrica distinta",
          }),
        ],
      }),
    ],
    metricDependencies: [{ metric: "revenue_per_session", depends_on: "revenue" }],
  });
  assert.ok(r.includes("corroboracion_no_independiente"));
});

test("§26: la confianza alta exige una fuente de verdad independiente", () => {
  const r = reglas({ signals: [senal({ signal_confidence: "high" })] });
  assert.ok(r.includes("confianza_exige_corroboracion"));
});

test("§26: con una fuente independiente y sin parentesco, la confianza se sostiene", () => {
  const r = reglas({
    signals: [
      senal({
        signal_confidence: "high",
        evidence: [
          engineSignalEvidenceSchema.parse({
            source: "shopify",
            metric: "orders",
            observation: "Los pedidos tambien bajan",
            independent: true,
            independence_rationale: "Backend propio, no depende del pixel de Meta",
          }),
        ],
      }),
    ],
    metricDependencies: [{ metric: "meta_ctr", depends_on: "meta_impressions" }],
  });
  assert.deepEqual(r, []);
});

test("§34: lo que se silencia no puede ser critico a la vez", () => {
  const r = reglas({
    signals: [
      senal({
        suppression: "suppress",
        matched_pattern: "Caida de agosto",
        business_relevance: "critical",
        business_exposure: "high",
      }),
    ],
  });
  assert.ok(r.includes("no_se_silencia_lo_critico"));
});

test("§29: dos senales dependientes del mismo scope sin agrupar son un aviso duplicado", () => {
  const r = checkSignalInvariants({
    signals: [
      senal({ signal_id: "S-a", metric: "sessions" }),
      senal({ signal_id: "S-b", metric: "revenue_per_session" }),
    ],
    metricDependencies: [{ metric: "revenue_per_session", depends_on: "sessions" }],
  }).map((x) => x.rule);
  assert.ok(r.includes("duplicado_sin_agrupar"));
});

test("§30: agrupadas en un cluster, dejan de ser un duplicado", () => {
  const r = checkSignalInvariants({
    signals: [
      senal({ signal_id: "S-a", metric: "sessions" }),
      senal({ signal_id: "S-b", metric: "revenue_per_session" }),
    ],
    metricDependencies: [{ metric: "revenue_per_session", depends_on: "sessions" }],
    clusters: [{ cluster_id: "C-1", signal_ids: ["S-a", "S-b"] }],
  }).map((x) => x.rule);
  assert.ok(!r.includes("duplicado_sin_agrupar"));
});

// --- El detector ------------------------------------------------------------

const serie = (values: number[], sample = 500) =>
  values.map((value, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    value,
    sample,
  }));

test("§24: la mediana y la MAD aguantan un outlier; la media no", () => {
  const conBlackFriday = [10, 11, 10, 12, 11, 10, 900];
  assert.equal(median(conBlackFriday), 11);
  // La media seria 137: el pico se lo lleva todo por delante.
  assert.ok(medianAbsoluteDeviation(conBlackFriday) < 2);
});

test("una serie estable no genera ninguna senal", () => {
  const s = detectSignals("cvr", serie([2.1, 2.0, 2.2, 2.1, 2.0, 2.1, 2.2, 2.0, 2.1, 2.1, 2.0, 2.2, 2.1, 2.0]));
  assert.deepEqual(s, []);
});

test("una caida fuera del rango esperado genera una senal de nivel", () => {
  const valores = [100, 102, 98, 101, 99, 100, 103, 97, 101, 100, 99, 102, 100, 62];
  const s = detectSignals("meta_ctr", serie(valores), { exposure: "high" });
  const level = s.find((x) => x.signal_type === "level");
  assert.ok(level, "deberia detectar la caida");
  assert.equal(level.direction, "down");
  assert.ok(level.magnitude_relative! < -0.3);
});

test("§49: la senal describe, no interpreta", () => {
  const valores = [100, 102, 98, 101, 99, 100, 103, 97, 101, 100, 99, 102, 100, 62];
  const s = detectSignals("meta_ctr", serie(valores), { exposure: "high" });
  for (const señal of s) {
    // "CTR cae un 38%" si. "Fatiga creativa" no: eso lo decide D06.
    assert.match(señal.description, /meta_ctr/);
    for (const prohibido of ["fatiga", "causa", "porque", "deberia", "recomend"]) {
      assert.ok(
        !señal.description.toLowerCase().includes(prohibido),
        `la descripcion no puede interpretar: "${señal.description}"`,
      );
    }
  }
});

test("§8: la misma caida sin exposicion material no llega a critica", () => {
  const valores = [100, 102, 98, 101, 99, 100, 103, 97, 101, 100, 99, 102, 100, 40];
  const conPeso = detectSignals("revenue", serie(valores), { exposure: "high" });
  const sinPeso = detectSignals("revenue", serie(valores), { exposure: "minimal" });
  assert.equal(conPeso.find((x) => x.signal_type === "level")?.business_relevance, "critical");
  assert.equal(sinPeso.find((x) => x.signal_type === "level")?.business_relevance, "medium");
});

test("§22: con muestra pequena la senal se degrada, no se calla", () => {
  const valores = [100, 102, 98, 101, 99, 100, 103, 97, 101, 100, 99, 102, 100, 40];
  const s = detectSignals("refund_rate", serie(valores, 3), { exposure: "high" });
  const level = s.find((x) => x.signal_type === "level");
  assert.ok(level);
  assert.equal(level.low_sample, true);
  assert.notEqual(level.business_relevance, "critical");
  assert.equal(level.statistical_strength, "weak");
});

test("§43: una mejora sostenida se detecta con el mismo rigor que un deterioro", () => {
  const valores = [50, 51, 49, 50, 51, 50, 49, 51, 50, 52, 55, 58, 62, 67];
  const s = detectSignals("repeat_rate", serie(valores), { exposure: "high" });
  const positiva = s.find((x) => x.signal_type === "positive");
  assert.ok(positiva, "cinco periodos subiendo es una senal positiva");
  assert.equal(positiva.direction, "up");
});

test("§14: una desviacion de un solo dia no se declara regimen nuevo", () => {
  const valores = [100, 102, 98, 101, 99, 100, 103, 97, 101, 100, 99, 102, 100, 62];
  const s = detectSignals("meta_ctr", serie(valores), { exposure: "high" });
  const level = s.find((x) => x.signal_type === "level");
  assert.equal(level?.persistence, "transient");
  assert.equal(level?.regime, "anomaly");
});

test("§14: sostenida en el tiempo, si pasa a regimen nuevo", () => {
  const valores = [100, 102, 98, 101, 99, 100, 103, 97, 101, 62, 60, 61, 59, 62];
  const s = detectSignals("meta_ctr", serie(valores), { exposure: "high" });
  const level = s.find((x) => x.signal_type === "level");
  assert.equal(level?.persistence, "persistent");
  assert.equal(level?.regime, "new_regime");
});

test("el baseline no se contamina con el punto que se esta juzgando", () => {
  const valores = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 40];
  const s = detectSignals("orders", serie(valores), { exposure: "high" });
  assert.equal(s.find((x) => x.signal_type === "level")?.baseline_value, 100);
});

test("una serie demasiado corta no afirma nada", () => {
  assert.deepEqual(detectSignals("cvr", serie([10, 12])), []);
});

// --- Lo estructural ---------------------------------------------------------

test("§49 y §50: la senal no tiene donde escribir un sintoma, una causa ni una accion", () => {
  // "D5 puede decir CTR deterioration. D5 no puede decir creative fatigue
  // confirmed." La garantia es que el campo no existe.
  const campos = Object.keys(engineSignalFields.shape);
  for (const prohibido of [
    "symptom",
    "cause",
    "root_cause",
    "action",
    "recommendation",
    "priority",
    "playbook",
  ]) {
    assert.ok(
      !campos.includes(prohibido),
      `"${prohibido}" esta fuera de la frontera de D05 (guardrails 4, 5, 6, 49, 50, 53 y 55)`,
    );
  }
});

test("§7 y §12: lo estadistico y lo empresarial son campos distintos", () => {
  const campos = Object.keys(engineSignalFields.shape);
  for (const necesario of [
    "statistical_strength",
    "business_relevance",
    "business_exposure",
    "sample_size",
  ]) {
    assert.ok(campos.includes(necesario), `falta "${necesario}"`);
  }
});
