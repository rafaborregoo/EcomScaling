import assert from "node:assert/strict";
import test from "node:test";
import { applyOfferPricingBenchmarksEvidence, buildOfferPricingBenchmarksPlaybookContext } from "./offer-pricing-benchmarks-engine.js";

test("F6.06 observa AOV y economics sin convertir AOV en profit ni promoción en incrementalidad", () => {
  const context = buildOfferPricingBenchmarksPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyOfferPricingBenchmarksEvidence(context, {
    sales: { available: true, orders_count: 20, revenue: 2400, units_sold: 30 },
    margin: { available: true, contribution: 720, items_with_cost: 8 },
    funnel: { available: true, sessions: 1000, conversion_rate: 0.02 },
    products: { available: true, product_count: 8, top_products_count: 5 },
    promotions: { available: true, discount_codes: 2 },
    history: { available: true, days: 30 },
  }, ["shopify_sales_summary:org-1:2026-09-18"]);

  assert.equal(enriched.facts?.["offer_pricing_benchmarks.aov.observed"], "TRUE");
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.economics.observed"], "TRUE");
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.contribution_per_order.observed"], "TRUE");
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.funnel.observed"], "TRUE");
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.product_mix.observed"], "TRUE");
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.promotions.observed"], "TRUE");
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.incrementality.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.pricing_elasticity.observed"], "UNKNOWN");
});

test("F6.06 conserva UNKNOWN cuando faltan fuentes de monetización", () => {
  const context = buildOfferPricingBenchmarksPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyOfferPricingBenchmarksEvidence(context, {});
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.aov.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.guardrails.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["offer_pricing_benchmarks.confidence.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length ?? 0, 0);
});
