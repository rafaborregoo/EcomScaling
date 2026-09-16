/**
 * FASE 3 / D09 — lo que esta pantalla no puede dejar que pase.
 *
 * Dos fallos, otra vez con disfraces distintos:
 *
 * 1. **Suavizar "sin resolver" hasta que parezca "casi resuelto".** Reintroduce
 *    por la puerta de atras la certeza que el esquema prohíbe.
 * 2. **Fundir causa raíz y constraint en una sola tarjeta.** Responden
 *    preguntas distintas, y el esquema las mantiene separadas a propósito.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  bindingStatusLabel,
  chainRoleLabel,
  confidenceLabel,
  exposureLabel,
  groupConstraintsByCase,
  groupRootCausesByCase,
  missingForBinding,
  roleLabel,
  rootCauseStatusLabel,
  sortChain,
  type ChainStepView,
  type ConstraintView,
  type RootCauseView,
} from "./root-cause-view-model";

const rc = (over: Partial<RootCauseView> = {}): RootCauseView => ({
  id: "RC-1",
  organization_id: "org-1",
  organization_name: "Tienda",
  case_id: "c1",
  code: "RC1",
  statement: "Los pedidos mueven las ventas netas.",
  family: "conversion",
  cause_type: "process",
  role: "contributing",
  scope: "business",
  status: "unresolved",
  confidence: "insufficient",
  explanatory_coverage: "unknown",
  residual_material: true,
  residual_note: "Sigue sin explicarse.",
  controllability: "unknown",
  reversibility: "unknown",
  recurrence: "unknown",
  affects_observability_only: false,
  limitations: null,
  updated_at: "2026-10-06T10:00:00.000Z",
  chain: [],
  ...over,
});

const k = (over: Partial<ConstraintView> = {}): ConstraintView => ({
  id: "K-1",
  organization_id: "org-1",
  organization_name: "Tienda",
  case_id: "c1",
  code: "K1",
  statement: "Inventario tiene mala salud.",
  constraint_type: "inventory",
  target: "net_sales",
  scope: "business",
  binding_status: "latent",
  nature: "soft",
  timing: "structural",
  confidence: "medium",
  capacity: null,
  demand_on_capacity: null,
  falsifier: null,
  counterfactual_question: "¿Mejoraría si se resolviera?",
  counterfactual_result: null,
  limits_target: false,
  exposure: "unknown",
  status: "active",
  updated_at: "2026-10-06T10:00:00.000Z",
  tests: [],
  ...over,
});

test("'sin resolver' se dice con esas palabras, no se disfraza de progreso", () => {
  const estado = rootCauseStatusLabel("unresolved");
  assert.equal(estado.label, "Sin resolver");
  assert.match(estado.hint, /se ha mirado y no se puede cerrar/i);

  // Y no comparte tono con lo que sí se ha cerrado.
  assert.notEqual(estado.tone, rootCauseStatusLabel("confirmed").tone);
});

test("causa parcial y sin resolver no se confunden entre sí", () => {
  assert.notEqual(
    rootCauseStatusLabel("partial_root_cause").label,
    rootCauseStatusLabel("unresolved").label,
  );
});

test("la cadena se lee del origen al efecto, no al revés", () => {
  const pasos: ChainStepView[] = [
    { root_cause_id: "RC-1", step_order: 3, chain_role: "outcome", statement: "x", supported: true },
    { root_cause_id: "RC-1", step_order: 1, chain_role: "immediate_cause", statement: "y", supported: true },
    { root_cause_id: "RC-1", step_order: 2, chain_role: "intermediate_cause", statement: "z", supported: true },
  ];
  assert.deepEqual(
    sortChain(pasos).map((p) => p.chain_role),
    ["immediate_cause", "intermediate_cause", "outcome"],
  );
});

test("cada eslabón se nombra en castellano, sin tecnicismos", () => {
  assert.equal(chainRoleLabel("immediate_cause"), "Causa inmediata");
  assert.equal(chainRoleLabel("outcome"), "Lo que se observó");
  assert.equal(chainRoleLabel("inventado"), "inventado");
});

test("un cuello candidato dice qué falta para poder probarlo", () => {
  // Guardrails 29 y 31 en pantalla.
  const sinNada = missingForBinding(k());
  assert.match(sinNada ?? "", /capacidad.*demanda/);

  const conCapacidad = missingForBinding(k({ capacity: "3 pedidos por hora" }));
  assert.match(conCapacidad ?? "", /demanda/);
  assert.doesNotMatch(conCapacidad ?? "", /capacidad/);

  // Y un vinculante de verdad no pide nada: ya se probó.
  assert.equal(missingForBinding(k({ binding_status: "binding" })), null);
});

test("'latent' se lee como candidata sin probar, no como límite real", () => {
  const estado = bindingStatusLabel("latent");
  assert.match(estado.hint, /falta medir/);
  assert.notEqual(estado.tone, bindingStatusLabel("binding").tone);
});

test("causa raíz y constraint se agrupan por separado, nunca juntos", () => {
  // La prueba estructural de la decisión de fondo: son dos funciones y dos
  // formas distintas, no una que junte las dos cosas en un mismo grupo.
  const causas = groupRootCausesByCase([rc({ id: "a" }), rc({ id: "b", case_id: "c2" })]);
  const cuellos = groupConstraintsByCase([k({ id: "x" })]);

  assert.equal(causas.length, 2);
  assert.equal(cuellos.length, 1);
  assert.ok(!("constraints" in causas[0]!));
  assert.ok(!("rootCauses" in cuellos[0]!));
});

test("con una sola candidata sobre la mesa, el rol se explica", () => {
  assert.match(roleLabel("primary"), /Única candidata/);
  assert.match(roleLabel("contributing"), /Contribuye/);
});

test("ningún nivel de confianza se pinta como un número", () => {
  for (const nivel of ["high", "medium", "low", "insufficient"]) {
    assert.doesNotMatch(confidenceLabel(nivel).label, /\d/);
  }
});

test("la exposición se dice en palabras, y 'unknown' no se inventa", () => {
  assert.match(exposureLabel("existential"), /riesgo el negocio entero/);
  assert.match(exposureLabel("unknown"), /No se sabe/);
});
