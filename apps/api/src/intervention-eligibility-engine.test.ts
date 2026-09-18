import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildInterventionEligibilityContext,
  candidateInputFromTemplate,
} from "./intervention-eligibility-engine.js";
import type { PlaybookTemplate } from "@ecomscaling/contracts";

const template: PlaybookTemplate = {
  template_id: "template:checkout-fix",
  template_version: "v1",
  schema_version: "5.00.v1",
  lifecycle: "ACTIVE",
  domain: "CONVERSION",
  domain_extension: {},
  name: "Fix checkout",
  purpose: "Remove a confirmed checkout defect",
  problem_refs: [],
  intent: "fix checkout",
  intervention_type: "defect_fix",
  activation_signals: ["diagnostic:checkout"],
  preconditions: [],
  contraindications: [],
  steps: [{ step_id: "step:1", label: "fix", stage: "CORRECT", adaptation_policy: "LOCKED" }],
  expected_effects: ["checkout works"],
  validation_requirements: ["checkout validation"],
  success_criteria: ["orders complete"],
  failure_criteria: ["orders remain blocked"],
  stop_conditions: ["rollback if harmful"],
  reassessment_conditions: [],
  resource_requirements: ["owner"],
  dependencies: ["tracking"],
  intervention_risks: ["revenue interruption"],
  adaptation_policy: { default: "LOCKED", allow_new_steps: false },
  source_refs: ["f7.01.artifact"],
};

test("F7.01 context is tenant-bound and conservative by default", () => {
  const context = buildInterventionEligibilityContext(
    "org-a",
    [{ id: "diag-a", finalization_status: "invalid_output", handoff_ready: false }],
    null,
    "2026-09-18T12:00:00.000Z",
  );

  assert.equal(context.business_id, "org-a");
  assert.equal(context.facts["diagnosis.sufficient"], "UNKNOWN");
  assert.equal(context.facts["constraints.critical_clear"], "UNKNOWN");
  assert.equal(context.priority_problem_refs.length, 0);
});

test("F7.01 candidate mapping exposes dependencies instead of silently approving them", () => {
  const context = buildInterventionEligibilityContext(
    "org-a",
    [{ id: "diag-a", finalization_status: "finalized_valid", validation_passed: true, handoff_ready: true }],
    { id: "decision-a" },
    "2026-09-18T12:00:00.000Z",
  );
  const candidate = candidateInputFromTemplate(template, context);

  assert.equal(candidate.candidate_id, "template:checkout-fix@v1");
  assert.equal(candidate.dependencies_satisfied, "UNKNOWN");
  assert.equal(candidate.causal_coherence, "UNKNOWN");
  assert.ok(candidate.evidence_refs.includes("diag-a"));
  assert.ok(candidate.source_refs.includes("f7.01.artifact"));
});
