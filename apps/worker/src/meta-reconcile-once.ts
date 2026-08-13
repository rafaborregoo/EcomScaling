import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { reconcileAllMetaConnections } from "@ecomscaling/api/meta-sync";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("meta-reconcile-cron");
const jobContext = createWorkerJobContext("meta-reconcile-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info(
    "Starting Meta Ads reconciliation cron",
    workerJobMeta(jobContext),
  );
  const result = await reconcileAllMetaConnections(env);
  logger.info(
    "Meta Ads reconciliation cron completed",
    workerJobMeta(jobContext, {
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
    }),
  );
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  logger.error("Meta Ads reconciliation cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
