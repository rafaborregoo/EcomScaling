import assert from "node:assert/strict";
import test from "node:test";
import { latestPlaybookAssessments } from "./ai-playbook-insights-api.js";

test("el feed transversal conserva solo el último assessment por dominio", () => {
  const result = latestPlaybookAssessments([
    { domain: "SCALABILITY", disposition: "VALIDATION_REQUIRED" },
    { domain: "SCALABILITY", disposition: "BLOCKED" },
    { domain: "ACQUISITION", disposition: "REASSESS_DIAGNOSIS" },
  ]);

  assert.deepEqual(result, [
    { domain: "SCALABILITY", disposition: "VALIDATION_REQUIRED" },
    { domain: "ACQUISITION", disposition: "REASSESS_DIAGNOSIS" },
  ]);
});
