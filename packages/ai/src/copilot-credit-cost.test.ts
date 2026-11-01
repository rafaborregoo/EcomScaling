import assert from "node:assert/strict";
import test from "node:test";
import { estimateCostUsd } from "./provider-capabilities.js";

test("el mismo contexto consume más presupuesto con el modelo caro", () => {
  assert.equal(estimateCostUsd("gpt-6-luna", 10_000, 1_000), 0.0015);
  assert.equal(estimateCostUsd("gpt-6-sol", 10_000, 1_000), 0.03);
  assert.equal(estimateCostUsd("claude-opus-5", 10_000, 1_000), 0.075);
});

test("Claude añade la caché a la entrada y OpenAI la descuenta de la entrada total", () => {
  // Sonnet 5: 1000 entrada ($2/M), 100 salida ($10/M), 10000 leídos ($.2/M), 5000 escritos ($2.5/M).
  assert.equal(
    estimateCostUsd("claude-sonnet-5", 1000, 100, 10_000, 5000),
    0.0175,
  );
  assert.equal(estimateCostUsd("gpt-6-luna", 11_000, 100, 10_000), 0.00025);
});

test("Claude distingue escritura de 1h y aplica contexto largo sobre toda la entrada", () => {
  assert.equal(
    estimateCostUsd("claude-sonnet-5", 1000, 100, 10_000, 5000, 2000),
    0.0205,
  );
  assert.equal(
    estimateCostUsd("claude-haiku-5-5", 1000, 100, 100_000),
    0.00575,
  );
});
