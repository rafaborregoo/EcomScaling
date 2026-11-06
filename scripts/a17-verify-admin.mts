import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
const env = loadApiEnv(process.env); assert.equal(new URL(env.SUPABASE_URL).hostname, "kopcblejsxpkxoykldyh.supabase.co");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const profile = await db.from("profiles").select("id").eq("platform_role", "platform_admin").eq("is_active", true).limit(1).single(); assert.ifError(profile.error);
const user = await db.auth.admin.getUserById(profile.data!.id); assert.ifError(user.error); assert.ok(user.data.user?.email);
const link = await db.auth.admin.generateLink({ type: "magiclink", email: user.data.user.email }); assert.ifError(link.error);
const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.verifyOtp({ type: "magiclink", token_hash: link.data.properties.hashed_token }); assert.ifError(login.error); assert.ok(login.data.session);
try {
  const headers = { authorization: `Bearer ${login.data.session.access_token}` };
  const response = await fetch(`http://localhost:${env.API_PORT}/v1/admin/ai-cost-model`, { headers }); const body: any = await response.json(); assert.equal(response.status, 200);
  const a17 = body.agents.find((row: any) => row.code === "a17_plan_semanal"); assert.ok(a17, "Costes debe exponer A17");
  assert.equal(a17.effective_model, "claude-sonnet-5-5"); assert.equal(a17.model_decision.fallbackModel, "gpt-6.1-terra");
  assert.equal(a17.default_runs_per_day, 1 / 6); assert.equal(a17.profile.input_total, 62726); assert.equal(a17.profile.output, 1233);
  assert.equal(a17.model_configurable, false); assert.equal(a17.saved.runs_per_day, null);
  const labResponse = await fetch(`http://localhost:${env.API_PORT}/v1/admin/ai-model-lab/a17_plan_semanal`, { headers }); const lab: any = await labResponse.json(); assert.equal(labResponse.status, 200);
  const text = JSON.stringify(lab); assert.ok(text.includes("a17_plan_semanal:real-store-runtime-2026-11-06-weekly-v2"));
  assert.ok(text.includes("Sonnet 5.5; fallback: Terra"));
  const local = JSON.parse(await readFile(".e-nora-test-lab/a17-real-2026-11-06/review.json", "utf8"));
  const receipt = { at: new Date().toISOString(), admin_cost_status: response.status, lab_status: labResponse.status, model: a17.effective_model, fallback: a17.model_decision.fallbackModel, default_runs_per_day: a17.default_runs_per_day, monthly_runs_per_store: a17.default_runs_per_day * 30, profile: a17.profile, native_contracts: local.summaries.filter((row: any) => row.native_contract).length, results: local.summaries.length };
  await writeFile(".e-nora-test-lab/a17-real-2026-11-06/admin-visibility.json", JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
} finally { await client.auth.signOut({ scope: "local" }); }
