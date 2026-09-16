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
  coverageFromMagnitude,
  generateHypotheses,
  priorFromEdge,
  testFor,
  type EngineHypothesis,
  type HypothesisCheckInput,
  type HypothesisEngineInput,
  type PathForHypothesis,
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

// ---------------------------------------------------------------------------
// EL MOTOR
// ---------------------------------------------------------------------------
//
// Todos estos tests persiguen la misma tentacion con disfraces distintos:
// **quedarse con una**. Elegir la que mejor encaja, retirar el challenger,
// contar el hueco de una rama como si fuera evidencia en su contra. Las tres
// convierten una lista de candidatas en un diagnostico que nadie ha hecho.

const rutaH = (over: Partial<PathForHypothesis> = {}): PathForHypothesis => ({
  path_id: "P1",
  target_node_id: "N-ns",
  target_label: "Ventas netas",
  origin_node_id: "N-oc",
  status: "partial",
  missing_evidence: ["Los confusores declarados en D02 no se han revisado."],
  next_evidence: "Un contraste contra un periodo de control.",
  origin_code: "orders_count",
  origin_label: "Pedidos",
  origin_measured: true,
  origin_is_observed_metric: false,
  capability: "conversion",
  mediator_labels: [],
  temporal_fit: "fits",
  scope_fit: "compatible",
  magnitude_fit: "partial",
  relation_type: "mathematical",
  edge_evidence_level: "deterministic",
  all_mathematical: true,
  evidence: [{ stance: "supporting", observation: "Da cuenta del 50% del movimiento." }],
  ...over,
});

const entradaH = (paths: PathForHypothesis[]): HypothesisEngineInput => ({
  caseId: "C-1",
  targetMetric: "net_sales",
  scope: "business_global",
  paths,
});

test("una rama descartada sobrevive como hipotesis, con su motivo escrito", () => {
  // Es la mitad del valor del bloque. Sin esto, dentro de un mes alguien vuelve
  // a mirar los pedidos porque nadie guardo que ya se habian mirado.
  const hs = generateHypotheses(
    entradaH([
      rutaH({
        status: "contradicted",
        evidence: [
          {
            stance: "contradicting",
            observation: '"Ventas netas" empezo a moverse antes que "Pedidos".',
          },
        ],
      }),
    ]),
  );

  assert.equal(hs[0]?.status, "contradicted");
  assert.match(hs[0]?.rejection_reason ?? "", /empezo a moverse antes/);
  // Y no se le propone test: gastar en comprobar lo ya descartado es el gasto
  // mas facil de evitar.
  assert.equal(hs[0]?.test, null);
});

test("lo que nadie ha mirado no cuenta como evidencia en contra", () => {
  // Guardrail 5, y el error que mas veces se cuela. `not_observed` con
  // `inconclusive`: ni apoya ni contradice, porque nadie fue a ver.
  const hs = generateHypotheses(
    entradaH([
      rutaH({
        status: "untested",
        origin_node_id: "N-aov",
        origin_code: "average_order_value",
        origin_label: "Ticket medio",
        origin_measured: false,
        magnitude_fit: "untested",
        evidence: [],
      }),
    ]),
  );

  const hueco = hs[0]?.evidence.find((e) => e.observation_kind === "not_observed");
  assert.ok(hueco, "el hueco se registra");
  assert.equal(hueco?.relation, "inconclusive");
  assert.ok(hs[0]?.evidence.every((e) => e.relation !== "contradicts"));
  assert.equal(hs[0]?.status, "untested");
  assert.equal(hs[0]?.confidence, "insufficient");
});

test("el prior sale de la arista, no de lo bien que encaje con el caso", () => {
  // Guardrail 2: "esto suele pasar" y "esto esta pasando" son dos columnas.
  assert.equal(priorFromEdge("deterministic"), "high");
  assert.equal(priorFromEdge("common_mechanism"), "medium");
  assert.equal(priorFromEdge("plausible"), "low");
  assert.equal(priorFromEdge("speculative"), "unknown");

  // Una ruta con prior alto y encaje flojo conserva las dos cosas separadas.
  const hs = generateHypotheses(
    entradaH([rutaH({ edge_evidence_level: "deterministic", magnitude_fit: "partial" })]),
  );
  assert.equal(hs[0]?.prior_plausibility, "high");
  assert.equal(hs[0]?.confidence, "low");
});

