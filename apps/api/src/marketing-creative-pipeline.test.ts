import test from "node:test";
import assert from "node:assert/strict";
import { runMarketingCreativePipeline, type StageReceipt, type MarketingPipelineTrace } from "./marketing-creative-pipeline.js";

const product = "33333333-3333-4333-8333-333333333333";
const narrative = { concept: "Producto real", subject: "Tu próxima salida", preheader: "Una elección", headline: "En la nieve", body: "Descubre el producto", call_to_action: "Ver producto", product_ids: [product], pending: [] };
function setup(options: { invalidProduct?: boolean; unknownPrice?: boolean; expensive?: boolean; reviewBlocks?: boolean; invalidDesign?: boolean } = {}) {
  const calls: string[] = [], snapshots: MarketingPipelineTrace[] = [];
  return { calls, snapshots, run: () => runMarketingCreativePipeline({ productIds: [product], maxCostUsd: 1,
    checkpoint: async (trace) => { snapshots.push(trace); },
    validateDesign: (value) => { if (options.invalidDesign) throw new Error("invalid_design"); return value as { html: string }; },
    invoke: async (stage, previous) => {
      calls.push(stage); assert.equal(previous.length, calls.length - 1);
      if (stage === "design") assert.equal((previous[0]!.output as typeof narrative).subject, narrative.subject);
      return { stage, model: "candidate", model_verified: false, duration_ms: 20,
        price: options.unknownPrice ? null : { low: 0.1, high: options.expensive ? 1 : 0.2 },
        output: stage === "narrative" ? { ...narrative, product_ids: options.invalidProduct ? ["44444444-4444-4444-8444-444444444444"] : [product] } : stage === "design" ? { html: "<p>Producto</p>" } : { verdict: options.reviewBlocks ? "needs_changes" : "acceptable_draft", summary: "Contenido revisado; render pendiente", issues: options.reviewBlocks ? [{ severity: "blocking", detail: "Precio inventado" }] : [] },
      } satisfies StageReceipt;
    },
  }) };
}
test("subagents pass typed results in order, sum all costs and never claim visual review", async () => {
  const fixture = setup(); const result = await fixture.run();
  assert.deepEqual(fixture.calls, ["narrative", "design", "review"]);
  assert.ok(Math.abs(result.price.high - 0.6) < 1e-10);
  assert.equal(result.trace.visual_review, "pending"); assert.equal(result.readyForHumanReview, true);
  assert.equal(fixture.snapshots[0]!.stages.length, 0); assert.equal(fixture.snapshots.at(-1)!.status, "completed");
});
test("out-of-scope product blocks design and preserves failed stage/output/cost", async () => {
  const fixture = setup({ invalidProduct: true }); await assert.rejects(fixture.run(), /out_of_scope/);
  assert.deepEqual(fixture.calls, ["narrative"]); assert.equal(fixture.snapshots.at(-1)!.failed_stage, "narrative"); assert.equal(fixture.snapshots.at(-1)!.stages.length, 1);
});
test("unknown cost or exhausted budget stops further calls", async () => {
  for (const options of [{ unknownPrice: true }, { expensive: true }]) {
    const fixture = setup(options); await assert.rejects(fixture.run(), /cost_unknown|budget_exhausted/);
    assert.deepEqual(fixture.calls, ["narrative"]);
  }
});
test("invalid design never reaches reviewer and remains available for diagnosis", async () => {
  const fixture = setup({ invalidDesign: true }); await assert.rejects(fixture.run(), /invalid_design/);
  assert.deepEqual(fixture.calls, ["narrative", "design"]); assert.equal(fixture.snapshots.at(-1)!.stages.length, 2);
});
test("review rejection is retained without auto rewrite or publish", async () => {
  const fixture = setup({ reviewBlocks: true }); const result = await fixture.run();
  assert.equal(result.readyForHumanReview, false); assert.equal(result.trace.stages.length, 3); assert.equal(result.review.issues[0]!.detail, "Precio inventado");
});
