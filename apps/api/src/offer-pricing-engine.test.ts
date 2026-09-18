import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOfferPricingEvidence,
  buildOfferPricingPlaybookContext,
} from "./offer-pricing-engine.js";

test("P04 no confunde AOV disponible con rentabilidad", () => {
  const context = buildOfferPricingPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyOfferPricingEvidence(context, {
    sales: { orders_count: 4, discounts: 10 },
    margin: { items_with_cost: 0 },
    stock: { tracked_items: 3 },
    top_products_count: 2,
  });
  assert.equal(enriched.facts?.["offer_pricing.economics.aov.available"], "TRUE");
  assert.equal(enriched.facts?.["offer_pricing.economics.margin.available"], "UNKNOWN");
  assert.equal(enriched.facts?.["offer_pricing.inventory.available"], "TRUE");
});

test("P04 mantiene UNKNOWN para elasticidad e incrementalidad", () => {
  const context = buildOfferPricingPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyOfferPricingEvidence(context, { sales: null, margin: null, stock: null });
  assert.equal(enriched.facts?.["offer_pricing.pricing.elasticity.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["offer_pricing.promotions.incrementality.supported"], "UNKNOWN");
});
