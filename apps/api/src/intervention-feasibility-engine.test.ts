import assert from "node:assert/strict";
import test from "node:test";
import type { PlaybookTemplate } from "@ecomscaling/contracts";
import { buildInterventionFeasibilityContext, candidateInputFromFeasibilitySources } from "./intervention-feasibility-engine.js";

const template = { template_id: "fix@1.0.0", template_version: "1.0.0", lifecycle: "ACTIVE", schema_version: "v1", domain: "GENERAL", name: "Fix", purpose: "Fix", intent: "Fix", intervention_type: "test", problem_refs: [], activation_signals: [], preconditions: [], contraindications: [], steps: [{ step_id: "s", label: "s", stage: "CORRECT", adaptation_policy: "LOCKED" }], expected_effects: ["effect"], validation_requirements: ["validation"], success_criteria: ["success"], failure_criteria: ["failure"], stop_conditions: ["stop"], reassessment_conditions: [], resource_requirements: [], dependencies: [], intervention_risks: [], resource_profile: [], source_refs: ["template:1"], domain_extension: { feasibility: { resource_requirements: [{ resource: "developer", required_level: "MODERATE", availability: "AVAILABLE", capacity_status: "SUFFICIENT", capability_status: "FIT", owner_status: "ASSIGNED", duration: "short", bottleneck: false, source_refs: ["resource:team"] }], time_requirement: { implementation: "short", operational_readiness: "medium", confident_outcome: "unknown", deadline_fit: "FIT" }, success_capacity: { required_resources: [], moving_bottleneck: null, buffer_status: "PRESENT" } } } } as unknown as PlaybookTemplate;

test("F7.05 context preserves the F7.03/F7.04 lineage and tenant", () => {
  const context = buildInterventionFeasibilityContext("org-a", { context_id: "impact-ctx", decision_cycle_id: "cycle", primary_priority_candidate_id: "fix@1.0.0", source_refs: ["impact:1"] }, { source_refs: ["priority:1"] }, "2026-09-19T12:00:00.000Z");
  assert.equal(context.business_id, "org-a");
  assert.equal(context.primary_priority_candidate_id, "fix@1.0.0");
  assert.deepEqual(context.source_refs, ["impact:1", "priority:1", "f7-p05.v1"]);
});

test("F7.05 maps explicit resource metadata without inventing availability", () => {
  const context = buildInterventionFeasibilityContext("org-a", { context_id: "impact-ctx", decision_cycle_id: "cycle", primary_priority_candidate_id: "fix@1.0.0", source_refs: [] }, { source_refs: [] });
  const input = candidateInputFromFeasibilitySources(template, context, { candidate_id: "fix@1.0.0", disposition: "SUPPORTED_QUALITATIVE", source_refs: ["impact:1"] }, { candidate_id: "fix@1.0.0", priority_tier: "NOW", source_refs: ["priority:1"] });
  assert.equal(input.resource_requirements[0]?.resource, "developer");
  assert.equal(input.resource_requirements[0]?.availability, "AVAILABLE");
  assert.equal(input.cost_profile.numeric_support, false);
  assert.equal(input.cost_profile.amounts.length, 0);
});
