import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { reconcileAllKlaviyoConnections } from "@e-nora/api/klaviyo-sync";
import { closeIntegrationSyncQueues } from "@e-nora/api/integration-sync-queue";
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
      outcomes: result.results.map(({ status, detail }) => ({ status, detail })),
    }),
  );
  if (result.failed > 0) process.exitCode = 1;
}

main().finally(closeIntegrationSyncQueues).catch((error: unknown) => {
  logger.error("Klaviyo reconciliation cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
