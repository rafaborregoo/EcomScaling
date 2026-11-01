import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { callSummaryOutputSchema } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";

const projectRef = "kopcblejsxpkxoykldyh";
assert.ok(process.env.SUPABASE_URL?.includes(`://${projectRef}.supabase.co`), "A01 lab writes only to TEST");
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, "service_role_required");
const dir = resolve(".e-nora-test-lab/ai-models");
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(resolve(dir, "report.json"), "utf8")));
const cases = report.cases.filter((item) => item.agent_code === "a01_analista_llamadas" && item.meeting_benchmark?.database_call_id);
assert.equal(cases.length, 3, "expected_three_private_lab_calls");
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const inserts: Record<string, unknown>[] = [];

for (const testCase of cases) {
  const callId = testCase.meeting_benchmark!.database_call_id!;
  const { data: call, error: callError } = await db.from("consulting_calls")
    .select("id,consultant_user_id,is_visible_to_client,title")
    .eq("id", callId).eq("organization_id", report.target.organization_id).single();
  if (callError) throw callError;
  assert.equal(call.is_visible_to_client, false, "lab_call_must_remain_private");
  const { data: transcript, error: transcriptError } = await db.from("call_transcripts")
    .select("id").eq("call_id", callId).eq("organization_id", report.target.organization_id).eq("is_current", true).single();
  if (transcriptError) throw transcriptError;
  const { data: existing, error: existingError } = await db.from("call_ai_summaries")
    .select("id,key_points").eq("call_id", callId).eq("organization_id", report.target.organization_id);
  if (existingError) throw existingError;
  assert.equal(existing?.length ?? 0, 0, "lab_summaries_already_saved");

  for (const result of report.results.filter((row) => row.case_id === testCase.id && row.status === "completed")) {
    const output = callSummaryOutputSchema.parse(JSON.parse(result.raw_response));
    const modelLabel = report.models.find((model) => model.id === result.model_id)?.label ?? result.model_id;
    inserts.push({
      call_id: callId,
      organization_id: report.target.organization_id,
      transcript_id: transcript.id,
      summary: output.summary,
      key_points: {
        facts: output.facts,
        recommendations: output.recommendations,
        risks: output.risks,
        key_quotes: output.key_quotes,
        proposed_tasks: output.proposed_tasks,
        proposed_campaign_ideas: output.proposed_campaign_ideas,
        proposed_camino_changes: output.proposed_camino_changes,
        consultant_gaps: output.consultant_gaps,
        conversation_signals: output.conversation_signals,
        sources: output.sources,
        confidence: output.confidence,
        warnings: output.warnings,
        ai_lab: {
          is_lab: true,
          synthetic_meeting: true,
          case_id: testCase.id,
          model_id: result.model_id,
          model_label: modelLabel,
          actual_model: result.actual_model,
          model_verified: result.model_verified,
          standard_api_cost_usd: null,
          cli_reported_cost_usd: result.provider_reported_cost,
          input_tokens: result.usage.input,
          output_tokens: result.usage.output,
          result_status: result.status,
          review_status: "pending",
        },
      },
      agreed_actions: output.decisions,
      status: "draft",
      authored_by: call.consultant_user_id,
    });
  }
}

assert.equal(inserts.length, 18, "expected_18_completed_model_outputs");
const { data, error } = await db.from("call_ai_summaries").insert(inserts).select("id,call_id");
if (error) throw error;
console.log(JSON.stringify({ saved: data?.length ?? 0, calls: cases.length, statuses: "draft/private; client visibility disabled" }));
