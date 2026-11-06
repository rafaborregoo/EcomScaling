import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadA13CalendarGoalProgress } from "./a13-goal-period.js";
import { calculateCaminoGoalProgress } from "./camino-goal-progress.js";
test("A13 goal progress reads calendar sales separately from its 30-day operating totals", async () => {
  const calls: Array<{ name: string; args: any }> = [];
  const db = createClient("https://stub.invalid", "test", { global: { fetch: async (input, init) => {
    const url = new URL(String(input)), args = JSON.parse(String(init?.body)); calls.push({ name: url.pathname.split("/").at(-1)!, args });
    return new Response(JSON.stringify([{ net_sales: args.period_start.startsWith("2026-11") ? 1000 : 10000, orders_count: 10 }]), { headers: { "content-type": "application/json" } });
  } } });
  const now = new Date("2026-11-03T08:00:00Z"), calendar = await loadA13CalendarGoalProgress(db, "org", "store", now);
  assert.equal(calls.length, 4); assert.ok(calls.every((call) => call.args.target_store_id === "store" && call.args.target_organization_id === "org"));
  assert.deepEqual(calls.map((call) => call.args.period_start), ["2026-11-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z"]);
  assert.equal(calls[1]!.args.period_end, "2026-10-31T23:59:59.999Z");
  const progress = calculateCaminoGoalProgress({ goal: { metric_key: "net_sales", metric_label: "Ventas", unit: "money", target: 75000, baseline: 39091, baseline_window_days: 30, target_date: "2026-11-30" }, planStartedAt: "2026-10-15", now,
    coverage: { availability: "available", connections: [{ provider: "shopify", status: "connected", last_sync_at: now.toISOString() }] },
    sales: { current: { row: { net_sales: 49723.8, orders_count: 952 }, error: null }, previous: { row: null, error: null } }, financial: { current: { row: null, error: null }, previous: { row: null, error: null } },
    calendarMonth: calendar, stock: { row: null, error: null }, meta: { current: { row: null, error: null }, previous: { row: null, error: null } } });
  assert.equal(progress.measurement_period, "calendar_month_to_date"); assert.equal(progress.observed_value, 1000); assert.notEqual(progress.status, "achieved");
});
