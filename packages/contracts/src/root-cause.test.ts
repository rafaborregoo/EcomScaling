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
  type RootCause,
  type BusinessConstraint,
  type RootCauseCheckInput,
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
