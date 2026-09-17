import assert from "node:assert/strict";
import test from "node:test";
import {
  validateConversionCroPlaybookTemplate,
} from "./conversion-cro.js";
import type { PlaybookTemplateInput } from "./playbook.js";

const template = (profile: Record<string, unknown>): PlaybookTemplateInput => ({
  template_id: "CRO-001",
  template_version: "1.0.0",
  schema_version: "p5.03.v1",
  lifecycle: "ACTIVE",
  domain: "CONVERSION",
  domain_extension: { conversion_cro: profile },
  name: "CRO validation",
  purpose: "Locate and validate a conversion intervention",
  problem_refs: [],
  intent: "locate-funnel-loss",
  intervention_type: "CRO",
  activation_signals: ["conversion"],
  preconditions: [],
  contraindications: [],
  steps: [{
    step_id: "CRO-001-S01",
    label: "Review the declared evidence",
    stage: "ISOLATE",
    adaptation_policy: "LOCKED",
  }],
  expected_effects: ["REDUCE_UNCERTAINTY"],
  validation_requirements: ["declared evidence"],
  success_criteria: ["evidence supports the hypothesis"],
  failure_criteria: ["evidence contradicts the hypothesis"],
  stop_conditions: ["economic guardrail deteriorates"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED", allow_new_steps: false },
  source_refs: ["artifact:f5-p03"],
});

test("P03 acepta un perfil CRO de fix con etapa y evidencia", () => {
  const result = validateConversionCroPlaybookTemplate(template({
    intervention_mode: "FIX",
    funnel_stage: "checkout",
    evidence_requirements: ["FUNNEL_EVIDENCE", "CHECKOUT_PAYMENT_EVIDENCE"],
  }));
  assert.equal(result.valid, true);
  assert.equal(result.profile?.funnel_stage, "checkout");
});

test("P03 exige hipótesis y métrica primaria para un test", () => {
  const result = validateConversionCroPlaybookTemplate(template({
    intervention_mode: "TEST",
    funnel_stage: "pdp",
    evidence_requirements: ["FUNNEL_EVIDENCE"],
  }));
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["CRO.TEST_HYPOTHESIS_REQUIRED"]);
});

test("P03 no permite la extensión CRO en otro dominio", () => {
  const result = validateConversionCroPlaybookTemplate({
    ...template({
      intervention_mode: "RESEARCH",
      funnel_stage: "discovery",
      evidence_requirements: ["QUALITATIVE_RESEARCH_EVIDENCE"],
    }),
    domain: "PAID_MEDIA",
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["CRO.DOMAIN_EXTENSION_FORBIDDEN"]);
});
