import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_REVIEWS } from "./audit-data";
import { AGENT_EVAL_AGENT_CODES } from "../../../../../../packages/ai/src/agent-eval-catalog";
import { READING_MODELS, readingCost } from "./reading-cost";

test("Haiku cambia el tramo por entrada total, incluida caché, al superar 100K", () => {
  const haiku = READING_MODELS[0];
  assert.equal(readingCost(haiku, 100_000, 1000, 0)?.longHaiku, false);
  assert.equal(readingCost(haiku, 100_001, 1000, 100_000)?.longHaiku, true);
  assert.ok(
    Math.abs(readingCost(haiku, 100_000, 1000, 0)!.usd - 0.0105) < 1e-10,
  );
  assert.ok(
    Math.abs(readingCost(haiku, 200_000, 10_000, 100_000)!.usd - 0.08) < 1e-10,
  );
});

test("Sonnet separa entrada nueva, lectura de caché y salida", () => {
  assert.equal(
    readingCost(READING_MODELS[1], 100_000, 10_000, 50_000)?.usd,
    0.205,
  );
});

test("rechaza escenarios imposibles y valores no válidos", () => {
  for (const [input, output, cached] of [
    [-1, 0, 0],
    [1, 0, 2],
    [NaN, 1, 0],
    [Infinity, 0, 0],
    [1.5, 0, 0],
    [1_000_000, 1, 0],
    [1, 128_001, 0],
  ]) {
    assert.equal(
      readingCost(READING_MODELS[0], input!, output!, cached!),
      null,
    );
  }
  assert.equal(readingCost(READING_MODELS[2], 0, 0, 0)?.usd, 0);
});

test("la revisión cubre los 27 agentes actuales sin duplicar códigos", () => {
  const codes = AGENT_REVIEWS.map((a) => a.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.deepEqual([...codes].sort(), [...AGENT_EVAL_AGENT_CODES].sort());
});
