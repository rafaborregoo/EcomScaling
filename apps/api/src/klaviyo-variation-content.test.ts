import assert from "node:assert/strict";
import test from "node:test";
import type { KlaviyoClient } from "./klaviyo-client.js";
import {
  buildKlaviyoCampaignMessageVariationPath,
  fetchKlaviyoCampaignVariations,
  indexKlaviyoVariationConnections,
  klaviyoVariationBodyProvenance,
  normalizeKlaviyoCampaignMessageVariations,
} from "./klaviyo-variation-content.js";

test("indexes only real internal account IDs with a usable connection", () => {
  const connections = indexKlaviyoVariationConnections([
    { id: "account-internal-1", connection_id: "connection-1" },
    { id: "account-internal-2", connection_id: null },
    { id: "", connection_id: "connection-3" },
  ]);
  assert.deepEqual([...connections], [["account-internal-1", "connection-1"]]);
});

test("beta request encodes only the known message ID and asks for email variation metadata", () => {
  const path = buildKlaviyoCampaignMessageVariationPath("message/a");
  const url = new URL(path, "https://a.klaviyo.com");
  assert.equal(url.pathname, "/campaign-messages/message%2Fa");
  assert.equal(url.searchParams.get("include"), "campaign-variations");
  assert.equal(url.searchParams.get("fields[campaign-variation]"), "definition");
});

test("normalizes only variations related to this message and channel email", () => {
  const rows = normalizeKlaviyoCampaignMessageVariations("account-1", "message-1", {
    data: {
      id: "message-1",
      relationships: {
        "campaign-variations": { data: [
          { type: "campaign-variation", id: "variation-email" },
          { type: "campaign-variation", id: "variation-sms" },
        ] },
      },
    },
    included: [
      { type: "campaign-variation", id: "variation-email", attributes: {
        updated: "2026-09-20T12:00:00Z",
        definition: { name: "Control", details: { channel: "email", template_id: "template-a", subject: "Hello", preview_text: "Preview" } },
      } },
      { type: "campaign-variation", id: "variation-sms", attributes: {
        definition: { name: "SMS", details: { channel: "sms", body: "Hello" } },
      } },
      { type: "campaign-variation", id: "unrelated", attributes: {
        definition: { name: "Not related", details: { channel: "email", template_id: "bad-template" } },
      } },
    ],
  });

  assert.deepEqual(rows, [{
    account_id: "account-1",
    message_id: "message-1",
    variation_id: "variation-email",
    variation_name: "Control",
    channel: "email",
    template_id: "template-a",
    subject: "Hello",
    preview_text: "Preview",
    provider_updated_at: "2026-09-20T12:00:00Z",
  }]);
  assert.equal(normalizeKlaviyoCampaignMessageVariations("account-1", "wrong-message", {
    data: { id: "message-1" },
  }).length, 0);
});

test("variation fetch deduplicates account/message pairs, caps requests and reports failures", async () => {
  const requested: string[] = [];
  const result = await fetchKlaviyoCampaignVariations(
    [
      { account_id: "account-1", message_id: "m1" },
      { account_id: "account-1", message_id: "m1" },
      { account_id: "account-2", message_id: "m1" },
      { account_id: "account-1", message_id: "m2" },
    ],
    async (accountId) => ({
      request: async (path: string) => {
        requested.push(`${accountId}:${path}`);
        if (accountId === "account-2") throw new Error("provider payload omitted from result");
        return { data: { id: path.includes("m1") ? "m1" : "m2" } };
      },
    }) as unknown as KlaviyoClient,
    2,
  );

  assert.equal(requested.length, 2);
  assert.deepEqual(result, {
    rows: [],
    eligibleMessages: 3,
    requestedMessages: 2,
    omittedMessages: 1,
    failedMessages: 1,
  });
});

test("does not claim a variant body is sent when it only has a current template fallback", () => {
  const provenance = klaviyoVariationBodyProvenance({
    templateId: "template-1",
    bodyAvailable: true,
    providerUpdatedAt: "2026-09-20T12:00:00Z",
    sendTime: "2026-09-21T12:00:00Z",
    historicalSource: null,
  });
  assert.equal(typeof provenance, "object");
  assert.match(JSON.stringify(provenance), /no se encontro snapshot/);
});
