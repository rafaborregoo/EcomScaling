import { test } from "node:test";
import assert from "node:assert/strict";
import { interventionEligibilityViewModel } from "./intervention-eligibility-view-model";

test("F7.01 view model keeps every candidate and does not turn eligibility into selection", () => {
  const model = interventionEligibilityViewModel({
    disposition: "VALIDATION_REQUIRED",
    candidate_count: 2,
    eligible_count: 0,
    unresolved_unknowns: ["risk_acceptable"],
    result: {
      candidate_evaluations: [
        {
          candidate_id: "a",
          disposition: "INSUFFICIENT_EVIDENCE",
          reason_codes: ["EVIDENCE_OR_CONTEXT_UNKNOWN"],
          conditions: [],
          blockers: [],
          unresolved_unknowns: ["risk_acceptable"],
        },
        {
          candidate_id: "b",
          disposition: "BLOCKED_BY_CONSTRAINT",
          reason_codes: ["CRITICAL_CONSTRAINT_ACTIVE"],
          conditions: [],
          blockers: ["stock"],
          unresolved_unknowns: [],
        },
      ],
    },
  });

  assert.equal(model.candidateCount, 2);
  assert.equal(model.candidates.length, 2);
  assert.equal(model.candidates[1]?.disposition, "BLOCKED_BY_CONSTRAINT");
});
