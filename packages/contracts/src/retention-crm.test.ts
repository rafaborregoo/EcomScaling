import assert from "node:assert/strict";
import test from "node:test";
import {
  validateRetentionCrmPlaybookTemplate,
  type RetentionCrmInterventionProfile,
} from "./retention-crm.js";
import type { PlaybookTemplateInput } from "./playbook.js";

const baseTemplate = (
  profile: Partial<RetentionCrmInterventionProfile>,
): PlaybookTemplateInput => ({
  template_id: "RETENTION-001",
  template_version: "1.0.0",
  schema_version: "p5.05.v1",
  lifecycle: "ACTIVE",
  domain: "RETENTION_CRM",
  domain_extension: {
    retention_crm: {
      intervention_family: "WIN_BACK",
      primary_metric_ref: "metric:reactivation_rate",
      economic_metric_ref: "metric:contribution_ltv",
      guardrail_metric_refs: ["metric:unsubscribe_rate"],
      consent_required: true,
      reversible: true,
      ...profile,
    },
  },
  name: "Retention validation",
  purpose: "Validate a retention intervention",
  problem_refs: [],
  intent: "improve-retention-quality",
  intervention_type: "RETENTION_CRM",
  activation_signals: ["repeat-rate"],
  preconditions: [],
  contraindications: [],
  steps: [{ step_id: "RETENTION-001-S01", label: "Review recurrence and consent", stage: "ISOLATE", adaptation_policy: "LOCKED" }],
  expected_effects: ["IMPROVE_RETENTION_QUALITY"],
  validation_requirements: ["repeat and contribution outcome"],
  success_criteria: ["retention outcome is observed"],
  failure_criteria: ["guardrail deteriorates"],
  stop_conditions: ["consent or customer harm"],
  reassessment_conditions: [],
  resource_requirements: [],
  dependencies: [],
  intervention_risks: [],
  adaptation_policy: { default: "LOCKED", allow_new_steps: false },
  source_refs: ["artifact:f5.05"],
});

test("P05 acepta win-back reversible con consentimiento explícito", () => {
  const result = validateRetentionCrmPlaybookTemplate(baseTemplate({
    lifecycle_state_ref: "state:lapsed",
    channel: "EMAIL",
  }));
  assert.equal(result.valid, true);
  assert.equal(result.profile?.consent_required, true);
});

test("P05 permite no-action sin inventar un canal ni un incentivo", () => {
  const result = validateRetentionCrmPlaybookTemplate(baseTemplate({
    intervention_family: "NO_ACTION",
    channel: undefined,
    incentive_ref: undefined,
  }));
  assert.equal(result.valid, true);
});

test("P05 no permite extensión de retención en otro dominio", () => {
  const result = validateRetentionCrmPlaybookTemplate({
    ...baseTemplate({}),
    domain: "CONVERSION",
  });
  assert.equal(result.valid, false);
  assert.deepEqual(result.reason_codes, ["RETENTION.DOMAIN_EXTENSION_FORBIDDEN"]);
});
