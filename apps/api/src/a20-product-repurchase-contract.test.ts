import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../../supabase/migrations/20261115700000_a20_product_repeat_health.sql", import.meta.url);
const promptMigrationUrl = new URL("../../../supabase/migrations/20261115150000_ai_a20_customer_health_tool_and_prompt.sql", import.meta.url);
const runtimeUrl = new URL("./ai-runtime.ts", import.meta.url);

test("la RPC de A20 esta limitada a tienda, solo lectura y devuelve cohortes maduras sin hashes", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const functionSql = sql.slice(sql.indexOf("create or replace function public.shopify_product_repurchase_summary"), sql.indexOf("revoke execute on function public.shopify_product_repurchase_summary"));
  assert.match(functionSql, /security invoker/i);
  assert.match(functionSql, /set search_path = ''/i);
  assert.match(functionSql, /o\.organization_id = target_organization_id[\s\S]*?o\.store_id = target_store_id/i);
  assert.match(functionSql, /customer_reference_hash is not null/);
  assert.match(functionSql, /first_purchase_at <= as_of - interval '90 days'/i);
  assert.match(functionSql, /having count\(\*\) >= 30/i);
  assert.match(functionSql, /repeat_customers_90d >= 10/i);
  assert.match(functionSql, /observed_history_start/);
  assert.doesNotMatch(functionSql, /insert into public\.|update public\.|delete from public\./i);
  const outputProjection = functionSql.slice(functionSql.indexOf("select jsonb_build_object"));
  assert.doesNotMatch(outputProjection, /customer_reference_hash|customer_key/i);
  assert.match(sql, /shopify_product_repurchase_health/);
  assert.match(sql, /'v3',[\s\S]*?ANALISIS DE RECOMPRA POR PRODUCTO/);
});

test("el executor A20 exige tienda y sincronizacion Shopify fresca antes de ejecutar el analisis historico", async () => {
  const source = (await readFile(runtimeUrl, "utf8")).replace(/\r\n/g, "\n");
  const registration = source.slice(
    source.indexOf('registerScopedReadTool(\n    "shopify_product_repurchase_health"'),
    source.indexOf('registerScopedReadTool(\n    "shopify_demand_sources"'),
  );
  assert.match(registration, /if \(!storeId\).*store_required/s);
  assert.match(registration, /last_sync_at/);
  assert.match(registration, /48 \* 60 \* 60 \* 1000/);
  assert.match(registration, /recordProtectedDataAccess/);
  assert.match(registration, /shopify_product_repurchase_summary/);
});

test("A20 fija tienda activa y limita tareas/fases; el prompt delega diseño Klaviyo", async () => {
  const source = (await readFile(runtimeUrl, "utf8")).replace(/\r\n/g, "\n");
  const runStart = source.indexOf("export async function runRetencionClientesAgent");
  const cacheStart = source.indexOf("export async function getRetencionClientesDiagnostic", runStart);
  const run = source.slice(runStart, cacheStart);
  const cache = source.slice(cacheStart, source.indexOf("export function agentRpcEvidence", cacheStart));
  const promptMigration = await readFile(promptMigrationUrl, "utf8");
  assert.match(run, /resolveStrictStoreScope/);
  assert.match(cache, /resolveStrictStoreScope/);
  assert.match(run, /loadOpenTasksBlock\(supabase, organizationId, storeId, true\)/);
  assert.match(run, /loadPlanPhasesBlock\(supabase, organizationId, storeId\)/);
  assert.match(promptMigration, /A20 define el objetivo\/segmento; A12\/A28 diseñan/);
});
