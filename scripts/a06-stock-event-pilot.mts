/** Development enrollment only. This utility cannot enable paid calls. */
import pg from "pg";
import { loadApiEnv } from "../packages/config/src/index.js";
import { buildPlatformAdminContext } from "../apps/api/src/ai-runtime.js";
import { getAdminA06StockEvents } from "../apps/api/src/a06-stock-events.js";
const env = loadApiEnv(process.env),
  url = process.env.SUPABASE_DB_URL;
if (
  !url ||
  url.includes("cthjwpeygpzwdmjkxeqa") ||
  env.SUPABASE_URL.includes("cthjwpeygpzwdmjkxeqa")
)
  throw new Error("Development only");
const account = process.argv
  .find((arg) => arg.startsWith("--account="))
  ?.slice(10);
const db = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await db.connect();
try {
  if (account) {
    const { rows: stores } = await db.query(
      `select distinct s.id, s.organization_id, s.shop_name
      from auth.users u join public.organization_members m on m.user_id=u.id
      join public.shopify_stores s on s.organization_id=m.organization_id
      where lower(u.email)=lower($1) and s.is_active`,
      [account],
    );
    if (!stores.length)
      throw new Error("No active stores found for the account");
    for (const store of stores)
      await db.query(
        `insert into public.a06_stock_event_settings(store_id, organization_id, mode)
      values ($1,$2,'shadow') on conflict(store_id) do nothing`,
        [store.id, store.organization_id],
      );
    console.log(
      JSON.stringify({
        enrolled_for_observation: stores.map((store) => ({
          id: store.id,
          name: store.shop_name,
        })),
        paid_calls_enabled: false,
      }),
    );
  }
  const context = await buildPlatformAdminContext(env);
  if (!context.ok) throw new Error("Platform admin context unavailable");
  const result = await getAdminA06StockEvents(env, context.context);
  if (!result.ok || !result.data.available)
    throw new Error("Pilot admin endpoint unavailable");
  console.log(
    JSON.stringify({
      available: result.data.available,
      stores_enrolled: result.data.settings.length,
      modes: result.data.settings.map((setting) => setting.mode),
      model_configured: result.data.current_model,
      evaluations: result.data.evaluations.length,
      examples: result.data.examples.length,
    }),
  );
} finally {
  await db.end();
}
