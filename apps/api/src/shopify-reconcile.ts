import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runShopifyInitialSync } from "./shopify-sync.js";

type ApiEnv = LoadedApiEnv;
const logger = createLogger("shopify-reconcile");

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

/**
 * Catches up any Shopify connection that might have missed webhook
 * deliveries (Shopify doesn't guarantee delivery). Runs sequentially, one
 * store at a time, since each store's bulk operations already run as long
 * background jobs and Shopify rate limits are per-shop, not global.
 */
export async function reconcileAllShopifyConnections(env: ApiEnv) {
  const supabase = createServiceClient(env);

  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("id, organization_id, status")
    .eq("provider", "shopify")
    .in("status", ["connected", "error"]);

  if (error) {
    logger.error("Shopify reconciliation connection lookup failed", { error: error.message });
    return { attempted: 0, failed: 0 };
  }

  let attempted = 0;
  let failed = 0;

  for (const connection of connections ?? []) {
    attempted += 1;

    try {
      await runShopifyInitialSync(env, connection.id, "incremental");
    } catch (syncError) {
      failed += 1;
      logger.error("Shopify reconciliation sync failed for connection", {
        connection_id: connection.id,
        organization_id: connection.organization_id,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

  logger.info("Shopify reconciliation pass completed", { attempted, failed });

  return { attempted, failed };
}
