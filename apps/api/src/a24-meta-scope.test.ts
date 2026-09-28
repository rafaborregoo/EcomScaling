import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("A24 review issues are scoped to the selected store and carry account/ad freshness", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20261115540000_a24_scoped_review_issues.sql", import.meta.url), "utf8");
  assert.match(sql, /function public\.meta_scoped_review_issues/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /a\.store_id = target_store_id/);
  assert.match(sql, /join public\.meta_ad_accounts/);
  assert.match(sql, /ad_effective_status/);
  assert.match(sql, /account_last_synced_at/);
  assert.match(sql, /review_category/);
  assert.match(sql, /limit 30/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
});

test("A24 prompt treats missing data as unknown and rejects stale/unclassified issues", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20261115540000_a24_scoped_review_issues.sql", import.meta.url), "utf8");
  assert.match(sql, /a24_medicion_meta_system'[\s\S]*?'v3'/);
  assert.match(sql, /ausencia de eventos Purchase/);
  assert.match(sql, /cobertura insuficiente\/desconocido/);
  assert.match(sql, /fresh/);
  assert.match(sql, /unclassified_issue/);
});

test("A24 links only the explicitly promoted pixel/event and keeps missing coverage unknown", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20261115550000_a24_optimization_event_mapping.sql", import.meta.url), "utf8");
  const runtime = await readFile(new URL("./ai-runtime.ts", import.meta.url), "utf8");
  const tools = await readFile(new URL("../../../packages/ai/src/tool-layer.ts", import.meta.url), "utf8");
  assert.match(sql, /function public\.meta_optimization_event_health/);
  assert.match(sql, /promoted_object ->> 'pixel_id'/);
  assert.match(sql, /promoted_object ->> 'custom_event_type'/);
  assert.match(sql, /custom_conversion_event_unresolved/);
  assert.match(sql, /mapped_event_not_observed_in_synced_window/);
  assert.match(sql, /no_activity_observed_in_fresh_sources/);
  assert.match(sql, /unknown_or_incomplete/);
  assert.match(sql, /reports_scope_missing/);
  assert.match(sql, /sync_scope = 'sessions'/);
  assert.match(sql, /sync_scope = 'orders'/);
  assert.match(sql, /interval '48 hours'/);
  assert.match(sql, /a\.store_id = target_store_id/);
  assert.match(sql, /limit 100/);
  assert.match(sql, /period_end - period_start > 90/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
  assert.match(sql, /a24_medicion_meta_system', 'v4'/);
  assert.match(sql, /No infieras Purchase a partir de `optimization_goal`/);
  assert.match(sql, /a24_medicion_meta_system', 'v5'/);
  assert.match(sql, /no exijas equivalencia 1:1/);
  assert.match(runtime, /rpc\("meta_optimization_event_health", window\)/);
  assert.match(runtime, /optimization_event_mapping_available/);
  assert.match(runtime, /Diferencias Meta-Shopify no prueban causalidad/);
  assert.match(runtime, /alineacion_objetivo_evento: client\.rpc\([\s\S]*?meta_optimization_event_health/);
  assert.match(tools, /objetivo\/evento promocionado realmente configurado/);
});

test("A24 separates Meta learning status from generic activity and scoped spend coverage", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20261115560000_a24_learning_activity_semantics.sql", import.meta.url), "utf8");
  const runtime = await readFile(new URL("./ai-runtime.ts", import.meta.url), "utf8");
  const web = await readFile(new URL("../../web/src/app/meta/insights-sections.tsx", import.meta.url), "utf8");
  assert.match(sql, /drop function if exists public\.meta_learning_phase_status/);
  assert.match(sql, /last_account_activity_type/);
  assert.match(sql, /not_confirmed_by_activity_log/);
  assert.match(sql, /local_50_conversion_reference/);
  assert.match(sql, /sa\.store_id = target_store_id/);
  assert.match(sql, /spend_source_days/);
  assert.match(sql, /a24_medicion_meta_system', 'v6'/);
  assert.match(sql, /a24_medicion_meta_system', 'v7'/);
  assert.match(sql, /activity_sync_state/);
  assert.match(sql, /sync_scope = 'activities:'/);
  assert.match(sql, /sync_in_progress/);
  assert.match(sql, /ni prueba de que reinici[oó] aprendizaje/);
  assert.match(runtime, /ese evento no confirma reinicio/i);
  assert.match(web, /Última actividad registrada/);
  assert.match(web, /Aprendizaje limitado/);
  assert.match(web, /no confirma que se reiniciara el aprendizaje/);
  assert.match(web, /cobertura del log desconocida/);
});

test("A24 and A25 GET, manual run, cache, and cron carry the selected connection/store", async () => {
  const runtime = await readFile(new URL("./ai-runtime.ts", import.meta.url), "utf8");
  const routes = await readFile(new URL("./server.ts", import.meta.url), "utf8");
  assert.match(runtime, /runMedicionMetaAgent\([\s\S]*?connectionId\?: string \| null/);
  assert.match(runtime, /getMedicionMetaDiagnostic\([\s\S]*?connectionId\?: string \| null/);
  assert.match(runtime, /runCambiosMetaAgent\([\s\S]*?connectionId\?: string \| null/);
  assert.match(runtime, /getCambiosMetaDiagnostic\([\s\S]*?connectionId\?: string \| null/);
  assert.match(runtime, /supabase\.rpc\("meta_scoped_review_issues", window\)/);
  assert.match(runtime, /supabase\.rpc\("meta_optimization_event_health", window\)/);
  assert.match(runtime, /meta_audience_overview", window/);
  assert.match(runtime, /"a24_medicion_meta",\s*scope\.storeId/);
  assert.match(runtime, /"a25_cambios_meta",\s*scope\.storeId/);
  assert.match(runtime, /agentCode !== "a23_creatividad_meta"[\s\S]*?agentCode !== "a25_cambios_meta"/);
  assert.match(routes, /agent\.slug === "medicion-meta"[\s\S]*?request\.query\.connectionId/);
  assert.match(routes, /agent\.slug === "cambios-meta"[\s\S]*?request\.query\.connectionId/);
});

test("A24 persists one versioned store-window gate and A14/A23/A25 fail closed when it is absent", async () => {
  const runtime = await readFile(new URL("./ai-runtime.ts", import.meta.url), "utf8");
  const verdict = await readFile(new URL("./meta-measurement-verdict.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../../../supabase/migrations/20261115570000_a24_meta_measurement_verdict_cache.sql", import.meta.url), "utf8");
  assert.match(runtime, /buildMetaMeasurementVerdict\(/);
  assert.match(runtime, /saveMetaMeasurementVerdict\(/);
  assert.match(runtime, /loadMetaMeasurementVerdict\(supabase, organizationId, storeId, periodStart, now\)/);
  assert.match(runtime, /from\("meta_measurement_verdict_cache"\)/);
  const gateIndex = runtime.indexOf('"a24_medicion_meta",\n  // A13/A14');
  assert.ok(gateIndex > 0, "A24 should be prioritized before A14 and the other Meta specialists");
  assert.ok(gateIndex < runtime.indexOf('"a14_operativa_meta"', gateIndex));
  assert.match(verdict, /usable_with_attribution_limits/);
  assert.match(verdict, /fresh_verdict_unavailable/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /grant select, insert, update, delete[\s\S]*to service_role/);
});
