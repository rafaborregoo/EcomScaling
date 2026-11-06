import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
const env = loadApiEnv(process.env); assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const org = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
const values = await db.from("klaviyo_report_values").select("*").eq("organization_id", org).contains("raw_data", { source: "synthetic", scenario_id: "enora_12m_v1" }); assert.ifError(values.error);
const runs = await db.from("klaviyo_report_runs").select("*").eq("organization_id", org).like("idempotency_key", "synthetic:enora_12m_v1:%"); assert.ifError(runs.error);
const isExclusiveMonth = (row: any) => { const date = new Date(`${row.period_start}T00:00:00Z`); return row.period_start.endsWith("-01") && row.period_end === new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0,10); };
const affectedValues = values.data!.filter(isExclusiveMonth), affectedRuns = runs.data!.filter(isExclusiveMonth);
assert.ok(affectedValues.every((row) => affectedRuns.some((run) => run.id === row.report_run_id)));
const dir = ".e-nora-test-lab/a12-real-2026-11-02"; await mkdir(dir, { recursive: true });
if (affectedValues.length) await writeFile(`${dir}/exclusive-month-fixture-backup.json`, JSON.stringify({ values: affectedValues, runs: affectedRuns }, null, 2));
for (const [table, rows] of [["klaviyo_report_values", affectedValues], ["klaviyo_report_runs", affectedRuns]] as const) for (const row of rows) {
  const end = new Date(Date.parse(`${row.period_end}T00:00:00Z`) - 86400000).toISOString().slice(0,10);
  const update = await db.from(table).update({ period_end: end }).eq("organization_id", org).eq("id", row.id).eq("period_end", row.period_end).select("id").single(); assert.ifError(update.error);
}
const checks = [];
for (const [start, end] of [["2026-09-01", "2026-09-30"], ["2026-10-01", "2026-10-31"]]) {
  const result = await db.rpc("klaviyo_email_report", { target_organization_id: org, period_start: start, period_end: end, target_store_id: "5e84efa9-6e7f-4759-8b87-22119401bd81" }); assert.ifError(result.error); assert.ok(result.data.length > 0);
  checks.push({ start, end, rows: result.data.length });
}
console.log(JSON.stringify({ corrected_values: affectedValues.length, corrected_runs: affectedRuns.length, checks, environment: "TEST", synthetic: true }));
