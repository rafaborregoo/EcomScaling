import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20261115480000_a16_overlay_creative_brief.sql",
  import.meta.url,
);
const imageBankUrl = new URL("./instagram-image-bank.ts", import.meta.url);

test("A16 migration persists a bounded editorial brief and activates a tool-free v2", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /add column if not exists creative_brief text not null default ''/i);
  assert.match(sql, /char_length\(creative_brief\) <= 2000/i);
  assert.match(sql, /a16_texto_sobre_imagen_system[\s\S]*?'v2'/i);
  assert.match(sql, /'\[\]'::jsonb,[\s\S]*?'none',[\s\S]*?true/i);
  assert.match(sql, /Stories 9:16[\s\S]*?14% superior e inferior/i);
  assert.match(sql, /no tapes producto, sujeto, logotipo ni OCR existente/i);
});

test("A16 and A11 use the same saved brief and preserve the visual ratio context", async () => {
  const source = await readFile(imageBankUrl, "utf8");
  assert.match(source, /select\("id, format, ratio, slides, creative_brief"\)/);
  assert.match(source, /overlay\.creative_brief as string \| null/);
  assert.match(source, /Brief editorial compartido con A16/);
  assert.match(source, /ratio:\s*overlay\.ratio === "1:1"/);
});
