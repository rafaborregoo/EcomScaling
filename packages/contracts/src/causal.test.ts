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
  exploreCausalPaths,
  type CausalCheckInput,
  type CausalEngineInput,
  type SignalForCausal,
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

// ---------------------------------------------------------------------------
// EL MOTOR
// ---------------------------------------------------------------------------
//
// El fallo que persiguen estos tests es uno solo con dos caras: **convertir
// "no lo se" en "no lo hay"**, y **presentar una descomposicion como una
// explicacion**. Las dos podan la rama correcta por el motivo equivocado.

const N = {
  net_sales: {
    node_id: "N-ns",
    code: "net_sales",
    label: "Ventas netas",
    observability: "derived" as const,
    measurement_layer: "real_world" as const,
  },
  orders: {
    node_id: "N-oc",
    code: "orders_count",
    label: "Pedidos",
    observability: "directly_observed" as const,
    measurement_layer: "real_world" as const,
  },
  aov: {
    node_id: "N-aov",
    code: "average_order_value",
    label: "Ticket medio",
    observability: "derived" as const,
    measurement_layer: "real_world" as const,
  },
  sessions: {
    node_id: "N-se",
    code: "sessions",
    label: "Sesiones",
    observability: "directly_observed" as const,
    measurement_layer: "observed_metric" as const,
  },
};

const E = {
  ordersToSales: {
    edge_id: "E-oc-ns",
    from_node_id: "N-oc",
    to_node_id: "N-ns",
    relation_type: "mathematical" as const,
    expected_sign: "positive" as const,
    expected_lag_days: 0,
    edge_kind: "causal" as const,
  },
  aovToSales: {
    edge_id: "E-aov-ns",
    from_node_id: "N-aov",
    to_node_id: "N-ns",
    relation_type: "mathematical" as const,
    expected_sign: "positive" as const,
    expected_lag_days: 0,
    edge_kind: "causal" as const,
  },
  sessionsToOrders: {
    edge_id: "E-se-oc",
    from_node_id: "N-se",
    to_node_id: "N-oc",
    relation_type: "mathematical" as const,
    expected_sign: "positive" as const,
    expected_lag_days: 0,
    edge_kind: "causal" as const,
  },
};

const senal = (over: Partial<SignalForCausal> = {}): SignalForCausal => ({
  metric: "net_sales",
  direction: "down",
  scope: "business",
  window_start: "2026-09-01T00:00:00.000Z",
  window_end: "2026-09-14T00:00:00.000Z",
  magnitude_relative: -0.2,
  ...over,
});

const entrada = (over: Partial<CausalEngineInput> = {}): CausalEngineInput => ({
  caseId: "C-1",
  symptomId: null,
  targetCode: "net_sales",
  targetScope: "business",
  nodes: [N.net_sales, N.orders, N.aov],
  edges: [E.ordersToSales, E.aovToSales],
  signals: [senal()],
  measuredMetrics: ["net_sales", "orders_count"],
  ...over,
});

test("una metrica que se vigila y no se movio contradice su rama", () => {
  // El hallazgo que justifica el bloque: las ventas cayeron, los pedidos se
  // miran y no emitieron senal, luego lo que se hundio es el ticket.
  const rutas = exploreCausalPaths(entrada());
  const porPedidos = rutas.find((r) => r.steps[0]?.edge_id === "E-oc-ns");

  assert.equal(porPedidos?.status, "contradicted");
  assert.equal(porPedidos?.evidence[0]?.stance, "contradicting");
  assert.match(porPedidos?.evidence[0]?.observation ?? "", /se vigila y no emitio senal/);
});

test("una metrica que nadie mide deja su rama SIN PROBAR, no contradicha", () => {
  // La misma ausencia de senal, leida al reves segun si alguien miraba. Es la
  // diferencia entre podar una rama y no haberla mirado nunca.
  const rutas = exploreCausalPaths(entrada());
  const porTicket = rutas.find((r) => r.steps[0]?.edge_id === "E-aov-ns");

  assert.equal(porTicket?.status, "untested");
  assert.equal(porTicket?.path_confidence, "insufficient_data");
  assert.equal(porTicket?.evidence.length, 0);
  assert.ok(
    porTicket?.missing_evidence.some((m) => /Nadie mide "Ticket medio"/.test(m)),
    "tiene que decir quien no se mide",
  );
});

test("ninguna ruta llega a soportada hoy, y el motivo va escrito", () => {
  // No es pesimismo: el guardrail 50 dice que una ruta con huecos declarados no
  // esta soportada, y los confusores de D02 no los ha mirado nadie.
  const rutas = exploreCausalPaths(
    entrada({
      signals: [senal(), senal({ metric: "orders_count", magnitude_relative: -0.2 })],
    }),
  );

  assert.ok(rutas.every((r) => r.status !== "supported"));
  for (const r of rutas) {
    assert.ok(r.missing_evidence.length > 0);
  }
  const porPedidos = rutas.find((r) => r.steps[0]?.edge_id === "E-oc-ns");
  assert.ok(
    porPedidos?.missing_evidence.some((m) => /confusores/.test(m)),
    "lo que no se ha revisado se dice",
  );
});