test("ninguna explicacion llega a completa, y el residual se escribe", () => {
  // Aunque el factor de cuenta del movimiento entero, por que se movio el factor
  // sigue sin explicarse. El check `cobertura_vs_residual` no dejaria mentir.
  assert.equal(coverageFromMagnitude("sufficient"), "partial");
  assert.equal(coverageFromMagnitude("partial"), "minimal");
  assert.equal(coverageFromMagnitude("untested"), "unknown");

  const hs = generateHypotheses(entradaH([rutaH({ magnitude_fit: "sufficient" })]));
  assert.notEqual(hs[0]?.explanatory_coverage, "full");
  assert.equal(hs[0]?.unexplained_residual_material, true);
  assert.match(hs[0]?.residual_note ?? "", /sigue sin explicarse/);
});

test("la hipotesis de que no haya pasado nada se escribe sola", () => {
  // El challenger del guardrail 12, y la unica que puede tumbar a todas de
  // golpe. Si dependiera de que alguien se acuerde, no estaria nunca.
  const hs = generateHypotheses(
    entradaH([
      rutaH(),
      rutaH({
        path_id: "P2",
        origin_node_id: "N-se",
        origin_code: "sessions",
        origin_label: "Sesiones",
        origin_is_observed_metric: true,
      }),
    ]),
  );

  const challenger = hs.find((h) => h.hypothesis_type === "data_quality_explanation");
  assert.ok(challenger, "tiene que existir");
  assert.equal(challenger?.relative_role, "challenger");
  assert.equal(challenger?.source_path_id, null);
  assert.match(challenger?.statement ?? "", /Puede que no haya caido nada/);
  // Y su test contrasta contra una fuente que no dependa del tracking.
  assert.match(challenger?.test?.diagnostic_question ?? "", /no dependa del tracking/);
});

test("sin metricas de tracking no se inventa el challenger", () => {
  // La otra mitad: una hipotesis que siempre esta deja de significar nada.
  const hs = generateHypotheses(entradaH([rutaH()]));
  assert.ok(hs.every((h) => h.hypothesis_type !== "data_quality_explanation"));
});

test("con varias en pie, la separacion es baja y se dice", () => {
  // Que no sepamos distinguirlas es un hecho conocido, no una incognita.
  // Ponerlo `unknown` seria suavizarlo.
  const hs = generateHypotheses(
    entradaH([rutaH(), rutaH({ path_id: "P2", origin_node_id: "N-aov", origin_label: "Ticket medio" })]),
  );

  assert.ok(hs.every((h) => h.separation === "low"));
  assert.ok(hs.every((h) => h.relative_role != null));
  // Y ninguna es primaria: elegir seria decidir, y decidir es D09.
  assert.ok(hs.every((h) => h.relative_role !== "primary"));
});

test("ninguna se afirma, y ninguna es candidata a raiz", () => {
  // Guardrail 43: un factor de la formula es donde se ve el problema, no de
  // donde viene.
  const hs = generateHypotheses(
    entradaH([rutaH({ magnitude_fit: "sufficient" }), rutaH({ path_id: "P2", origin_node_id: "N-aov" })]),
  );

  for (const h of hs) {
    assert.ok(!["supported", "most_likely", "confirmed"].includes(h.status), h.code);
    assert.equal(h.root_cause_candidate, false);
    assert.ok(h.falsification_condition, "toda hipotesis dice que la falsaria");
  }
});

test("no se pide fuera un dato que la plataforma ya tiene", () => {
  // Guardrails 46 y 47, y el check `no_preguntar_lo_que_ya_hay`: si esta
  // disponible, el test es pasivo.
  const conSerie = testFor(rutaH());
  assert.equal(conSerie?.availability, "available");
  assert.equal(conSerie?.mode, "passive");

  // Y cuando falta la serie, no es que haya que preguntarle a nadie: falta
  // conectar la fuente. Confundirlo manda al consultor a molestar al cliente.
  const sinSerie = testFor(rutaH({ origin_measured: false }));
  assert.equal(sinSerie?.availability, "needs_integration");
  assert.equal(sinSerie?.mode, "passive");
  assert.equal(sinSerie?.information_gain, "high");
});

test("todo test dice que se veria si es verdad y que si es mentira", () => {
  // Un test cuyo resultado encaja con las dos cosas no discrimina nada, y el
  // check exige diez caracteres en cada prediccion para que no se despache.
  for (const ruta of [rutaH(), rutaH({ origin_measured: false })]) {
    const t = testFor(ruta);
    assert.ok((t?.expected_if_true.length ?? 0) >= 10);
    assert.ok((t?.expected_if_false.length ?? 0) >= 10);
    assert.notEqual(t?.expected_if_true, t?.expected_if_false);
  }
});

