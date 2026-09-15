/**
 * FASE 3 / D08: el motor de hipotesis.
 *
 * Casi todos estos tests reproducen el mismo error: quedarse con la primera
 * explicacion que encaja. Por eso la mayoria comprueba lo que NO se hizo --
 * que alternativas no se probaron, que evidencia en contra no se busco, que
 * fuente se conto dos veces.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkHypothesisInvariants,
  engineHypothesisFields,
  engineHypothesisSchema,
  hypothesisEvidenceSchema,
  diagnosticTestSchema,
  toCaseHypothesis,
  type EngineHypothesis,
  type HypothesisCheckInput,
} from "./hypotheses.js";

function hip(over: Partial<EngineHypothesis> = {}): EngineHypothesis {
  return engineHypothesisSchema.parse({
    hypothesis_id: "H-1",
    code: "H1",
    statement: "El CPM subio en la subasta y arrastro al CAC",
    ...over,
  });
}

const causal = (over: Partial<EngineHypothesis> = {}) =>
  hip({ hypothesis_type: "direct_cause", source_path_id: "P-1", ...over });

const reglas = (input: HypothesisCheckInput) =>
  checkHypothesisInvariants(input).map((x) => x.rule);

// --- El contrato de la fila ------------------------------------------------

test("una hipotesis modesta y sin afirmar no dispara nada", () => {
  assert.deepEqual(reglas({ hypotheses: [hip(), hip({ hypothesis_id: "H-2", code: "H2" })] }), []);
});

test("§19: sin ruta causal en D07 no hay hipotesis causal", () => {
  assert.throws(() =>
    engineHypothesisSchema.parse({
      hypothesis_id: "H-x",
      code: "H9",
      statement: "El CPM arrastro al CAC",
      hypothesis_type: "direct_cause",
    }),
  );
  assert.ok(causal());
});

test("§32 y §60: confirmar tiene que costar", () => {
  assert.throws(() => causal({ status: "confirmed" }));
  assert.throws(() =>
    causal({ status: "confirmed", confidence: "high", separation: "high" }),
  );
  assert.ok(
    causal({
      status: "confirmed",
      confidence: "high",
      separation: "high",
      falsification_condition: "Si el CPM de agosto no supera al de julio, cae",
      why_alternatives_lose: "Ni el CTR ni el CVR se movieron en la ventana",
    }),
  );
});

test("§12 y §34: confianza alta exige separacion de las alternativas", () => {
  assert.throws(() => causal({ confidence: "high", separation: "low" }));
});

test("§57 a §60: la primaria explica por que gana y que la falsaria", () => {
  assert.throws(() => causal({ relative_role: "primary" }));
});

test("§36: no hay explicacion completa con residual material", () => {
  assert.throws(() =>
    causal({ explanatory_coverage: "full", unexplained_residual_material: true }),
  );
});

test("§37: una causa parcial se queda parcial", () => {
  assert.throws(() =>
    causal({ hypothesis_type: "contributory_cause", explanatory_coverage: "full" }),
  );
});

test("§4 y §17: una candidata a raiz dice que la falsaria", () => {
  assert.throws(() => causal({ root_cause_candidate: true }));
  assert.ok(
    causal({
      root_cause_candidate: true,
      falsification_condition: "Si el presupuesto no cambio en la ventana, cae",
    }),
  );
});

test("§46 y §47: no se pregunta lo que ya esta en el sistema", () => {
  assert.throws(() =>
    diagnosticTestSchema.parse({
      test_id: "T-1",
      hypothesis_id: "H-1",
      diagnostic_question: "Cuanto gastasteis en Meta?",
      expected_if_true: "El gasto subio mas de un 20% respecto a julio",
      expected_if_false: "El gasto se mantuvo plano o bajo",
      availability: "available",
      mode: "active",
    }),
  );
});

test("§17 y §18: un test sin prediccion util no discrimina nada", () => {
  assert.throws(() =>
    diagnosticTestSchema.parse({
      test_id: "T-2",
      hypothesis_id: "H-1",
      diagnostic_question: "Va bien?",
      expected_if_true: "si",
      expected_if_false: "no",
    }),
  );
});

// --- Las reglas que miran el conjunto --------------------------------------

test("§1, §9 y §10: la primera causa plausible no es un diagnostico", () => {
  const r = reglas({ hypotheses: [causal({ status: "supported" })] });
  assert.ok(r.includes("primera_plausible_no_es_diagnostico"));
});

test("§13 y §14: afirmar habiendo recogido solo evidencia a favor es sesgo", () => {
  const r = reglas({
    hypotheses: [
      causal({ status: "supported" }),
      hip({ hypothesis_id: "H-2", code: "H2", relative_role: "alternative" }),
    ],
    evidence: [
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-1",
        hypothesis_id: "H-1",
        relation: "supports",
      }),
    ],
  });
  assert.ok(r.includes("sesgo_de_confirmacion"));
});

test("§13: con un test ejecutado que podia tumbarla, deja de ser sesgo", () => {
  const r = reglas({
    hypotheses: [
      causal({ status: "supported" }),
      hip({ hypothesis_id: "H-2", code: "H2", relative_role: "alternative" }),
    ],
    evidence: [
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-1",
        hypothesis_id: "H-1",
        relation: "supports",
      }),
    ],
    tests: [
      diagnosticTestSchema.parse({
        test_id: "T-3",
        hypothesis_id: "H-1",
        diagnostic_question: "Se movio el CTR en la misma ventana?",
        expected_if_true: "El CTR se mantiene mientras el CPM sube",
        expected_if_false: "El CTR cae a la vez y el mecanismo es otro",
        status: "done",
      }),
    ],
  });
  assert.ok(!r.includes("sesgo_de_confirmacion"));
});

test("§21 y §22: dos lecturas del mismo sitio no son dos fuentes", () => {
  const r = reglas({
    hypotheses: [
      causal({
        status: "supported",
        confidence: "high",
        separation: "high",
        why_alternatives_lose: "Las demas no encajan en el tiempo",
      }),
      hip({ hypothesis_id: "H-2", code: "H2", relative_role: "alternative" }),
    ],
    evidence: [
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-1", hypothesis_id: "H-1", relation: "supports", source_system: "meta_ads",
      }),
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-2", hypothesis_id: "H-1", relation: "supports", source_system: "meta_ads",
      }),
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-3", hypothesis_id: "H-1", relation: "contradicts", source_system: "shopify",
      }),
    ],
  });
  assert.ok(r.includes("fuentes_no_independientes"));
});

test("§5: lo que nadie ha mirado no contradice nada", () => {
  const r = reglas({
    hypotheses: [causal(), hip({ hypothesis_id: "H-2", code: "H2" })],
    evidence: [
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-1",
        hypothesis_id: "H-1",
        relation: "contradicts",
        observation_kind: "not_observed",
      }),
    ],
  });
  assert.ok(r.includes("no_observado_no_es_ausencia"));
});

test("§5: haber mirado y no encontrarlo si contradice", () => {
  const r = reglas({
    hypotheses: [causal(), hip({ hypothesis_id: "H-2", code: "H2" })],
    evidence: [
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-1",
        hypothesis_id: "H-1",
        relation: "contradicts",
        observation_kind: "observed_absent",
      }),
    ],
  });
  assert.deepEqual(r, []);
});

test("§25: la evidencia rancia no sostiene una afirmacion", () => {
  const r = reglas({
    hypotheses: [causal({ status: "most_likely" }), hip({ hypothesis_id: "H-2", code: "H2", relative_role: "challenger" })],
    evidence: [
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-1", hypothesis_id: "H-1", relation: "supports", freshness: "stale",
      }),
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-2", hypothesis_id: "H-1", relation: "contradicts", freshness: "fresh",
      }),
    ],
  });
  assert.ok(r.includes("evidencia_rancia_no_sostiene"));
});

test("§23 y §24: dos fuentes fiables que se contradicen no se fuerzan", () => {
  const r = reglas({
    hypotheses: [
      causal({
        status: "confirmed",
        confidence: "high",
        separation: "high",
        falsification_condition: "Si el CPM no subio, cae",
        why_alternatives_lose: "No encajan en el tiempo",
      }),
      hip({ hypothesis_id: "H-2", code: "H2", relative_role: "alternative" }),
    ],
    evidence: [
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-1", hypothesis_id: "H-1", relation: "contradicts", reliability: "high",
      }),
    ],
  });
  assert.ok(r.includes("conflicto_no_se_fuerza"));
});

test("§43: una metrica de resultado no es candidata a raiz", () => {
  const r = reglas({
    hypotheses: [
      causal({
        root_cause_candidate: true,
        target_node_id: "N-revenue",
        falsification_condition: "Si las sesiones no cayeron, cae",
      }),
      hip({ hypothesis_id: "H-2", code: "H2" }),
    ],
    outcomeNodeIds: ["N-revenue"],
  });
  assert.ok(r.includes("downstream_no_es_raiz"));
});

test("§51 y §52: que lo proponga un agente no es evidencia", () => {
  const r = reglas({
    hypotheses: [
      causal({ confidence: "medium", proposing_agent: "a03_analista_adquisicion" }),
      hip({ hypothesis_id: "H-2", code: "H2" }),
    ],
  });
  assert.ok(r.includes("agente_no_es_evidencia"));
});

test("§12: con incertidumbre material el challenger sigue vivo", () => {
  const r = reglas({
    hypotheses: [
      causal({ status: "supported", confidence: "medium" }),
      hip({ hypothesis_id: "H-2", code: "H2", relative_role: "secondary" }),
    ],
    evidence: [
      hypothesisEvidenceSchema.parse({
        evidence_id: "EV-1", hypothesis_id: "H-1", relation: "contradicts",
      }),
    ],
  });
  assert.ok(r.includes("challenger_retirado_pronto"));
});

test("§41 y §42: dos formas de decir lo mismo no son dos hipotesis", () => {
  const r = reglas({
    hypotheses: [
      causal({ status: "under_test", target_node_id: "N-cac" }),
      causal({ hypothesis_id: "H-2", code: "H2", status: "under_test", target_node_id: "N-cac" }),
    ],
  });
  assert.ok(r.includes("doble_conteo"));
});

test("§48 y §49: lo barato y mas informativo va primero", () => {
  const r = reglas({
    hypotheses: [causal(), hip({ hypothesis_id: "H-2", code: "H2" })],
    tests: [
      diagnosticTestSchema.parse({
        test_id: "T-caro", hypothesis_id: "H-1",
        diagnostic_question: "Nos pasais el desglose de la agencia?",
        expected_if_true: "El desglose muestra subida de puja en agosto",
        expected_if_false: "El desglose no muestra cambios de puja",
        cost: "high", mode: "active", availability: "needs_user",
      }),
      diagnosticTestSchema.parse({
        test_id: "T-barato", hypothesis_id: "H-1",
        diagnostic_question: "Que dice nuestro propio historico de CPM?",
        expected_if_true: "El CPM medio de agosto supera al de julio",
        expected_if_false: "El CPM medio se mantiene en el rango de julio",
        cost: "low", mode: "passive", information_gain: "high", availability: "available",
      }),
    ],
  });
  assert.ok(r.includes("evidencia_barata_primero"));
});

// --- Lo estructural --------------------------------------------------------

test("§4, §25 y §45: no hay donde escribir causa raiz, accion ni prioridad", () => {
  const campos = Object.keys(engineHypothesisFields.shape);
  for (const prohibido of ["root_cause", "is_root_cause", "action", "recommendation", "priority", "severity"]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" esta fuera de la frontera de D08`);
  }
  // Lo que si existe es la candidata, que es otra cosa (guardrail 4).
  assert.ok(campos.includes("root_cause_candidate"));
});

test("§2, §6 y §13: prior, confianza y cobertura son tres campos distintos", () => {
  const campos = Object.keys(engineHypothesisFields.shape);
  for (const necesario of ["prior_plausibility", "confidence", "explanatory_coverage"]) {
    assert.ok(campos.includes(necesario), `falta "${necesario}"`);
  }
});

test("la hipotesis del motor es la misma del caso de D00, no otra", () => {
  const caso = toCaseHypothesis(causal({ status: "invalidated", rejection_reason: "El CPM no subio" }));
  assert.equal(caso.code, "H1");
  assert.equal(caso.status, "invalidated");
});