test("una ruta de pura aritmetica dice que descompone, no que explica", () => {
  // Guardrail 4. `checkCausalInvariants` ya lo castiga si alguien la declara
  // soportada; el motor ni siquiera llega a intentarlo, y lo escribe.
  const rutas = exploreCausalPaths(
    entrada({
      signals: [senal(), senal({ metric: "orders_count", magnitude_relative: -0.2 })],
    }),
  );
  const porPedidos = rutas.find((r) => r.steps[0]?.edge_id === "E-oc-ns");

  assert.ok(
    porPedidos?.missing_evidence.some((m) => /descompone el movimiento, no lo explica/.test(m)),
  );
});

test("la cuota aritmetica sale del cociente, no de un corte elegido", () => {
  // Los pedidos cayeron la mitad de lo que cayeron las ventas: dan cuenta de la
  // mitad del movimiento, y por tanto hay otra causa a la vez.
  const rutas = exploreCausalPaths(
    entrada({
      signals: [senal(), senal({ metric: "orders_count", magnitude_relative: -0.1 })],
    }),
  );
  const paso = rutas.find((r) => r.steps[0]?.edge_id === "E-oc-ns")?.steps[0];

  assert.equal(paso?.magnitude_fit, "partial");
  assert.equal(paso?.cause_role, "contributory");
  assert.match(paso?.contribution_note ?? "", /50%/);
});

test("moverse al reves no explica: la rama queda contradicha", () => {
  // Las ventas caen y los pedidos suben. El factor no da cuenta del movimiento,
  // lo empeora -- y una cuota negativa no es una cuota pequena.
  const rutas = exploreCausalPaths(
    entrada({
      signals: [senal(), senal({ metric: "orders_count", magnitude_relative: 0.1 })],
    }),
  );
  const ruta = rutas.find((r) => r.steps[0]?.edge_id === "E-oc-ns");

  assert.equal(ruta?.steps[0]?.magnitude_fit, "insufficient");
  assert.equal(ruta?.status, "contradicted");
  assert.equal(ruta?.path_confidence, "low");
});

test("si el efecto empezo antes que la causa, la causa no explica el arranque", () => {
  // Guardrails 19 y 20. No se prohibe registrarlo: se prohibe registrarlo como
  // si encajara, y el check de la tabla lo exige.
  const rutas = exploreCausalPaths(
    entrada({
      signals: [
        senal({ window_start: "2026-09-01T00:00:00.000Z" }),
        senal({
          metric: "orders_count",
          window_start: "2026-09-08T00:00:00.000Z",
          magnitude_relative: -0.2,
        }),
      ],
    }),
  );
  const paso = rutas.find((r) => r.steps[0]?.edge_id === "E-oc-ns")?.steps[0];

  assert.equal(paso?.temporal_fit, "contradicted");
  assert.equal(paso?.observed_lag_days, -7);
  assert.equal(paso?.case_support, "contradicted");
});

test("lo que rompio la ruta manda sobre lo que le falta por pulir", () => {
  // Un fallo real de la primera corrida: la rama salia descartada por tiempo y
  // el "siguiente dato" hablaba de magnitud. Mandaba a mirar donde no era.
  const rutas = exploreCausalPaths(
    entrada({
      signals: [
        senal({ window_start: "2026-09-01T00:00:00.000Z" }),
        senal({
          metric: "orders_count",
          window_start: "2026-09-03T00:00:00.000Z",
          magnitude_relative: -0.1,
        }),
      ],
    }),
  );
  const ruta = rutas.find((r) => r.steps[0]?.edge_id === "E-oc-ns");

  // La pregunta util es que se movio en esos dos dias, no que explica el resto.
  assert.match(ruta?.next_evidence ?? "", /2 dia\(s\) en que el efecto ya caia/);
  assert.match(
    ruta?.evidence[0]?.observation ?? "",
    /empezo a moverse antes que "Pedidos"/,
  );
  assert.equal(ruta?.evidence[0]?.stance, "contradicting");
});

test("el recorrido no sigue hacia arriba por una rama ya podada", () => {
  // Perseguir la causa de una causa descartada produce cadenas largas y falsas.
  const rutas = exploreCausalPaths(
    entrada({
      nodes: [N.net_sales, N.orders, N.aov, N.sessions],
      edges: [E.ordersToSales, E.aovToSales, E.sessionsToOrders],
    }),
  );

  // Sin senal de pedidos (que si se vigilan), la rama muere ahi: nadie sube a
  // sesiones.
  assert.ok(rutas.every((r) => !r.steps.some((s) => s.edge_id === "E-se-oc")));
});

