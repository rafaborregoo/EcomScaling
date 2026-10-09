import assert from "node:assert/strict";
import test from "node:test";
import type { CopilotEvidenceReference } from "@e-nora/contracts";
import { scoreChartIdentification, scoreCopilotAnswer } from "./copilot-quality-evals.js";

const expected: CopilotEvidenceReference = {
  kind: "chart_point", source: "meta", route: "/meta", section: "ROAS diario",
  connection_id: null, entity: null, metric: { key: "meta_roas", date: "2026-10-07" },
  period: { start: "2026-10-01", end: "2026-10-08" }, period_label: "7 días", filters: {},
};

test("chart identification detects a different point even when the graph is correct", () => {
  assert.equal(scoreChartIdentification(expected, expected).correct, true);
  const wrongDay = { ...expected, metric: { key: "meta_roas" as const, date: "2026-10-06" } };
  const score = scoreChartIdentification(wrongDay, expected);
  assert.equal(score.correct, false);
  assert.equal(score.checks.metric, false);
});

test("answer evaluation separates correct figures, source citations and unsupported claims", () => {
  const score = scoreCopilotAnswer({
    answer: "El ROAS de Meta fue 2,5 el 7 de octubre; Shopify confirma 50 pedidos.",
    sources: [{ kind: "metric", reference: "meta_performance_daily" }],
    expectedFacts: [
      { text: "2,5", source: "meta_performance_daily", sourceKind: "metric" },
      { text: "7 de octubre", source: "meta_performance_daily", sourceKind: "metric" },
    ],
    forbiddenClaims: ["Shopify confirma 50 pedidos"],
  });
  assert.equal(score.factAccuracy, 1);
  assert.equal(score.citationCoverage, 1);
  assert.deepEqual(score.unsupportedClaims, ["Shopify confirma 50 pedidos"]);
  assert.equal(scoreCopilotAnswer({
    answer: "El ROAS fue 2,5.", sources: [],
    expectedFacts: [{ text: "2,5", source: "meta_performance_daily", sourceKind: "metric" }],
  }).citationCoverage, 0);
});
