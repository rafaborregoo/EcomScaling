/**
 * FASE 3 / D09: causa raiz y constraint.
 *
 * El bloque que cierra. Casi todos estos tests comprueban lo mismo por sitios
 * distintos: que cerrar cueste. Pararse en la causa inmediata, subir a un driver
 * abstracto sin evidencia, llamar constraint a una debilidad o dar por hecho que
 * no hay cuello sin haberlo buscado son cuatro formas de cerrar barato.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkRootCauseInvariants,
  rootCauseFields,
  rootCauseSchema,
  businessConstraintFields,
  businessConstraintSchema,
  constraintTestSchema,
  chainStepSchema,
  CHAIN_ROLES,
  DEFINITIVE_LANGUAGE,
  BLAME_LANGUAGE,
  generateRootCauses,
  familyFromCapability,
  weakestLink,
  generateConstraintCandidates,
  constraintTypeFromCapability,
  type RootCause,
  type BusinessConstraint,
  type RootCauseCheckInput,
  type ChainNodeInput,
  type RootCauseCandidateInput,
  type RootCauseEngineInput,
  type ConstraintCandidateInput,
} from "./root-cause.js";

function causa(over: Partial<RootCause> = {}): RootCause {
  return rootCauseSchema.parse({
    root_cause_id: "RC-1",
    code: "RC1",
    statement: "La planificacion de compra no mira la estacionalidad",
    family: "inventory",
    cause_type: "planning",
    ...over,
  });
}

const afirmada = (over: Partial<RootCause> = {}) =>
  causa({ status: "probable", causal_path_id: "P-1", ...over });

function cuello(over: Partial<BusinessConstraint> = {}): BusinessConstraint {
  return businessConstraintSchema.parse({
    constraint_id: "CN-1",
    code: "CN1",
    statement: "La reposicion no da para el ritmo de ventas",
    constraint_type: "inventory",
    target: "revenue",
    ...over,
  });
}

const vinculante = (over: Partial<BusinessConstraint> = {}) =>
  cuello({
    binding_status: "binding",
    limits_target: true,
    capacity: "400 uds/semana",
    demand_on_capacity: "900 uds/semana",
    falsifier: "Si se dobla la reposicion y las ventas no suben, no era el cuello",
    counterfactual_result: "Al doblar reposicion en piloto, las ventas subieron un 22%",
    ...over,
  });

const reglas = (input: RootCauseCheckInput) =>
  checkRootCauseInvariants(input).map((x) => x.rule);

// --- El contrato de la fila ------------------------------------------------

test("una causa sin afirmar y un cuello latente no disparan nada", () => {
  assert.deepEqual(reglas({ rootCauses: [causa()], constraints: [cuello()] }), []);
});

test("§16: una causa afirmada necesita cadena causal soportada", () => {
  assert.throws(() => causa({ status: "probable" }));
  assert.ok(afirmada());
});

test("§12 y §48: confirmar es excepcional", () => {
  assert.throws(() => afirmada({ status: "confirmed" }));
  assert.throws(() => afirmada({ status: "confirmed", confidence: "high" }));
  assert.ok(
    afirmada({
      status: "confirmed",
      confidence: "high",
      hypothesis_id: "H-1",
      limitations: "No se pudo comparar con un mercado control",
    }),
  );
});

test("§24: no hay explicacion completa con residual material", () => {
  assert.throws(() => afirmada({ explanatory_coverage: "full", residual_material: true }));
});

test("§41 y §42: medir mal no es ir mal", () => {
  assert.throws(() =>
    afirmada({ affects_observability_only: true, explanatory_coverage: "partial" }),
  );
  // Como causa de un problema de observabilidad, si cabe.
  assert.ok(afirmada({ affects_observability_only: true, explanatory_coverage: "minimal" }));
});

test("§5 y §28: una debilidad que no limita el target no es un constraint", () => {
  assert.throws(() => cuello({ binding_status: "binding" }));
});

test("§31: declararlo vinculante exige el contrafactual", () => {
  assert.throws(() =>
    cuello({
      binding_status: "binding",
      limits_target: true,
      capacity: "400 uds/semana",
      demand_on_capacity: "900 uds/semana",
    }),
  );
});

test("§29: una capacidad sola no hace cuello; la relacion con la demanda si", () => {
  assert.throws(() =>
    cuello({
      binding_status: "binding",
      limits_target: true,
      falsifier: "Si se dobla la reposicion y no sube, no era",
      counterfactual_result: "Subio un 22%",
    }),
  );
  assert.ok(vinculante());
});

test("§15: un test cuyas dos predicciones dicen lo mismo no distingue nada", () => {
  assert.throws(() =>
    constraintTestSchema.parse({
      test_id: "T-1",
      constraint_id: "CN-1",
      target: "revenue",
      counterfactual_question: "Y si reponemos mas?",
      expected_if_binding: "suben las ventas de forma clara",
      expected_if_not_binding: "suben las ventas de forma clara",
    }),
  );
});

// --- Las reglas que miran el conjunto --------------------------------------

test("§2 y §9: pararse en la causa inmediata es pararse demasiado pronto", () => {
  const r = reglas({
    rootCauses: [afirmada()],
    chain: [
      chainStepSchema.parse({ root_cause_id: "RC-1", step_order: 1, chain_role: "outcome", statement: "Ventas abajo" }),
      chainStepSchema.parse({ root_cause_id: "RC-1", step_order: 2, chain_role: "symptom", statement: "Roturas de stock" }),
      chainStepSchema.parse({ root_cause_id: "RC-1", step_order: 3, chain_role: "immediate_cause", statement: "No habia unidades" }),
    ],
  });
  assert.ok(r.includes("causa_inmediata_no_es_raiz"));
});

test("§10: subir a un driver estructural sin evidencia es inventar", () => {
  const r = reglas({
    rootCauses: [afirmada()],
    chain: [
      chainStepSchema.parse({ root_cause_id: "RC-1", step_order: 1, chain_role: "root_cause", statement: "Compra sin estacionalidad", supported: true }),
      chainStepSchema.parse({ root_cause_id: "RC-1", step_order: 2, chain_role: "structural_driver", statement: "Falta cultura de dato" }),
    ],
  });
  assert.ok(r.includes("driver_estructural_sin_evidencia"));
});

test("§15: la correlacion no cierra una causa", () => {
  const r = reglas({
    rootCauses: [afirmada()],
    evidenceLevels: [{ root_cause_id: "RC-1", level: "correlation_only" }],
  });
  assert.ok(r.includes("correlacion_no_cierra_una_causa"));
});

test("§20: un patron conocido no supera a la evidencia directa", () => {
  const r = reglas({
    rootCauses: [
      afirmada({ status: "confirmed", confidence: "high", hypothesis_id: "H-1", limitations: "Ninguna comparacion control" }),
    ],
    evidenceLevels: [{ root_cause_id: "RC-1", level: "pattern_match" }],
  });
  assert.ok(r.includes("patron_no_supera_evidencia_directa"));
});

test("§46 y §47: el lenguaje se calibra a la confianza", () => {
  const r = reglas({
    rootCauses: [
      afirmada({
        statement: "La caida esta causado por la rotura de stock, sin duda",
        confidence: "low",
      }),
    ],
  });
  assert.ok(r.includes("lenguaje_sin_calibrar"));
});

test("§38, §39 y §40: se describen procesos, no personas", () => {
  const r = reglas({
    rootCauses: [afirmada({ statement: "El de compras se olvido de pedir stock" })],
  });
  assert.ok(r.includes("senala_a_personas"));
});

test("§23: el residual material no se redondea a cero", () => {
  const r = reglas({
    rootCauses: [
      afirmada({ explanatory_coverage: "partial" }),
      afirmada({ root_cause_id: "RC-2", code: "RC2", explanatory_coverage: "partial", residual_material: true }),
    ],
  });
  assert.ok(r.includes("residual_no_declarado"));
});

test("§21 y §22: una sola causa que explica una parte deja algo sin decir", () => {
  const r = reglas({
    rootCauses: [afirmada({ explanatory_coverage: "partial", residual_material: true })],
  });
  assert.ok(r.includes("causa_unica_con_cobertura_parcial"));
});

test("§31: vinculante con el test todavia pendiente es una opinion", () => {
  const r = reglas({
    rootCauses: [],
    constraints: [vinculante()],
    tests: [
      constraintTestSchema.parse({
        test_id: "T-1", constraint_id: "CN-1", target: "revenue",
        counterfactual_question: "Y si reponemos mas?",
        expected_if_binding: "Las ventas suben por encima del rango habitual",
        expected_if_not_binding: "Las ventas se quedan donde estaban",
      }),
    ],
  });
  assert.ok(r.includes("vinculante_sin_test_resuelto"));
});

test("§26 y §27: un cuello local no limita el negocio entero sin exposicion", () => {
  const r = reglas({
    rootCauses: [],
    constraints: [vinculante({ scope: "market", exposure: "minimal" })],
  });
  assert.ok(r.includes("constraint_local_no_limita_el_todo"));
});

test("§32: decir que no hay cuello sin haber evaluado ninguno no es una conclusion", () => {
  const r = reglas({ rootCauses: [], noBusinessConstraint: true });
  assert.ok(r.includes("sin_constraint_no_es_no_haber_mirado"));
});

test("§43 y §45: un driver positivo cabe y no necesita justificarse como problema", () => {
  const r = reglas({
    rootCauses: [causa({ code: "RC9", cause_type: "positive_driver", statement: "El cambio de packaging subio la recompra" })],
  });
  assert.deepEqual(r, []);
});

// --- Lo estructural --------------------------------------------------------

test("§4 y apartado 23: causa y constraint son independientes", () => {
  // Causa resuelta con el cuello todavia activo. Nada lo impide, y este test
  // existe para que nadie ate las dos tablas mas adelante.
  const r = reglas({
    rootCauses: [causa({ status: "resolved" })],
    constraints: [vinculante()],
  });
  assert.deepEqual(r, []);
  // Y al reves: cuello identificado sin saber por que.
  const r2 = reglas({ rootCauses: [], constraints: [vinculante()] });
  assert.deepEqual(r2, []);
});

test("§7, §25, §35 y §37: no hay donde escribir prioridad ni severidad", () => {
  const campos = [
    ...Object.keys(rootCauseFields.shape),
    ...Object.keys(businessConstraintFields.shape),
  ];
  for (const prohibido of ["priority", "severity", "impact_rank", "rank", "playbook", "action", "urgency"]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" es F4, no D09 (guardrails 25, 35 y 37)`);
  }
});

test("§38 a §40: no existe ninguna columna donde quepa una persona", () => {
  // La garantia contra culpar no es una regla de estilo: es que no hay sitio.
  const campos = [
    ...Object.keys(rootCauseFields.shape),
    ...Object.keys(businessConstraintFields.shape),
  ];
  for (const prohibido of ["responsible", "owner", "person", "blamed_by", "assignee", "user_id"]) {
    assert.ok(!campos.includes(prohibido), `"${prohibido}" convertiria un diagnostico en una acusacion`);
  }
});

test("§1 a §3: los eslabones de la cadena son roles distintos y hay que elegir uno", () => {
  for (const rol of ["symptom", "immediate_cause", "root_cause", "structural_driver"]) {
    assert.ok((CHAIN_ROLES as readonly string[]).includes(rol));
  }
  assert.throws(() =>
    chainStepSchema.parse({
      root_cause_id: "RC-1", step_order: 1, chain_role: "la_culpa_de_todo", statement: "x",
    }),
  );
});

// ---------------------------------------------------------------------------
// EL MOTOR
// ---------------------------------------------------------------------------
//
// Lo que estos tests persiguen: que "co-movimiento" no se convierta en "causa
// cerrada", y que "capacidad con mala salud" no se convierta en "cuello
// vinculante" sin haber medido capacidad y demanda.

const nodo = (over: Partial<ChainNodeInput> = {}): ChainNodeInput => ({
  node_id: "N-oc",
  label: "Pedidos",
  case_support: "partial",
  ...over,
});

const candidata = (over: Partial<RootCauseCandidateInput> = {}): RootCauseCandidateInput => ({
  hypothesis_id: "H-1",
  source_path_id: "P-1",
  hypothesis_type: "contributory_cause",
  relative_role: "alternative",
  confidence: "low",
  explanatory_coverage: "partial",
  capability: "conversion",
  limitations: null,
  chain: [nodo()],
  ...over,
});

const entradaRC = (candidates: RootCauseCandidateInput[]): RootCauseEngineInput => ({
  targetNodeId: "N-ns",
  targetLabel: "Ventas netas",
  scope: "business",
  scopeDetail: {},
  candidates,
});

test("con evidencia de correlacion, nunca se cierra la causa", () => {
  // Guardrail 15. Es la conclusion mas importante del bloque: co-movimiento no
  // es prueba, y `probable`/`confirmed` quedan fuera de alcance siempre.
  const [rc] = generateRootCauses(entradaRC([candidata()]));

  assert.notEqual(rc?.status, "probable");
  assert.notEqual(rc?.status, "confirmed");
  assert.equal(rc?.status, "partial_root_cause");
});

test("un tramo sin medir tumba la cadena entera, por fuerte que sea el resto", () => {
  // La regla del eslabon mas debil, literal: una cadena no es mas fuerte que su
  // tramo mas flojo.
  const [rc] = generateRootCauses(
    entradaRC([
      candidata({
        chain: [
          nodo({ node_id: "N-se", label: "Sesiones", case_support: "partial" }),
          nodo({ node_id: "N-oc", label: "Pedidos", case_support: "untested" }),
        ],
      }),
    ]),
  );

  assert.equal(rc?.status, "unresolved");
  assert.equal(rc?.confidence, "insufficient");
  assert.match(rc?.statement ?? "", /tramo sin medir/);
});

test("el origen es siempre causa inmediata, nunca raiz", () => {
  // Guardrail 9: llegar a "root_cause" exige profundidad y evidencia que hoy no
  // hay. Etiquetarlo asi seria afirmar una busqueda que no se hizo.
  const [rc] = generateRootCauses(entradaRC([candidata()]));
  const chain = rc?.chain ?? [];

  assert.equal(chain[0]?.chain_role, "immediate_cause");
  assert.equal(chain.at(-1)?.chain_role, "outcome");
  assert.ok(chain.every((s) => s.chain_role !== "root_cause"));
  assert.ok(chain.every((s) => s.chain_role !== "structural_driver"));
});

test("una cadena de varios pasos marca los intermedios como tal", () => {
  const [rc] = generateRootCauses(
    entradaRC([
      candidata({
        chain: [
          nodo({ node_id: "N-se", label: "Sesiones", case_support: "partial" }),
          nodo({ node_id: "N-oc", label: "Pedidos", case_support: "partial" }),
        ],
      }),
    ]),
  );
  const roles = (rc?.chain ?? []).map((s) => s.chain_role);
  assert.deepEqual(roles, ["immediate_cause", "intermediate_cause", "outcome"]);
});

test("con varias candidatas, ninguna es 'primary': todas contribuyen", () => {
  // D08 ya establecio que la separacion es baja. Elegir una aqui seria fingir
  // un criterio que no existe.
  const rcs = generateRootCauses(
    entradaRC([
      candidata({ hypothesis_id: "H-1" }),
      candidata({ hypothesis_id: "H-2", capability: "unit_economics" }),
    ]),
  );

  assert.ok(rcs.every((r) => r.role === "contributing"));
});

test("con una sola candidata, es 'primary' sin dejar de estar sin cerrar", () => {
  const [rc] = generateRootCauses(entradaRC([candidata()]));
  assert.equal(rc?.role, "primary");
  assert.notEqual(rc?.status, "confirmed");
});

test("el desafiante de la medicion se marca como tal, no como una causa mas", () => {
  const [rc] = generateRootCauses(
    entradaRC([
      candidata({
        hypothesis_id: "H-4",
        hypothesis_type: "data_quality_explanation",
        relative_role: "challenger",
        source_path_id: null,
        chain: [],
        explanatory_coverage: "unknown",
      }),
    ]),
  );

  assert.equal(rc?.affects_observability_only, true);
  assert.equal(rc?.explanatory_coverage, "unknown");
  assert.equal(rc?.cause_type, "quality");
  assert.equal(rc?.family, "data");
});

test("la familia traduce la capacidad del grafo, no la inventa", () => {
  // `unit_economics` (grafo) y `economics` (D09) son la misma cosa con dos
  // nombres.
  assert.equal(familyFromCapability("unit_economics"), "economics");
  assert.equal(familyFromCapability("conversion"), "conversion");
  assert.equal(familyFromCapability(null), "data");
});

test("ninguna afirmacion suena a certeza ni senala a una persona", () => {
  const rcs = generateRootCauses(
    entradaRC([
      candidata(),
      candidata({
        hypothesis_id: "H-4",
        hypothesis_type: "data_quality_explanation",
        relative_role: "challenger",
        source_path_id: null,
        chain: [],
      }),
    ]),
  );

  for (const rc of rcs) {
    assert.doesNotMatch(rc.statement, DEFINITIVE_LANGUAGE);
    assert.doesNotMatch(rc.statement, BLAME_LANGUAGE);
  }
});

test("lo que el motor escribe pasa los invariantes del propio bloque", () => {
  const rcs = generateRootCauses(
    entradaRC([
      candidata({ hypothesis_id: "H-1" }),
      candidata({
        hypothesis_id: "H-4",
        hypothesis_type: "data_quality_explanation",
        relative_role: "challenger",
        source_path_id: null,
        chain: [],
        explanatory_coverage: "unknown",
      }),
    ]),
  );

  const parsed = rcs.map((rc, i) =>
    rootCauseSchema.parse({
      root_cause_id: `RC-${i}`,
      code: rc.code,
      statement: rc.statement,
      family: rc.family,
      cause_type: rc.cause_type,
      role: rc.role,
      scope: rc.scope,
      status: rc.status,
      confidence: rc.confidence,
      explanatory_coverage: rc.explanatory_coverage,
      residual_material: rc.residual_material,
      causal_path_id: rc.causal_path_id ?? undefined,
      hypothesis_id: rc.hypothesis_id,
      controllability: rc.controllability,
      reversibility: rc.reversibility,
      affects_observability_only: rc.affects_observability_only,
      limitations: rc.limitations ?? undefined,
    }),
  );

  const chain = rcs.flatMap((rc, i) =>
    rc.chain.map((s) =>
      chainStepSchema.parse({
        root_cause_id: `RC-${i}`,
        step_order: s.step_order,
        chain_role: s.chain_role,
        statement: s.statement,
        supported: s.supported,
      }),
    ),
  );

  const violaciones = checkRootCauseInvariants({ rootCauses: parsed, chain });
  assert.deepEqual(violaciones, []);
});

// ---------------------------------------------------------------------------
// EL MOTOR (constraint)
// ---------------------------------------------------------------------------

const candidataK = (over: Partial<ConstraintCandidateInput> = {}): ConstraintCandidateInput => ({
  capability: "inventory",
  health_state: "bad",
  confidence: "medium",
  ...over,
});

test("una capacidad con mala salud nunca sale 'binding' sin capacidad y demanda medidas", () => {
  // Guardrails 29 y 31: declararlo vinculante exige capacidad, demanda y un
  // test contrafactual resuelto, y nada de eso existe todavia.
  const [k] = generateConstraintCandidates({
    targetMetric: "net_sales",
    scope: "business",
    scopeDetail: {},
    candidates: [candidataK()],
  });

  assert.equal(k?.binding_status, "latent");
  assert.equal(k?.limits_target, false);
});

test("cada candidata trae el test que haria falta correr", () => {
  const [k] = generateConstraintCandidates({
    targetMetric: "net_sales",
    scope: "business",
    scopeDetail: {},
    candidates: [candidataK()],
  });

  assert.ok(k?.counterfactual_question.length ?? 0 > 10);
  assert.notEqual(k?.test.expected_if_binding, k?.test.expected_if_not_binding);
  assert.ok((k?.test.expected_if_binding.length ?? 0) >= 10);
  assert.ok((k?.test.expected_if_not_binding.length ?? 0) >= 10);
});

test("lo que el motor de constraint escribe pasa los invariantes del propio bloque", () => {
  const drafts = generateConstraintCandidates({
    targetMetric: "net_sales",
    scope: "business",
    scopeDetail: {},
    candidates: [candidataK(), candidataK({ capability: "unit_economics", health_state: "critical" })],
  });

  const parsed = drafts.map((k, i) =>
    businessConstraintSchema.parse({
      constraint_id: `K-${i}`,
      code: k.code,
      statement: k.statement,
      constraint_type: k.constraint_type,
      target: k.target,
      scope: k.scope,
      binding_status: k.binding_status,
      nature: k.nature,
      confidence: k.confidence,
      limits_target: k.limits_target,
      exposure: k.exposure,
    }),
  );

  const tests = drafts.map((k, i) =>
    constraintTestSchema.parse({
      test_id: `T-${i}`,
      constraint_id: `K-${i}`,
      target: k.target,
      counterfactual_question: k.counterfactual_question,
      expected_if_binding: k.test.expected_if_binding,
      expected_if_not_binding: k.test.expected_if_not_binding,
    }),
  );

  const violaciones = checkRootCauseInvariants({ rootCauses: [], constraints: parsed, tests });
  assert.deepEqual(violaciones, []);
});
