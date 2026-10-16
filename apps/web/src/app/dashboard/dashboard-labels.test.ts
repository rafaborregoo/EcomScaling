import assert from "node:assert/strict";
import test from "node:test";
import { metaAttributionLabel } from "./dashboard-labels";

test("la atribución se explica en lenguaje de cliente sin códigos técnicos", () => {
  assert.equal(metaAttributionLabel(["7d_click_1d_view"]), "7 días tras clic y 1 día tras visualización");
  assert.equal(metaAttributionLabel([null, "7d_click", "7d_click"]), "7 días tras clic");
});
test("las ventanas mixtas no se presentan como una única ventana", () => {
  assert.equal(metaAttributionLabel(["7d_click", "1d_view"]), "ventanas de atribución distintas por anuncio");
});
test("la ausencia o un identificador nuevo no inventan una ventana", () => {
  assert.equal(metaAttributionLabel([null, undefined]), null);
  assert.equal(metaAttributionLabel(["provider_future_enum"]), "ventana configurada en Meta");
});
