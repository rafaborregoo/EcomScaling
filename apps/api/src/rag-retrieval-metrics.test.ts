import assert from "node:assert/strict";
import test from "node:test";
import { scoreRetrievalAtK } from "./rag-retrieval-metrics.js";

test("scores relevant documents in the first k results", () => {
  assert.deepEqual(scoreRetrievalAtK(["noise", "roas", "fatigue"], ["roas", "fatigue"], 3), {
    precision: 2 / 3,
    recall: 1,
    reciprocalRank: 1 / 2,
    hits: 2,
  });
});

test("counts repeated chunks from one document once", () => {
  const score = scoreRetrievalAtK(["roas", "roas", "noise"], ["roas"], 3);
  assert.equal(score.precision, 1 / 3);
  assert.equal(score.recall, 1);
});

test("requires human relevance labels for positive queries", () => {
  assert.throws(() => scoreRetrievalAtK(["noise"], [], 3));
});
