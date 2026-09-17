import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDecisionPlaybookContextBlocks,
  summarizeDecisionOutput,
  summarizePlaybookRun,
} from "./decision-playbook-chat-context.js";

test("el contexto del Copiloto conserva abstención, incertidumbre y trazabilidad", () => {
  const blocks = buildDecisionPlaybookContextBlocks({
    decisionOutput: {
      as_of: "2026-09-17T10:00:00.000Z",
      candidate_ref: "case-1",
      decision_status: "VALIDATION_REQUIRED",
      reason_codes: ["VALIDATION.UNKNOWN"],
      result: {
        decision_type: "ABSTAIN",
        decision_confidence: "UNKNOWN",
        rationale: "Falta contexto",
        unknowns: ["ranking"],
        evidence_refs: ["output-1"],
        tradeoffs: ["delay"],
        critical_assumptions: ["objective"],
        review_trigger: "new evidence",
      },
    },
    playbookRuns: [
      {
        domain: "PAID_MEDIA",
        disposition: "VALIDATION_REQUIRED",
        candidate_count: 1,
        selected_instance_id: null,
        unresolved_unknowns: ["paid_media.measurement.sufficient"],
        reason_codes: ["SELECTION.VALIDATION_REQUIRED"],
        source_refs: ["rag:5.02"],
        as_of: "2026-09-17T10:00:00.000Z",
        result: { selected_instance: null },
      },
    ],
  });

  assert.equal(blocks.length, 3);
  assert.deepEqual(summarizeDecisionOutput({ decision_status: "ABSTAIN", result: {} }).status, "ABSTAIN");
  assert.deepEqual(
    summarizePlaybookRun({
      domain: "PAID_MEDIA",
      disposition: "VALIDATION_REQUIRED",
      unresolved_unknowns: ["measurement"],
      result: {},
    }).unknowns,
    ["measurement"],
  );
  assert.match(JSON.stringify(blocks), /paid_media\.measurement\.sufficient/);
  assert.match(JSON.stringify(blocks), /VALIDATION_REQUIRED/);
});
