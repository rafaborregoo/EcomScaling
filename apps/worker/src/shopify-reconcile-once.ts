import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { reconcileAllShopifyConnections } from "@e-nora/api/shopify-reconcile";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("shopify-reconcile-cron");
const jobContext = createWorkerJobContext("shopify-reconcile-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info(
    "Starting Shopify reconciliation cron",
    workerJobMeta(jobContext),
  );

  const result = await reconcileAllShopifyConnections(env);

  logger.info(
    "Shopify reconciliation cron completed",
    workerJobMeta(jobContext, result),
  );

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Shopify reconciliation cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
