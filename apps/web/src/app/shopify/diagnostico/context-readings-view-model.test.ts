/**
 * FASE 3 / D02 — la pantalla no puede convertir una duda en una conclusion.
 *
 * El fallo que persiguen estos tests es el del bloque entero: leer como
 * deterioro lo que solo fue un cambio de peso, o dar por buena una comparacion
 * que no se sostiene.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  comparabilityLabel,
  interpretationLabel,
  performanceMoved,
  weightShift,
  type MixSegmentView,
} from "./context-readings-view-model";

const segmento = (over: Partial<MixSegmentView> = {}): MixSegmentView => ({
  dimension: "channel",
  segment: "meta",
  weight_before: 0.5,
  weight_after: 0.9,
  performance_before: 40,
  performance_after: 40,
  ...over,
});

test("D02 vista: un cambio de composicion no se lee como un deterioro", () => {
  const r = interpretationLabel("mix_shift");
  assert.ok(!r.label.toLowerCase().includes("rendimiento"));
  assert.ok(r.detail.includes("cuánto pesa"));
});

test("D02 vista: 'sin determinar' no puede leerse como 'no pasa nada'", () => {
  // Es la confusion mas cara de esta pantalla: no poder responder no es haber
  // respondido que todo esta bien.
  const r = interpretationLabel("undetermined");
  assert.ok(r.detail.includes("todavía no se puede decir"));
  assert.notEqual(r.tone, "success");
});

test("D02 vista: una interpretacion desconocida cae en 'sin determinar', no se rompe", () => {
  assert.equal(interpretationLabel("algo_nuevo").label, "Sin determinar");
});

test("D02 vista: una comparacion invalida se pinta como tal", () => {
  assert.equal(comparabilityLabel("not_comparable").tone, "danger");
  assert.equal(comparabilityLabel("comparable").tone, "success");
  // Cualquier otra cosa es limitada, nunca valida.
  assert.equal(comparabilityLabel("limited").tone, "warn");
  assert.equal(comparabilityLabel("lo_que_sea").tone, "warn");
});

test("D02 vista: el peso se dice en puntos, no en porcentaje de variacion", () => {
  // Del 5% al 10% de peso es +5 puntos. Decir "+100%" impresiona y no informa.
  assert.equal(weightShift(segmento({ weight_before: 0.05, weight_after: 0.1 })), "+5.0 pts");
  assert.equal(weightShift(segmento({ weight_before: 0.5, weight_after: 0.1 })), "-40.0 pts");
});

test("D02 vista: un rendimiento que no se movio no se pinta como movido", () => {
  assert.equal(performanceMoved(segmento({ performance_before: 40, performance_after: 40 })), false);
  assert.equal(
    performanceMoved(segmento({ performance_before: 40, performance_after: 40.1 })),
    false,
    "medio decimal de AOV no es un cambio",
  );
  assert.equal(performanceMoved(segmento({ performance_before: 40, performance_after: 48 })), true);
});

test("D02 vista: sin rendimiento en los dos lados no se afirma movimiento", () => {
  assert.equal(
    performanceMoved(segmento({ performance_before: null, performance_after: null })),
    false,
  );
});
