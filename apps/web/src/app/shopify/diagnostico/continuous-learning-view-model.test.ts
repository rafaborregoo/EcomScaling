import { test } from "node:test";
import assert from "node:assert/strict";
import { continuousLearningViewModel, F9_SECTIONS } from "./continuous-learning-view-model";

test("las cuatro secciones cubren los 40 bloques una vez, con su ancla", () => {
  const blocks = F9_SECTIONS.flatMap((s) => s.blocks);
  assert.equal(blocks.length, 40);
  assert.equal(new Set(blocks).size, 40);
  assert.ok(!blocks.includes("9.21"));
  assert.equal(new Set(F9_SECTIONS.map((s) => s.anchor)).size, 4);
});

test("cada bloque muestra su propia decision y la evaluacion mas reciente", () => {
  const model = continuousLearningViewModel([
    { block_code: "9.03", status: "BLOCKED", result: { title: "Execution fidelity", block_decision: "NO", why: "nueva", next_evidence: [] } },
    { block_code: "9.03", status: "READY", result: { block_decision: "YES", why: "vieja" } },
  ]);
  const item = model.sections[0]!.items.find((i) => i.block === "9.03")!;
  assert.equal(item.decision, "NO");
  assert.equal(item.why, "nueva");
  assert.equal(model.blocked, 1);
  assert.equal(model.evaluated, 1);
});
