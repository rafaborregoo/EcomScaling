import assert from "node:assert/strict";
import test from "node:test";
import { summariseKlaviyoEmailRows, type KlaviyoEmailReportRow } from "./klaviyo.js";

test("per-flow summary retains delivery, unsubscribe, bounce and complaint signals", () => {
  const rows: KlaviyoEmailReportRow[] = [{
    bucket_month: "2026-08-01",
    entity_type: "flow",
    entity_id: "flow-1",
    entity_name: "Welcome",
    subject: null,
    send_time: null,
    trigger_type: "list",
    revenue: 100,
    conversions: 2,
    recipients: 120,
    delivered: 100,
    opens_unique: 50,
    clicks_unique: 10,
    unsubscribes: 2,
    bounced: 3,
    spam_complaints: 1,
  }];
  const flow = summariseKlaviyoEmailRows(rows).flows[0];
  assert.ok(flow);
  assert.equal(flow.unsubscribes, 2);
  assert.equal(flow.bounced, 3);
  assert.equal(flow.spam_complaints, 1);
  assert.equal(flow.unsub_rate, 0.02);
  assert.equal(flow.bounce_rate, 0.025);
  assert.equal(flow.spam_rate, 0.01);
});
