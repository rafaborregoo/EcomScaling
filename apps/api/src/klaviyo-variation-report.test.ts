import assert from "node:assert/strict";
import test from "node:test";
import { buildKlaviyoVariationContext } from "./klaviyo-variation-report.js";

const inventory = [
  { account_id: "account-1", external_message_id: "message-1", parent_name: "Launch" },
  { account_id: "account-2", external_message_id: "message-1", parent_name: "Other launch" },
];

test("joins variation metrics only to the exact Klaviyo account and message", () => {
  const result = buildKlaviyoVariationContext(inventory, [
    {
      account_id: "account-1", campaign_id: "campaign-1", campaign_message_id: "message-1",
      variation_id: "A", variation_name: "Control", period_start: "2026-09-01", period_end: "2026-09-30",
      statistics: { recipients: "100", conversion_value: 25, secret_profile_data: "must-not-pass" },
    },
    {
      account_id: "other-account", campaign_id: "campaign-1", campaign_message_id: "message-1",
      variation_id: "B", variation_name: "Wrong store", period_start: "2026-09-01", period_end: "2026-09-30",
      statistics: { recipients: 999 },
    },
  ]);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.campaign_name, "Launch");
  assert.deepEqual(result.rows[0]?.statistics, { recipients: 100, conversion_value: 25 });
  assert.equal(result.unmatchedCount, 1);
});

test("keeps only the newest period per variant and labels evidence limits", () => {
  const base = {
    account_id: "account-1", campaign_id: "campaign-1", campaign_message_id: "message-1",
    variation_id: "A", variation_name: "Control", period_start: "2026-01-01",
  };
  const result = buildKlaviyoVariationContext(inventory, [
    { ...base, period_end: "2026-01-31", statistics: { clicks_unique: 3 } },
    { ...base, period_start: "2026-02-01", period_end: "2026-02-28", statistics: { clicks_unique: 7 } },
  ]);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.period_end, "2026-02-28");
  assert.equal(result.rows[0]?.statistics.clicks_unique, 7);
  assert.equal(result.rows[0]?.interpretation_limits.length, 2);
});

test("bounds emitted rows and reports omitted variants", () => {
  const rows = Array.from({ length: 3 }, (_, index) => ({
    account_id: "account-1", campaign_id: "campaign-1", campaign_message_id: "message-1",
    variation_id: `variant-${index}`, variation_name: `Variant ${index}`,
    period_start: "2026-01-01", period_end: `2026-0${index + 1}-28`, statistics: { delivered: index + 1 },
  }));
  const result = buildKlaviyoVariationContext(inventory, rows, 1);

  assert.equal(result.rows.length, 1);
  assert.equal(result.matchedVariantCount, 3);
  assert.equal(result.omittedCount, 2);
});

test("surfaces when the database cap truncated the provider variation report", () => {
  const result = buildKlaviyoVariationContext(inventory, [{
    account_id: "account-1", campaign_id: "campaign-1", campaign_message_id: "message-1",
    variation_id: "A", variation_name: "Control", period_start: "2026-01-01",
    period_end: "2026-01-31", statistics: { recipients: 5 }, total_count: 251,
  }]);

  assert.equal(result.queryTruncated, true);
  assert.equal(result.providerRowsReported, 251);
  assert.equal(result.providerRowsReturned, 1);
});

test("does not attach malformed or incomplete variant rows", () => {
  const result = buildKlaviyoVariationContext(inventory, [
    {
      account_id: "account-1", campaign_id: "campaign-1", campaign_message_id: "message-1",
      variation_id: "", variation_name: "No id", period_start: "2026-01-01", period_end: "2026-01-31", statistics: {},
    },
    {
      account_id: "account-1", campaign_id: "campaign-1", campaign_message_id: null,
      variation_id: "B", variation_name: "No message", period_start: "2026-01-01", period_end: "2026-01-31", statistics: {},
    },
  ]);

  assert.equal(result.rows.length, 0);
  assert.equal(result.unmatchedCount, 0);
});
