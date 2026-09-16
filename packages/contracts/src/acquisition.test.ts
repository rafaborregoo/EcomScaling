import assert from "node:assert/strict";
import test from "node:test";
import {
  validateAcquisitionPlaybookTemplate,
  type AcquisitionPlaybookTemplateLike,
} from "./acquisition.js";

const baseTemplate: AcquisitionPlaybookTemplateLike = {
  template_id: "ACQ-001",
  template_version: "1.0.0",
  schema_version: "p5.1.v1",
  lifecycle: "ACTIVE",
  domain: "ACQUISITION",
  name: "Demand capture",
  purpose: "Capture qualified existing demand",
  intent: "capture-demand",
  intervention_type: "DEMAND_CAPTURE",
  steps: [
    {
      step_id: "ACQ-001-S01",
      label: "Validate the demand source",
      stage: "VALIDATE",
      adaptation_policy: "LOCKED",
    },
  ],
  validation_requirements: ["qualified demand evidence"],
  success_criteria: ["qualified demand increases"],
  failure_criteria: ["qualified demand does not materialize"],
  stop_conditions: ["measurement becomes unreliable"],
  source_refs: ["rag:5.01"],
  domain_extension: {
    acquisition: {
      acquisition_motion: "DEMAND_CAPTURE",
      channel_scope: "CHANNEL_NEUTRAL",
      acquisition_evidence_requirements: ["DEMAND_VOLUME_EVIDENCE"],
    },
  },
};

test("5.01 acepta la extensión mínima de adquisición", () => {
  const result = validateAcquisitionPlaybookTemplate(baseTemplate);

  assert.equal(result.valid, true);
  assert.equal(result.profile?.acquisition_motion, "DEMAND_CAPTURE");
  assert.equal(result.profile?.channel_scope, "CHANNEL_NEUTRAL");
});

test("5.01 no permite extensión de adquisición en otro dominio", () => {
  const result = validateAcquisitionPlaybookTemplate({
    ...baseTemplate,
    domain: "PAID_MEDIA",
  });

  assert.equal(result.valid, false);
  assert.ok(result.reason_codes.includes("ACQ.DOMAIN_EXTENSION_FORBIDDEN"));
});

test("5.01 exige referencias cuando el playbook es específico de canal", () => {
  const result = validateAcquisitionPlaybookTemplate({
    ...baseTemplate,
    domain_extension: {
      acquisition: {
        acquisition_motion: "CHANNEL_EXPANSION",
        channel_scope: "SPECIFIC_CHANNEL",
        acquisition_evidence_requirements: ["CHANNEL_FIT_EVIDENCE"],
      },
    },
  });

  assert.equal(result.valid, false);
  assert.ok(result.reason_codes.includes("ACQ.CHANNEL_REFS_REQUIRED"));
});

test("5.01 permite un template de adquisición sin extensión específica", () => {
  const result = validateAcquisitionPlaybookTemplate({
    ...baseTemplate,
    domain_extension: {},
  });

  assert.equal(result.valid, true);
  assert.equal(result.profile, null);
});
