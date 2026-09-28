import assert from "node:assert/strict";
import test from "node:test";
import { klaviyoReportGroupings } from "./klaviyo-report-groupings.js";

test("campaign reports retain required campaign/message IDs and group stable A/B dimensions", () => {
  assert.deepEqual(klaviyoReportGroupings("campaign-values-report"), [
    "campaign_id", "campaign_message_id", "variation", "variation_name",
  ]);
});

test("flow report groupings remain unchanged", () => {
  assert.deepEqual(klaviyoReportGroupings("flow-values-report"), [
    "flow_id", "flow_message_id",
  ]);
});
