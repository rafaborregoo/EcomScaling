import assert from "node:assert/strict";
import test from "node:test";
import { buildCampaignRows, STATE_LABEL, UPCOMING, type CampaignPlanSummary } from "./campaign-rows";
import type { CampaignItem } from "@/hooks/use-campaign-items";
import type { MarketingDraft } from "@/hooks/use-marketing-drafts";
import type { KCampaign } from "./klaviyo-workspace";
import type { MetaCampaignListRow } from "../meta/campaign-types";

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

function metaCampaign(overrides: Partial<MetaCampaignListRow>): MetaCampaignListRow {
  return {
    campaign_id: "m1",
    name: "Meta primavera",
    objective: "Ventas",
    effective_status: "ACTIVE",
    budget: null,
    ad_set_count: 1,
    active_ad_set_count: 1,
    ad_count: 1,
    rejected_ad_count: 0,
    learning_ad_set_count: 0,
    learning_limited_ad_set_count: 0,
    spend: 100,
    impressions: 1000,
    clicks: 30,
    purchases: 3,
    purchase_value: 250,
    roas: 2.5,
    purchase_action_type: null,
    days_with_data: 30,
    cpm: 100,
    cpc: 3.33,
    daily_spend: [],
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
  assert.deepEqual(state, { a: "nopiece", b: "ready", c: "review", d: "late", e: "nopiece" });
  assert.equal(rows[0]!.item!.id, "d", "lo atrasado va primero");
});

test("calendarized A05 actions are marked for review and stay in upcoming", () => {
  const rows = buildCampaignRows(
    [item({
      id: "a05-message",
      title: "Guía de preparación",
      metadata: { a05_proposal: { output_id: "output-1", action_index: 0, initiative: "Preparar Navidad" } },
    })],
    [],
    [],
    NOW,
  );

  assert.equal(rows[0]?.state, "plan");
  assert.equal(STATE_LABEL[rows[0]!.state].label, "Plan IA · por revisar");
  assert.ok(UPCOMING.includes(rows[0]!.state));
});

test("email and Meta drafts without a calendar item still appear in the campaign list", () => {
  const emailDraft = {
    ...approved,
    id: "email-draft",
    status: "draft",
    content_type: "campaign",
    request: { channel: "email_klaviyo" },
    created_at: "2026-09-28T10:00:00Z",
    scheduled_for: null,
  } as MarketingDraft;
  const metaDraft = {
    ...approved,
    id: "meta-draft",
    status: "pending_approval",
    content_type: "campaign",
    request: { channel: "meta_ads" },
    created_at: "2026-09-29T10:00:00Z",
    scheduled_for: null,
  } as MarketingDraft;

  const rows = buildCampaignRows([], [emailDraft, metaDraft], [], NOW);

  assert.deepEqual(
    rows.map((row) => [row.draft?.id, row.channel, row.state]),
    [
      ["meta-draft", "meta_ads", "review"],
      ["email-draft", "email_klaviyo", "draft"],
    ],
  );
});

test("an approved draft with a missed planned date is late", () => {
  const draft = {
    ...approved,
    content_type: "campaign",
    request: { channel: "email_klaviyo" },
    scheduled_for: "2026-09-29T10:00:00Z",
  } as MarketingDraft;
  const rows = buildCampaignRows([], [draft], [], NOW);
  assert.equal(rows[0]?.state, "late");
});

test("unapplied A05 initiatives appear as items awaiting review until accepted", () => {
  const proposal: CampaignPlanSummary = {
    output_id: "output-1",
    applied_indexes: [1],
    content: {
      campaigns: [
        { title: "Email de temporada", channel: "email_klaviyo", objective: "Email", scheduled_date: "2026-10-05" },
        { title: "Creativo Meta", channel: "meta_ads", objective: "Anuncio", scheduled_date: "2026-10-08" },
      ],
    },
  };

  const rows = buildCampaignRows([], [], [], NOW, proposal);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.source, "proposal");
  assert.equal(rows[0]!.name, "Email de temporada");
  assert.equal(rows[0]!.state, "review");
});

test("the calendar review list keeps each canonical action date and umbrella initiative", () => {
  const proposal: CampaignPlanSummary = {
    output_id: "output-canonical",
    applied_indexes: [0],
    content: {
      campaigns: [],
      calendar_actions: [
        {
          index: 0,
          title: "Preparar flow: Bienvenida",
          channel: "Email",
          objective: "Preparar la bienvenida",
          scheduled_date: "2026-10-03",
          initiative: "Preparar Navidad",
          breadcrumb: ["Preparar Navidad", "Flows", "Bienvenida"],
          action_type: "klaviyo_flow_preparation",
        },
        {
          index: 1,
          title: "Vídeo vertical de temporada",
          channel: "Meta",
          objective: "Presentar equipo",
          scheduled_date: "2026-10-08",
          initiative: "Preparar Navidad",
          breadcrumb: ["Preparar Navidad", "Campaña Meta", "Conjunto de montaña"],
          action_type: "meta_ad_creative",
        },
      ],
    },
  };

  const rows = buildCampaignRows([], [], [], NOW, proposal);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.proposalIndex, 1);
  assert.equal(rows[0]?.initiative, "Preparar Navidad");
  assert.equal(rows[0]?.name, "Vídeo vertical de temporada");
  assert.equal(rows[0]?.date, "2026-10-08");
});

test("Meta campaigns are listed with their real active state and Meta channel", () => {
  const rows = buildCampaignRows([], [], [], NOW, null, [metaCampaign({})]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.source, "meta");
  assert.equal(rows[0]!.state, "active");
  assert.equal(rows[0]!.channel, "meta_ads");
  assert.equal(rows[0]!.metaCampaign?.spend, 100);
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
