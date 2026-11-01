import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { backfillOrderJourneys } from "./shopify-order-journey.js";
import { ensureShopifyWebPixel } from "./shopify-pixel.js";
import { runShopifyInitialSync } from "./shopify-sync.js";
import { drainFailedShopifyWebhooks } from "./shopify-webhook-handler.js";
import { ensureShopifyWebhooks } from "./shopify-webhooks.js";
import type { ShopifyQueueJob } from "./shopify-sync-queue.js";

export type ShopifyQueueWorkerJob = ShopifyQueueJob;

export async function runShopifyQueueJob(env: LoadedApiEnv, job: ShopifyQueueWorkerJob) {
  if (job.kind === "webhook_drain") {
    return drainFailedShopifyWebhooks(env, 10);
  }

  if (job.kind === "reconcile_finalize") {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.schema("private").rpc("capture_inventory_snapshot");
    if (error) throw new Error(`shopify_inventory_snapshot_failed: ${error.message}`);
    return { status: "reconcile_finalized", inventory_snapshot: data ?? null };
  }

  try { await ensureShopifyWebhooks(env, job.connectionId, job.source === "oauth"); }
  catch (error) { console.error("Shopify webhook verification failed", { connection_id: job.connectionId, error: error instanceof Error ? error.message : String(error) }); }

  if (job.source === "reconcile") {
    try {
      await backfillOrderJourneys(env, job.connectionId);
    } catch (error) {
      // Journey attribution is auxiliary; it must not block catalog, orders,
      // inventory, or promotion synchronization for the store.
      console.error("Shopify order journey backfill failed", {
        connection_id: job.connectionId,
        organization_id: job.organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await ensureShopifyWebPixel(env, job.connectionId);
  }

  await runShopifyInitialSync(env, job.connectionId, job.syncType);
  return {
    status: "shopify_sync_completed",
    connection_id: job.connectionId,
    organization_id: job.organizationId,
    sync_type: job.syncType,
  };
}
