import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";

const projectRef = "kopcblejsxpkxoykldyh";
assert.ok(process.env.SUPABASE_URL?.includes(`://${projectRef}.supabase.co`), "A01 lab writes only to TEST");
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, "service_role_required");
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(resolve(".e-nora-test-lab/ai-models/report.json"), "utf8")));
assert.equal(report.target.project_ref, projectRef, "wrong report project");
const callIds = report.cases
  .filter((item) => item.agent_code === "a01_analista_llamadas" && item.meeting_benchmark?.database_call_id)
  .map((item) => item.meeting_benchmark!.database_call_id!);
assert.equal(callIds.length, 3, "expected A01 30/60/120 minute test calls");

const rates: Record<string, { input: number; output: number; cached: number; writeShort: number; writeLong: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cached: 0.01, writeShort: 0.125, writeLong: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cached: 0.1, writeShort: 2.5, writeLong: 4 },
  "claude-opus-5-5": { input: 4, output: 20, cached: 0.2, writeShort: 5, writeLong: 8 },
  "gpt-6-luna": { input: 0.1, output: 0.5, cached: 0.01, writeShort: 0.125, writeLong: 0.25 },
  "gpt-6.1-sol": { input: 2, output: 10, cached: 0.1, writeShort: 2.5, writeLong: 5 },
  "gpt-6.1-terra": { input: 1, output: 5, cached: 0.05, writeShort: 1.25, writeLong: 2.5 },
};

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data, error } = await db.from("consulting_calls")
  .update({ is_visible_to_client: true })
  .eq("organization_id", report.target.organization_id)
  .in("id", callIds)
  .select("id,is_visible_to_client,title,held_at,status");
if (error) throw error;
assert.equal(data?.length, 3, "not all A01 test calls were updated");
assert.ok(data.every((call) => call.is_visible_to_client), "client visibility update failed");
const { data: summaries, error: summariesError } = await db.from("call_ai_summaries")
  .select("id,call_id,key_points,status")
  .eq("organization_id", report.target.organization_id)
  .in("call_id", callIds);
if (summariesError) throw summariesError;
assert.equal(summaries?.length, 18, "expected 18 saved model comparisons");
for (const summary of summaries ?? []) {
  assert.equal(summary.status, "draft", "lab result must not become an official/published summary");
  const points = summary.key_points && typeof summary.key_points === "object" && !Array.isArray(summary.key_points)
    ? summary.key_points as Record<string, unknown>
    : {};
  const lab = points.ai_lab && typeof points.ai_lab === "object" && !Array.isArray(points.ai_lab)
    ? points.ai_lab as Record<string, unknown>
    : {};
  assert.equal(lab.is_lab, true, "comparison is not an A01 lab result");
  assert.equal(lab.synthetic_meeting, true, "comparison is not tied to a synthetic test meeting");
  const modelId = String(lab.model_id ?? "");
  const rate = rates[modelId];
  const usage = report.results.find((result) => result.case_id === lab.case_id && result.model_id === modelId)?.usage;
  let costFields: Record<string, number> = {};
  if (rate && usage && [usage.input, usage.cached, usage.cache_creation, usage.output].every((value) => value !== null)) {
    const input = usage.input!;
    const cached = usage.cached!;
    const writes = usage.cache_creation!;
    const output = usage.output!;
    const anthropic = modelId.startsWith("claude-");
    const contextTokens = anthropic ? input + cached + writes : input;
    const multiplier = modelId === "claude-haiku-5-5" && contextTokens > 100_000 ? 5 : 1;
    const fresh = anthropic ? input : input - cached - writes;
    if (fresh >= 0) {
      const base = (fresh * rate.input + cached * rate.cached) * multiplier + output * rate.output * multiplier;
      const low = (base + writes * rate.writeShort * multiplier) / 1_000_000;
      const high = (base + writes * rate.writeLong * multiplier) / 1_000_000;
      costFields = { standard_api_cost_usd: (low + high) / 2, standard_api_cost_low_usd: low, standard_api_cost_high_usd: high };
    }
  }
  const { error: updateError } = await db.from("call_ai_summaries")
    .update({ key_points: { ...points, ai_lab: { ...lab, ...costFields, client_comparison_visible: true } } })
    .eq("organization_id", report.target.organization_id)
    .eq("id", summary.id);
  if (updateError) throw updateError;
}
console.log(JSON.stringify({
  project: projectRef,
  calls: data.map(({ id, title, held_at, status }) => ({ id, title, held_at, status, visible_to_client: true })),
  comparisons_visible_to_client: summaries?.length ?? 0,
  statuses: [...new Set((summaries ?? []).map(({ status }) => status))],
}));
