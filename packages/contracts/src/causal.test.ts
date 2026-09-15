/**
 * FASE 3 / D07: el grafo causal.
 *
 * Casi todos estos tests reproducen el mismo error con disfraces distintos:
 * pasar de "encaja" a "es". Coincidir en el tiempo, descomponer una formula,
 * encontrar la primera ruta que cuadra -- ninguna de las tres es una causa.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkCausalInvariants,
  causalNodeSchema,
  causalEdgeSchema,
  causalEdgeFields,
  causalPathSchema,
  causalPathFields,
  causalPathStepSchema,
  causalEvidenceSchema,
  evidenceRank,
  CASE_EVIDENCE_LEVELS,
  type CausalCheckInput,
} from "./causal.js";

const nodo = (over: Record<string, unknown> = {}) =>
  causalNodeSchema.parse({
    node_id: "N-cpc",
    code: "cpc",
    label: "CPC",
    node_type: "metric",
    ...over,
  });

const arista = (over: Record<string, unknown> = {}) =>
  causalEdgeSchema.parse({
    edge_id: "E-1",
    from_node_id: "N-cpm",
    to_node_id: "N-cpc",
    relation_type: "economic",
    mechanism:
      "Un CPM mas alto encarece cada mil impresiones y, si el CTR se mantiene, cada clic cuesta mas",
    diagnostic_rationale: "Separa un problema de subasta de uno creativo",
    ...over,
  });

const ruta = (over: Record<string, unknown> = {}) =>
  causalPathSchema.parse({ path_id: "P-1", target_node_id: "N-cpc", ...over });

const paso = (over: Record<string, unknown> = {}) =>
  causalPathStepSchema.parse({
    step_id: "S-1",
    path_id: "P-1",
    edge_id: "E-1",
    step_order: 1,
    ...over,
  });

const reglas = (input: CausalCheckInput) =>
  checkCausalInvariants(input).map((x) => x.rule);

// --- El contrato de la fila ------------------------------------------------

test("una arista con mecanismo y utilidad declarada entra sin ruido", () => {
  assert.ok(arista());
  assert.deepEqual(reglas({ paths: [ruta()] }), []);
});

test("§7 y §9: sin mecanismo no hay arista causal", () => {
  assert.throws(() =>
    causalEdgeSchema.parse({
      edge_id: "E-2",
      from_node_id: "N-a",
      to_node_id: "N-b",
      relation_type: "economic",
      diagnostic_rationale: "Para algo sirve",
    }),
  );
  // Y un eslogan tampoco es un mecanismo.
  assert.throws(() => arista({ edge_id: "E-3", mechanism: "Sube el coste" }));
});

test("§8: una correlacion sin mecanismo tiene techo", () => {
  assert.throws(() =>
    causalEdgeSchema.parse({
      edge_id: "E-4",
      from_node_id: "N-a",
      to_node_id: "N-b",
      relation_type: "temporal",
      edge_kind: "unvalidated_relation",
      evidence_level: "strongly_established",
      strength: "strong",
    }),
  );
  // Declarada como lo que es, si cabe en el grafo.
  assert.ok(
    causalEdgeSchema.parse({
      edge_id: "E-5",
      from_node_id: "N-a",
      to_node_id: "N-b",
      relation_type: "temporal",
      edge_kind: "unvalidated_relation",
      evidence_level: "speculative",
      strength: "weak",
    }),
  );
});

test("§45: una heuristica de experto no llega a conocimiento establecido", () => {
  assert.throws(() =>
    arista({ edge_id: "E-6", knowledge_source: "expert_heuristic", evidence_level: "strongly_established" }),
  );
});

test("§13: una recomendacion no es un nodo causal", () => {
  assert.throws(() =>
    causalNodeSchema.parse({
      node_id: "N-x",
      code: "increase_budget",
      label: "Subir presupuesto",
      node_type: "state",
    }),
  );
});

test("§12, §14 y §17: un nodo latente tiene que explicar como se sabe algo de el", () => {
  assert.throws(() =>
    causalNodeSchema.parse({
      node_id: "N-brand",
      code: "brand_strength",
      label: "Fuerza de marca",
      node_type: "state",
      observability: "latent",
    }),
  );
});

test("§11 y §39: confianza alta exige confusores revisados y medicion validada", () => {
  assert.throws(() => ruta({ path_confidence: "high" }));
});

test("§50: una ruta con evidencia pendiente no esta soportada", () => {
  assert.throws(() => ruta({ status: "supported", missing_evidence: ["falta el control"] }));
});

test("§40, §41 y §42: un proxy contrafactual no es un experimento", () => {
  assert.throws(() =>
    causalEvidenceSchema.parse({
      evidence_id: "EV-1",
      path_id: "P-1",
      evidence_level: "before_after_with_control",
      observation: "En Portugal no paso",
      counterfactual_source: "control_market",
    }),
  );
  // Con supuestos y comparabilidad declarados, si vale.
  assert.ok(
    causalEvidenceSchema.parse({
      evidence_id: "EV-2",
      path_id: "P-1",
      evidence_level: "before_after_with_control",
      observation: "En Portugal no paso",
      counterfactual_source: "control_market",
      assumptions: "Portugal comparte creatividades y no tuvo cambio de precio",
      control_comparable: true,
    }),
  );
});

// --- Las reglas que miran la ruta entera -----------------------------------

test("§2 y §16: la correlacion sola no sostiene confianza", () => {
  const r = reglas({
    paths: [ruta({ path_confidence: "medium" })],
    evidence: [
      causalEvidenceSchema.parse({
        evidence_id: "EV-3",
        path_id: "P-1",
        evidence_level: "correlation_only",
        observation: "Cayeron a la vez",
      }),
    ],
  });
  assert.ok(r.includes("correlacion_no_sostiene_confianza"));
});

test("§4: descomponer una formula no es explicar", () => {
  const r = reglas({
    paths: [ruta({ status: "supported" })],
    steps: [paso()],
    edges: [
      arista({
        relation_type: "mathematical",
        mechanism: "Revenue es exactamente sesiones por CVR por AOV, por definicion",
      }),
    ],
  });
  assert.ok(r.includes("linaje_no_es_explicacion"));
});

test("§50: un paso sin comprobar no se tapa con la confianza de la ruta", () => {
  const r = reglas({
    paths: [
      ruta({ path_confidence: "high", confounders_reviewed: true, measurement_validated: true }),
    ],
    steps: [paso({ case_support: "untested" })],
    edges: [arista()],
  });
  assert.ok(r.includes("eslabon_debil_expuesto"));
});

test("§49: no se da por buena una ruta con las rivales sin tocar", () => {
  const r = reglas({
    paths: [
      ruta({ status: "supported" }),
      ruta({ path_id: "P-2", status: "untested" }),
      ruta({ path_id: "P-3", status: "untested" }),
    ],
  });
  assert.ok(r.includes("rutas_rivales_sin_probar"));
});

test("§49: si las rivales se probaron y se descartaron, la ruta se sostiene", () => {
  const r = reglas({
    paths: [
      ruta({ status: "supported" }),
      ruta({ path_id: "P-2", status: "contradicted" }),
    ],
  });
  assert.deepEqual(r, []);
});

test("§37, §38 y §39: no se diagnostica desde una medicion sin validar", () => {
  const r = reglas({
    paths: [ruta({ status: "supported" })],
    steps: [paso()],
    edges: [arista()],
    nodes: [
      nodo({ node_id: "N-cpm", code: "cpm", label: "CPM" }),
      nodo({ node_id: "N-cpc", measurement_layer: "observed_metric" }),
    ],
  });
  assert.ok(r.includes("medicion_sin_validar_no_diagnostica"));
});

test("§17 y §18: lo latente exige mas evidencia, no la misma", () => {
  const r = reglas({
    paths: [
      ruta({ path_confidence: "high", confounders_reviewed: true, measurement_validated: true }),
    ],
    steps: [paso({ case_support: "supported" })],
    edges: [arista()],
    nodes: [
      nodo({
        node_id: "N-cpm",
        code: "brand_strength",
        label: "Fuerza de marca",
        observability: "latent",
        notes: "Se aproxima por busquedas de marca",
      }),
      nodo(),
    ],
    evidence: [
      causalEvidenceSchema.parse({
        evidence_id: "EV-4",
        path_id: "P-1",
        evidence_level: "multi_source_corroboration",
        observation: "Dos fuentes apuntan igual",
      }),
    ],
  });
  assert.ok(r.includes("latente_exige_mas_evidencia"));
});

test("§19 y §31: usar media interaccion es afirmar que basta por su cuenta", () => {
  const r = reglas({
    paths: [ruta({ status: "supported" })],
    steps: [paso()],
    edges: [
      arista({ interaction_group: "stock_y_precio" }),
      arista({ edge_id: "E-par", from_node_id: "N-precio", interaction_group: "stock_y_precio" }),
    ],
  });
  assert.ok(r.includes("interaccion_incompleta"));
});

test("§33 y §34: un confusor nombrado y no resuelto no convive con un paso bueno", () => {
  const r = reglas({
    paths: [ruta()],
    steps: [paso({ case_support: "supported", confounder_id: "CF-black-friday" })],
    edges: [arista()],
  });
  assert.ok(r.includes("confusor_sin_resolver"));
});

test("§6: coincidir con un evento no es haber sido causado por el", () => {
  const r = reglas({
    paths: [ruta()],
    steps: [paso({ case_support: "supported" })],
    edges: [
      causalEdgeSchema.parse({
        edge_id: "E-1",
        from_node_id: "N-deploy",
        to_node_id: "N-cpc",
        relation_type: "temporal",
        edge_kind: "unvalidated_relation",
        evidence_level: "speculative",
        strength: "weak",
      }),
    ],
  });
  assert.ok(r.includes("coincidir_no_es_causar"));
});

// --- Lo estructural --------------------------------------------------------

test("§46, §47 y §48: no hay donde escribir causa raiz, accion ni prioridad", () => {
  const campos = [
    ...Object.keys(causalPathFields.shape),
    ...Object.keys(causalEdgeFields.shape),
  ];
  for (const prohibido of [
    "root_cause",
    "is_root_cause",
    "action",
    "recommendation",
    "priority",
    "severity",
    "rank",
  ]) {
    assert.ok(
      !campos.includes(prohibido),
      `"${prohibido}" esta fuera de la frontera de D07 (guardrails 46, 47 y 48)`,
    );
  }
});

test("§5: no se guarda centralidad, para que nadie ordene por ella", () => {
  // "GRAPH CENTRALITY != BUSINESS PRIORITY". La forma mas segura de que nadie
  // priorice por betweenness es no tener betweenness.
  const campos = [
    ...Object.keys(causalPathFields.shape),
    ...Object.keys(causalEdgeFields.shape),
  ];
  for (const metrica of ["centrality", "betweenness", "degree", "blast_radius"]) {
    assert.ok(!campos.includes(metrica), `"${metrica}" invita a confundir centralidad con prioridad`);
  }
});

test("§24: la jerarquia de evidencia esta ordenada de fuerte a debil", () => {
  assert.equal(CASE_EVIDENCE_LEVELS[0], "randomized_experiment");
  assert.equal(CASE_EVIDENCE_LEVELS[CASE_EVIDENCE_LEVELS.length - 1], "correlation_only");
  assert.ok(evidenceRank("randomized_experiment") < evidenceRank("correlation_only"));
});

test("§3: el prior de la arista y la confianza del caso son campos distintos", () => {
  // Un edge fuerte en general no hace fuerte el caso concreto.
  assert.ok(Object.keys(causalEdgeFields.shape).includes("strength"));
  assert.ok(Object.keys(causalPathFields.shape).includes("path_confidence"));
  assert.ok(!Object.keys(causalEdgeFields.shape).includes("path_confidence"));
});
