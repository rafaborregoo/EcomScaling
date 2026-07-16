import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { reconcileAllShopifyConnections } from "@ecomscaling/api/shopify-reconcile";

const logger = createLogger("shopify-reconcile-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting Shopify reconciliation cron");

  const result = await reconcileAllShopifyConnections(env);

  logger.info("Shopify reconciliation cron completed", result);

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Shopify reconciliation cron crashed", error);
  process.exit(1);
});
