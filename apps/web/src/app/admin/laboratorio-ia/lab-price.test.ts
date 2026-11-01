import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateLabApiPrice } from "./lab-price";

test("Terra tarifa exactamente la mitad de Sol con el mismo uso, también en contexto largo", () => {
  for (const input of [25000, 300000]) {
    const usage = {input, cached: 1000, cache_creation: 0, output: 1500};
    assert.equal(calculateLabApiPrice("gpt-6.1-terra", usage)?.low, calculateLabApiPrice("gpt-6.1-sol", usage)!.low / 2);
  }
});

test("A02: no suma ni cobra dos veces los 12.416 tokens cacheados incluidos en los 25.647 de Sol", () => {
  const price = calculateLabApiPrice("gpt-6.1-sol", {
    input: 25647,
    cached: 12416,
    cache_creation: 0,
    output: 1133,
  })!;
  assert.equal(price.inputTotal, 25647);
  assert.equal(price.low, 0.0390336);
  assert.equal(price.high, price.low);
});
test("Anthropic suma categorías y mantiene rango de escritura 5m/1h", () => {
  const price = calculateLabApiPrice("claude-sonnet-5-5", {
    input: 2,
    cached: 0,
    cache_creation: 4444,
    output: 1830,
  })!;
  assert.equal(price.inputTotal, 4446);
  assert.equal(price.low, 0.029414);
  assert.equal(price.high, 0.03608);
});
test("Haiku y Sol aplican su contexto largo a la petición, sin cambiar A01 corto", () => {
  const haiku = calculateLabApiPrice("claude-haiku-5-5", {
    input: 6,
    cached: 60773,
    cache_creation: 47919,
    output: 32681,
  })!;
  assert.equal(haiku.inputTotal, 108698);
  assert.ok(haiku.low > 0.11 && haiku.high < 0.14);
  assert.equal(
    calculateLabApiPrice("gpt-6.1-sol", {
      input: 300000,
      cached: 100000,
      cache_creation: 0,
      output: 1000,
    })?.low,
    0.835,
  );
  assert.equal(
    calculateLabApiPrice("gpt-6.1-sol", {
      input: 52169,
      cached: 0,
      cache_creation: 0,
      output: 2498,
    })?.low,
    0.129318,
  );
});
test("no inventa costes con categorías faltantes o caché mayor que la entrada total", () => {
  assert.equal(
    calculateLabApiPrice("gpt-6.1-sol", {
      input: 100,
      cached: 101,
      cache_creation: 0,
      output: 2,
    }),
    null,
  );
  assert.equal(
    calculateLabApiPrice("gpt-6.1-sol", {
      input: 100,
      cached: null,
      cache_creation: 0,
      output: 2,
    }),
    null,
  );
});
