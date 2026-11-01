import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("A24 final SQL after every migration retains its fields, scoped pagination and service-only ACL", async () => {
  const directory = new URL("../../../supabase/migrations/", import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  const source = (await Promise.all(files.map((file) => readFile(new URL(file, directory), "utf8")))).join("\n");
  const finalDefinition = (name: string) => {
    const matches = [...source.matchAll(new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${name}\\s*\\(`, "gi"))];
    const start = matches.at(-1)?.index;
    assert.notEqual(start, undefined, `${name} must exist`);
    const suffix = source.slice(start);
    const delimiter = /as\s+(\$[a-z_]*\$)/i.exec(suffix);
    assert.ok(delimiter, `${name} must have a SQL body`);
    const token = delimiter[1];
    assert.ok(token);
    const bodyEnd = suffix.indexOf(token + ";", delimiter.index + delimiter[0].length);
    return suffix.slice(0, bodyEnd + token.length + 1);
  };
  const learning = finalDefinition("meta_learning_phase_status");
  for (const field of ["activity_sync_state", "account_last_synced_at", "spend_source_days", "learning_threshold_source", "target_campaign_id"]) assert.ok(learning.includes(field), field);
  for (const name of ["meta_measurement_event_page", "meta_measurement_issue_page"]) {
    const sql = finalDefinition(name);
    assert.match(sql, /security invoker/i);
    assert.match(sql, /target_store_id is null/);
    assert.match(sql, /page_size/);
    assert.match(source, new RegExp(`revoke all on function public\\.${name}[^;]*from public,\\s*anon,\\s*authenticated`, "i"));
  }
  assert.match(finalDefinition("meta_measurement_event_page"), /private\.a23_meta_insight_rows_canonical/);
  assert.match(finalDefinition("meta_save_measurement_verdict"), /last_synced_at>evaluated/);
  assert.match(finalDefinition("meta_record_measurement_assessment"), /assessment_not_current/);
  const task = finalDefinition("materialize_a24_measurement_task");
  assert.match(task, /::public\.task_priority/);
  assert.match(task, /m\.status in \('in_progress','pending'\)/);
});
