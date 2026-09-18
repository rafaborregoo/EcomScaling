import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runAcquisitionDemandPlaybookEngineForAllOrganizations } from "@ecomscaling/api/acquisition-demand-engine";

const logger = createLogger("acquisition-demand-worker");
runAcquisitionDemandPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("acquisition_demand_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("acquisition_demand_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
