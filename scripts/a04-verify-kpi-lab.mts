import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";

const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"), "TEST only");
const report = JSON.parse(await readFile(".e-nora-test-lab/ai-models/report.json", "utf8"));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const stores = await db.from("shopify_stores").select("id,connection_id").eq("organization_id", report.target.organization_id).eq("is_active", true);
if (stores.error) throw stores.error;
assert.equal(stores.data?.length, 1);
const checks: any[] = [];
for (const [role, email] of [["cliente", report.target.owner], ["consultor", report.target.consultant]]) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await auth.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (login.error) throw login.error;
  const token = login.data.session!.access_token;
  try {
    for (const scope of [{ label: "tienda", connectionId: stores.data![0]!.connection_id, count: 2 }, { label: "organizacion", connectionId: null, count: 1 }]) {
      const params = new URLSearchParams({ days: "30" });
      if (scope.connectionId) params.set("connectionId", scope.connectionId);
      const response = await fetch(`http://localhost:${env.API_PORT}/v1/organizations/${report.target.organization_id}/ai/task-planner?${params}`, { headers: { authorization: `Bearer ${token}` } });
      const body = await response.json();
      assert.equal(response.status, 200, `${role}/${scope.label}: ${JSON.stringify(body)}`);
      const data = body.data ?? body;
      assert.equal(data.output_status, "pending_approval");
      assert.equal(data.output?.proposed_writes?.length, scope.count);
      assert.ok(data.output?.ai_lab?.transport === "codex_cli");
      checks.push({ role, scope: scope.label, status: response.status, output_id: data.output_id, output_status: data.output_status, proposals: data.output.proposed_writes.map((item: any) => item.title) });
    }
  } finally { await auth.auth.signOut({ scope: "local" }); }
}
await writeFile(".e-nora-test-lab/a04-kpi-refresh/access-verification.json", JSON.stringify({ checked_at: new Date().toISOString(), checks }, null, 2));
console.log(JSON.stringify(checks, null, 2));
