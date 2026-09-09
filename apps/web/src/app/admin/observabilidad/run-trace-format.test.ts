/**
 * AI-30: la regla `null` != `0`, en la pantalla.
 *
 * La fase 1 la impuso en la base de datos. Estos tests existen porque volver a
 * romperla en la capa de presentacion es trivial (`usd ?? 0`) y el resultado
 * seria el mismo: un consultor mirando "$0.00" en una ejecucion cuyo coste no
 * sabemos calcular.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCostWithBasis,
  formatDuration,
  formatReportedTokens,
  severityTone,
  waterfallWidths,
} from "./run-trace-format.js";

test("un coste no calculable no se pinta como cero", () => {
  assert.equal(formatCostWithBasis(null, "unknown_model"), "No calculable");
  assert.equal(formatCostWithBasis(null, null), "Desconocido");

  // Un coste real de cero si es cero: no todo null.
  assert.equal(formatCostWithBasis(0, "priced"), "$0.00");
});

test("el coste conserva decimales donde importan", () => {
  // Una ejecucion de céntimos no puede redondearse a $0.00.
  assert.equal(formatCostWithBasis(0.0032, "priced"), "$0.0032");
  assert.equal(formatCostWithBasis(12.5, "priced"), "$12.50");
});

test("un token no reportado se distingue de un token que vale cero", () => {
  assert.equal(formatReportedTokens(null), "No reportado");
  assert.equal(formatReportedTokens(0), "0");
});

test("la duracion cambia de unidad al segundo", () => {
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(940), "940 ms");
  assert.equal(formatDuration(1500), "1.50 s");
});

test("la severidad alta se pinta como peligro y la desconocida no alarma", () => {
  assert.equal(severityTone("critical"), "danger");
  assert.equal(severityTone("high"), "danger");
  assert.equal(severityTone("medium"), "warn");
  assert.equal(severityTone("info"), "neutral");
  assert.equal(severityTone("inventada"), "neutral");
});

test("la cascada reparte el ancho por duracion y no esconde las fases cortas", () => {
  const widths = waterfallWidths([
    { duration_ms: 30_000 },
    { duration_ms: 1 },
    { duration_ms: null },
  ]);

  assert.ok(widths[0]! > 90, "la fase dominante ocupa casi todo");
  // Una fase de 1 ms sobre 30 s daria 0.003%: invisible, y una fase invisible
  // no se audita.
  assert.equal(widths[1], 2);
  assert.equal(widths[2], 2);
});

test("sin duraciones medidas no se inventan barras", () => {
  assert.deepEqual(waterfallWidths([{ duration_ms: null }]), [0]);
  assert.deepEqual(waterfallWidths([]), []);
});
