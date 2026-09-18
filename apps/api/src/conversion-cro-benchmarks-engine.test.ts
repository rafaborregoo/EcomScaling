import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConversionCroBenchmarksEvidence,
  buildConversionCroBenchmarksPlaybookContext,
} from "./conversion-cro-benchmarks-engine.js";

test("F6.05 observa definición, funnel y economics sin inventar product views ni experimentos", () => {
  const context = buildConversionCroBenchmarksPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyConversionCroBenchmarksEvidence(context, {
    funnel: { available: true, sessions: 1000, cart_additions: 80, checkouts_reached: 40, purchases: 25, conversion_rate: 0.025 },
    sales: { available: true, orders_count: 25, revenue: 2500 },
    economics: { available: true, aov: 100, margin: 900, contribution_per_session: 0.45 },
    history: { available: true, days: 30 },
  }, ["shopify_funnel_summary:org-1:2026-09-18"]);

  assert.equal(enriched.facts?.["conversion_cro.definition.observed"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.funnel.observed"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.sessions.observed"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.add_to_cart.observed"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.checkout.observed"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.purchase.observed"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.economics.observed"], "TRUE");
  assert.equal(enriched.facts?.["conversion_cro.product_views.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["conversion_cro.experiments.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["conversion_cro.guardrails.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["conversion_cro.confidence.observed"], "UNKNOWN");
  assert.deepEqual(enriched.evidence_refs, ["shopify_funnel_summary:org-1:2026-09-18"]);
});

test("F6.05 conserva UNKNOWN sin evidencia de CRO", () => {
  const context = buildConversionCroBenchmarksPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyConversionCroBenchmarksEvidence(context, {});
  assert.equal(enriched.facts?.["conversion_cro.definition.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["conversion_cro.funnel.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["conversion_cro.opportunity.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length ?? 0, 0);
});
