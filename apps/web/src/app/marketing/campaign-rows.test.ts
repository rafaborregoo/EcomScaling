import assert from "node:assert/strict";
import test from "node:test";
import { buildCampaignRows } from "./campaign-rows";
import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import type { KCampaign } from "./klaviyo-workspace";

const NOW = Date.parse("2026-09-30T08:00:00Z");

function item(overrides: Partial<CampaignItem>): CampaignItem {
  return {
    id: "i",
    calendar_id: "c",
    title: "Campaña",
    description: null,
    channel: "email_klaviyo",
    status: "planned",
    starts_at: "2026-10-02T09:00:00Z",
    ends_at: null,
    marketing_draft_id: null,
    meta_campaign_id: null,
    klaviyo_campaign_id: null,
    ...overrides,
  };
}

const approved = { id: "d1", status: "approved", subject: "Otoño" } as MarketingDraft;
const inReview = { id: "d2", status: "pending_approval", subject: "Rebajas" } as MarketingDraft;

function campaign(overrides: Partial<KCampaign>): KCampaign {
  return {
    id: "k",
    external_id: "EXT",
    name: "Klaviyo",
    status: "Sent",
    send_time: "2026-09-20T09:00:00Z",
    channel: "email",
    subject: "Asunto",
    preview_text: null,
    from_email: null,
    from_label: null,
    template_id: null,
    audiences: { included: [], excluded: [] },
    stats: null,
    ...overrides,
  };
}

test("planned campaigns get a state from their piece and date", () => {
  const rows = buildCampaignRows(
    [
      item({ id: "a", marketing_draft_id: null }),
      item({ id: "b", marketing_draft_id: "d1" }),
      item({ id: "c", marketing_draft_id: "d2" }),
      item({ id: "d", starts_at: "2026-09-15T09:00:00Z" }),
      item({ id: "e", channel: "meta_ads" }),
      item({ id: "f", status: "cancelled" }),
    ],
    [approved, inReview],
    [],
    NOW,
  );
  const state = Object.fromEntries(rows.map((row) => [row.item!.id, row.state]));
  assert.deepEqual(state, { a: "nopiece", b: "ready", c: "review", d: "late" });
  assert.equal(rows[0]!.item!.id, "d", "lo atrasado va primero");
});

test("a Klaviyo campaign linked to a plan item is one row, the rest stand alone", () => {
  const rows = buildCampaignRows(
    [item({ id: "a", klaviyo_campaign_id: "k1", marketing_draft_id: "d1" })],
    [approved],
    [campaign({ id: "k1", status: "Scheduled", send_time: "2026-10-01T09:00:00Z" }), campaign({ id: "k2" })],
    NOW,
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.source, "both");
  assert.equal(rows[0]!.state, "scheduled");
  assert.equal(rows[1]!.source, "klaviyo");
  assert.equal(rows[1]!.state, "sent");
});
