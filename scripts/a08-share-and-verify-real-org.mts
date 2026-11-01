import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { buildReadOnlyOutputContract } from "../packages/ai/src/index.js";
import { A08_MODEL_DECISION } from "../packages/contracts/src/ai-model-decisions.js";
import { getKnowledgeManagerDiagnostic, runKnowledgeManagerAgent } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
import { parseOutput } from "./ai-model-lab-core.js";
const env = loadApiEnv(process.env); assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const dir = ".e-nora-test-lab/ai-models", report = JSON.parse(await readFile(`${dir}/report.json`, "utf8"));
const caseId = "a08_gestor_conocimiento:real-org-methodology-runtime-2026-10-31", marker = "cli-lab:a08-real-org-2026-10-31";
const scenario = report.cases.find((row: any) => row.id === caseId); assert.ok(scenario);
const result = report.results.find((row: any) => row.case_id === caseId && row.model_id === A08_MODEL_DECISION.model && row.status === "completed"); assert.ok(result);
const output = buildReadOnlyOutputContract().schema.parse(parseOutput(result.raw_response));
const actualInput = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04", actorId = "0aa0090b-2a10-4f1e-881f-bdeb4f52b183";
const checked = async (query: any) => { const value = await query; assert.ifError(value.error); return value.data; };
const org = await checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", orgId).single()); assert.equal(org.display_name, "Prueba Borrego");
const consultant = await db.auth.admin.getUserById(actorId); assert.equal(consultant.data.user?.email, "rafael@noraapp.es");
await checked(db.from("consultant_assignments").select("consultant_user_id").eq("organization_id", orgId).eq("consultant_user_id", actorId).single());
const previous = await checked(db.from("agent_runs").select("id,agent_outputs!inner(id)").eq("organization_id", orgId).eq("deployment_version", marker).maybeSingle());
let runId = previous?.id;
if (!runId) {
  const version = await checked(db.from("agent_versions").select("id,agent_definitions!inner(code)").eq("agent_definitions.code", "a08_gestor_conocimiento").eq("is_active", true).single());
  runId = randomUUID(); const now = new Date().toISOString();
  await checked(db.from("agent_runs").insert({ id: runId, organization_id: orgId, store_id: null, agent_version_id: version.id,
    actor_user_id: actorId, trigger_type: "manual", status: "succeeded", execution_mode: "shadow", lookback_days: 30,
    objective: "SIMULACIÓN CLI A08 con catálogo autorizado real del 31/10/2026. Terra elegido entre seis modelos. Auditoría interna de solo lectura; sin API LLM, tareas ni cambios documentales. ID servido por Codex no verificado.",
    time_range: actualInput.input.time_range, provider: A08_MODEL_DECISION.provider, model: result.actual_model ?? result.model_id,
    input_tokens: result.usage.input, output_tokens: result.usage.output, cache_read_tokens: result.usage.cached, cache_creation_tokens: result.usage.cache_creation,
    estimated_cost_usd: null, cost_basis: null, latency_ms: result.duration_ms, started_at: now, finished_at: now,
    prompt_code: "a08_gestor_conocimiento_system", prompt_version: scenario.prompt_version, deployment_version: marker, stop_reason: "cli_simulation" }));
  await checked(db.from("agent_context_snapshots").insert({ run_id: runId, organization_id: orgId, context_level: "C2", snapshot: { blocks: actualInput.input.context.snapshot,
    period: actualInput.input.time_range, source_run_id: scenario.source_run_id, execution_source: "cli_simulation", dynamic_tool_selection_verified: false, served_model_verified: result.model_verified } }));
  await checked(db.from("agent_outputs").insert({ run_id: runId, organization_id: orgId, schema_version: "v1", output, approval_required: false, status: "published" }));
  const digest = await db.rpc("organization_knowledge_digest", { target_organization_id: orgId });
  assert.ifError(digest.error);
  if (typeof digest.data === "string") await checked(db.from("agent_runs").update({ activity_digest: digest.data }).eq("id", runId));
}
for (const [id, email, kind] of [["ead62983-1938-4da6-af8f-13cb64d8cd3e", "borregorafa99@gmail.com", "client"], [actorId, "rafael@noraapp.es", "consultant"]] as const) {
  const user = await db.auth.admin.getUserById(id); assert.equal(user.data.user?.email, email);
  const profile = await checked(db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("id", id).single());
  const member = kind === "client" ? await checked(db.from("organization_members").select("role").eq("organization_id", orgId).eq("user_id", id).single())
    : await checked(db.from("consultant_assignments").select("consultant_user_id").eq("organization_id", orgId).eq("consultant_user_id", id).single());
  assert.ok(member);
  const context: AuthContext = { user: { id }, profile, subscriptions: [], memberships: [{ organization_id: orgId, organization: org,
    role: kind === "client" ? member.role : "consultant", accessSource: kind === "client" ? "membership" : "consultant_assignment" }] };
  const read = await getKnowledgeManagerDiagnostic(env, context, orgId);
  if (kind === "client") {
    assert.equal(read.ok, false); if (!read.ok) assert.equal(read.statusCode, 403);
    const run = await runKnowledgeManagerAgent(env, context, orgId); assert.equal(run.ok, false); if (!run.ok) assert.equal(run.statusCode, 403);
    console.log(JSON.stringify({ viewer: kind, read: 403, run: 403 }));
  } else {
    assert.ok(read.ok, JSON.stringify(read)); assert.equal(read.data.run_id, runId); assert.deepEqual(read.data.output, output);
    console.log(JSON.stringify({ viewer: kind, run_id: runId, output_id: read.data.output_id, findings: output.findings.length, recommendations: output.recommendations.length, tasks: output.proposed_writes.length, approval_required: output.approval_required }));
  }
}
