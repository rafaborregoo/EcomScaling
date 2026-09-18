import assert from "node:assert/strict";
import test from "node:test";
import { validateProductInventoryBenchmarksPlaybookTemplate } from "./product-inventory-benchmarks.js";

const profile = {
  product_inventory_motion: "ASSESS_COVERAGE",
  stock_refs: ["stock_on_hand", "available_to_sell"], accuracy_refs: ["inventory_accuracy"],
  demand_refs: ["units_sold", "velocity"], coverage_refs: ["weeks_of_cover"], stockout_refs: ["oos_days"],
  method_refs: ["direct_fix", "investigate", "monitor"], limitation_requirements: ["no_forecast_without_history", "no_overstock_without_age"],
  lead_time_refs: ["supplier_lead_time"], aging_refs: ["inventory_age"], supplier_refs: ["supplier_reliability"], economics_refs: ["cogs", "contribution"], benchmark_refs: ["internal_history"], guardrail_families: ["ACCURACY", "STOCKOUT", "CASH"],
};
const base = {
  template_id: "product-inventory-benchmarks-1", template_version: "1.0.0", schema_version: "f6-p10.v1", lifecycle: "ACTIVE" as const, domain: "PRODUCT_INVENTORY_BENCHMARKS", domain_extension: { product_inventory_benchmarks: profile }, name: "Product inventory benchmarks", purpose: "Evaluate inventory health", problem_refs: ["inventory_uncertain"], intent: "diagnose-inventory-health", intervention_type: "INVENTORY_DIAGNOSTIC", activation_signals: ["inventory_data_available"], preconditions: [], contraindications: [], steps: [{ step_id: "step-1", label: "Assess coverage", stage: "ISOLATE" as const, adaptation_policy: "LOCKED" as const }], expected_effects: ["BOUNDED_INVENTORY_JUDGMENT"], validation_requirements: ["stock_and_demand"], success_criteria: ["evidence bounded"], failure_criteria: ["no false forecast"], stop_conditions: ["tracking insufficient"], reassessment_conditions: [], resource_requirements: [], dependencies: [], intervention_risks: [], adaptation_policy: { default: "LOCKED" as const, allow_new_steps: false }, source_refs: ["fase-06/6.10"],
};

test("F6.10 acepta inventario y salud comercial", () => assert.equal(validateProductInventoryBenchmarksPlaybookTemplate(base).valid, true));
test("F6.10 no mezcla su dominio con el playbook de inventario operativo", () => assert.deepEqual(validateProductInventoryBenchmarksPlaybookTemplate({ ...base, domain: "PRODUCT_INVENTORY" }).reason_codes, ["PRODUCT_INVENTORY_BENCHMARKS.DOMAIN_EXTENSION_FORBIDDEN"]));
test("F6.10 exige referencias mínimas y limitaciones", () => assert.equal(validateProductInventoryBenchmarksPlaybookTemplate({ ...base, domain_extension: { product_inventory_benchmarks: { ...profile, stock_refs: [], accuracy_refs: [], limitation_requirements: [] } } }).valid, false));
