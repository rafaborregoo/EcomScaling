import assert from "node:assert/strict";
import test from "node:test";
import {
  insightSpotsFromAiAssessments,
  insightSpotsFromPlaybookAssessments,
} from "./insights-registry";

test("el feed transversal de playbooks crea un insight con enlace a la card exacta", () => {
  const spots = insightSpotsFromPlaybookAssessments(
    { organizationId: "org-1", connectionId: "", isConsultant: true },
    [{ domain: "SCALABILITY", disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["capacity"], reason_codes: [] }],
  );
  assert.equal(spots.length, 1);
  assert.equal(spots[0]?.id, "playbook-scalability");
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-scalability");
  assert.equal(spots[0]?.insights[0]?.severity, "medium");
});

test("el feed no enseña diagnósticos de playbooks a un cliente", () => {
  const spots = insightSpotsFromPlaybookAssessments(
    { organizationId: "org-1", connectionId: "", isConsultant: false },
    [{ domain: "RECOVERY_CRISIS", disposition: "BLOCKED", unresolved_unknowns: [], reason_codes: [] }],
  );
  assert.deepEqual(spots, []);
});

test("el feed F3 enlaza D12, D13 y D14 con sus cards exactas", () => {
  const spots = insightSpotsFromAiAssessments(
    { organizationId: "org-1", connectionId: "store-1", isConsultant: true },
    [
      { domain: "F3_D12_ADVERSARIAL", disposition: "REASSESS_DIAGNOSIS", store_id: "store-1", reason_codes: ["high_risk"] },
      { domain: "F3_D13_TEMPORAL", disposition: "VALIDATION_REQUIRED", store_id: "store-1", reason_codes: ["trajectory_unknown"] },
      { domain: "F3_D14_OUTPUT", disposition: "VALIDATION_REQUIRED", store_id: "store-1", reason_codes: ["invalid_output"] },
    ],
  );

  assert.deepEqual(spots.map((spot) => spot.href), [
    "/shopify/diagnostico#insight-d12-adversarial",
    "/shopify/diagnostico#insight-d13-temporal",
    "/shopify/diagnostico#insight-d14-output",
  ]);
  assert.equal(spots[0]?.insights[0]?.severity, "high");
});

test("el feed F3 no mezcla una revisión de otra tienda", () => {
  const spots = insightSpotsFromAiAssessments(
    { organizationId: "org-1", connectionId: "store-1", isConsultant: true },
    [{ domain: "F3_D12_ADVERSARIAL", disposition: "REASSESS_DIAGNOSIS", store_id: "store-2" }],
  );
  assert.deepEqual(spots, []);
});

test("el feed F7.02 enlaza el matching causal con su card", () => {
  const spots = insightSpotsFromAiAssessments(
    { organizationId: "org-1", connectionId: "", isConsultant: true },
    [{ domain: "F7_02_MATCHING", disposition: "VALIDATION_REQUIRED", reason_codes: ["MATCHING.CAUSAL_STORY_INCOMPLETE"] }],
  );
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-intervention-matching");
});
