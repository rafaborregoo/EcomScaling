import { test } from "node:test";
import assert from "node:assert/strict";
import { DECISION_BLOCKS, evaluateDecisionBlocks } from "./decision-blocks-engine.js";

const NOW = "2026-09-27T00:00:00.000Z";

test("los siete bloques 4.06-4.12 evaluan sin casos y con casos", () => {
  assert.deepEqual(DECISION_BLOCKS.map((b) => b.code), ["4.06", "4.07", "4.08", "4.09", "4.10", "4.11", "4.12"]);
  for (const caseIds of [[], ["case-a", "case-b"]]) {
    for (const { block, result } of evaluateDecisionBlocks("org-1", caseIds, NOW)) {
      assert.equal(result.business_id, "org-1", block.code);
      assert.ok(result.input_fingerprint, `${block.code} sin huella`);
      assert.ok(result[block.statusColumn] !== undefined, `${block.code} sin ${block.statusColumn}`);
      if (block.perCandidate) assert.equal(result.candidate_ref, caseIds[0] ?? "org-1", block.code);
    }
  }
});

test("la huella no depende de la hora: repetir la noche no duplica filas", () => {
  const a = evaluateDecisionBlocks("org-1", ["case-a"], NOW);
  const b = evaluateDecisionBlocks("org-1", ["case-a"], "2026-09-28T00:00:00.000Z");
  const changed = a.filter((x, i) => x.result.input_fingerprint !== b[i]!.result.input_fingerprint).map((x) => x.block.code);
  assert.deepEqual(changed, []);
});

test("la huella si cambia cuando cambian los casos", () => {
  const a = evaluateDecisionBlocks("org-1", ["case-a"], NOW);
  const b = evaluateDecisionBlocks("org-1", ["case-b"], NOW);
  const same = a.filter((x, i) => x.result.input_fingerprint === b[i]!.result.input_fingerprint).map((x) => x.block.code);
  assert.deepEqual(same, []);
});
