import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const runtimeUrl = new URL("./ai-runtime.ts", import.meta.url);
const migrationUrl = new URL("../../../supabase/migrations/20261115721000_a21_store_sync_coverage.sql", import.meta.url);

test("A21 uses active store scope for run, cache, tasks, phases and sync coverage", async () => {
  const source = (await readFile(runtimeUrl, "utf8")).replace(/\r\n/g, "\n");
  const runStart = source.indexOf("export async function runAdquisicionShopifyAgent");
  const cacheStart = source.indexOf("export async function getAdquisicionShopifyDiagnostic", runStart);
  const nextAgentStart = source.indexOf("export async function runPostventaShopifyAgent", cacheStart);
  const run = source.slice(runStart, cacheStart);
  const cache = source.slice(cacheStart, nextAgentStart);
  const coverageStart = source.indexOf("async function loadShopifySyncCoverageBlock");
  const coverageEnd = source.indexOf("export async function runAdquisicionShopifyAgent", coverageStart);
  const coverage = source.slice(coverageStart, coverageEnd);
  assert.match(run, /resolveStrictStoreScope/);
  assert.match(cache, /resolveStrictStoreScope/);
  assert.match(run, /loadShopifySyncCoverageBlock\(supabase, organizationId, storeId\)/);
  assert.match(run, /loadOpenTasksBlock\(supabase, organizationId, storeId, true\)/);
  assert.match(run, /loadPlanPhasesBlock\(supabase, organizationId, storeId\)/);
  assert.match(coverage, /\.eq\("is_active", true\)/);
  assert.match(coverage, /storesQuery\.eq\("id", selectedStoreId\)/);
  assert.match(coverage, /\.in\("id", connectionIds\)/);
});

test("A21 v6 migration preserves tools and documents connection versus metric-window freshness", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /A21_V5_REQUIRED_FOR_STORE_SYNC_COVERAGE/);
  assert.match(sql, /'v5',[\s\S]*?SINCRONIZACION DE SHOPIFY POR TIENDA/);
  assert.match(sql, /'v6',[\s\S]*?v\.allowed_tools/);
  assert.match(sql, /existing_version\.is_active or excluded\.is_active/);
  assert.match(sql, /days_with_funnel_data\/requested_days/);
});
