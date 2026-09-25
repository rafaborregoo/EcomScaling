import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runSignalEngineForAllOrganizations } from "@e-nora/api/signal-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("signal-engine-cron");
const jobContext = createWorkerJobContext("signal-engine-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting signal engine cron", workerJobMeta(jobContext));

  const result = await runSignalEngineForAllOrganizations(env);

  logger.info("Signal engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Signal engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
