import assert from "node:assert/strict";
import test from "node:test";
import {
  validateUnitEconomicsPlaybookTemplate,
  type UnitEconomicsInterventionProfile,
} from "./unit-economics.js";
import type { PlaybookTemplateInput } from "./playbook.js";

const baseTemplate = (
  profile: Partial<UnitEconomicsInterventionProfile>,
): PlaybookTemplateInput => ({
  template_id: "UNIT-001",
  template_version: "1.0.0",
  schema_version: "p5.06.v1",
  lifecycle: "ACTIVE",
  domain: "UNIT_ECONOMICS",
  domain_extension: {
    unit_economics: {
      intervention_family: "AOV",
      analysis_unit: "ORDER",
      economic_metric_ref: "metric:contribution_per_order",
      guardrail_metric_refs: ["metric:gross_margin_pct"],
      reversible: true,
      ...profile,
    },
  },
  name: "Unit economics validation",
  purpose: "Validate an economic intervention",
  problem_refs: [],
  intent: "improve-contribution-quality",
  intervention_type: "UNIT_ECONOMICS",
  activation_signals: ["contribution-per-order"],
  preconditions: [],
  contraindications: [],
  steps: [{ step_id: "UNIT-001-S01", label: "Review the economic waterfall", stage: "ISOLATE", adaptation_policy: "LOCKED" }],
  expected_effects: ["IMPROVE_UNIT_ECONOMICS_QUALITY"],
  validation_requirements: ["contribution and cash outcome"],
  success_criteria: ["economic outcome is observed"],
  failure_criteria: ["contribution or guardrail deteriorates"],
  stop_conditions: ["definitions or costs are not comparable"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED", allow_new_steps: false },
  source_refs: ["artifact:f5.06"],
});

test("P06 acepta contribution por pedido con unidad explicita", () => {
  const result = validateUnitEconomicsPlaybookTemplate(baseTemplate({
    primary_metric_ref: "metric:contribution_per_order",
    scenario_ref: "scenario:baseline",
  }));
  assert.equal(result.valid, true);
  assert.equal(result.profile?.analysis_unit, "ORDER");
  assert.equal(result.profile?.scenario_ref, "scenario:baseline");
});

test("P06 permite escenarios sin inventar umbrales universales", () => {
  const result = validateUnitEconomicsPlaybookTemplate(baseTemplate({
    intervention_family: "NO_ACTION",
    analysis_unit: "MARKET",
    primary_metric_ref: undefined,
    scenario_ref: "scenario:downside",
  }));
  assert.equal(result.valid, true);
});

test("P06 no permite la extension economica en otro dominio", () => {
  const result = validateUnitEconomicsPlaybookTemplate({
    ...baseTemplate({}),
    domain: "CONVERSION",
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["UNIT_ECONOMICS.DOMAIN_EXTENSION_FORBIDDEN"]);
});
