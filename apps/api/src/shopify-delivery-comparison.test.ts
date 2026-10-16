import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDeliveryComparisonWindows } from "./shopify-delivery-comparison.js";

test("A22 uses equal adjacent windows with an explicit as-of", () => {
  const windows = buildDeliveryComparisonWindows(
    new Date("2026-09-29T12:00:00.000Z"),
    90,
  );
  const currentStart = Date.parse(windows.current.period_start);
  const currentEnd = Date.parse(windows.current.period_end);
  const previousStart = Date.parse(windows.previous.period_start);
  const previousEnd = Date.parse(windows.previous.period_end);

  assert.equal(windows.as_of, "2026-09-29T12:00:00.000Z");
  assert.equal(currentEnd - currentStart, 90 * 24 * 60 * 60 * 1000);
  assert.equal(previousEnd - previousStart, 90 * 24 * 60 * 60 * 1000);
  assert.equal(currentStart - previousEnd, 1);
});

test("A22 rejects invalid comparison windows", () => {
  assert.throws(() => buildDeliveryComparisonWindows(new Date("invalid"), 90), /invalid_window_end/);
  assert.throws(() => buildDeliveryComparisonWindows(new Date(), 0), /invalid_window_days/);
  assert.throws(() => buildDeliveryComparisonWindows(new Date(), 366), /invalid_window_days/);
});

test("A22 runtime compares both windows through the same store-scoped RPC", () => {
  const runtime = readFileSync(new URL("./ai-runtime.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const toolStart = runtime.indexOf(
    'registerScopedReadTool(\n    "shopify_delivery_diagnostics",',
  );
  const toolEnd = runtime.indexOf(
    'registerScopedReadTool(\n    "shopify_open_delivery_exceptions",',
  );
  assert.notEqual(toolStart, -1, "delivery diagnostics tool registration must exist");
  assert.ok(toolEnd > toolStart, "delivery diagnostics block must end before exceptions tool");
  const tool = runtime.slice(
    toolStart,
    toolEnd,
  );
  assert.match(tool, /diagnostico_actual:\s*client\.rpc\(\s*"shopify_delivery_diagnostics"/);
  assert.match(tool, /diagnostico_periodo_anterior:\s*client\.rpc\(\s*"shopify_delivery_diagnostics"/);
  assert.match(tool, /target_organization_id: organizationId/);
  assert.match(tool, /target_store_id: storeId/);
  assert.match(tool, /\.\.\.periods\.current/);
  assert.match(tool, /\.\.\.periods\.previous/);
});

test("A22 v7 prompt requires comparable samples and human-approved evidence-led actions", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20261115798000_a22_equivalent_delivery_windows.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /'v7'/);
  assert.match(migration, /al menos 30 fulfillments en CADA ventana/);
  assert.match(migration, /hip\\u00f3tesis por comprobar/);
  assert.match(migration, /aprobaci\\u00f3n humana/);
  assert.match(migration, /shopify_delivery_diagnostics/);
  assert.match(migration, /shopify_return_delay_comparison/);
});
