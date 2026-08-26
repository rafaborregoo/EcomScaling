import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetaActionMetricPayloads,
  buildMetaInsightRowPayload,
} from "./meta-sync.js";

test("construye una fila de insights batch con conversiones seguras", () => {
  const row = buildMetaInsightRowPayload(
    "org-1",
    "account-1",
    {
      ad_id: "ad-1",
      date_start: "2026-08-26",
      spend: "12.50",
      impressions: "100",
      ctr: "1.25",
      publisher_platform: "facebook",
      platform_position: "feed",
      action_attribution_windows: ["1d_click", "7d_click"],
    },
    { adId: "internal-ad-1", adSetId: "set-1", campaignId: "campaign-1" },
    "2026-08-26T12:00:00.000Z",
  );

  assert.equal(row?.organization_id, "org-1");
  assert.equal(row?.spend, 12.5);
  assert.equal(row?.impressions, 100);
  assert.equal(row?.ctr, 1.25);
  assert.equal(row?.campaign_id, "campaign-1");
  assert.deepEqual(row?.breakdowns, {
    publisher_platform: "facebook",
    platform_position: "feed",
  });
  assert.equal(row?.attribution_hash.length, 64);
});

test("deduplica acciones por métrica y tipo antes del upsert batch", () => {
  const payloads = buildMetaActionMetricPayloads("org-1", "insight-1", {
    actions: [
      { action_type: "purchase", value: "2" },
      { action_type: "purchase", value: "3" },
    ],
    purchase_roas: [{ action_type: "purchase", value: "4.5" }],
  });

  assert.deepEqual(
    payloads.map((item) => [item.metric_name, item.action_type, item.value]),
    [
      ["actions", "purchase", 3],
      ["purchase_roas", "purchase", 4.5],
    ],
  );
});

test("conserva la ventana de atribucion cuando Meta la devuelve en una accion", () => {
  const payloads = buildMetaActionMetricPayloads("org-1", "insight-1", {
    actions: [
      { action_type: "purchase", value: "2", "1d_click": "1", "7d_click": "2" },
    ],
  });

  assert.deepEqual(
    payloads.map((item) => [item.attribution_window, item.value]),
    [["1d_click", 1], ["7d_click", 2]],
  );
});

test("descarta insights sin ad o fecha para no fabricar claves de idempotencia", () => {
  assert.equal(
    buildMetaInsightRowPayload("org-1", "account-1", { spend: "5" }, undefined),
    null,
  );
});
