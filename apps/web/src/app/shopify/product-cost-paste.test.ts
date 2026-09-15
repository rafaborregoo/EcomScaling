import assert from "node:assert/strict";
import test from "node:test";
import { parseCostPaste } from "./product-cost-paste";

// El camino real es copiar dos columnas de Excel y pegarlas. Estos casos son
// los que aparecen de verdad al hacerlo, no casos de laboratorio.

test("pegado de Excel: tabulador y coma decimal", () => {
  const rows = parseCostPaste("ACEITE-500\t3,40\nACEITE-1L\t6,10");

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.sku, "ACEITE-500");
  assert.equal(rows[0]?.unitCost, 3.4);
  assert.equal(rows[1]?.unitCost, 6.1);
  assert.equal(rows[0]?.problem, null);
});

test("CSV con punto y coma", () => {
  const rows = parseCostPaste("ACEITE-500;3.40");
  assert.equal(rows[0]?.unitCost, 3.4);
  assert.equal(rows[0]?.problem, null);
});

test("la cabecera pegada sin querer se ignora, no se marca como error", () => {
  const rows = parseCostPaste("SKU\tCoste\nACEITE-500\t3,40");
  assert.equal(rows.length, 1, "solo queda la fila de datos");
  assert.equal(rows[0]?.sku, "ACEITE-500");
});

test("con comas y decimal no se adivina: se rechaza la linea", () => {
  // "ACEITE,3,40" puede ser coste 3 con basura detras o coste 3,40. Inventarlo
  // escribiria un COGS equivocado, que arrastra el beneficio de todo el panel.
  const rows = parseCostPaste("ACEITE,3,40");
  assert.equal(rows[0]?.problem, "coma_ambigua");
  assert.equal(rows[0]?.unitCost, null);
});

test("con comas y dos campos limpios si se lee", () => {
  const rows = parseCostPaste("ACEITE-500,3.40");
  assert.equal(rows[0]?.unitCost, 3.4);
  assert.equal(rows[0]?.problem, null);
});

test("una sola columna no vale", () => {
  const rows = parseCostPaste("ACEITE-500\nACEITE-1L");
  assert.equal(rows[0]?.problem, "sin_separador");
});

test("el simbolo de euro y los espacios no estorban", () => {
  const rows = parseCostPaste("ACEITE-500\t 3,40 €");
  assert.equal(rows[0]?.unitCost, 3.4);
});

test("texto donde va el coste se marca, no se cuela como cero", () => {
  const rows = parseCostPaste("ACEITE-500\tpendiente");
  assert.equal(rows[0]?.problem, "coste_no_numerico");
  assert.equal(rows[0]?.unitCost, null);
});

test("las lineas en blanco no cuentan y la numeracion sigue siendo la del pegado", () => {
  const rows = parseCostPaste("ACEITE-500\t3,40\n\n\nACEITE-1L\t6,10");
  assert.equal(rows.length, 2);
  assert.equal(rows[1]?.line, 4, "la segunda fila es la linea 4 del texto");
});

test("coste cero se acepta: hay productos de regalo", () => {
  const rows = parseCostPaste("MUESTRA\t0");
  assert.equal(rows[0]?.unitCost, 0);
  assert.equal(rows[0]?.problem, null);
});
