/**
 * FASE 3 / D07 — lo que esta pantalla no puede dejar que pase.
 *
 * Dos fallos, y los dos son de lectura, no de calculo:
 *
 * 1. **Que "nadie lo ha mirado" se lea como "descartado".** Es el mismo error
 *    que persigue toda la fase, aqui con dos colores parecidos.
 * 2. **Que la lista se lea como un ranking.** Quien lee el primero de una lista
 *    entiende que es el bueno, y el guardrail 48 dice que D07 no prioriza.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  confidenceLabel,
  declarableNodes,
  failingFits,
  groupByCase,
  pathStatusLabel,
  relationPhrase,
  sortPaths,
  stepSentence,
  type CausalEdgeView,
  type CausalNodeView,
  type CausalPathView,
  type CausalStepView,
} from "./causal-view-model";

const paso = (over: Partial<CausalStepView> = {}): CausalStepView => ({
  id: "S1",
  edge_id: "E1",
  step_order: 1,
  case_support: "partial",
  cause_onset: "2026-09-01T00:00:00.000Z",
  effect_onset: "2026-09-01T00:00:00.000Z",
  observed_lag_days: 0,
  temporal_fit: "fits",
  scope_fit: "compatible",
  magnitude_fit: "sufficient",
  cause_role: null,
  contribution_note: null,
  is_mediator: false,
  evidence: [],
  ...over,
});

const ruta = (over: Partial<CausalPathView> = {}): CausalPathView => ({
  id: "P1",
  organization_id: "org-1",
  organization_name: "Tienda",
  case_id: "c1",
  target_node_id: "N-ns",
  status: "partial",
  path_confidence: "low",
  missing_evidence: [],
  confounders_reviewed: false,
  measurement_validated: false,
  next_evidence: null,
  updated_at: "2026-10-05T10:00:00.000Z",
  steps: [paso()],
  ...over,
});

const NODOS: CausalNodeView[] = [
  {
    id: "N-oc",
    code: "orders_count",
    label: "Pedidos",
    node_type: "metric",
    capability: "conversion",
    observability: "directly_observed",
    measurement_layer: "real_world",
    organization_id: null,
  },
  {
    id: "N-ns",
    code: "net_sales",
    label: "Ventas netas",
    node_type: "metric",
    capability: "unit_economics",
    observability: "derived",
    measurement_layer: "real_world",
    organization_id: null,
  },
];

const ARISTAS: CausalEdgeView[] = [
  {
    id: "E1",
    from_node_id: "N-oc",
    to_node_id: "N-ns",
    edge_kind: "causal",
    relation_type: "mathematical",
    expected_sign: "positive",
    mechanism: "Las ventas netas son la suma del importe de los pedidos.",
    diagnostic_rationale: "Separa una caida de pedidos de una caida de ticket.",
    conditions: null,
    expected_lag_days: 0,
    strength: "strong",
    evidence_level: "deterministic",
    knowledge_source: "system_logic",
    organization_id: null,
  },
];

test("lo que descarta va primero, no lo que mejor encaja", () => {
  // La decision de la pantalla. Hoy ninguna ruta esta sostenida, y lo unico que
  // el bloque sabe de verdad es donde NO esta el problema.
  const ordenadas = sortPaths([
    ruta({ id: "a", status: "untested" }),
    ruta({ id: "b", status: "partial" }),
    ruta({ id: "c", status: "contradicted" }),
  ]);

  assert.deepEqual(
    ordenadas.map((r) => r.status),
    ["contradicted", "partial", "untested"],
  );
});

test("'sin comprobar' no dice lo mismo que 'descartada'", () => {
  // Los dos estados que el ojo confunde, y el unico par que importa separar.
  const descartada = pathStatusLabel("contradicted");
  const sinProbar = pathStatusLabel("untested");

  assert.equal(descartada.label, "Descartada");
  assert.match(descartada.hint, /Se miro/);
  assert.equal(sinProbar.label, "Sin comprobar");
  assert.match(sinProbar.hint, /No es lo mismo que haberlo descartado/);
  assert.notEqual(descartada.tone, sinProbar.tone);
});

test("la aritmetica se nombra aritmetica, no causa", () => {
  // Guardrail 4: el linaje descompone, no explica. La pantalla no va a decir
  // "causa" donde el esquema dice "mathematical".
  assert.equal(relationPhrase("mathematical"), "es parte de la formula de");
  assert.doesNotMatch(relationPhrase("mathematical"), /causa/i);

  assert.equal(
    stepSentence(paso(), ARISTAS, NODOS),
    "Pedidos es parte de la formula de Ventas netas",
  );
});

test("solo se ensenan los encajes que restan", () => {
  // Lo que se cumple no cambia ninguna decision; lo que falla, si. Mismo
  // criterio que el mapa de sintomas y la salud por capacidad.
  assert.equal(failingFits(paso()).length, 0);

  const roto = failingFits(
    paso({ temporal_fit: "contradicted", magnitude_fit: "partial" }),
  );
  assert.deepEqual(
    roto.map((f) => f.axis),
    ["Tiempo", "Magnitud"],
  );
  assert.match(roto[0]?.verdict ?? "", /el efecto empezo antes/);
  assert.equal(roto[1]?.tone, "warn");
});

test("una magnitud sin formula se dice, no se da por buena", () => {
  // La arista economica no tiene identidad que permita calcular la cuota. Decir
  // "sin formula que lo mida" es distinto de callarlo.
  const fits = failingFits(paso({ magnitude_fit: "untested" }));
  assert.equal(fits.length, 1);
  assert.match(fits[0]?.verdict ?? "", /sin formula/);
  assert.equal(fits[0]?.tone, "neutral");
});

test("ningun nivel de confianza se pinta como un numero", () => {
  for (const nivel of ["high", "medium", "low", "insufficient_data"]) {
    assert.doesNotMatch(confidenceLabel(nivel).label, /\d/);
  }
  assert.equal(confidenceLabel("insufficient_data").label, "Sin dato suficiente");
});

test("las rutas de un caso se agrupan y se ordenan dentro", () => {
  const grupos = groupByCase([
    ruta({ id: "a", case_id: "c1", status: "untested" }),
    ruta({ id: "b", case_id: "c2", status: "partial" }),
    ruta({ id: "c", case_id: "c1", status: "contradicted" }),
  ]);

  assert.equal(grupos.length, 2);
  const primero = grupos.find((g) => g.caseId === "c1");
  assert.deepEqual(
    primero?.paths.map((r) => r.status),
    ["contradicted", "untested"],
  );
});

test("no se puede declarar una relacion con el nodo de otra tienda", () => {
  // Una arista entre organizaciones no significa nada, y el esquema no la
  // admite: que no llegue ni a ofrecerse es mas barato que un 400.
  const conAjeno: CausalNodeView[] = [
    ...NODOS,
    { ...NODOS[0]!, id: "N-otra", label: "Suyo", organization_id: "org-2" },
    { ...NODOS[0]!, id: "N-mio", label: "Mio", organization_id: "org-1" },
  ];

  const disponibles = declarableNodes(conAjeno, "org-1");
  assert.ok(disponibles.every((n) => n.id !== "N-otra"));
  assert.ok(disponibles.some((n) => n.id === "N-mio"));
  // Y en castellano, por etiqueta.
  assert.deepEqual(
    disponibles.map((n) => n.label),
    ["Mio", "Pedidos", "Ventas netas"],
  );
});
