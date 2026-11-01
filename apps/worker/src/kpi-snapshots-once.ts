import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runWeeklyKpiSnapshots } from "@e-nora/api/kpi-snapshots";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("kpi-snapshots-cron");
const jobContext = createWorkerJobContext("kpi-snapshots-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting weekly KPI snapshots", workerJobMeta(jobContext));

  const result = await runWeeklyKpiSnapshots(env);

  logger.info("Weekly KPI snapshots completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Weekly KPI snapshots crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
