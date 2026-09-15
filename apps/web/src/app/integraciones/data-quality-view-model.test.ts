/**
 * FASE 3 / D01 — la pantalla no puede decir algo mas tranquilizador que el dato.
 *
 * Estos tests cubren la unica forma real de que esta vista haga dano: que una
 * fuente que impide diagnosticar se lea como aceptable, o que aparezca un
 * porcentaje de cobertura donde no habia con que calcularlo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { downstreamVerdict, sourceFacts } from "./data-quality-view-model";

const issue = (downstream_effect: "none" | "degraded" | "blocked") => ({
  downstream_effect,
});

test("D01 vista: manda lo peor, no lo ultimo ni lo mas frecuente", () => {
  // Cuatro avisos inofensivos no compensan uno que bloquea.
  const v = downstreamVerdict({
    issues: [issue("none"), issue("none"), issue("degraded"), issue("blocked")],
  });
  assert.equal(v.label, "Bloquea el diagnóstico");
  assert.equal(v.tone, "danger");
});

test("D01 vista: degradar no se pinta como bloquear", () => {
  const v = downstreamVerdict({ issues: [issue("none"), issue("degraded")] });
  assert.equal(v.label, "Lo degrada");
  assert.equal(v.tone, "warn");
});

test("D01 vista: avisos que no tocan el diagnostico dejan la fuente apta", () => {
  // Un periodo abierto es informacion, no una averia: si tinera la fila de
  // amarillo, todas las fuentes estarian siempre en amarillo.
  const v = downstreamVerdict({ issues: [issue("none")] });
  assert.equal(v.label, "Apto");
  assert.equal(v.tone, "success");
});

test("D01 vista: sin cobertura medible no se inventa un porcentaje", () => {
  const texto = sourceFacts({
    freshness: "fresh",
    coverage: null,
    period_settlement: "settled",
  });
  assert.ok(!texto.includes("%"), `no deberia haber porcentaje en "${texto}"`);
  assert.ok(!texto.includes("sin huecos"), "tampoco puede afirmar que no faltan datos");
});

test("D01 vista: la cobertura incompleta se dice en cristiano", () => {
  const texto = sourceFacts({
    freshness: "stale",
    coverage: 0.57,
    period_settlement: "open",
  });
  assert.ok(texto.includes("57% del periodo cubierto"));
  assert.ok(texto.includes("obsoleto"));
  assert.ok(texto.includes("periodo aún abierto"));
});

test("D01 vista: un estado que no conozcamos se muestra tal cual, no se traga", () => {
  const texto = sourceFacts({
    freshness: "inventado",
    coverage: null,
    period_settlement: "raro",
  });
  assert.ok(texto.includes("inventado"));
  assert.ok(texto.includes("raro"));
});
