import assert from "node:assert/strict";
import test from "node:test";
import { insightSpotsFromAiAssessments } from "./insights-registry";

test("F8.16 InsightsMenu enlaza el cierre con su card", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F8_16_CLOSURE_HANDOFF", disposition: "COMPLETED", reason_codes: ["active_actions"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-closure-handoff");
});
