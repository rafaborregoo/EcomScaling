import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

test("A26 final migration state retains precise scope, semantic revisions, ACLs and atomic delivery", async () => {
  const root = new URL("../../../supabase/migrations/", import.meta.url);
  const files = (await readdir(root)).filter((file) => file.endsWith(".sql")).sort();
  const source = (await Promise.all(files.map((file) => readFile(new URL(file, root), "utf8")))).join("\n");
  const final = (name: string) => {
    const matches = [...source.matchAll(new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\s*\\(`,"gi"))];
    const start = matches.at(-1)?.index; assert.notEqual(start, undefined);
    const tail = source.slice(start); const token = /as\s+(\$[a-z_]*\$)/i.exec(tail); assert.ok(token);
    return tail.slice(0, tail.indexOf(token[1]! + ";", token.index + token[0].length));
  };
  const inventory = final("a26_email_inventory_page");
  for (const fragment of ["p_store_id is null", "c.status in ('connected','syncing')", "k.store_id=p_store_id", "message_status", "sequence_order_verified", "next_cursor", "total_count", "-'last_synced_at'"]) assert.ok(inventory.includes(fragment), fragment);
  assert.match(final("materialize_a26_content_task"), /content_changed_since_analysis/);
  assert.match(final("materialize_a26_content_task"), /pg_advisory_xact_lock/);
  assert.match(final("materialize_a26_content_task"), /camino_changed_since_analysis/);
  assert.match(final("materialize_a26_content_task"), /a26_email_inventory_item/);
  assert.match(final("reserve_a26_manual_refresh"), /a26_contenido_email/);
  assert.doesNotMatch(final("reserve_a26_manual_refresh"), /a26_medicion_meta/);
  assert.match(final("a26_link_revision_draft"), /A26_DRAFT_PROVENANCE_MISMATCH/);
  assert.match(final("a26_record_review_outcome"), /draft_revision_required/);
  for (const name of ["a26_email_inventory_page", "materialize_a26_content_task", "a26_record_review_outcome"]) assert.match(source, new RegExp(`revoke all on function public\\.${name}[^;]*from public,anon,authenticated`,"i"));
});

test("A26 request, cron, contract and tools retain their final wiring", async () => {
  const runtime = await readFile(new URL("./ai-runtime.ts", import.meta.url), "utf8");
  const server = await readFile(new URL("./server.ts", import.meta.url), "utf8");
  const runner = runtime.slice(runtime.indexOf("export async function runContenidoEmailAgent"), runtime.indexOf("export async function getContenidoEmailDiagnostic"));
  assert.match(runner,/target_period_start: variationPeriodStart/); assert.match(runner,/target_period_end: variationPeriodEnd/);
  assert.match(runner,/resolveMetaDiagnosticStoreScope/); assert.match(runner,/requireOperationalStore/);
  assert.match(runner,/loadA26Inventory/); assert.match(runtime,/buildA26ContentOutputContract\(messages\)/);
  const cron = runtime.slice(runtime.indexOf('} else if (item.agentCode === "a26_contenido_email")'),runtime.indexOf('} else if (item.agentCode === "a25_cambios_meta")'));
  assert.match(cron,/activityDigest: item.digest/); assert.match(cron,/item.connectionId/);
  const post = server.slice(server.indexOf('? await runContenidoEmailAgent('));
  assert.match(post.slice(0,520),/manualRequestKey: idempotencyKey/);
  assert.match(runtime,/content_changed_since_review/);
});
