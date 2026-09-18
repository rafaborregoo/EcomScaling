import assert from "node:assert/strict";
import test from "node:test";
import {
  validateOfferPricingPlaybookTemplate,
  type OfferPricingInterventionProfile,
} from "./offer-pricing.js";
import type { PlaybookTemplateInput } from "./playbook.js";

const baseTemplate = (profile: Partial<OfferPricingInterventionProfile>): PlaybookTemplateInput => ({
  template_id: "OFFER-001",
  template_version: "1.0.0",
  schema_version: "p5.04.v1",
  lifecycle: "ACTIVE",
  domain: "OFFER_PRICING",
  domain_extension: { offer_pricing: {
    intervention_family: "CROSS_SELL",
    economic_metric_ref: "metric:contribution_per_order",
    reversible: true,
    ...profile,
  } },
  name: "Offer validation",
  purpose: "Validate an economic offer intervention",
  problem_refs: [],
  intent: "improve-contribution",
  intervention_type: "OFFER_PRICING",
  activation_signals: ["aov"],
  preconditions: [],
  contraindications: [],
  steps: [{ step_id: "OFFER-001-S01", label: "Review evidence", stage: "ISOLATE", adaptation_policy: "LOCKED" }],
  expected_effects: ["IMPROVE_CONTRIBUTION"],
  validation_requirements: ["economic outcome"],
  success_criteria: ["contribution is observed"],
  failure_criteria: ["guardrail deteriorates"],
  stop_conditions: ["economic harm"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED", allow_new_steps: false },
  source_refs: ["artifact:f5.04"],
});

test("P04 acepta una intervención de oferta reversible", () => {
  const result = validateOfferPricingPlaybookTemplate(baseTemplate({
    intervention_family: "CROSS_SELL",
    product_refs: ["product:a", "product:b"],
  }));
  assert.equal(result.valid, true);
  assert.equal(result.profile?.economic_metric_ref, "metric:contribution_per_order");
});

test("P04 exige dos productos para un bundle", () => {
  const result = validateOfferPricingPlaybookTemplate(baseTemplate({ intervention_family: "BUNDLE" }));
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["OFFER.BUNDLE_PRODUCTS_REQUIRED"]);
});

test("P04 no permite extensión de oferta en otro dominio", () => {
  const result = validateOfferPricingPlaybookTemplate({
    ...baseTemplate({}),
    domain: "CONVERSION",
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["OFFER.DOMAIN_EXTENSION_FORBIDDEN"]);
});
