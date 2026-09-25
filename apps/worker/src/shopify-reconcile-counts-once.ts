import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { reconcileShopifyCounts } from "@e-nora/api/shopify-count-reconcile";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("shopify-reconcile-counts-once");
const jobContext = createWorkerJobContext("shopify-reconcile-counts-cron");

async function main() {
  const env = loadApiEnv(process.env);
  const connectionId = process.argv[2];

  if (!connectionId) {
    logger.error("Missing connection_id argument", workerJobMeta(jobContext));
    process.exit(1);
  }

  const result = await reconcileShopifyCounts(env, connectionId);

  logger.info(
    "Shopify count reconciliation completed",
    workerJobMeta(jobContext, result),
  );

  const hasMismatch = result.comparisons.some(
    (comparison) => comparison.diff !== 0,
  );
  if (hasMismatch) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Shopify count reconciliation crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
