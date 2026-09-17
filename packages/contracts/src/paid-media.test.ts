import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePlaybookFramework,
  type PlaybookFrameworkInputLike,
} from "./playbook.js";

const context: PlaybookFrameworkInputLike["context"] = {
  context_id: "paid-media-context-1",
  decision_cycle_id: "cycle-1",
  business_id: "org-1",
  priority_ref: "decision-1",
  problem_refs: ["paid-media-problem"],
  diagnosis_refs: ["diagnosis-1"],
  source_versions: ["p5.00.v1"],
  facts: {
    "paid_media.measurement.sufficient": "UNKNOWN",
    "paid_media.economics.compatible": "UNKNOWN",
  },
  as_of: "2026-09-17T10:00:00.000Z",
};

type PlaybookTemplateFixture = NonNullable<
  PlaybookFrameworkInputLike["templates"]
>[number];

const template: PlaybookTemplateFixture = {
  template_id: "PM-001",
  template_version: "1.0.0",
  schema_version: "p5.2.v1",
  lifecycle: "ACTIVE",
  domain: "PAID_MEDIA",
  name: "Paid media validation",
  purpose: "Validate performance before changing campaigns",
  problem_refs: ["paid-media-problem"],
  intent: "diagnose-paid-media",
  intervention_type: "PAID_MEDIA_DIAGNOSTIC",
  preconditions: [
    {
      condition_id: "measurement",
      condition_type: "HARD_PRECONDITION",
      fact_ref: "paid_media.measurement.sufficient",
      expected: "TRUE",
      unknown_policy: "REQUIRE_VALIDATION",
    },
  ],
  contraindications: [],
  steps: [
    {
      step_id: "PM-001-S01",
      label: "Verify tracking and economic truth",
      stage: "ISOLATE",
      adaptation_policy: "LOCKED",
    },
  ],
  expected_effects: ["REDUCE_PAID_MEDIA_DIAGNOSTIC_UNCERTAINTY"],
  validation_requirements: ["platform and ecommerce evidence"],
  success_criteria: ["cause is isolated"],
  failure_criteria: ["evidence remains inconclusive"],
  stop_conditions: ["measurement becomes unreliable"],
  source_refs: ["rag:5.02"],
};

test("5.02 reutiliza P00 y exige validar antes de tocar Paid Media", () => {
  const result = evaluatePlaybookFramework({
    context,
    templates: [template],
    evaluated_at: "2026-09-17T10:00:00.000Z",
  });

  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.equal(result.selected_instance, null);
  assert.ok(result.unresolved_unknowns.includes("paid_media.measurement.sufficient"));
});

test("5.02 no trata un dominio Paid Media como permiso para recomendar por volumen", () => {
  const result = evaluatePlaybookFramework({
    context: { ...context, facts: { "paid_media.measurement.sufficient": "TRUE" } },
    templates: [template],
    evaluated_at: "2026-09-17T10:00:00.000Z",
  });

  assert.equal(result.disposition, "READY_FOR_RECOMMENDATION");
  assert.equal(result.selected_instance?.playbook_id, "PM-001");
  assert.equal(result.selected_instance?.domain_extension && Object.keys(result.selected_instance.domain_extension).length, 0);
});
