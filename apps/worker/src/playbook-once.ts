import { loadApiEnv } from "@ecomscaling/config";
import { runPlaybookFrameworkEngineForAllOrganizations } from "@ecomscaling/api/playbook-engine";
import { createLogger } from "@ecomscaling/observability";

const logger = createLogger("playbook-worker");

runPlaybookFrameworkEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => {
    logger.info("playbook_framework_cron_completed", result);
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((error: unknown) => {
    logger.error("playbook_framework_cron_crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
