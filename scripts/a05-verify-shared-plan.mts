import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { getCampaignPlanProposal } from "../apps/api/src/ai-runtime.js";
import type { AuthContext } from "../apps/api/src/auth-context.js";
const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
const checked = async (query: any) => { const result = await query; assert.ifError(result.error); return result.data; };
const org = await checked(db.from("organizations").select("id,display_name,slug,status,timezone,currency_code,kind").eq("id", orgId).single());
const store = await checked(db.from("shopify_stores").select("connection_id").eq("organization_id", orgId).eq("id", "5e84efa9-6e7f-4759-8b87-22119401bd81").single());
const expected = await checked(db.from("agent_runs").select("id,agent_outputs!inner(id)").eq("organization_id", orgId).eq("deployment_version", "cli-lab:a05-clean-v3").single());
let outputId: string | null = null;
for (const [id, email, kind] of [["ead62983-1938-4da6-af8f-13cb64d8cd3e", "borregorafa99@gmail.com", "client"], ["0aa0090b-2a10-4f1e-881f-bdeb4f52b183", "rafael@noraapp.es", "consultant"]] as const) {
  const user = await db.auth.admin.getUserById(id);
  assert.equal(user.data.user?.email, email);
  const profile = await checked(db.from("profiles").select("id,full_name,avatar_url,platform_role,is_active").eq("id", id).single());
  const access = kind === "client"
    ? await checked(db.from("organization_members").select("role").eq("organization_id", orgId).eq("user_id", id).single())
    : await checked(db.from("consultant_assignments").select("consultant_user_id").eq("organization_id", orgId).eq("consultant_user_id", id).single());
  assert.ok(access);
  const context: AuthContext = { user: { id }, profile, subscriptions: [], memberships: [{ organization_id: orgId, organization: org,
    role: kind === "client" ? access.role : "consultant", accessSource: kind === "client" ? "membership" : "consultant_assignment" }] };
  const result = await getCampaignPlanProposal(env, context, orgId, store.connection_id);
  assert.ok(result.ok, JSON.stringify(result));
  assert.ok(result.data.proposal?.content, "UI must receive valid plan content");
  const proposal = result.data.proposal;
  assert.equal(proposal.run_id, expected.id);
  assert.equal(proposal.model, "gpt-6.1-sol");
  assert.equal(proposal.execution_source, "cli_simulation");
  assert.equal(proposal.status, "pending_approval");
  if (outputId) assert.equal(proposal.output_id, outputId);
  outputId = proposal.output_id;
  console.log(JSON.stringify({ viewer: kind, output_id: outputId, plan_name: proposal.content.plan_name, actions: proposal.content.calendar_actions.length,
    titles: proposal.content.calendar_actions.map((action: any) => ({ title: action.title, date: action.scheduled_date, channel: action.channel })) }));
}
