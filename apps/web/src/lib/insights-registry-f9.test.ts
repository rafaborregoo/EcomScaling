import assert from "node:assert/strict";
import test from "node:test";
import { insightSpotsFromAiAssessments } from "./insights-registry";
test("el feed F9 enlaza aprendizaje continuo con su panel", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F9_CONTINUOUS_LEARNING", disposition: "WAITING_FOR_EVIDENCE", reason_codes: ["sample"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-continuous-learning");
});
