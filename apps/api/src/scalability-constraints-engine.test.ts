import assert from "node:assert/strict";
import test from "node:test";
import {
  applyScalabilityEvidence,
  buildScalabilityPlaybookContext,
} from "./scalability-constraints-engine.js";

test("P10 observa señales de throughput sin inventar capacidad ni bottleneck", () => {
  const context = buildScalabilityPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyScalabilityEvidence(context, {
    sales: { available: true, orders_count: 42 },
    margin: { available: true, items_with_cost: 18 },
    stock: { available: true, tracked_items: 12, total_available: 80 },
    delivery: { available: true, fulfillments: 40 },
    measurement: { available: true, days: 30 },
  }, ["sales", "margin", "stock", "delivery", "measurement"]);
  assert.equal(enriched.facts?.["scalability.throughput.observed"], "TRUE");
  assert.equal(enriched.facts?.["scalability.economics.observed"], "TRUE");
  assert.equal(enriched.facts?.["scalability.capacity.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["scalability.headroom.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["scalability.constraint.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["scalability.next_constraint.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 5);
});

test("P10 conserva UNKNOWN cuando no hay evidencia operativa", () => {
  const context = buildScalabilityPlaybookContext("org-1", [], null, "2026-09-18T10:00:00.000Z");
  const enriched = applyScalabilityEvidence(context, {});
  assert.equal(enriched.facts?.["scalability.throughput.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["scalability.capacity.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 0);
});
