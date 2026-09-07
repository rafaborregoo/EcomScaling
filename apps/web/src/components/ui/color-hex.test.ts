/**
 * Las dos reglas que tenían roto el selector de color de las plantillas.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { sameHex, toEmailHex } from "./color-hex";

test("el alpha se recorta: el email solo entiende #RRGGBB", () => {
  // Con alpha < 1, react-aria devuelve #RRGGBBAA y el cliente de correo se
  // come el color entero en vez de ignorar el canal de más.
  assert.equal(toEmailHex("#1D4ED880"), "#1d4ed8");
  assert.equal(toEmailHex("#1d4ed8"), "#1d4ed8");
});

test("un hex corrupto o vacío no revienta el selector", () => {
  for (const invalid of ["", "  ", "azul", "#fff", "#12345"]) {
    assert.equal(toEmailHex(invalid), "#000000", `"${invalid}"`);
  }
});

test("la comparación ignora mayúsculas, que es lo que reiniciaba el tirador", () => {
  // react-aria emite en mayúsculas y la app guarda en minúsculas. Comparando
  // en crudo, el eco del propio arrastre parecía un color nuevo llegado de
  // fuera: el selector se reiniciaba y el tirador volvía al sitio.
  assert.ok(sameHex("#1D4ED8", "#1d4ed8"));
  assert.ok(sameHex("#1D4ED8FF", "#1d4ed8"));
  assert.ok(!sameHex("#1d4ed8", "#dc2626"));
});
