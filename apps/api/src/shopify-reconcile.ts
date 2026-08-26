import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { STALE_SYNCING_MS } from "./shopify.js";
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

  // Ademas de "connected"/"error", recoge conexiones que quedaron atascadas en "syncing":
  // el sync inicial dispara desde el callback OAuth (funcion serverless de Vercel con
  // maxDuration corto) y puede morir a mitad de una bulk operation de Shopify, dejando
  // la fila en "syncing" para siempre. Sin esto, esas conexiones nunca se reintentan.
  const staleCutoff = new Date(Date.now() - STALE_SYNCING_MS).toISOString();

  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("id, organization_id, status, updated_at")
    .eq("provider", "shopify")
    .or(`status.in.(connected,error),and(status.eq.syncing,updated_at.lt.${staleCutoff})`);

  if (error) {
    logger.error("Shopify reconciliation connection lookup failed", { error: error.message });
    return { attempted: 0, failed: 0 };
  }

  let attempted = 0;
  let failed = 0;
  let skipped = 0;

  for (const connection of connections ?? []) {
    attempted += 1;

    let expectedStatus = connection.status;
    if (connection.status === "syncing") {
      logger.info("Recovering Shopify connection stuck in syncing", {
        connection_id: connection.id,
        organization_id: connection.organization_id,
        stuck_since: connection.updated_at,
      });

      const { data: recoveredConnection, error: recoveryError } = await supabase
        .from("integration_connections")
        .update({
          status: "error",
          last_error_at: new Date().toISOString(),
          last_error_message:
            "La sincronizacion anterior quedo abierta (probablemente cortada por timeout) y fue recuperada por la reconciliacion periodica.",
        })
        .eq("id", connection.id)
        .eq("status", "syncing")
        .select("id")
        .maybeSingle();
      if (recoveryError) {
        failed += 1;
        logger.error("Shopify stale connection recovery failed", {
          connection_id: connection.id,
          organization_id: connection.organization_id,
          error: recoveryError.message,
        });
        continue;
      }
      if (!recoveredConnection) {
        skipped += 1;
        continue;
      }
      expectedStatus = "error";
    }

    const { data: claimedConnection, error: claimError } = await supabase
      .from("integration_connections")
      .update({ status: "syncing" })
      .eq("id", connection.id)
      .eq("status", expectedStatus)
      .select("id")
      .maybeSingle();
    if (claimError) {
      failed += 1;
      logger.error("Shopify reconciliation claim failed", {
        connection_id: connection.id,
        organization_id: connection.organization_id,
        error: claimError.message,
      });
      continue;
    }
    if (!claimedConnection) {
      skipped += 1;
      continue;
    }

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

  logger.info("Shopify reconciliation pass completed", { attempted, failed, skipped });

  return { attempted, failed, skipped };
}
