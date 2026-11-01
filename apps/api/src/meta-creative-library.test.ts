import assert from "node:assert/strict";
import test from "node:test";
import { mapMetaCreativeLibraryRows } from "./meta-creative-library.js";

const creative = {
  id: "creative-1",
  ad_account_id: "account-1",
  external_creative_id: "remote-creative-1",
  name: "Black Friday vídeo",
  object_type: "VIDEO",
  primary_text: "Oferta de temporada",
  headline: "Hasta el viernes",
  description: null,
  link_url: "https://shop.example/product",
  thumbnail_url: "https://cdn.example/video.jpg",
  image_hash: null,
  external_video_id: "video-1",
  last_synced_at: "2026-10-20T10:00:00.000Z",
};

test("conecta creatividad con anuncio, conjunto, campaña, estado y presupuesto remoto", () => {
  const [row] = mapMetaCreativeLibraryRows({
    creatives: [creative],
    assets: [
      {
        id: "asset-1",
        creative_id: creative.id,
        asset_type: "video",
        position: 0,
        text_value: null,
        media_url: null,
        thumbnail_url: "https://cdn.example/video.jpg",
        link_url: null,
        asset_label: null,
        is_primary: true,
        metadata: null,
      },
    ],
    ads: [
      {
        id: "ad-1",
        ad_set_id: "set-1",
        current_creative_id: creative.id,
        external_ad_id: "remote-ad-1",
        name: "Ad vídeo 1",
        configured_status: "ACTIVE",
        effective_status: "DISAPPROVED",
        review_feedback: { message: "El texto no cumple la política" },
        last_synced_at: "2026-10-20T10:00:00.000Z",
      },
    ],
    adSets: [
      {
        id: "set-1",
        campaign_id: "campaign-1",
        name: "Prospecting ES",
        effective_status: "ACTIVE",
        daily_budget: "45.00",
        lifetime_budget: null,
        budget_remaining: "120.00",
      },
    ],
    campaigns: [
      {
        id: "campaign-1",
        name: "Black Friday 2026",
        effective_status: "ACTIVE",
        objective: "OUTCOME_SALES",
        daily_budget: null,
        lifetime_budget: "600.00",
        budget_remaining: "300.00",
      },
    ],
    accounts: [{ id: "account-1", name: "Tienda ES", currency_code: "EUR" }],
  });

  assert.equal(row?.ad_count, 1);
  assert.equal(row?.ads[0]?.effective_status, "DISAPPROVED");
  assert.equal(row?.ads[0]?.review_feedback, "El texto no cumple la política");
  assert.equal(row?.ads[0]?.ad_set?.budget?.kind, "daily");
  assert.equal(row?.ads[0]?.campaign?.budget?.kind, "lifetime");
  assert.equal(row?.assets[0]?.thumbnail_url, "https://cdn.example/video.jpg");
  assert.equal(row?.account?.currency_code, "EUR");
});

test("no inventa campaña o conjunto cuando la jerarquía sincronizada está incompleta", () => {
  const [row] = mapMetaCreativeLibraryRows({
    creatives: [creative],
    assets: [],
    ads: [
      {
        id: "ad-1",
        ad_set_id: "set-missing",
        current_creative_id: creative.id,
        external_ad_id: "remote-ad-1",
        name: "Ad sin conjunto",
        configured_status: null,
        effective_status: null,
        review_feedback: null,
        last_synced_at: null,
      },
    ],
    adSets: [],
    campaigns: [],
    accounts: [{ id: "account-1", name: null, currency_code: null }],
  });

  assert.equal(row?.ad_count, 1);
  assert.equal(row?.ads[0]?.ad_set, null);
  assert.equal(row?.ads[0]?.campaign, null);
});