test("una identidad aritmetica no tiene mecanismo que encaje", () => {
  // Decir que "encaja" seria contar la formula como si explicara. El eje no
  // aplica, y `unknown` no afirma nada.
  const aritmetica = generateHypotheses(entradaH([rutaH({ all_mathematical: true })]));
  assert.equal(aritmetica[0]?.mechanism_fit, "unknown");
  assert.equal(aritmetica[0]?.hypothesis_type, "contributory_cause");

  const conMecanismo = generateHypotheses(
    entradaH([rutaH({ all_mathematical: false, relation_type: "economic" })]),
  );
  assert.equal(conMecanismo[0]?.mechanism_fit, "untested");
  assert.equal(conMecanismo[0]?.hypothesis_type, "direct_cause");
});

test("lo que el motor escribe pasa los invariantes del propio bloque", () => {
  // El circulo cerrado: si el motor produjera algo que checkHypothesisInvariants
  // rechaza, el bloque se estaria saltando su contrato.
  const hs = generateHypotheses(
    entradaH([
      rutaH(),
      rutaH({
        path_id: "P2",
        origin_node_id: "N-se",
        origin_code: "sessions",
        origin_label: "Sesiones",
        origin_is_observed_metric: true,
      }),
      rutaH({
        path_id: "P3",
        origin_node_id: "N-aov",
        status: "contradicted",
        evidence: [{ stance: "contradicting", observation: "No encaja en el tiempo." }],
      }),
    ]),
  );

  const violaciones = checkHypothesisInvariants({
    hypotheses: hs.map((h, i) =>
      engineHypothesisSchema.parse({
        hypothesis_id: `H-${i}`,
        code: h.code,
        statement: h.statement,
        hypothesis_type: h.hypothesis_type,
        source_path_id: h.source_path_id ?? undefined,
        target_node_id: h.target_node_id ?? undefined,
        status: h.status,
        rejection_reason: h.rejection_reason ?? undefined,
        confidence: h.confidence,
        prior_plausibility: h.prior_plausibility,
        explanatory_coverage: h.explanatory_coverage,
        unexplained_residual_material: h.unexplained_residual_material,
        root_cause_candidate: h.root_cause_candidate,
        relative_role: h.relative_role ?? undefined,
        separation: h.separation,
        uncertainty_kinds: h.uncertainty_kinds,
        falsification_condition: h.falsification_condition ?? undefined,
      }),
    ),
    evidence: hs.flatMap((h, i) =>
      h.evidence.map((e, j) =>
        hypothesisEvidenceSchema.parse({
          evidence_id: `E-${i}-${j}`,
          hypothesis_id: `H-${i}`,
          relation: e.relation,
          source_system: e.source_system,
          observation_kind: e.observation_kind,
          freshness: e.freshness,
        }),
      ),
    ),
    tests: hs.flatMap((h, i) =>
      h.test
        ? [
            diagnosticTestSchema.parse({
              test_id: `T-${i}`,
              hypothesis_id: `H-${i}`,
              diagnostic_question: h.test.diagnostic_question,
              expected_if_true: h.test.expected_if_true,
              expected_if_false: h.test.expected_if_false,
              information_gain: h.test.information_gain,
              cost: h.test.cost,
              availability: h.test.availability,
              mode: h.test.mode,
            }),
          ]
        : [],
    ),
  });

  assert.deepEqual(violaciones, []);
});

test("una cadena de dos saltos no se cuenta como una relacion directa", () => {
  // Fallo real de la primera corrida: la frase decia que las sesiones entran en
  // la formula de las ventas. Entran en la de los pedidos, y los pedidos en la
  // de las ventas. Aplanarlo inventa una relacion que nadie declaro.
  const directa = generateHypotheses(entradaH([rutaH()]));
  assert.doesNotMatch(directa[0]?.statement ?? "", /a traves de/);

  const encadenada = generateHypotheses(
    entradaH([
      rutaH({
        origin_node_id: "N-se",
        origin_label: "Sesiones",
        mediator_labels: ["Pedidos"],
      }),
    ]),
  );
  assert.match(encadenada[0]?.statement ?? "", /"Sesiones", a traves de "Pedidos"/);
});
