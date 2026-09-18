import assert from "node:assert/strict";
import test from "node:test";
import { validateOfferPricingBenchmarksPlaybookTemplate } from "./offer-pricing-benchmarks.js";

const base = {
  template_id: "offer-pricing-benchmarks-1", template_version: "1.0.0", schema_version: "f6-p06.v1",
  lifecycle: "ACTIVE" as const, domain: "OFFER_PRICING_BENCHMARKS",
  domain_extension: { offer_pricing_benchmarks: {
    offer_pricing_motion: "DECOMPOSE_AOV",
    offer_refs: ["product", "value_proposition", "shipping", "returns_policy"],
    pricing_refs: ["list_price", "selling_price", "positioning", "competitor_context"],
    aov_refs: ["revenue", "orders", "upt", "asp", "basket_distribution"],
    economics_refs: ["margin", "contribution", "contribution_per_order", "contribution_per_session"],
    product_mix_refs: ["sku_mix", "category_mix", "hero_sku_share"],
    promotion_refs: ["discount_depth", "promo_share", "full_price_share", "cannibalization"],
    customer_quality_refs: ["new_returning", "repeat", "returns", "future_frequency"],
    merchandising_refs: ["ranking", "search", "filters", "recommendations", "availability"],
    incrementality_refs: ["control", "post_period", "halo", "pull_forward"],
    guardrail_families: ["MARGIN", "CVR", "CUSTOMER_QUALITY", "RETURNS", "INVENTORY", "TRANSPARENCY"],
    benchmark_refs: ["historical", "category", "internal_segment"],
    method_refs: ["direct_fix", "experiment", "further_diagnosis", "monitor"],
    limitation_requirements: ["no_universal_thresholds", "no_automatic_price_change", "no_assumed_incrementality"],
  } },
  name: "Offer pricing benchmarks", purpose: "Evaluate monetization and commercial guardrails", problem_refs: ["offer_economics_uncertain"],
  intent: "diagnose-offer-pricing", intervention_type: "OFFER_DIAGNOSTIC", activation_signals: ["sales_available"], preconditions: [], contraindications: [],
  steps: [{ step_id: "step-1", label: "Decompose AOV", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const }], expected_effects: ["BOUNDED_MONETIZATION_JUDGMENT"],
  validation_requirements: ["economics evidence"], success_criteria: ["guardrails respected"], failure_criteria: ["AOV treated as profit"], stop_conditions: ["definitions insufficient"],
  reassessment_conditions: [], resource_requirements: [], dependencies: [], intervention_risks: [], adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false }, source_refs: ["fase-06/6.06"],
};

test("F6.06 acepta el contrato de oferta, pricing, merchandising y AOV", () => {
  assert.equal(validateOfferPricingBenchmarksPlaybookTemplate(base).valid, true);
});

test("F6.06 mantiene la extensión fuera de OFFER_PRICING operativa", () => {
  assert.deepEqual(validateOfferPricingBenchmarksPlaybookTemplate({ ...base, domain: "OFFER_PRICING" }).reason_codes, ["OFFER_PRICING_BENCHMARKS.DOMAIN_EXTENSION_FORBIDDEN"]);
});

test("F6.06 exige definición comercial, economics y limitaciones", () => {
  const invalid = { ...base, domain_extension: { offer_pricing_benchmarks: { ...base.domain_extension.offer_pricing_benchmarks, offer_refs: [], economics_refs: [], limitation_requirements: [] } } };
  assert.equal(validateOfferPricingBenchmarksPlaybookTemplate(invalid).valid, false);
});
