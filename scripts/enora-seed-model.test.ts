import assert from "node:assert/strict";
import test from "node:test";
import {
  ENORA_PRODUCTS,
  ENORA_SCENARIO_ID,
  generateEnoraScenario,
} from "./enora-seed-model.js";

test("E-NORA 12m seed is deterministic and spans 365 complete days", () => {
  const a = generateEnoraScenario();
  const b = generateEnoraScenario();
  assert.equal(a.length, 365);
  assert.deepEqual(a, b);
  assert.equal(a[0]?.date, "2025-10-04");
  assert.equal(a.at(-1)?.date, "2026-10-03");
  assert.equal(ENORA_SCENARIO_ID, "enora_12m_v1");
});

test("catalog uses the eight current E-NORA demo Shopify products", () => {
  assert.equal(ENORA_PRODUCTS.length, 8);
  assert.deepEqual(
    ENORA_PRODUCTS.map((product) => product.sku),
    [
      "EN-DEMO-SUD-001",
      "EN-DEMO-CAM-002",
      "EN-DEMO-PAN-003",
      "EN-DEMO-CHA-004",
      "EN-DEMO-GOR-005",
      "EN-DEMO-BOL-006",
      "EN-DEMO-SUD-007",
      "EN-DEMO-CAL-008",
    ],
  );
});

test("every daily funnel is internally coherent", () => {
  for (const day of generateEnoraScenario()) {
    assert.ok(day.shopify.sessions >= day.shopify.cartAdditions, day.date);
    assert.ok(day.shopify.cartAdditions >= day.shopify.reachedCheckout, day.date);
    assert.ok(day.shopify.reachedCheckout >= day.shopify.completedCheckout, day.date);
    assert.equal(day.shopify.orders, day.orders.length, day.date);
    assert.equal(
      day.klaviyo.purchases,
      day.orders.filter((order) => order.channel === "klaviyo").length,
      day.date,
    );

    for (const meta of day.meta) {
      assert.ok(meta.impressions >= meta.reach, `${day.date}:${meta.campaignKey}`);
      assert.ok(meta.clicks >= meta.linkClicks, `${day.date}:${meta.campaignKey}`);
      assert.ok(meta.linkClicks >= meta.outboundClicks, `${day.date}:${meta.campaignKey}`);
      assert.ok(
        meta.outboundClicks >= meta.landingPageViews,
        `${day.date}:${meta.campaignKey}`,
      );
      assert.ok(meta.landingPageViews >= meta.addToCarts, day.date);
      assert.ok(meta.addToCarts >= meta.checkouts, day.date);
      assert.ok(meta.checkouts >= meta.purchases, day.date);

      assert.ok(Math.abs(meta.frequency - meta.impressions / meta.reach) < 0.000002);
      assert.ok(Math.abs(meta.ctr - (meta.clicks / meta.impressions) * 100) < 0.000002);
      if (meta.cpc !== null) {
        assert.ok(Math.abs(meta.cpc - meta.spend / meta.clicks) < 0.000002);
      }
      if (meta.cpm !== null) {
        assert.ok(Math.abs(meta.cpm - (meta.spend / meta.impressions) * 1000) < 0.000002);
      }
      if (meta.cpa !== null) {
        assert.ok(Math.abs(meta.cpa - meta.spend / meta.purchases) < 0.000002);
      }
      if (meta.roas !== null) {
        assert.ok(
          Math.abs(meta.roas - meta.attributedRevenue / meta.spend) < 0.000002,
        );
      }
    }
  }
});

test("scenario contains good, bad and anomalous periods", () => {
  const kinds = new Set(generateEnoraScenario().map((day) => day.scenario));
  for (const required of [
    "black_friday",
    "creative_fatigue",
    "checkout_friction",
    "tracking_anomaly",
    "scaling",
    "stockout",
    "deliverability_issue",
    "recovery",
  ]) {
    assert.ok(kinds.has(required as never), required);
  }
});

test("all synthetic orders are cross-channel traceable", () => {
  for (const day of generateEnoraScenario()) {
    for (const order of day.orders) {
      assert.ok(order.externalOrderId.startsWith("syn_order_"));
      assert.ok(order.customerKey.startsWith("syn_customer_"));
      if (order.channel === "meta") {
        assert.equal(order.utmSource, "facebook");
        assert.equal(order.utmMedium, "paid_social");
        assert.ok(order.utmCampaign?.startsWith("enora_meta_"));
      }
      if (order.channel === "klaviyo") {
        assert.equal(order.utmSource, "klaviyo");
        assert.equal(order.utmMedium, "email");
        assert.ok(order.utmCampaign?.startsWith("enora_email_"));
      }
    }
  }
});
