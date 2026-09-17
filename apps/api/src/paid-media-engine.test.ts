import assert from "node:assert/strict";
import test from "node:test";
import { buildPaidMediaPlaybookContext } from "./paid-media-engine.js";

test("P02 construye contexto Paid Media sin inventar evidencia económica", () => {
  const context = buildPaidMediaPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");

  assert.equal(context.context_id, "paid-media-context:org-1:2026-09-17");
  assert.equal(context.decision_cycle_id, "f5-p02:org-1:2026-09-17");
  assert.ok(context.source_versions?.includes("f5-p02.v1"));
  const facts = context.facts ?? {};
  assert.equal(facts["paid_media.measurement.sufficient"], "UNKNOWN");
  assert.equal(facts["paid_media.economics.compatible"], "UNKNOWN");
  assert.equal(facts["paid_media.incrementality.supported"], "UNKNOWN");
  assert.equal(facts["paid_media.inventory.available"], "UNKNOWN");
});
