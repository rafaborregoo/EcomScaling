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
const expected = {
  overview: ["sales_net_sales", "orders_count", "net_profit", "conversion_rate", "cac_blended", "average_order_value", "meta_roas", "stock_risk"],
  shopify: ["sales_net_sales", "orders_count", "average_order_value", "conversion_rate", "gross_margin"],
  meta: ["meta_spend", "meta_attributed_sales", "meta_roas", "meta_cost_per_purchase"],
  klaviyo: ["klaviyo_attributed_revenue", "klaviyo_attributed_purchases", "klaviyo_revenue_per_recipient", "klaviyo_recipients", "klaviyo_open_rate", "klaviyo_click_rate", "klaviyo_unsubscribe_rate", "klaviyo_spam_rate"],
  panel: ["net_revenue_ex_tax", "net_profit", "net_margin", "orders_count", "average_order_value_ex_tax", "new_customers", "cac_blended"],
};
const checks: any[] = [];
for (const [role, email] of [["cliente", report.target.owner], ["consultor", report.target.consultant]]) {
  const link = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const login = await auth.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (login.error) throw login.error;
  const token = login.data.session!.access_token;
  try {
    for (const store of [...(stores.data ?? []), null]) {
      for (const [scope, keys] of Object.entries(expected)) {
        const params = new URLSearchParams({ days: "30", view: scope });
        if (store?.connection_id) params.set("connectionId", store.connection_id);
        const response = await fetch(`http://localhost:${env.API_PORT}/v1/organizations/${report.target.organization_id}/ai/monitor?${params}`, { headers: { authorization: `Bearer ${token}` } });
        const body = await response.json();
        if (role === "cliente" && scope === "panel") {
          assert.equal(response.status, 403, "The client must not see the consultant-only profitability diagnostic");
          checks.push({ role, scope, store_id: store?.id ?? null, status: 403, expected_denial: true });
          continue;
        }
        assert.equal(response.status, 200, `${role}/${scope}: ${JSON.stringify(body)}`);
        const data = body.data ?? body;
        const reviews = data.output?.metric_reviews;
        assert.ok(Array.isArray(reviews), `${role}/${scope}: metric reviews are missing`);
        assert.deepEqual(reviews.map((row: any) => row.metric_key).sort(), [...keys].sort());
        assert.ok(reviews.every((row: any) => row.summary.trim().split(/\s+/u).length <= 10));
        assert.equal(data.output_status, "approved");
        checks.push({ role, scope, store_id: store?.id ?? null, status: response.status, output_id: data.output_id, generated_at: data.generated_at, reviews: reviews.length });
      }
    }
  } finally { await auth.auth.signOut({ scope: "local" }); }
}
await writeFile(".e-nora-test-lab/a02-kpi-refresh/access-verification.json", JSON.stringify({ checked_at: new Date().toISOString(), checks }, null, 2));
console.log(JSON.stringify(checks, null, 2));
process.exit(0);
