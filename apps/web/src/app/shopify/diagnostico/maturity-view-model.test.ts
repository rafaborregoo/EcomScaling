/**
 * FASE 3 / D03 — la pantalla no puede convertir un hueco de datos en un juicio.
 *
 * Un panel con siete capacidades y ocho vacias se lee como "a este negocio le
 * faltan ocho cosas". Le faltan ocho *a nuestra vista*, que es otra cosa y es
 * la diferencia entre insultar a un cliente y saber que preguntarle.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  capabilityLabel,
  changeLabel,
  formatMeasure,
  gapLabel,
  levelLabel,
  missingDimensions,
  sortUnobserved,
  type CapabilityView,
} from "./maturity-view-model";

const capacidad = (over: Partial<CapabilityView> = {}): CapabilityView => ({
  id: "c-1",
  capability: "retention",
  current_level: "repeatable",
  required_level: null,
  expectation_band: null,
  finding: null,
  gap_interpretation: null,
  has_existence: true,
  has_consistency: true,
  has_repeatability: true,
  has_measurement: false,
  influences_decisions: false,
  confidence: "low",
  evidence: [],
  ...over,
});

test("D03 vista: sin brecha decidida no se pinta un cero, se pide la decision", () => {
  // El artefacto dice que los umbrales no estan definidos. Un "0" o un
  // "pendiente" gris se leen como "no hace falta nada"; esto se lee como lo que
  // es: falta que alguien lo decida.
  const g = gapLabel(capacidad());
  assert.match(g.label, /Nadie ha dicho/);
  assert.notEqual(g.tone, "danger");
});

test("D03 vista: los niveles se dicen por lo que significan, no en ingles", () => {
  assert.equal(levelLabel("repeatable").label, "Siempre igual");
  assert.match(levelLabel("repeatable").detail, /todavía no lo miden/);
  assert.equal(levelLabel("ad_hoc").label, "A ratos");
  assert.match(levelLabel("defined").detail, /hay datos/);
});

test("D03 vista: mejorar y vernos mejor no se dicen igual", () => {
  // Guardrail 28. Si se confunden, el consultor felicita al cliente por algo
  // que el cliente no ha hecho.
  assert.equal(changeLabel("real_change").tone, "success");
  assert.match(changeLabel("confidence_increase").label, /no ha cambiado/);
  assert.notEqual(changeLabel("confidence_increase").tone, "success");
  assert.notEqual(changeLabel("uncertainty_reduction").tone, "success");
});

test("D03 vista: solo se enumera lo que falta para el siguiente peldano", () => {
  const completa = missingDimensions(
    capacidad({ has_measurement: true, influences_decisions: true }),
  );
  assert.deepEqual(completa, []);

  const coja = missingDimensions(capacidad());
  assert.deepEqual(coja, [
    "no hay con qué medirlo",
    "nadie ha dicho si la medida cambia decisiones",
  ]);
});

test("D03 vista: lo que se puede arreglar conectando va primero", () => {
  // Los huecos accionables --falta el origen de los pedidos, falta el coste--
  // se cierran conectando algo. Equipo y estrategia se preguntan. Mezclarlos
  // convierte una lista de tareas en una lista de excusas.
  const ordenado = sortUnobserved([
    { capability: "team", reason: "no esta en ninguna tabla" },
    { capability: "acquisition", reason: "solo el 4% de los pedidos trae origen" },
    { capability: "strategy", reason: "no se observa en el dato transaccional" },
    { capability: "unit_economics", reason: "solo 1 de 44 referencias tiene coste" },
  ]);
  assert.deepEqual(
    ordenado.map((u) => u.capability),
    ["acquisition", "unit_economics", "team", "strategy"],
  );
  assert.equal(ordenado[0]!.actionable, true);
  assert.equal(ordenado[3]!.actionable, false);
});

test("D03 vista: las capacidades se nombran en castellano", () => {
  assert.equal(capabilityLabel("unit_economics"), "Economía unitaria");
  assert.equal(capabilityLabel("algo_nuevo"), "algo_nuevo", "lo desconocido no rompe la pantalla");
});

test("D03 vista: un contador no lleva decimales inventados", () => {
  assert.equal(formatMeasure({ key: "orders", label: "", value: 787, unit: "pedidos" }), "787 pedidos");
  assert.equal(formatMeasure({ key: "net_sales", label: "", value: 51234.67, unit: "EUR" }), "51.235 €");
});
