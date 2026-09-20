import assert from "node:assert/strict";
import test from "node:test";
import { f8HitlApprovalAssessmentsFromRows } from "./ai-playbook-insights-api.js";

test("F8.02 feed publica gates HITL y oculta autonomías disponibles", () => {
  const result = f8HitlApprovalAssessmentsFromRows([
    { disposition: "AUTONOMY_AVAILABLE" },
    { disposition: "APPROVAL_REQUIRED", unresolved_unknowns: ["approval"], reason_codes: ["material_action"] },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.domain, "F8_02_HITL_APPROVAL");
  assert.equal(result[0]?.disposition, "APPROVAL_REQUIRED");
});
