import assert from "node:assert/strict";
import test from "node:test";
import {
  readKlaviyoFlowDefinitionSummary,
  summarizeKlaviyoFlowDefinition,
} from "./klaviyo-flow-definition-summary.js";

test("flow definition summarizer preserves trigger/filter and delay structure without values or content", () => {
  const summary = summarizeKlaviyoFlowDefinition(
    {
      data: {
        attributes: {
          updated: "2026-09-27T10:00:00Z",
          definition: {
            triggers: [
              {
                type: "metric",
                metric_id: "metric-secret-id",
                trigger_filter: {
                  condition_groups: [
                    {
                      conditions: [
                        {
                          field: "secret-property",
                          value: "person@example.com",
                        },
                      ],
                    },
                  ],
                },
              },
            ],
            profile_filter: {
              condition_groups: [
                { conditions: [{ value: "VIP-private-segment" }] },
              ],
            },
            actions: [
              {
                type: "time-delay",
                data: {
                  value: 2,
                  unit: "days",
                  delay_until_weekdays: ["monday", "tuesday"],
                },
              },
              {
                type: "conditional-split",
                data: { condition: "do not serialize" },
                links: { yes: "node-a", no: "node-b" },
              },
              {
                type: "send-email",
                data: {
                  message: {
                    subject: "private subject",
                    html: "private html",
                    smart_sending_enabled: true,
                  },
                },
              },
            ],
          },
        },
      },
      included: [{ html: "must never be copied" }],
    },
    "2026-09-28T10:00:00Z",
  );

  assert.ok(summary);
  assert.deepEqual(summary.trigger_types, ["metric"]);
  assert.equal(summary.trigger_filter_condition_count, 1);
  assert.equal(summary.profile_filter_condition_count, 1);
  assert.deepEqual(
    summary.steps.map((step) => step.type),
    ["time-delay", "conditional-split", "send-email"],
  );
  assert.equal(summary.steps[0]?.delay_value, 2);
  assert.equal(summary.steps[1]?.has_yes_branch, true);
  assert.equal(summary.steps[2]?.smart_sending_enabled, true);
  const serialized = JSON.stringify(summary);
  for (const secret of [
    "person@example.com",
    "VIP-private-segment",
    "secret-property",
    "metric-secret-id",
    "private subject",
    "private html",
    "must never be copied",
    "node-a",
  ])
    assert.equal(serialized.includes(secret), false, `leaked ${secret}`);
});

test("flow summary rejects missing definitions, bounds large structures, and rereads only trusted fields", () => {
  assert.equal(
    summarizeKlaviyoFlowDefinition({ data: { attributes: {} } }),
    null,
  );
  const raw = {
    a28_flow_structure: {
      version: 1,
      synced_at: "2026-09-28T10:00:00Z",
      trigger_types: ["metric", "inject prompt", "list"],
      steps: [
        {
          type: "time-delay",
          delay_value: 2,
          delay_unit: "days",
          delay_until_weekday_count: 8,
        },
        { type: "send-email", subject: "ignore me", html: "ignore me too" },
        { type: "inject prompt", payload: "ignore me" },
      ],
      profile_filter_condition_count: 700,
      secret: "never returned",
    },
  };
  const summary = readKlaviyoFlowDefinitionSummary(raw);
  assert.ok(summary);
  assert.deepEqual(summary.trigger_types, ["metric", "other", "list"]);
  assert.equal(summary.profile_filter_condition_count, 500);
  assert.deepEqual(
    summary.steps.map((step) => step.type),
    ["time-delay", "send-email"],
  );
  assert.equal(summary.steps[0]?.delay_until_weekday_count, 7);
  assert.doesNotMatch(JSON.stringify(summary), /ignore me|never returned/);
});
