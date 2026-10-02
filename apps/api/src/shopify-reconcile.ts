import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { STALE_SYNCING_MS } from "./shopify.js";
import {
  enqueueShopifyReconcileFinalize,
  enqueueShopifySync,
  ShopifySyncQueueSaturatedError,
} from "./shopify-sync-queue.js";

type ApiEnv = LoadedApiEnv;
const logger = createLogger("shopify-reconcile");

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

/** Queues one store at a time; the Redis-backed worker applies global limits. */
export async function reconcileAllShopifyConnections(env: ApiEnv) {
  const supabase = createServiceClient(env);
  const staleCutoff = new Date(Date.now() - STALE_SYNCING_MS).toISOString();
  const pageSize = 250;
  let attempted = 0;
  let failed = 0;
  let skipped = 0;
  let queued = 0;
  let deferred = 0;
  reconciliation: for (let offset = 0; ; offset += pageSize) {
    const { data: page, error } = await supabase
      .from("integration_connections")
      .select("id, organization_id, status, updated_at")
      .eq("provider", "shopify")
      // A store's updated_at advances during sync, so older/less recently
      // serviced connections get first chance on the next reconciliation.
      .order("updated_at", { ascending: true, nullsFirst: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      logger.error("Shopify reconciliation connection lookup failed", {
        offset,
        error: error.message,
      });
      return { attempted, failed: failed + 1, skipped, queued };
    }
    for (const connection of page ?? []) {
      const isStaleSync = connection.status === "syncing" &&
        (!connection.updated_at || connection.updated_at < staleCutoff);
      if (connection.status !== "connected" && connection.status !== "error" && !isStaleSync) {
        continue;
      }
      attempted += 1;
      if (isStaleSync) {
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
              "La sincronizacion anterior quedo abierta y fue recuperada por la reconciliacion periodica.",
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
      }

      try {
        const result = await enqueueShopifySync(env, {
          kind: "sync",
          connectionId: connection.id,
          organizationId: connection.organization_id,
          syncType: "incremental",
          source: "reconcile",
        });
        if (result.deduplicated) skipped += 1;
        else queued += 1;
      } catch (enqueueError) {
        if (enqueueError instanceof ShopifySyncQueueSaturatedError) {
          deferred += 1;
          logger.info("Shopify reconciliation deferred at queue capacity", {
            connection_id: connection.id,
            organization_id: connection.organization_id,
          });
          break reconciliation;
        }
        failed += 1;
        logger.error("Shopify reconciliation enqueue failed", {
          connection_id: connection.id,
          organization_id: connection.organization_id,
          error: enqueueError instanceof Error ? enqueueError.message : String(enqueueError),
        });
      }
    }
    if (!page || page.length < pageSize) break;
  }

  try {
    await enqueueShopifyReconcileFinalize(env, new Date().toISOString().slice(0, 10));
  } catch (finalizeError) {
    failed += 1;
    logger.error("Shopify reconciliation finalizer enqueue failed", {
      error: finalizeError instanceof Error ? finalizeError.message : String(finalizeError),
    });
  }

  logger.info("Shopify reconciliation pass queued", { attempted, failed, skipped, queued, deferred });
  return { attempted, failed, skipped, queued, deferred };
}
