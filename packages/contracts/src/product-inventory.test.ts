import assert from "node:assert/strict";
import test from "node:test";
import {
  validateProductInventoryPlaybookTemplate,
  type ProductInventoryInterventionProfile,
} from "./product-inventory.js";
import type { PlaybookTemplateInput } from "./playbook.js";

const baseTemplate = (
  profile: Partial<ProductInventoryInterventionProfile>,
): PlaybookTemplateInput => ({
  template_id: "PRODUCT-001",
  template_version: "1.0.0",
  schema_version: "p5.07.v1",
  lifecycle: "ACTIVE",
  domain: "PRODUCT_INVENTORY",
  domain_extension: {
    product_inventory: {
      product_inventory_motion: "STOCKOUT_PREVENTION",
      intervention_surface: "SKU",
      product_scope: "SINGLE_PRODUCT",
      product_refs: ["product:hero"],
      inventory_state: "LOW",
      demand_supply_state: "DEMAND_EXCEEDS_SUPPLY",
      replenishment_context_ref: "replenishment:hero",
      supplier_dependency_refs: [],
      product_inventory_evidence_requirements: ["stock", "velocity", "lead-time"],
      economics_requirements: ["contribution"],
      operational_requirements: ["availability"],
      measurement_requirements: ["stockout-recovery"],
      ...profile,
    },
  },
  name: "Product inventory validation",
  purpose: "Validate a product and inventory intervention",
  problem_refs: [],
  intent: "improve-product-availability",
  intervention_type: "PRODUCT_INVENTORY",
  activation_signals: ["stockout-risk"],
  preconditions: [],
  contraindications: [],
  steps: [{ step_id: "PRODUCT-001-S01", label: "Validate inventory and demand", stage: "ISOLATE", adaptation_policy: "LOCKED" }],
  expected_effects: ["IMPROVE_PRODUCT_INVENTORY_QUALITY"],
  validation_requirements: ["inventory and demand evidence"],
  success_criteria: ["availability improves without violating guardrails"],
  failure_criteria: ["stock or product evidence is not reliable"],
  stop_conditions: ["customer or compliance risk"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED", allow_new_steps: false },
  source_refs: ["artifact:f5.07"],
});

test("P07 acepta stockout prevention con scope, superficie y reposicion trazables", () => {
  const result = validateProductInventoryPlaybookTemplate(baseTemplate({}));
  assert.equal(result.valid, true);
  assert.equal(result.profile?.intervention_surface, "SKU");
  assert.equal(result.profile?.replenishment_context_ref, "replenishment:hero");
});

test("P07 exige referencia de producto para un scope de producto unico", () => {
  const result = validateProductInventoryPlaybookTemplate(baseTemplate({ product_refs: [] }));
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["PRODUCT_INVENTORY.PRODUCT_REF_REQUIRED"]);
});

test("P07 exige contexto de reposicion para prevenir stockout", () => {
  const result = validateProductInventoryPlaybookTemplate(baseTemplate({ replenishment_context_ref: undefined }));
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["PRODUCT_INVENTORY.REPLENISHMENT_CONTEXT_REQUIRED"]);
});

test("P07 no permite extension de producto en otro dominio", () => {
  const result = validateProductInventoryPlaybookTemplate({ ...baseTemplate({}), domain: "CONVERSION" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["PRODUCT_INVENTORY.DOMAIN_EXTENSION_FORBIDDEN"]);
});
