import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runScheduledReports } from "@e-nora/api/reports";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("scheduled-reports-cron");
const jobContext = createWorkerJobContext("scheduled-reports-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting scheduled reports cron", workerJobMeta(jobContext));

  const result = await runScheduledReports(env);

  logger.info("Scheduled reports cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Scheduled reports cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
