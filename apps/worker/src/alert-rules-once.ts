import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runAlertRulesForAllOrganizations } from "@ecomscaling/api/operations";

const logger = createLogger("alert-rules-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting alert rules cron");

  const result = await runAlertRulesForAllOrganizations(env);

  logger.info("Alert rules cron completed", result);

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Alert rules cron crashed", error);
  process.exit(1);
});
