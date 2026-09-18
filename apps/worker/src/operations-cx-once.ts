import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runOperationsCxPlaybookEngineForAllOrganizations } from "@ecomscaling/api/operations-cx-engine";

const logger = createLogger("operations-cx-worker");

runOperationsCxPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("operations_cx_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("operations_cx_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
