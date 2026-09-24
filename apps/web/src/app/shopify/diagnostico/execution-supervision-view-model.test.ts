import { test } from "node:test";
import assert from "node:assert/strict";
import { blockHighlights, executionSupervisionViewModel } from "./execution-supervision-view-model";

test("se queda con la evaluacion mas reciente de cada etapa, no con la ultima de la lista", () => {
  const model = executionSupervisionViewModel([
    { stage: "CAPABILITIES", decision: "CONDITIONAL", result: { block_decision: "PREPARE_ONLY", why: "nueva" } },
    { stage: "CAPABILITIES", decision: "BLOCKED", result: { block_decision: "GAP", why: "vieja" } },
  ]);
  const capabilities = model.find((v) => v.stage === "CAPABILITIES")!;
  assert.equal(capabilities.blockDecision, "PREPARE_ONLY");
  assert.equal(capabilities.why, "nueva");
});

test("doce bloques con su ancla propia, evaluados o no", () => {
  const model = executionSupervisionViewModel([]);
  assert.equal(model.length, 12);
  assert.equal(new Set(model.map((v) => v.anchor)).size, 12);
  assert.ok(model.every((v) => v.blockDecision === "SIN_EVALUACION"));
});

test("cada bloque dice lo suyo: 8.14 nombra con quien choca y 8.01 el modo", () => {
  assert.deepEqual(
    blockHighlights("8.14", { overlaps: [{ plan_id: "plan-9", interaction: "write_conflict", shared_targets: ["product-9"] }] }),
    ["plan-9: write_conflict en product-9"],
  );
  assert.ok(blockHighlights("8.01", { execution_mode: "manual", handoff_required: true }).includes("Requiere que lo aplique una persona"));
});

test("solo se muestran los checks que no se cumplen o no se saben", () => {
  const [view] = executionSupervisionViewModel([
    { stage: "UNIVERSAL", decision: "BLOCKED", result: { checks: [
      { id: "a", status: "PASS", hard: true, detail: "ok" },
      { id: "b", status: "UNKNOWN", hard: true, detail: "sin readiness" },
    ] } },
  ]);
  assert.deepEqual(view!.failedChecks.map((c) => c.id), ["b"]);
});
