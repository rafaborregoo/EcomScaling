/**
 * El signo del umbral de "caída de ventas".
 *
 * `runAlertRules` evalúa `cambio% < umbral` con -30 por defecto. Guardar 30 en
 * vez de -30 convierte la condición en "cambio menor que +30%", cierta casi
 * siempre: el aviso saltaría a diario con las ventas subiendo. No da error, no
 * rompe nada visible -- solo deja de significar lo que dice.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  toDisplayThreshold,
  toStoredThreshold,
  thresholdLabel,
} from "./alert-threshold";

test("la caída de ventas se guarda en negativo, se escriba como se escriba", () => {
  assert.equal(toStoredThreshold("shopify_revenue_drop", "30"), -30);
  // Quien ya sabe que se guarda negativo tampoco se equivoca: -30 sigue
  // significando "una caída del 30%", no "una subida del 30%".
  assert.equal(toStoredThreshold("shopify_revenue_drop", "-30"), -30);
});

test("las demás reglas cuentan cosas y no se tocan", () => {
  assert.equal(toStoredThreshold("shopify_stock_out", "3"), 3);
  assert.equal(toStoredThreshold("integration_sync_failed", "0"), 0);
});

test("el campo se enseña en positivo para la caída y tal cual para el resto", () => {
  assert.equal(toDisplayThreshold("shopify_revenue_drop", -30), "30");
  assert.equal(toDisplayThreshold("shopify_stock_out", 3), "3");
  assert.equal(toDisplayThreshold("shopify_stock_out", 0), "0", "el cero se enseña, no se oculta");
});

test("vacío o ilegible es 'sin personalizar', no un cero silencioso", () => {
  // Un 0 accidental en la caída de ventas sería "avisa cuando caiga más de 0%":
  // un aviso cada día que la tienda no crezca.
  for (const input of ["", "   ", "abc", "--"]) {
    assert.equal(toStoredThreshold("shopify_revenue_drop", input), null);
  }
  assert.equal(toDisplayThreshold("shopify_revenue_drop", null), "");
});

test("una plantilla nueva sin etiqueta propia no rompe la pantalla", () => {
  assert.equal(thresholdLabel("regla_que_aun_no_existe"), "Umbral");
  assert.equal(
    thresholdLabel("shopify_stock_out"),
    "Avisar a partir de (productos sin stock)",
  );
});
