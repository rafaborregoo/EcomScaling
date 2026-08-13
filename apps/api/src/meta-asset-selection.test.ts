import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAssetIds } from "./meta.js";

test("normalizeAssetIds deja pasar una seleccion omitida", () => {
  assert.equal(normalizeAssetIds(undefined), undefined);
});

test("normalizeAssetIds limpia, deduplica y limita IDs internos", () => {
  assert.deepEqual(normalizeAssetIds([" a ", "a", "b", 42, ""]), ["a", "b"]);
  assert.equal(
    normalizeAssetIds(Array.from({ length: 101 }, (_, index) => String(index))),
    null,
  );
});

test("normalizeAssetIds rechaza entradas que no son arrays", () => {
  assert.equal(normalizeAssetIds("asset-id"), null);
  assert.equal(normalizeAssetIds({ id: "asset-id" }), null);
});
