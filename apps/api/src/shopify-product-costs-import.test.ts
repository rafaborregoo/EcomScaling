import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyImportRows,
  summarizeImport,
} from "./shopify-product-costs.js";

// F3b del panel del manager: la importacion masiva de costes decide, linea a
// linea, que se escribe y que no. Escribir un coste equivocado es peor que no
// escribirlo -- el COGS manda en el beneficio de todo el panel -- asi que las
// reglas de descarte se fijan aqui.

test("una linea normal se aplica", () => {
  const [row] = classifyImportRows([{ sku: "ACEITE-500", unitCost: 3.4 }]);
  assert.equal(row?.outcome, "ok");
  assert.equal(row?.line, 1, "la linea se numera desde 1, como en el pegado");
  assert.equal(row?.unit_cost, 3.4);
});

test("el SKU se limpia de espacios", () => {
  // Pegar desde Excel arrastra espacios y el SKU no casaria con el inventario.
  const [row] = classifyImportRows([{ sku: "  ACEITE-500 ", unitCost: 3.4 }]);
  assert.equal(row?.sku, "ACEITE-500");
  assert.equal(row?.outcome, "ok");
});

test("coste cero vale; negativo no", () => {
  // Cero es legitimo (muestras, regalos). Negativo es un error de tecleo.
  const rows = classifyImportRows([
    { sku: "A", unitCost: 0 },
    { sku: "B", unitCost: -1 },
  ]);
  assert.equal(rows[0]?.outcome, "ok");
  assert.equal(rows[1]?.outcome, "invalid_cost");
});

test("sin coste o sin SKU la linea se descarta, no se adivina", () => {
  const rows = classifyImportRows([
    { sku: "A" },
    { sku: "", unitCost: 5 },
    { sku: "C", unitCost: Number.NaN },
  ]);
  assert.equal(rows[0]?.outcome, "invalid_cost");
  assert.equal(rows[1]?.outcome, "missing_sku");
  assert.equal(rows[2]?.outcome, "invalid_cost");
});

test("el mismo SKU dos veces invalida LAS DOS lineas", () => {
  // Es una contradiccion del usuario, no algo que resolver por el: quedarse con
  // la ultima escribiria un coste que nadie decidio.
  const rows = classifyImportRows([
    { sku: "A", unitCost: 3 },
    { sku: "B", unitCost: 4 },
    { sku: "A", unitCost: 9 },
  ]);
  assert.equal(rows[0]?.outcome, "duplicate_in_input");
  assert.equal(rows[2]?.outcome, "duplicate_in_input");
  assert.equal(rows[1]?.outcome, "ok", "la que no se repite sigue valiendo");
});

test("el resumen cuadra con las lineas", () => {
  const rows = classifyImportRows([
    { sku: "A", unitCost: 3 },
    { sku: "B", unitCost: -1 },
    { sku: "", unitCost: 5 },
    { sku: "C", unitCost: 1 },
    { sku: "C", unitCost: 2 },
  ]);
  const summary = summarizeImport(rows);

  assert.equal(summary.total, 5);
  assert.equal(summary.applicable, 1);
  assert.equal(summary.invalid_cost, 1);
  assert.equal(summary.missing_sku, 1);
  assert.equal(summary.duplicate_in_input, 2);
  assert.equal(
    summary.applicable +
      summary.invalid_cost +
      summary.missing_sku +
      summary.duplicate_in_input +
      summary.sku_not_found +
      summary.sku_ambiguous,
    summary.total,
    "ninguna linea puede quedarse sin contar en el resumen",
  );
});
