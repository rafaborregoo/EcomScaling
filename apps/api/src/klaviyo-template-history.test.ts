import assert from "node:assert/strict";
import test from "node:test";
import {
  collectKlaviyoTemplateVersionRequests,
  klaviyoTemplateVersionKey,
  selectKlaviyoEmailsForContentAudit,
  selectKlaviyoTemplateBody,
} from "./klaviyo-template-history.js";

test("historical lookup deduplicates identical template/send tuples and prioritizes recent sends", () => {
  const batch = collectKlaviyoTemplateVersionRequests([
    { account_id: "a", external_template_id: "t1", send_time: "2026-01-01T00:00:00Z" },
    { account_id: "a", external_template_id: "t1", send_time: "2026-01-01T00:00:00.000Z" },
    { account_id: "a", external_template_id: "t2", send_time: "2026-02-01T00:00:00Z" },
    { account_id: "a", external_template_id: "t3", send_time: null },
  ]);
  assert.equal(batch.eligibleCount, 2);
  assert.equal(batch.requests.length, 2);
  assert.equal(batch.requests[0]?.external_template_id, "t2");
  assert.equal(batch.skippedWithoutSendTime, 1);
  assert.equal(batch.capped, false);
  assert.equal(
    klaviyoTemplateVersionKey("a", "t1", "2026-01-01T00:00:00Z"),
    klaviyoTemplateVersionKey("a", "t1", "2026-01-01T00:00:00.000Z"),
  );
});

test("historical lookup has a hard maximum and reports omitted candidates", () => {
  const rows = Array.from({ length: 4 }, (_, index) => ({
    account_id: "a",
    external_template_id: "t" + index,
    send_time: "2026-03-0" + (index + 1) + "T00:00:00Z",
  }));
  const batch = collectKlaviyoTemplateVersionRequests(rows, 2);
  assert.equal(batch.requests.length, 2);
  assert.equal(batch.eligibleCount, 4);
  assert.equal(batch.capped, true);
  assert.equal(batch.requests[0]?.external_template_id, "t3");
});

test("body selection uses matched historical html and never labels fallback as sent", () => {
  const match = {
    html_content: "<p>Version observada</p>",
    version_source: "provider_updated_at_precedes_send",
    version_observed_at: "2026-03-01T00:00:00Z",
    version_superseded_at: null,
  };
  const historical = selectKlaviyoTemplateBody("<p>Actual</p>", match, "2026-03-02T00:00:00Z");
  assert.equal(historical.html, match.html_content);
  assert.equal(typeof historical.provenance, "object");

  const fallback = selectKlaviyoTemplateBody("<p>Actual</p>", undefined, "2026-03-02T00:00:00Z");
  assert.equal(fallback.html, "<p>Actual</p>");
  assert.match(String(fallback.provenance), /no_coincide/);

  const noBodyInSnapshot = selectKlaviyoTemplateBody("<p>Actual</p>", {
    ...match,
    html_content: null,
  }, "2026-03-02T00:00:00Z");
  assert.equal(noBodyInSnapshot.html, "<p>Actual</p>");
  assert.match(String(noBodyInSnapshot.provenance), /no_tenia_html/);
});

test("content audit selection prioritizes complete live-flow sequences and recent campaigns", () => {
  const rows = [
    { source: "flow", account_id: "a", parent_id: "flow-1", parent_status: "live", position_in_parent: 2 },
    { source: "flow", account_id: "a", parent_id: "flow-1", parent_status: "live", position_in_parent: 1 },
    { source: "flow", account_id: "a", parent_id: "flow-draft", parent_status: "draft", position_in_parent: 1 },
    { source: "campaign", account_id: "a", parent_id: "older", parent_status: "sent", send_time: "2026-01-01T00:00:00Z" },
    { source: "campaign", account_id: "a", parent_id: "newer", parent_status: "sent", send_time: "2026-02-01T00:00:00Z" },
    { source: "campaign", account_id: "a", parent_id: "draft", parent_status: "draft" },
  ];
  const selection = selectKlaviyoEmailsForContentAudit(rows, 4);
  assert.equal(selection.rows.length, 4);
  assert.deepEqual(selection.rows.slice(0, 2).map((row) => row.position_in_parent), [1, 2]);
  assert.equal(selection.rows[2]?.parent_id, "newer");
  assert.equal(selection.rows[3]?.parent_id, "older");
  assert.equal(selection.excludedCount, 2);
  assert.equal(selection.omittedEligibleCount, 0);
});

test("content audit reports when a flow sequence must be sampled partially", () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, position) => ({
      source: "flow",
      account_id: "a",
      parent_id: "large-flow",
      parent_status: "live",
      position_in_parent: position + 1,
    })),
    { source: "campaign", account_id: "a", parent_id: "sent", parent_status: "sent", send_time: "2026-02-01T00:00:00Z" },
  ];
  const selection = selectKlaviyoEmailsForContentAudit(rows, 2);
  assert.equal(selection.rows.length, 2);
  assert.equal(selection.rows[0]?.source, "flow");
  assert.deepEqual(selection.truncatedFlowIds, ["large-flow"]);
  assert.equal(selection.omittedEligibleCount, 4);
});
