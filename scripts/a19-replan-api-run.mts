// Ejecuta A19 de verdad contra la API del proveedor con el modelo configurado, sin pasar por el
// servidor local: replanifica el Camino demo y deja la propuesta pendiente. Solo TEST. Gasta crédito.
//   npx dotenv -e .env.local -- npx tsx scripts/a19-replan-api-run.mts
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { runCaminoArchitectAgent } from "../apps/api/src/ai-runtime.js";
import { prepareReplanRun } from "../apps/api/src/camino-replan-service.js";

const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const SNAPSHOT_RUN = "7316abd6-2736-4a27-9384-7de268f62fb7";
const SCOPES = ["dates", "margin", "tasks", "goals", "strategy"];

const { data: run } = await db.from("agent_runs").select("organization_id, store_id, actor_user_id").eq("id", SNAPSHOT_RUN).single();
const org = run!.organization_id as string;
const { data: plan } = await db.from("strategic_plans").select("id").eq("organization_id", org).eq("status", "active").eq("store_id", run!.store_id).single();
const { data: store } = await db.from("shopify_stores").select("connection_id").eq("id", run!.store_id).single();
const { data: profile } = await db.from("profiles").select("*").eq("id", run!.actor_user_id).single();
const { data: organization } = await db.from("organizations").select("*").eq("id", org).single();
const context = {
  user: { id: run!.actor_user_id as string },
  profile,
  memberships: [{ organization_id: org, user_id: run!.actor_user_id, role: "owner", organization }],
  subscriptions: [],
} as never;

const prepared = await prepareReplanRun(env as never, context, org, plan!.id, SCOPES);
if (prepared.ok === false) throw new Error(JSON.stringify(prepared));
const started = new Date().toISOString();
console.log(JSON.stringify({ started }));
const outcome = await runCaminoArchitectAgent(env as never, context, org, 6, store!.connection_id as string, undefined, null, prepared.data);
const { data: runs } = await db
  .from("agent_runs")
  .select("id, status, provider, model, input_tokens, cache_read_tokens, output_tokens, estimated_cost_usd, error_message, latency_ms")
  .eq("organization_id", org)
  .gte("started_at", started)
  .order("started_at");
console.log(JSON.stringify({ ok: outcome.ok, error: outcome.ok ? null : outcome, runs }, null, 1));
process.exit(outcome.ok ? 0 : 1);
