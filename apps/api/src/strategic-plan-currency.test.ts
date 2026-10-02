import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCurrencyCode } from "./strategic-plans.js";

test("la moneda del camino solo acepta ISO 4217 válido", () => {
  assert.equal(normalizeCurrencyCode("eur"), "EUR");
  assert.equal(normalizeCurrencyCode(" USD "), "USD");
  assert.equal(normalizeCurrencyCode("EURO"), null);
  assert.equal(normalizeCurrencyCode("E1R"), null);
  assert.equal(normalizeCurrencyCode(42), null);
  assert.equal(normalizeCurrencyCode(null), null);
});
