import assert from "node:assert/strict";
import test from "node:test";
import { getAiEvidencePresentation } from "./ai-evidence-state";

test("AI evidence distinguishes verified, partial and insufficient context", () => {
  assert.deepEqual(getAiEvidencePresentation([{ kind: "metric", reference: "orders", period: null }]), {
    status: "verified",
    label: "Fuentes verificadas",
  });
  assert.deepEqual(getAiEvidencePresentation([{ kind: "document", reference: "playbook", period: null }], ["freshness_partial"]), {
    status: "partial",
    label: "Evidencia parcial",
  });
  assert.deepEqual(getAiEvidencePresentation([]), {
    status: "insufficient",
    label: "Sin evidencia",
  });
});
