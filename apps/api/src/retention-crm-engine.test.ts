import assert from "node:assert/strict";
import test from "node:test";
import {
  applyRetentionCrmEvidence,
  buildRetentionCrmPlaybookContext,
} from "./retention-crm-engine.js";

test("P05 distingue base/repeat observable de cohortes y LTV", () => {
  const context = buildRetentionCrmPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyRetentionCrmEvidence(context, {
    customers: { customer_count: 10, repeat_customers: 4, stateful_customers: 10 },
    sales: { orders_count: 14, refunds: 1 },
    margin: { items_with_cost: 8, gross_margin: 120 },
    crm: { account_count: 1, flows_count: 3, campaigns_count: 2 },
    consent: { consent_events: 10 },
  });
  assert.equal(enriched.facts?.["retention.customer_base.available"], "TRUE");
  assert.equal(enriched.facts?.["retention.repeat.observed"], "TRUE");
  assert.equal(enriched.facts?.["retention.economics.contribution.available"], "TRUE");
  assert.equal(enriched.facts?.["retention.cohorts.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["retention.ltv.observed"], "UNKNOWN");
});

test("P05 conserva UNKNOWN para churn, suscripción, incrementalidad y calidad", () => {
  const context = buildRetentionCrmPlaybookContext("org-1", [], null, "2026-09-17T10:00:00.000Z");
  const enriched = applyRetentionCrmEvidence(context, { customers: null, crm: null });
  assert.equal(enriched.facts?.["retention.churn.threshold_defined"], "UNKNOWN");
  assert.equal(enriched.facts?.["retention.subscription.observed"], "UNKNOWN");
  assert.equal(enriched.facts?.["retention.incrementality.supported"], "UNKNOWN");
  assert.equal(enriched.facts?.["retention.customer_quality.available"], "UNKNOWN");
  assert.equal(enriched.facts?.["retention.consent.observed"], "UNKNOWN");
});
