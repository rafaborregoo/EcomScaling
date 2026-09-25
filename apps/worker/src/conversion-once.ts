import { loadApiEnv } from "@e-nora/config";
import { runConversionPlaybookEngineForAllOrganizations } from "@e-nora/api/conversion-engine";
import { createLogger } from "@e-nora/observability";

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
