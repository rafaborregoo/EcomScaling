import assert from "node:assert/strict";
import test from "node:test";
import { applyCohortContextEvidence, buildCohortContextPlaybookContext } from "./cohort-context-engine.js";

test("F6.01 observa la métrica y el histórico sin inventar cohortes comparables", () => {
  const context = buildCohortContextPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyCohortContextEvidence(context, {
    sales: { available: true, orders_count: 42, revenue: 1200 },
    funnel: { available: true, sessions: 900, conversion_rate: 0.046 },
    measurement: { available: true, days: 90 },
  }, ["shopify_sales_summary:org-1:2026-09-18"]);
  assert.equal(enriched.facts?.["cohort.metric.observed"], "TRUE");
  assert.equal(enriched.facts?.["cohort.history.observed"], "TRUE");
  assert.equal(enriched.facts?.["cohort.reference.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["cohort.comparability.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["cohort.definition_compatibility.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["cohort.confidence.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 1);
});

test("F6.01 conserva unknown cuando no hay evidencia de cohortes", () => {
  const context = buildCohortContextPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyCohortContextEvidence(context, {});
  assert.equal(enriched.facts?.["cohort.metric.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["cohort.sample.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["cohort.mix.observed"], "UNKNOWN");
});
