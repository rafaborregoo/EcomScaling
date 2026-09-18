import assert from "node:assert/strict";
import test from "node:test";
import { applyAcquisitionDemandEvidence, buildAcquisitionDemandPlaybookContext } from "./acquisition-demand-engine.js";

test("F6.03 observa ventas y economics disponibles sin llamar adquisición a todo revenue", () => {
  const context = buildAcquisitionDemandPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyAcquisitionDemandEvidence(context, {
    sales: { available: true, orders_count: 42, revenue: 1200 },
    margin: { available: true, contribution: 420, items_with_cost: 12 },
    funnel: { available: true, sessions: 900 },
  }, ["shopify_sales_summary:org-1:2026-09-18"]);
  assert.equal(enriched.facts?.["acquisition.sales.observed"], "TRUE");
  assert.equal(enriched.facts?.["acquisition.economics.observed"], "TRUE");
  assert.equal(enriched.facts?.["acquisition.sample.observed"], "TRUE");
  assert.equal(enriched.facts?.["acquisition.new_customers.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.cac.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.incrementality.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.confidence.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 1);
});

test("F6.03 conserva unknown sin inversión ni calidad de cliente", () => {
  const context = buildAcquisitionDemandPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyAcquisitionDemandEvidence(context, {});
  assert.equal(enriched.facts?.["acquisition.spend.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.customer_quality.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["acquisition.concentration.observed"], "UNKNOWN");
});
