import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { reconcileShopifyCounts } from "@ecomscaling/api/shopify-count-reconcile";

const logger = createLogger("shopify-reconcile-counts-once");

async function main() {
  const env = loadApiEnv(process.env);
  const connectionId = process.argv[2];

  if (!connectionId) {
    logger.error("Missing connection_id argument");
    process.exit(1);
  }

  const result = await reconcileShopifyCounts(env, connectionId);

  logger.info("Shopify count reconciliation completed", result);

  const hasMismatch = result.comparisons.some((comparison) => comparison.diff !== 0);
  if (hasMismatch) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Shopify count reconciliation crashed", error);
  process.exit(1);
});
