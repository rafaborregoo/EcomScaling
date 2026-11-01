import assert from "node:assert/strict";
import test from "node:test";
import { emailCampaignState } from "./email-campaign-pipeline.js";

const now = new Date("2026-10-31T12:00:00Z");
const base = { id: "c", account_id: "a", name: "Campaign", status: "Draft", send_time: "2026-10-30T10:00:00Z", last_synced_at: null };
test("an old draft is not a missed scheduled send", () => {
  assert.equal(emailCampaignState(base, now), "draft");
});
test("past scheduled sends require verification, not automatic resend", () => {
  assert.equal(emailCampaignState({ ...base, status: "SCHEDULED" }, now), "scheduled_time_passed_verify");
  assert.equal(emailCampaignState({ ...base, status: "Scheduled", send_time: "2026-11-01T10:00:00Z" }, now), "scheduled");
  assert.equal(emailCampaignState({ ...base, status: "Sending" }, now), "sending");
  assert.equal(emailCampaignState({ ...base, status: "Cancelled" }, now), "cancelled");
});
test("one sent message does not complete a campaign with another scheduled message", () => {
  const message = { id: "m1", channel: "email", subject: "One", status: "Sent", sent_at: "2026-10-30T10:00:00Z", scheduled_at: "2026-10-30T10:00:00Z" };
  const campaign = { ...base, status: "Scheduled", messages: [message, { ...message, id: "m2", status: "Scheduled", sent_at: null, scheduled_at: "2026-11-01T10:00:00Z" }] };
  assert.equal(emailCampaignState(campaign, now), "scheduled");
  assert.equal(emailCampaignState({ ...base, messages: [message] }, now), "sent");
});
