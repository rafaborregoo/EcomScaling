import assert from "node:assert/strict";
import test from "node:test";
import { copilotCreditsForCost } from "./copilot-credits.js";

test("misma bolsa: 5 USD agotan un millón de créditos y se redondea por ejecución", () => {
  assert.equal(copilotCreditsForCost(5), 1_000_000);
  assert.equal(copilotCreditsForCost(0.000001), 1);
  assert.equal(copilotCreditsForCost(0.03), 6000);
  assert.equal(copilotCreditsForCost(0), 0);
});

test("un coste desconocido, negativo o inválido no se convierte en uso gratuito", () => {
  for (const cost of [null, NaN, Infinity, -1]) {
    assert.throws(
      () => copilotCreditsForCost(cost),
      /copilot_cost_unavailable/,
    );
  }
});
