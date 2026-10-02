import { test } from "node:test";
import assert from "node:assert/strict";
import { DECISION_BLOCKS, evaluateDecisionBlocks } from "./decision-blocks-engine.js";

const NOW = "2026-09-27T00:00:00.000Z";

test("los siete bloques 4.06-4.12 evaluan sin casos y con casos", () => {
  assert.deepEqual(DECISION_BLOCKS.map((b) => b.code), ["4.06", "4.07", "4.08", "4.09", "4.10", "4.11", "4.12"]);
  for (const caseIds of [[], ["case-a", "case-b"]]) {
    const evaluated = evaluateDecisionBlocks("org-1", caseIds, NOW);
    for (const { block, result, candidate } of evaluated) {
      assert.equal(result.business_id, "org-1", block.code);
      assert.ok(result.input_fingerprint, `${block.code} sin huella`);
      assert.ok(result[block.statusColumn] !== undefined, `${block.code} sin ${block.statusColumn}`);
      if (block.perCandidate) assert.equal(result.candidate_ref, candidate, block.code);
    }
    // Un bloque por candidato da una evaluacion por caso; sin casos, ninguna (la organizacion no es candidato).
    for (const block of DECISION_BLOCKS.filter((b) => b.perCandidate)) {
      assert.deepEqual(evaluated.filter((e) => e.block === block).map((e) => e.candidate), caseIds, block.code);
    }
  }
});

test("dos casos abiertos: cada caso tiene su propia decision, ninguna con la organizacion como candidato", () => {
  const evaluated = evaluateDecisionBlocks("org-1", ["case-a", "case-b"], NOW);
  for (const code of ["4.06", "4.07", "4.08", "4.09", "4.12"]) {
    const refs = evaluated.filter((e) => e.block.code === code).map((e) => e.result.candidate_ref);
    assert.deepEqual(refs, ["case-a", "case-b"], code);
    const fingerprints = new Set(evaluated.filter((e) => e.block.code === code).map((e) => e.result.input_fingerprint));
    assert.equal(fingerprints.size, 2, `${code}: huellas distintas por caso`);
  }
  assert.ok(!evaluated.some((e) => e.result.candidate_ref === "org-1"));
});

test("sin casos, ranking no se evalua y cartera no inventa un candidato de organizacion", () => {
  const evaluated = evaluateDecisionBlocks("org-1", [], NOW);
  assert.ok(!evaluated.some((e) => e.block.code === "4.10"));
  const portfolio = evaluated.find((e) => e.block.code === "4.11")!.result as { candidates?: Array<{ candidate_ref: string }> };
  assert.ok(!(portfolio.candidates ?? []).some((c) => c.candidate_ref === "org-1"));
});

test("la huella no depende de la hora: repetir la noche no duplica filas", () => {
  const a = evaluateDecisionBlocks("org-1", ["case-a"], NOW);
  const b = evaluateDecisionBlocks("org-1", ["case-a"], "2026-09-28T00:00:00.000Z");
  const changed = a.filter((x, i) => x.result.input_fingerprint !== b[i]!.result.input_fingerprint).map((x) => x.block.code);
  assert.deepEqual(changed, []);
});

test("la huella si cambia cuando cambian los casos", () => {
  const a = evaluateDecisionBlocks("org-1", ["case-a"], NOW);
  const b = evaluateDecisionBlocks("org-1", ["case-b"], "2026-09-27T00:00:00.000Z");
  const same = a.filter((x, i) => x.result.input_fingerprint === b[i]!.result.input_fingerprint).map((x) => x.block.code);
  assert.deepEqual(same, []);
});
