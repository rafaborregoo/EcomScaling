/** Makes the already generated A05 Sol CLI simulation visible in the TEST
 * customer and consultant marketing views. It is not an API model call and
 * does not create, schedule, or send campaigns.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { currentCampaignPlanOutputSchema } from "../packages/ai/src/index.js";
import { parseOutput } from "./ai-model-lab-core.js";

const report = JSON.parse(await readFile(resolve(".e-nora-test-lab/ai-models/report.json"), "utf8"));
const caseId = process.argv.find((arg) => arg.startsWith("--case="))?.slice("--case=".length) ?? "a05_estrategia_campanas:real-store-two-months-v2-2026-11";
const model = "gpt-6.1-sol";
const organizationId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
const storeId = "5e84efa9-6e7f-4759-8b87-22119401bd81";
const consultantId = "0aa0090b-2a10-4f1e-881f-bdeb4f52b183";
const marker = process.argv.find((arg) => arg.startsWith("--marker="))?.slice("--marker=".length) ?? "cli-lab:a05-two-months-v2";
assert.ok(marker.startsWith("cli-lab:a05-"));
const runtimeCase = caseId.startsWith("a05_estrategia_campanas:clean-runtime");
assert.equal(report.target.project_ref, "kopcblejsxpkxoykldyh", "TEST project only");
assert.equal(report.target.organization_id, organizationId, "expected test organization");
assert.equal(report.target.owner, "borregorafa99@gmail.com");
assert.equal(report.target.consultant, "rafael@noraapp.es");

const result = report.results.find((item: any) => item.case_id === caseId && item.model_id === model && item.status === "completed");
assert.ok(result, "completed Sol result must exist in the two-month A05 case");
const parsed = currentCampaignPlanOutputSchema.safeParse(parseOutput(result.raw_response));
assert.ok(parsed.success, "Sol output must satisfy the A05 native schema");
const plan = parsed.data;
assert.equal(plan.planning_window?.start_date, "2026-11-01");
assert.equal(plan.planning_window?.end_date, "2026-12-31");
if (!runtimeCase) {
  assert.equal(plan.campaigns.length, 0);
  assert.equal(plan.initiatives?.length ?? 0, 0);
}

const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST Supabase URL only");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const checked = async (query: any) => {
  const response = await query;
  if (response.error) throw new Error(response.error.message);
  return response.data;
};

const organization = await checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", organizationId).single());
assert.equal(organization.display_name, "Prueba Borrego");
const assignment = await checked(db.from("consultant_assignments").select("consultant_user_id").eq("organization_id", organizationId).eq("consultant_user_id", consultantId).single());
const consultant = await db.auth.admin.getUserById(assignment.consultant_user_id);
assert.equal(consultant.data.user?.email, "rafael@noraapp.es");
const store = await checked(db.from("shopify_stores").select("id").eq("id", storeId).eq("organization_id", organizationId).eq("is_active", true).single());
assert.equal(store.id, storeId);

const prior = await checked(db.from("agent_runs").select("id").eq("organization_id", organizationId).eq("deployment_version", marker).limit(1));
if (prior.length) {
  console.log(JSON.stringify({ status: "already_visible", run_id: prior[0].id, model }));
  process.exit(0);
}

const activeVersion = await checked(db.from("agent_versions").select("id,version").eq("definition_id", (await checked(db.from("agent_definitions").select("id").eq("code", "a05_estrategia_campanas").single())).id).eq("is_active", true).single());
const runId = randomUUID();
const now = new Date().toISOString();
const runtimeTokens = result.usage;
const objective = "Laboratorio IA TEST: plan A05 de dos meses para E-NORA Demo (01/11/2026–31/12/2026), generado por GPT-6.1 Sol mediante CLI. Importación para consulta compartida de cliente y consultor; no es llamada API.";

await checked(db.from("agent_runs").insert({
  id: runId,
  organization_id: organizationId,
  agent_version_id: activeVersion.id,
  actor_user_id: consultantId,
  trigger_type: "manual",
  objective,
  time_range: { start: "2026-11-01", end: "2026-12-31" },
  store_id: storeId,
  status: "succeeded",
  // OpenAI input already includes cached tokens; cache is tracked separately.
  input_tokens: Number(runtimeTokens.input ?? 0),
  output_tokens: Number(runtimeTokens.output ?? 0),
  cache_read_tokens: Number(runtimeTokens.cached ?? 0),
  cache_creation_tokens: Number(runtimeTokens.cache_creation ?? 0),
  estimated_cost_usd: null,
  latency_ms: result.duration_ms,
  started_at: now,
  finished_at: now,
  lookback_days: runtimeCase ? 365 : 90,
  execution_mode: "shadow",
  activity_digest: runtimeCase
    ? "SIMULACIÓN CLI tras limpieza NORA. Sol solicitado; contexto preparado por runtime y herramientas de lectura ejecutadas por el arnés. No valida selección de tools por el modelo. Sin API LLM ni envíos externos."
    : "SIMULACIÓN CLI DE LABORATORIO. GPT-6.1 Sol; JSON nativo A05 validado; sin llamada API, sin herramientas y sin escrituras en canales externos. Resultado compartido para lectura por cliente y consultor.",
  provider: "openai",
  model,
  cost_basis: null,
  stop_reason: "cli_simulation",
  prompt_code: "a05_estrategia_campanas_system",
  prompt_version: runtimeCase ? "v5+email-pipeline-cli" : "v5+cli-lab-v2",
  deployment_version: marker,
}));

if (runtimeCase) {
  const labCase = report.cases.find((item: any) => item.id === caseId);
  assert.ok(labCase);
  const actualInput = JSON.parse(await readFile(resolve(".e-nora-test-lab/ai-models", `${labCase.agent_code}.${labCase.context_hash}.${labCase.prompt_hash}.input.json`), "utf8"));
  await checked(db.from("agent_context_snapshots").insert({ run_id: runId, organization_id: organizationId, context_level: "C2", snapshot: {
    blocks: actualInput.input.context.snapshot, period: actualInput.input.time_range,
    source_run_id: labCase.source_run_id, execution_source: "cli_simulation", tool_selection: "harness_preselected",
  } }));
}

const outputRow = await checked(db.from("agent_outputs").insert({
  run_id: runId,
  organization_id: organizationId,
  schema_version: "v1",
  output: plan,
  approval_required: true,
  status: "pending_approval",
}).select("id,status,created_at").single());

console.log(JSON.stringify({ status: "shared_for_review", run_id: runId, output_id: outputRow.id, output_status: outputRow.status, model, window: plan.planning_window, campaigns: plan.campaigns.length, initiatives: plan.initiatives?.length ?? 0, execution_source: "CLI simulation; no API call" }));
