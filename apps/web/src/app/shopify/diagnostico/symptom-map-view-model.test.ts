/**
 * FASE 3 / D06 — la pantalla no puede convertir un patron en una causa.
 *
 * Es el unico fallo que importa aqui, y es silencioso: nadie escribe "causa" en
 * la pantalla; lo que pasa es que una tarjeta segura de si misma, con una nota
 * de confianza y sin nada que la contradiga a la vista, se lee como una causa.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSymptomTree,
  coherenceReasons,
  confidenceLabel,
  persistenceLabel,
  relationLabel,
  scopeLabel,
  signalRoleLabel,
  valenceLabel,
  type SymptomView,
} from "./symptom-map-view-model";

const sintoma = (over: Partial<SymptomView> = {}): SymptomView => ({
  id: "sy-1",
  organization_name: "Tienda",
  symptom_family: "financial",
  canonical_type: "net_sales_decline",
  label: "Caida de ventas netas",
  valence: "negative",
  capability: "unit_economics",
  scope: "business",
  scope_detail: {},
  diagnostic_depth: "intermediate",
  process_position: "downstream",
  time_role: "lagging",
  persistence: "acute",
  recurrence_count: 1,
  same_time_window: true,
  compatible_scope: true,
  compatible_direction: true,
  known_relationship: true,
  sufficient_signal_quality: true,
  coherence_relationship: "mathematical",
  confidence: "medium",
  data_confidence: "high",
  context_reviewed: true,
  parent_symptom_id: null,
  previous_symptom_id: null,
  first_seen_at: "2026-09-25T00:00:00.000Z",
  last_seen_at: "2026-09-28T00:00:00.000Z",
  signals: [],
  evidence: [],
  relations: [],
  ...over,
});

test("D06 vista: ninguna relacion candidata se traduce por algo causal", () => {
  // Guardrail 18. Si alguien cambia esto por "provoca", el bloque entero deja
  // de servir para lo que existe.
  for (const relacion of ["may_precede", "may_follow", "often_cooccurs", "related", "otra"]) {
    const texto = relationLabel(relacion).toLowerCase();
    assert.ok(!/caus|provoc|porque|caus[oa]/.test(texto), `"${texto}" suena a causa`);
  }
  assert.equal(relationLabel("often_cooccurs"), "coincide en el tiempo con");
});

test("D06 vista: la confianza se dice como para que sirve, no como nota", () => {
  const media = confidenceLabel("medium");
  assert.match(media.label, /investigar/);
  assert.notEqual(media.tone, "success");

  const baja = confidenceLabel("low");
  assert.match(baja.detail, /punto de partida/);
});

test("D06 vista: sin relacion declarada, la pantalla lo dice en la primera frase", () => {
  // Es el guardrail 9 hecho texto: coincidir no es estar relacionado, y el
  // consultor tiene que leerlo antes que nada.
  const razones = coherenceReasons(
    sintoma({ known_relationship: false, coherence_relationship: null }),
  );
  assert.match(razones[0]!, /coinciden, que no es lo mismo/);
});

test("D06 vista: solo se enumera lo que falta, no lo que se cumple", () => {
  // Cinco casillas verdes no cambian ninguna decision y tapan la que importa.
  const completo = coherenceReasons(sintoma());
  assert.equal(completo.length, 1, "con todo en orden solo queda la frase de la relacion");

  const cojo = coherenceReasons(
    sintoma({ compatible_direction: false, sufficient_signal_quality: false, context_reviewed: false }),
  );
  assert.equal(cojo.length, 4);
  assert.ok(cojo.some((r) => /sentidos opuestos/.test(r)));
  assert.ok(cojo.some((r) => /D02 todavía no/.test(r)));
});

test("D06 vista: cronico y recurrente no se dicen igual", () => {
  // Uno nunca se fue, el otro ha vuelto. Confundirlos cambia donde se mira.
  const cronico = persistenceLabel(
    sintoma({ persistence: "chronic", first_seen_at: "2026-07-01T00:00:00.000Z" }),
    new Date("2026-09-28T00:00:00.000Z"),
  );
  assert.match(cronico, /Crónico/);
  assert.match(cronico, /89 días/);

  const recurrente = persistenceLabel(
    sintoma({ persistence: "recurring", recurrence_count: 3 }),
    new Date("2026-09-28T00:00:00.000Z"),
  );
  assert.match(recurrente, /Recurrente/);
  assert.match(recurrente, /3ª vez/);
});

test("D06 vista: una senal que contradice se marca como tal, no se disimula", () => {
  assert.equal(signalRoleLabel("contradicting").tone, "danger");
  assert.match(signalRoleLabel("contradicting").label, /contradice/i);
});

test("D06 vista: un sintoma localizado dice donde, sin el uuid de la tienda", () => {
  const texto = scopeLabel(
    sintoma({ scope: "segment", scope_detail: { store_id: "uuid-feo", store: "Tienda FR" } }),
  );
  assert.equal(texto, "Tienda FR");
  assert.equal(scopeLabel(sintoma()), "Todo el negocio");
});

test("D06 vista: mixto no se pinta como una mala noticia a medias", () => {
  assert.equal(valenceLabel("mixed").label, "Mixto");
  assert.equal(valenceLabel("mixed").tone, "warn");
  assert.equal(valenceLabel("positive").tone, "success");
});

test("D06 vista: el arbol pone cada descomposicion bajo lo que descompone", () => {
  const padre = sintoma({ id: "padre" });
  const hijo = sintoma({
    id: "hijo",
    canonical_type: "order_volume_decline",
    parent_symptom_id: "padre",
  });
  const arbol = buildSymptomTree([hijo, padre]);
  assert.equal(arbol.length, 1);
  assert.equal(arbol[0]!.symptom.id, "padre");
  assert.equal(arbol[0]!.children[0]!.id, "hijo");
});

test("D06 vista: un hijo sin su padre a la vista se muestra, no desaparece", () => {
  // Esconder una fila porque falta otra es la peor forma de fallar en una
  // pantalla de diagnostico: el consultor no sabe que le falta algo.
  const huerfano = sintoma({ id: "hijo", parent_symptom_id: "padre-que-no-esta" });
  const arbol = buildSymptomTree([huerfano]);
  assert.equal(arbol.length, 1);
  assert.equal(arbol[0]!.symptom.id, "hijo");
});
