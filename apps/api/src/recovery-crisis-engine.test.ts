import assert from "node:assert/strict";
import test from "node:test";
import { applyRecoveryCrisisEvidence, buildRecoveryCrisisPlaybookContext } from "./recovery-crisis-engine.js";

test("P11 observa fuentes disponibles pero no declara crisis por un KPI aislado", () => {
  const context = buildRecoveryCrisisPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyRecoveryCrisisEvidence(context, {
    sales: { available: true, orders_count: 42 },
    delivery: { available: true, fulfillments: 40 },
    stock: { available: true, tracked_items: 12 },
    measurement: { available: true, days: 30 },
  }, ["sales", "delivery", "stock", "measurement"]);
  assert.equal(enriched.facts?.["recovery_crisis.sources.available"], "TRUE");
  assert.equal(enriched.facts?.["recovery_crisis.throughput.observed"], "TRUE");
  assert.equal(enriched.facts?.["recovery_crisis.crisis_state.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["recovery_crisis.severity.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["recovery_crisis.blast_radius.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["recovery_crisis.recovery_baseline.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 4);
});

test("P11 conserva UNKNOWN sin contexto fiable de incidente", () => {
  const context = buildRecoveryCrisisPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyRecoveryCrisisEvidence(context, {});
  assert.equal(enriched.facts?.["recovery_crisis.crisis_state.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["recovery_crisis.containment.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 0);
});
