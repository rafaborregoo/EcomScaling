/**
 * FASE 3 / D08 — lo que esta pantalla no puede dejar que pase.
 *
 * Tres fallos, y los tres convierten una lista de candidatas en un diagnostico
 * que nadie ha hecho:
 *
 * 1. **Esconder las descartadas.** Es medio bloque: sin el motivo escrito,
 *    dentro de un mes alguien repite la misma busqueda.
 * 2. **Enterrar el challenger entre iguales.** Si es cierto que solo cambio la
 *    medida, las demas sobran. Leerlo el ultimo es leerlo tarde.
 * 3. **Ordenar por confianza.** Quien lee el primero entiende que es el bueno.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  availabilityLabel,
  confidenceLabel,
  coverageLabel,
  groupByCase,
  priorLabel,
  separationWarning,
  splitEvidence,
  splitHypotheses,
  statusLabel,
  typeLabel,
  type HypothesisView,
} from "./hypotheses-view-model";

const hip = (over: Partial<HypothesisView> = {}): HypothesisView => ({
  id: "H-1",
  organization_id: "org-1",
  organization_name: "Tienda",
  case_id: "c1",
  code: "H1",
  statement: "El movimiento está en los pedidos.",
  hypothesis_type: "contributory_cause",
  source_path_id: "P1",
  target_node_id: "N-oc",
  family: "conversion",
  status: "under_test",
  rejection_reason: null,
  confidence: "low",
  prior_plausibility: "high",
  explanatory_coverage: "partial",
  unexplained_residual_material: true,
  residual_note: "Por qué se movieron los pedidos sigue sin explicarse.",
  root_cause_candidate: false,
  relative_role: "alternative",
  separation: "low",
  uncertainty_kinds: ["causal"],
  temporal_fit: "fits",
  scope_fit: "compatible",
  magnitude_fit: "partial",
  mechanism_fit: "unknown",
  falsification_condition: "Que la serie de pedidos esté plana.",
  limitations: null,
  updated_at: "2026-10-06T10:00:00.000Z",
  test: null,
  evidence: [],
  ...over,
});

test("lo descartado se ensena aparte, no se filtra", () => {
  // Sin el motivo escrito y a la vista, dentro de un mes alguien vuelve a mirar
  // los pedidos porque se le olvido que ya se habian mirado.
  const { vivas, descartadas } = splitHypotheses([
    hip({ id: "a" }),
    hip({ id: "b", status: "contradicted", rejection_reason: "El efecto empezó antes." }),
  ]);

  assert.equal(vivas.length, 1);
  assert.equal(descartadas.length, 1);
  assert.equal(descartadas[0]?.rejection_reason, "El efecto empezó antes.");
});

test("el challenger va en su propia pila, no entre iguales", () => {
  // Si es cierto que solo cambio la medida, las demas sobran. No es una
  // hipotesis mas de la lista.
  const { challenger, vivas } = splitHypotheses([
    hip({ id: "a" }),
    hip({
      id: "b",
      relative_role: "challenger",
      hypothesis_type: "data_quality_explanation",
    }),
  ]);

  assert.equal(challenger.length, 1);
  assert.equal(challenger[0]?.id, "b");
  assert.ok(vivas.every((h) => h.id !== "b"));
});

test("el prior y la confianza se dicen por separado", () => {
  // Guardrail 2. Una relacion que casi siempre se cumple puede tener confianza
  // baja en este caso concreto, y las dos frases tienen que caber a la vez.
  const h = hip({ prior_plausibility: "high", confidence: "low" });

  assert.match(priorLabel(h.prior_plausibility), /casi siempre se cumplen/);
  assert.match(confidenceLabel(h.confidence).label, /en este caso/);
  assert.notEqual(priorLabel("high"), confidenceLabel("high").label);
});

test("'falta conectar la fuente' no se pinta como 'preguntale al cliente'", () => {
  // El error mas caro de la pantalla: mandar al consultor a molestar al cliente
  // por un dato que la plataforma ya tiene, o al reves.
  const yaEsta = availabilityLabel("available");
  const faltaFuente = availabilityLabel("needs_integration");
  const preguntar = availabilityLabel("needs_user");

  assert.match(yaEsta.label, /ya está en la plataforma/);
  assert.match(faltaFuente.label, /conectar la fuente/);
  assert.match(preguntar.label, /preguntárselo al cliente/);
  assert.equal(new Set([yaEsta.tone, faltaFuente.tone, preguntar.tone]).size, 3);
});

test("lo que nadie ha mirado se separa de lo observado", () => {
  // Guardrail 5 en pantalla: en la misma lista, un hueco cuenta como si fuera
  // evidencia.
  const { mirada, huecos } = splitEvidence([
    { relation: "supports", observation: "Se movieron juntas.", observation_kind: "observed_present" },
    { relation: "inconclusive", observation: "Nadie mide el ticket.", observation_kind: "not_observed" },
  ]);

  assert.equal(mirada.length, 1);
  assert.equal(huecos.length, 1);
  assert.match(huecos[0]?.observation ?? "", /Nadie mide/);
});

test("no se ordena por confianza", () => {
  // Ordenar por confianza es decir cual es la buena sin decirlo. Se ordena por
  // el codigo, que es el orden en que las escribio el motor.
  const grupos = groupByCase([
    hip({ id: "a", code: "H3", confidence: "medium" }),
    hip({ id: "b", code: "H1", confidence: "insufficient" }),
    hip({ id: "c", code: "H2", confidence: "low" }),
  ]);

  assert.deepEqual(
    grupos[0]?.hypotheses.map((h) => h.code),
    ["H1", "H2", "H3"],
  );
});

test("si nada separa las explicaciones, se avisa", () => {
  // Cinco explicaciones sin avisar de que ninguna se distingue invita a quedarse
  // con la primera.
  const aviso = separationWarning([hip({ id: "a" }), hip({ id: "b" })]);
  assert.match(aviso ?? "", /nada las separa/);

  // Con una sola no hay nada que separar.
  assert.equal(separationWarning([hip()]), null);
  // Y si alguna esta separada de verdad, el aviso sobra.
  assert.equal(
    separationWarning([hip({ id: "a", separation: "high" }), hip({ id: "b" })]),
    null,
  );
});

test("'puede que sea la medicion' se dice en castellano, no en jerga", () => {
  assert.equal(typeLabel("data_quality_explanation"), "Puede que sea la medición");
  assert.equal(typeLabel("contributory_cause"), "Causa parcial");
  assert.equal(typeLabel("inventado"), "inventado");
});

test("ninguna cobertura se pinta como completa cuando no lo es", () => {
  assert.match(coverageLabel("partial") ?? "", /una parte/);
  assert.match(coverageLabel("minimal") ?? "", /porción pequeña/);
  // `unknown` no dice nada, que es lo correcto: no se sabe.
  assert.equal(coverageLabel("unknown"), null);
});

test("'sin comprobar' y 'descartada' no se pintan igual", () => {
  assert.notEqual(statusLabel("untested").tone, statusLabel("contradicted").tone);
  assert.equal(statusLabel("untested").label, "Sin comprobar");
  assert.equal(statusLabel("contradicted").label, "Descartada");
});
