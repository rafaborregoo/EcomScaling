import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20261115470000_a15_meta_visual_asset_sources.sql",
  import.meta.url,
);

test("A15 migration keeps source provenance tenant-scoped and read-only to authenticated", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /alter table public\.marketing_visual_asset_sources enable row level security/i);
  assert.match(sql, /using \(private\.can_access_org\(organization_id\)\)/i);
  assert.match(sql, /grant select on public\.marketing_visual_asset_sources to authenticated/i);
  assert.match(sql, /grant all on public\.marketing_visual_asset_sources to service_role/i);
  assert.match(sql, /foreign key \(image_id, organization_id\)/i);
  assert.match(sql, /foreign key \(meta_asset_id, organization_id\)/i);
  assert.match(sql, /'marketing-source-assets',[\s\S]*?false[\s\S]*?array\['image\/png', 'image\/jpeg', 'image\/webp'\]/i);
  assert.match(sql, /storage_bucket in \('marketing-assets', 'marketing-source-assets'\)/i);
  assert.match(sql, /'v2',[\s\S]*?'\[\]'::jsonb,[\s\S]*?'none',[\s\S]*?true/i);
  assert.doesNotMatch(sql, /source_url\s+text/i);
});
