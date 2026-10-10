import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("A23 daily trend keeps the series bounded, canonical, store-scoped, and never sums reach/frequency", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20261115530000_a23_creative_daily_trend.sql", import.meta.url), "utf8");
  assert.match(sql, /function public\.meta_creative_daily_trend/);
  assert.match(sql, /security invoker/);
  assert.match(sql, /period_end - period_start > 90/);
  assert.match(sql, /a\.store_id = target_store_id/);
  assert.match(sql, /partition by r\.metric_date/);
  assert.match(sql, /r\.breakdown_hash = 'none'/);
  assert.match(sql, /'reach', d\.reach/);
  assert.match(sql, /'frequency', d\.frequency/);
  assert.doesNotMatch(sql, /sum\s*\(\s*r?\.(reach|frequency)\s*\)/i);
  assert.match(sql, /daily_observations_and_must_not_be_summed/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
});

test("A23 prompt explains temporal coverage and blocks unsupported fatigue claims", async () => {
  const sql = await readFile(new URL("../../../supabase/migrations/20261115530001_a23_creative_trend_prompt_v5.sql", import.meta.url), "utf8");
  assert.match(sql, /a23_creatividad_meta_system'[\s\S]*?'v5'/);
  assert.match(sql, /nunca las sumes/);
  assert.match(sql, /no demuestra fatiga creativa ni causalidad/);
});

test("A23 runtime passes server-owned store scope to the daily trend RPC", async () => {
  const source = await readFile(new URL("./ai-runtime.ts", import.meta.url), "utf8");
  assert.match(source, /meta_creative_daily_trend/);
  assert.match(source, /daily_trend:/);
  assert.match(source, /target_store_id: storeId/);
  assert.match(source, /REVISION VISUAL A23/);
  assert.match(source, /marketing_visual_asset_sources/);
  assert.match(source, /\.download\(imageRow\.storage_path\)/);
  assert.match(source, /sniffStaticImageMime\(bytes\)/);
  assert.match(source, /base64: bytes\.toString\("base64"\)/);
});

test("A23 inspects imported video thumbnails as stills and never fetches video bytes", async () => {
  const [runtime, bank, ui] = await Promise.all([
    readFile(new URL("./ai-runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("./instagram-image-bank.ts", import.meta.url), "utf8"),
    readFile(new URL("../../web/src/app/marketing/imagenes/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(runtime, /\.in\("asset_type", \["image", "video"\]\)/);
  assert.match(runtime, /miniatura fija de vídeo/);
  assert.match(runtime, /no permite evaluar movimiento ni montaje/);
  assert.match(runtime, /no infieras movimiento, montaje, ritmo ni el gancho del primer segundo/);
  assert.match(runtime, /const preferredType = videoByAd\.get\(adId\) \? "video" : "image"/);
  assert.match(runtime, /\.slice\(0, 8\)/);
  assert.match(bank, /resolveMetaVisualRepresentation/);
  assert.match(bank, /imported_representation: params\.assetType === "video" \? "static_thumbnail_only"/);
  assert.match(ui, /El vídeo completo no se\s*importa:\s*solo la imagen fija/);
  assert.match(ui, /miniatura de vídeo/i);
});
