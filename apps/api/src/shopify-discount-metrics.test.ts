import assert from "node:assert/strict";
import test from "node:test";
import { discountAlertKinds, discountMetricsView, discountPeriodDays } from "./shopify-catalog.js";

const now = new Date("2026-10-02T12:00:00Z");
const base = { id: "d1", status: "ACTIVE", ends_at: null, usage_count: 0, usage_limit: null };

test("avisos: acaba en 7 dias, cerca del limite y regla de app", () => {
  assert.deepEqual(discountAlertKinds({ ...base, ends_at: "2026-10-05T00:00:00Z" }, now), ["ending"]);
  assert.deepEqual(discountAlertKinds({ ...base, ends_at: "2026-10-20T00:00:00Z" }, now), []);
  assert.deepEqual(discountAlertKinds({ ...base, usage_count: 80, usage_limit: 100 }, now), ["limit"]);
  assert.deepEqual(discountAlertKinds({ ...base, configuration_coverage: "app_managed" }, now), ["app"]);
  assert.deepEqual(discountAlertKinds({ ...base, status: "EXPIRED", ends_at: "2026-10-03T00:00:00Z", usage_count: 99, usage_limit: 100 }, now), []);
});

test("metricas: ticket medio, base sin promo y descuento parcial", () => {
  const row = { discount_id: "d1", orders_count: 4, discount_amount: 40, amount_coverage: "complete", net_revenue: 400, new_customer_orders: 3, known_customer_orders: 4, last_order_at: null, baseline_orders: 10, baseline_net_revenue: 800 };
  const view = discountMetricsView(row);
  assert.equal(view.aov, 100);
  assert.equal(view.aov_baseline, 80);
  assert.equal(view.new_customer_share, 0.75);
  assert.equal(discountMetricsView({ ...row, discount_amount: null, amount_coverage: "partial" }).discount_amount, null);
  assert.equal(discountMetricsView({ ...row, baseline_orders: 2 }).aov_baseline, null);
  assert.equal(discountMetricsView(undefined).orders, 0);
});

test("periodo: solo 30, 90 o 365", () => {
  assert.equal(discountPeriodDays("30"), 30);
  assert.equal(discountPeriodDays("7"), 90);
  assert.equal(discountPeriodDays(undefined), 90);
});
