/**
 * FASE 3 / D05 — lo que esta pantalla no puede dejar que pase.
 *
 * Los dos fallos que persiguen estos tests son los dos guardrails que mas
 * facilmente se rompen sin darse cuenta: ordenar por magnitud (que inventa una
 * prioridad) y ensenar una magnitud grande sin decir que la base es minuscula
 * (que hace gritar al motor cuanto menos importa lo que mira).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  baselineNote,
  headline,
  magnitudeCaveat,
  magnitudeText,
  patternNote,
  relevanceLabel,
  sortSignals,
  splitBySuppression,
  weaknesses,
  windowLabel,
  type SignalView,
} from "./signal-list-view-model";

function senal(overrides: Partial<SignalView> = {}): SignalView {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    organization_name: "Tienda",
    signal_type: "level",
    anomaly_type: null,
    capability: null,
    metric: "net_sales",
    scope: "business",
    scope_detail: {},
    direction: "down",
    observed_value: 820,
    baseline_value: 1000,
    magnitude_absolute: -180,
    magnitude_relative: -0.18,
    expected_low: 900,
    expected_high: 1100,
    window_start: "2026-09-01T00:00:00.000Z",
    window_end: "2026-09-07T00:00:00.000Z",
    detected_at: "2026-09-08T00:00:00.000Z",
    persistence: "emerging",
    trajectory: null,
    regime: "anomaly",
    baseline_kind: "own_history",
    baseline_conflict: false,
    sample_size: 14,
    low_sample: false,
    statistical_method: "median_mad",
    statistical_strength: "moderate",
    business_relevance: "medium",
    business_exposure: "moderate",
    data_confidence: "high",
    signal_confidence: "medium",
    suppression: "none",
    description: "Las ventas netas bajan un 18% respecto a su propio histórico.",
    in_symptom: false,
    ...overrides,
  };
}

test("se ordena por fin de ventana, nunca por magnitud", () => {
  // Es el nucleo de la pantalla. Ordenar de mayor a menor caida pinta una
  // prioridad que D05 no calcula, y quien la lea la tomara por una.
  const pequenaReciente = senal({
    id: "a",
    magnitude_relative: -0.02,
    window_end: "2026-09-14T00:00:00.000Z",
  });
  const enormeVieja = senal({
    id: "b",
    magnitude_relative: -0.91,
    window_end: "2026-08-01T00:00:00.000Z",
  });

  const ordenadas = sortSignals([enormeVieja, pequenaReciente]);
  assert.deepEqual(
    ordenadas.map((s) => s.id),
    ["a", "b"],
    "la reciente va primero aunque sea la mas pequena",
  );
});

test("dos señales del mismo día no bailan entre recargas", () => {
  const primera = senal({ id: "aaa", window_end: "2026-09-14T00:00:00.000Z" });
  const segunda = senal({ id: "bbb", window_end: "2026-09-14T00:00:00.000Z" });

  assert.deepEqual(
    sortSignals([segunda, primera]).map((s) => s.id),
    sortSignals([primera, segunda]).map((s) => s.id),
  );
});

test("una magnitud grande sobre base pequeña lo dice en voz alta", () => {
  // Guardrail 8 y su ejemplo del 57: un +200% en una campana minuscula puede
  // ser irrelevante. Ensenar el 200% y callar la exposicion es el fallo.
  const ruidosa = senal({
    magnitude_relative: 2,
    business_exposure: "minimal",
    business_relevance: "low",
  });
  assert.match(magnitudeCaveat(ruidosa) ?? "", /base pequeña/);

  // Y no se avisa cuando no hay nada que avisar, para no llenar la lista.
  assert.equal(magnitudeCaveat(senal()), null);
});

test("magnitud y relevancia se dicen por separado", () => {
  assert.equal(magnitudeText(senal()), "-18.0%");
  assert.equal(magnitudeText(senal({ magnitude_relative: 0.2 })), "+20.0%");
  assert.equal(magnitudeText(senal({ magnitude_relative: null })), null);

  assert.equal(relevanceLabel(senal()).label, "Exposición media");
  assert.equal(relevanceLabel(senal({ business_relevance: "critical" })).tone, "danger");
});

test("una señal sola es 'aún no forma patrón', no 'sin importancia'", () => {
  // Decir que no importa seria afirmar una ausencia que nadie ha comprobado:
  // puede ser la primera de un patron que todavia no existe.
  assert.equal(patternNote(senal()).label, "Aún no forma patrón");
  assert.equal(patternNote(senal({ in_symptom: true })).label, "Forma parte de un patrón");
});

test("el titular dice qué se movió, nunca por qué", () => {
  assert.equal(headline(senal()), "Ventas netas baja");
  assert.equal(
    headline(senal({ metric: "orders_count", direction: "up" })),
    "Número de pedidos sube",
  );

  // La frontera del bloque: guardrails 49 y 50. Si esto empieza a hablar de
  // causas, D05 se ha comido a D07.
  const prohibidas = /fatiga|causa|porque|debido|culpa|recomend/i;
  assert.ok(!prohibidas.test(headline(senal())));
});

test("lo que debilita la señal se dice, y solo cuando lo hay", () => {
  assert.deepEqual(weaknesses(senal()), []);

  const floja = senal({
    low_sample: true,
    sample_size: 3,
    baseline_conflict: true,
    statistical_strength: "weak",
    data_confidence: "insufficient_data",
  });
  const avisos = weaknesses(floja);
  assert.equal(avisos.length, 4);
  assert.match(avisos[0] ?? "", /\(3\)/, "el tamaño de muestra va en la frase");
});

test("se dice contra qué se compara, y null cuando no consta", () => {
  assert.equal(baselineNote(senal()), "Comparada contra su propio histórico");
  assert.equal(baselineNote(senal({ baseline_kind: null })), null);
});

test("las señales apartadas se separan, no se esconden", () => {
  const { visibles, apartadas } = splitBySuppression([
    senal({ id: "a" }),
    senal({ id: "b", suppression: "reduce_attention" }),
    senal({ id: "c", suppression: "suppress" }),
  ]);

  assert.deepEqual(visibles.map((s) => s.id), ["a"]);
  assert.deepEqual(apartadas.map((s) => s.id), ["b", "c"]);
});

test("la ventana se lee como un rango de fechas", () => {
  assert.match(windowLabel(senal()), /sept/);
});
