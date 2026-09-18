import assert from "node:assert/strict";
import test from "node:test";
import {
  applyOperationsCxEvidence,
  buildOperationsCxPlaybookContext,
} from "./operations-cx-engine.js";

test("P08 expone la cobertura real de entrega sin inventar SLA, capacidad ni soporte", () => {
  const context = buildOperationsCxPlaybookContext(
    "org-1",
    [],
    null,
    "2026-09-17T10:00:00.000Z",
  );
  const enriched = applyOperationsCxEvidence(context, {
    delivery: {
      fulfillments: 12,
      delivered: 8,
      in_transit: 4,
      avg_hours_to_ship: 18.5,
      avg_days_to_deliver: 3.2,
      with_estimate: 8,
      late_deliveries: 2,
      avg_delay_days: 1.1,
    },
    orders: { orders_count: 14 },
  });

  assert.equal(enriched.facts?.["operations.order_volume.observed"], "TRUE");
  assert.equal(enriched.facts?.["operations.delivery.fulfillments_observed"], "TRUE");
  assert.equal(enriched.facts?.["operations.delivery.delivered_observed"], "TRUE");
  assert.equal(enriched.facts?.["operations.delivery.processing_time_observed"], "TRUE");
  assert.equal(enriched.facts?.["operations.delivery.transit_time_observed"], "TRUE");
  assert.equal(enriched.facts?.["operations.delivery.promise_observed"], "TRUE");
  assert.equal(enriched.facts?.["operations.delivery.on_time_observed"], "TRUE");
  assert.equal(enriched.facts?.["operations.data_quality.timestamps_observed"], "TRUE");
  assert.equal(enriched.facts?.["operations.capacity.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["operations.backlog.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["operations.support.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["operations.support.wismo_observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["operations.service_recovery.observed"], "UNKNOWN");
});

test("P08 conserva UNKNOWN cuando Shopify no aporta evidencia operativa", () => {
  const context = buildOperationsCxPlaybookContext(
    "org-1",
    [],
    null,
    "2026-09-17T10:00:00.000Z",
  );
  const enriched = applyOperationsCxEvidence(context, {
    delivery: null,
    orders: null,
    returns: null,
    support: null,
  });

  assert.equal(enriched.facts?.["operations.delivery.fulfillments_observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["operations.delivery.on_time_observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["operations.returns.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["operations.customer_experience.observed"], "UNKNOWN");
  assert.equal(enriched.evidence_refs?.length, 0);
});
