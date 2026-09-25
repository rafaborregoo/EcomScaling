import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runAlertRulesForAllOrganizations } from "@e-nora/api/operations";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("alert-rules-cron");
const jobContext = createWorkerJobContext("alert-rules-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting alert rules cron", workerJobMeta(jobContext));

  const result = await runAlertRulesForAllOrganizations(env);

  logger.info("Alert rules cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Alert rules cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