test("pasar por una metrica observada obliga a decir que la medicion no se valido", () => {
  // Guardrails 37-39: un fallo de tracking mueve las sesiones sin mover el
  // negocio, y una ruta que lo ignora diagnostica una averia que no existe.
  const rutas = exploreCausalPaths(
    entrada({
      nodes: [N.net_sales, N.orders, N.aov, N.sessions],
      edges: [E.ordersToSales, E.aovToSales, E.sessionsToOrders],
      measuredMetrics: ["net_sales", "orders_count", "sessions"],
      signals: [
        senal(),
        senal({ metric: "orders_count", magnitude_relative: -0.2 }),
        senal({ metric: "sessions", magnitude_relative: -0.2 }),
      ],
    }),
  );
  const larga = rutas.find((r) => r.steps.some((s) => s.edge_id === "E-se-oc"));

  assert.ok(larga, "la cadena de dos pasos tiene que existir");
  assert.equal(larga?.measurement_validated, false);
  assert.ok(
    larga?.missing_evidence.some((m) => /metrica observada/.test(m)),
    "la capa de medida se declara",
  );
  // Y el paso intermedio es mediador, no el final.
  assert.equal(larga?.steps[0]?.is_mediator, true);
  assert.equal(larga?.steps[1]?.is_mediator, false);
});

test("la explicacion corta y sostenida no se diluye en la extension mas larga", () => {
  // El fallo real que aparecio corriendo D07 encadenado con D09: "pedidos
  // explican la mitad, con encaje perfecto" solo se veia disuelto dentro de
  // "sesiones -> pedidos -> ventas", que nadie mide. Preservar alternativas
  // (paso 15) incluye la version corta, no solo las rivales del mismo largo.
  const rutas = exploreCausalPaths(
    entrada({
      nodes: [N.net_sales, N.orders, N.aov, N.sessions],
      edges: [E.ordersToSales, E.aovToSales, E.sessionsToOrders],
      signals: [senal(), senal({ metric: "orders_count", magnitude_relative: -0.1 })],
    }),
  );

  const corta = rutas.find(
    (r) => r.steps.length === 1 && r.steps[0]?.edge_id === "E-oc-ns",
  );
  const larga = rutas.find((r) => r.steps.some((s) => s.edge_id === "E-se-oc"));

  assert.ok(corta, "la ruta de un solo paso, bien sostenida, tiene que existir por si sola");
  assert.equal(corta?.steps[0]?.magnitude_fit, "partial");
  assert.ok(larga, "la extension hacia sesiones tambien se conserva, como rival");
  // Son rutas distintas, no la misma contada dos veces.
  assert.notEqual(corta, larga);
});

test("se conservan las rutas rivales, no solo la que encaja", () => {
  // Guardrail 49. Devolver la mejor seria elegir la primera que cuadro.
  const rutas = exploreCausalPaths(
    entrada({
      signals: [senal(), senal({ metric: "orders_count", magnitude_relative: -0.2 })],
    }),
  );

  assert.equal(rutas.length, 2);
  assert.deepEqual(
    rutas.map((r) => r.status).sort(),
    ["partial", "untested"],
  );
});

test("el siguiente dato es uno, no una lista", () => {
  // El campo existe para decidir que se mide manana; diez pendientes no deciden.
  const rutas = exploreCausalPaths(entrada());
  for (const r of rutas) {
    assert.equal(typeof r.next_evidence, "string");
    assert.ok((r.next_evidence ?? "").length > 0);
  }
  const porTicket = rutas.find((r) => r.steps[0]?.edge_id === "E-aov-ns");
  assert.match(porTicket?.next_evidence ?? "", /serie diaria de "Ticket medio"/);
});

test("lo que el motor escribe pasa los invariantes del propio bloque", () => {
  // La comprobacion que cierra el circulo: si el motor produjera una ruta que
  // checkCausalInvariants rechaza, el bloque se estaria saltando su contrato.
  const rutas = exploreCausalPaths(
    entrada({
      signals: [senal(), senal({ metric: "orders_count", magnitude_relative: -0.2 })],
    }),
  );

  const nodos = [N.net_sales, N.orders, N.aov].map((n) =>
    causalNodeSchema.parse({ ...n, node_type: "metric" }),
  );
  const aristas = [E.ordersToSales, E.aovToSales].map((e) =>
    causalEdgeSchema.parse({
      ...e,
      mechanism: "Identidad aritmetica entre las dos metricas declarada en la semilla del grafo.",
      diagnostic_rationale: "Separa una caida de pedidos de una caida de ticket.",
    }),
  );

  const violaciones = checkCausalInvariants({
    paths: rutas.map((r, i) =>
      causalPathSchema.parse({
        path_id: `P-${i}`,
        target_node_id: r.target_node_id,
        status: r.status,
        path_confidence: r.path_confidence,
        missing_evidence: r.missing_evidence,
        confounders_reviewed: r.confounders_reviewed,
        measurement_validated: r.measurement_validated,
      }),
    ),
    steps: rutas.flatMap((r, i) =>
      r.steps.map((s) =>
        causalPathStepSchema.parse({
          step_id: `S-${i}-${s.step_order}`,
          path_id: `P-${i}`,
          edge_id: s.edge_id,
          step_order: s.step_order,
          case_support: s.case_support,
          temporal_fit: s.temporal_fit,
          scope_fit: s.scope_fit,
          magnitude_fit: s.magnitude_fit,
          is_mediator: s.is_mediator,
        }),
      ),
    ),
    edges: aristas,
    nodes: nodos,
  });

  assert.deepEqual(violaciones, []);
});
