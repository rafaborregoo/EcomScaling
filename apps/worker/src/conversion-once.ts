import { loadApiEnv } from "@ecomscaling/config";
import { runConversionPlaybookEngineForAllOrganizations } from "@ecomscaling/api/conversion-engine";
import { createLogger } from "@ecomscaling/observability";

const logger = createLogger("conversion-cro-worker");

runConversionPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => {
    logger.info("conversion_cro_playbook_cron_completed", result);
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((error: unknown) => {
    logger.error("conversion_cro_playbook_cron_crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
