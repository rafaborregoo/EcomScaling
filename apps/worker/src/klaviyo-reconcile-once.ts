import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { reconcileAllKlaviyoConnections } from "@ecomscaling/api/klaviyo-sync";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("klaviyo-reconcile-cron");
const jobContext = createWorkerJobContext("klaviyo-reconcile-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info(
    "Starting Klaviyo reconciliation cron",
    workerJobMeta(jobContext),
  );
  const result = await reconcileAllKlaviyoConnections(env);
  logger.info(
    "Klaviyo reconciliation cron completed",
    workerJobMeta(jobContext, {
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      skipped: result.skipped,
    }),
  );
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  logger.error("Klaviyo reconciliation cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
