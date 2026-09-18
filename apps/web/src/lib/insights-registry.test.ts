import assert from "node:assert/strict";
import test from "node:test";
import { insightSpotsFromPlaybookAssessments } from "./insights-registry";

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
