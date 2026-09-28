import assert from "node:assert/strict";
import test from "node:test";
import { summarizeKlaviyoFlowInventory } from "./klaviyo-flow-architect-context.js";

const now = Date.parse("2026-09-28T12:00:00Z");

test("A28 includes only flows from the selected store and excludes message content", () => {
  const result = summarizeKlaviyoFlowInventory({
    accounts: [
      { id: "account-a", store_id: "store-a", name: "A" },
      { id: "account-b", store_id: "store-b", name: "B" },
    ],
    flows: [
      {
        id: "flow-a",
        account_id: "account-a",
        name: "Welcome",
        status: "live",
        trigger_type: "Added to list",
        last_synced_at: "2026-09-27T12:00:00Z",
      },
      {
        id: "flow-b",
        account_id: "account-b",
        name: "Winback",
        status: "live",
        trigger_type: "Metric",
        last_synced_at: "2026-09-27T12:00:00Z",
      },
    ],
    actions: [
      {
        flow_id: "flow-a",
        action_type: "send_email",
        status: "live",
        position: 1,
        settings_data: { body: "private" },
      },
    ],
    messages: [
      {
        flow_id: "flow-a",
        channel: "email",
        subject: "private subject",
        raw_data: { html: "private body" },
      },
    ],
    selectedStoreId: "store-a",
    now,
  });
  assert.equal(result.scope, "selected_store");
  assert.equal(result.active_flow_count_observed, 1);
  assert.equal(result.flows[0]?.name, "Welcome");
  assert.equal(result.flows[0]?.message_count_observed, 1);
  assert.equal(JSON.stringify(result).includes("private subject"), false);
  assert.equal(JSON.stringify(result).includes("private body"), false);
});

test("A28 reads cached event aggregates without exposing provider metric IDs or claiming eligibility", () => {
  const result = summarizeKlaviyoFlowInventory({
    selectedStoreId: "store-a",
    now: Date.parse("2026-09-28T12:00:00.000Z"),
    accounts: [{ id: "account-a", store_id: "store-a", name: "Main" }],
    flows: [
      {
        id: "flow-a",
        account_id: "account-a",
        name: "Cart recovery",
        status: "live",
        raw_data: {
          a28_flow_metric_refs: ["private-klaviyo-id"],
          a28_flow_metric_volumes: [
            {
              metric_id: "private-klaviyo-id",
              event_type: "started_checkout",
              event_count: 125,
              period_start: "2026-06-30T12:00:00.000Z",
              period_end: "2026-09-28T12:00:00.000Z",
              fetched_at: "2026-09-28T11:00:00.000Z",
            },
          ],
        },
      },
    ],
    actions: [],
    messages: [],
  });
  const output = JSON.stringify(result);
  assert.match(output, /started_checkout/);
  assert.match(output, /total_metric_events_not_filter_eligible_profiles/);
  assert.doesNotMatch(output, /private-klaviyo-id/);
  assert.equal(result.eligible_event_volume_available, false);
  assert.equal(result.trigger_event_volume_status, "available");
});

test("A28 distinguishes empty inventory, failed sync, stale data and truncation", () => {
  const base = {
    accounts: [{ id: "a", store_id: null, name: "Main" }],
    selectedStoreId: null,
    now,
  };
  assert.equal(
    summarizeKlaviyoFlowInventory({
      ...base,
      flows: [],
      actions: [],
      messages: [],
    }).status,
    "available",
  );
  const unavailable = summarizeKlaviyoFlowInventory({
    ...base,
    accounts: [],
    flows: [],
    actions: [],
    messages: [],
  });
  assert.equal(unavailable.status, "unavailable");
  const partial = summarizeKlaviyoFlowInventory({
    ...base,
    flows: [
      {
        id: "f",
        account_id: "a",
        name: "Onboarding",
        last_synced_at: "2026-09-20T12:00:00Z",
      },
    ],
    actions: [],
    messages: [],
    loadErrors: ["some pages could not be loaded"],
    maxFlows: 1,
  });
  assert.equal(partial.status, "partial");
  assert.equal(partial.flows[0]?.sync_stale, true);
  assert.equal(partial.labels_are_untrusted_data, true);
});

test("A28 bounds account inventory to the configured maximum", () => {
  const accounts = [{ id: "a", store_id: null, name: "Main" }];
  const flows = Array.from({ length: 3 }, (_, index) => ({
    id: `f${index}`,
    account_id: "a",
    name: `Flow ${index}`,
  }));
  const result = summarizeKlaviyoFlowInventory({
    accounts,
    flows,
    actions: [],
    messages: [],
    selectedStoreId: null,
    maxFlows: 2,
  });
  assert.equal(result.active_flow_count_observed, 3);
  assert.equal(result.active_flow_count_included, 2);
  assert.equal(result.inventory_truncated, true);
});

test("A28 exposes only sanitized flow structure and flags missing or outdated definitions", () => {
  const result = summarizeKlaviyoFlowInventory({
    accounts: [{ id: "a", store_id: "s", name: "Main" }],
    flows: [
      {
        id: "f1",
        account_id: "a",
        name: "Welcome",
        status: "live",
        updated_at_external: "2026-09-28T10:00:00Z",
        raw_data: {
          a28_flow_structure: {
            version: 1,
            synced_at: "2026-09-28T10:01:00Z",
            source_updated_at: "2026-09-28T10:00:00Z",
            trigger_types: ["metric"],
            trigger_filter_condition_count: 2,
            profile_filter_condition_count: 1,
            has_profile_filter: true,
            action_count_observed: 3,
            steps: [
              { type: "time-delay", delay_value: 2, delay_unit: "days" },
              { type: "send-email", smart_sending_enabled: true },
            ],
          },
          content: { html: "must not pass" },
        },
      },
      {
        id: "f2",
        account_id: "a",
        name: "Post-purchase",
        status: "live",
        updated_at_external: "2026-09-28T10:00:00Z",
        raw_data: {
          definition: {
            profile_filter: { conditions: [{ value: "private" }] },
          },
        },
      },
    ],
    actions: [],
    messages: [],
    selectedStoreId: "s",
    now,
  });
  assert.equal(result.flows[0]?.definition_status, "available");
  assert.equal(result.flows[0]?.definition_stale, false);
  assert.equal(result.flows[0]?.structure?.trigger_filter_condition_count, 2);
  assert.deepEqual(
    result.flows[0]?.structure?.steps.map((step) => step.type),
    ["time-delay", "send-email"],
  );
  assert.equal(result.flows[1]?.definition_status, "not_synced");
  assert.equal(result.flows[1]?.definition_stale, true);
  assert.doesNotMatch(JSON.stringify(result), /must not pass|private/);
});
