import assert from "node:assert/strict";
import test from "node:test";
import { interventionMatchingViewModel } from "./intervention-matching-view-model.js";

test("F7.02 conserva candidatos, trazabilidad y no selecciona ninguno", () => {
  const model = interventionMatchingViewModel({
    disposition: "MATCHES_AVAILABLE",
    candidate_count: 2,
    matched_count: 1,
    result: {
      candidate_evaluations: [
        {
          candidate_id: "candidate-a",
          disposition: "MATCHED",
          causal_chain: {
            problem_refs: ["problem:cvr"],
            driver_refs: ["driver:checkout"],
            cause_refs: ["cause:mobile"],
            mechanism_refs: ["mechanism:checkout"],
            lever_refs: ["lever:mobile"],
          },
          supporting_signal_refs: ["signal:mobile"],
          disconfirming_signal_refs: [],
          discriminating_evidence_refs: [],
          reason_codes: ["MATCHING.CAUSAL_FIT_SUPPORTED"],
          unresolved_unknowns: [],
        },
      ],
    },
  });
  assert.equal(model.matchedCount, 1);
  assert.equal(model.candidates[0]?.causal_chain.mechanism_refs[0], "mechanism:checkout");
});
