import test from "node:test";
import assert from "node:assert/strict";
import { a26ContentIdentity, a26FlowGraph, loadA26Inventory } from "./a26-content-evidence.js";
import { emailHtmlToText } from "./email-body-text.js";
import { selectKlaviyoEmailsForContentAudit } from "./klaviyo-template-history.js";
import { selectKlaviyoTemplateBody } from "./klaviyo-template-history.js";
import { buildKlaviyoVariationContext } from "./klaviyo-variation-report.js";
import type { SupabaseClient } from "@supabase/supabase-js";

test("invalid Unicode cannot abort an email audit", () => {
  assert.equal(emailHtmlToText("<p>&#999999999; &#xD800; &#0; &#x1f600;</p>").text, "� � � 😀");
  assert.equal(emailHtmlToText("<p>&#12ff;</p>").text, "&#12ff;");
});
test("historical plaintext takes precedence over current HTML without being labelled recipient proof", () => {
  const selected = selectKlaviyoTemplateBody("<p>Current</p>", { html_content: null, text_content: "Historical plaintext", version_source: "snapshot", version_observed_at: "2026-09-01", version_superseded_at: "2026-10-01" }, "2026-09-15");
  assert.equal(selected.html, null); assert.equal(selected.text, "Historical plaintext");
});
test("the editorial bundle changes for subject, account, body or message state", () => {
  const row = { account_id: "a", message_id: "m", subject: "original" };
  const id = a26ContentIdentity(row, "body", "observed");
  for (const changed of [{ ...row, subject: "changed" }, { ...row, account_id: "b" }, { ...row, message_status: "draft" }]) assert.notEqual(a26ContentIdentity(changed, "body", "observed").content_hash, id.content_hash);
  assert.notEqual(a26ContentIdentity(row, "changed", "observed").content_hash, id.content_hash);
});
test("flow branches come from provider links; reused IDs in another flow do not resolve a gap", () => {
  const graph = a26FlowGraph([
    { flow_id: "one", external_action_id: "a", action_type: "conditional-split", raw_data: { definition: { links: { next_if_true: "b", next_if_false: "c" } } } },
    { flow_id: "one", external_action_id: "b" }, { flow_id: "two", external_action_id: "c" },
  ]);
  assert.deepEqual(graph.nodes[0]?.edges.map((edge) => edge.resolved), [true, false]);
  assert.equal(a26FlowGraph([{ flow_id: "one", external_action_id: "a", position: 1 }]).sequence_status, "order_unverified");
});
test("message state and channel are considered and large flows rotate past the first messages", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ message_id: String(i), source: "flow", parent_status: "live", account_id: "a", parent_id: "f", position_in_parent: i, channel: "email", message_status: "live" }));
  const first = selectKlaviyoEmailsForContentAudit(rows, 3, 0);
  const second = selectKlaviyoEmailsForContentAudit(rows, 3, 1);
  assert.ok(second.rows.every((row) => !first.rows.includes(row)));
  assert.equal(selectKlaviyoEmailsForContentAudit([{ ...rows[0], channel: "sms" }, { ...rows[0], message_status: "draft" }]).rows.length, 0);
});
test("variant comparisons reject incompatible windows and invalid counts", () => {
  const base = { account_id: "a", campaign_id: "c", campaign_message_id: "m", variation_name: "variant", statistics: { recipients: -1, clicks_unique: 2.5, delivered: 10 }, period_start: "2026-08-01" };
  const result = buildKlaviyoVariationContext([{ account_id: "a", external_message_id: "m", parent_name: "Campaign" }], [
    { ...base, variation_id: "A", period_end: "2026-08-31" }, { ...base, variation_id: "B", period_start: "2026-09-01", period_end: "2026-09-30" },
  ]);
  assert.ok(result.rows.every((row) => row.comparison_status === "incompatible_periods"));
  assert.deepEqual(result.rows[0]?.statistics, { delivered: 10 });
});
test("inventory traverses stable pages and fails closed on a source error", async () => {
  let calls = 0;
  const client = { rpc: async (_name: string, args: Record<string, unknown>) => {
    calls++;
    assert.equal(args.p_store_id, "store");
    return { data: { rows: [{ message_id: String(calls) }], total_count: 2, next_cursor: calls === 1 ? "cursor" : null }, error: null };
  } } as unknown as SupabaseClient;
  const result = await loadA26Inventory(client, "org", "store");
  assert.equal(result.rows.length, 2); assert.equal(result.complete, true);
  await assert.rejects(loadA26Inventory({ rpc: async () => ({ error: { message: "failure" } }) } as unknown as SupabaseClient, "org", "store"), /unavailable/);
  await assert.rejects(loadA26Inventory({ rpc: async () => ({ data: { rows: [{ message_id: "same" }], total_count: 2, next_cursor: "again" }, error: null }) } as unknown as SupabaseClient, "org", "store"), /duplicate/);
});
