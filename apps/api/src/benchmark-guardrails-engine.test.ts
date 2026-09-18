import assert from "node:assert/strict";
import test from "node:test";
import { applyBenchmarkGuardrailsEvidence, buildBenchmarkGuardrailsPlaybookContext } from "./benchmark-guardrails-engine.js";

test("F6.00 observa datos propios pero no inventa benchmark, comparabilidad ni confianza", () => {
  const context = buildBenchmarkGuardrailsPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyBenchmarkGuardrailsEvidence(context, {
    sales: { available: true, orders_count: 42, revenue: 1200 },
    funnel: { available: true, sessions: 900 },
    margin: { available: true, items_with_cost: 12 },
    measurement: { available: true, days: 90 },
  }, ["shopify_sales_summary:org-1:2026-09-18"]);
  assert.equal(enriched.facts?.["benchmark.metric.value.observed"], "TRUE");
  assert.equal(enriched.facts?.["benchmark.history.observed"], "TRUE");
  assert.equal(enriched.facts?.["benchmark.reference.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["benchmark.comparability.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["benchmark.confidence.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 1);
});

test("F6.00 deja el juicio indeterminado sin fuentes", () => {
  const context = buildBenchmarkGuardrailsPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyBenchmarkGuardrailsEvidence(context, {});
  assert.equal(enriched.facts?.["benchmark.metric.value.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["benchmark.guardrails.observed"], "UNKNOWN");
});
