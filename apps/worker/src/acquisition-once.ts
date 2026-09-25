import { loadApiEnv } from "@e-nora/config";
import { runAcquisitionPlaybookEngineForAllOrganizations } from "@e-nora/api/acquisition-engine";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("acquisition-worker");

runAcquisitionPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => {
    logger.info("acquisition_playbook_cron_completed", result);
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((error: unknown) => {
    logger.error("acquisition_playbook_cron_crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
