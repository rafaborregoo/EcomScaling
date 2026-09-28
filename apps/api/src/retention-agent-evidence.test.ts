import assert from "node:assert/strict";
import test from "node:test";
import { buildRetentionAgentEvidenceGate } from "./retention-agent-evidence.js";

const recurrence = { new_orders: 70, returning_orders: 30, unknown_orders: 0 };

test("A20 gate rejects a store-wide repeat rate whenever any orders are unclassified", () => {
  const result = buildRetentionAgentEvidenceGate({
    recurrence: { new_orders: 63, returning_orders: 27, unknown_orders: 10 },
    cohorts: [],
    asOf: "2026-09-27T00:00:00.000Z",
  });
  assert.equal(result.period_repeat_rate.assessable, false);
  assert.equal(result.period_repeat_rate.majority_unclassified, false);
  assert.equal(result.period_repeat_rate.classified_orders_only, true);
  assert.equal(result.status, "insufficient_evidence");
});

test("A20 gate requires two mature cohorts of minimum size at a matching age", () => {
  const result = buildRetentionAgentEvidenceGate({
    recurrence,
    cohorts: [
      { cohort_month: "2026-06-01", cohort_customers: 35, month_offset: 1 },
      { cohort_month: "2026-07-01", cohort_customers: 40, month_offset: 1 },
      { cohort_month: "2026-08-01", cohort_customers: 80, month_offset: 1 },
    ],
    asOf: "2026-09-27T00:00:00.000Z",
  });
  assert.equal(result.comparable_by_age.find((item) => item.age_months === 1)?.eligible_cohorts, 2);
  assert.equal(result.comparable_by_age.find((item) => item.age_months === 1)?.comparison_ready, true);
  assert.equal(result.comparable_by_age.find((item) => item.age_months === 3)?.comparison_ready, false);
  assert.equal(result.status, "descriptive_comparison_ready");
});

test("A20 gate leaves failed metrics unknown and does not count the current month as complete", () => {
  const result = buildRetentionAgentEvidenceGate({
    recurrence: "no_disponible",
    cohorts: [{ cohort_month: "2026-09-01", cohort_customers: 200, month_offset: 0 }],
    asOf: "2026-09-27T00:00:00.000Z",
  });
  assert.equal(result.period_repeat_rate.assessable, false);
  assert.equal(result.period_repeat_rate.unknown_orders_share, null);
  assert.equal(result.cohorts[0]?.complete_months_observed, 0);
  assert.equal(result.status, "insufficient_evidence");
  assert.match(result.constraints.join(" "), /no demuestra.*retenci/i);
});
