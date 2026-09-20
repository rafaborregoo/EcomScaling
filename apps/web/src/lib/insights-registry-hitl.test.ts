import assert from "node:assert/strict";
import test from "node:test";
import { insightSpotsFromAiAssessments } from "./insights-registry";

test("F8.02 InsightsMenu enlaza el gate de aprobación con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F8_02_HITL_APPROVAL", disposition: "APPROVAL_REQUIRED", reason_codes: ["material_action"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-hitl-approval");
  assert.equal(spots[0]?.label, "Aprobación humana");
});
