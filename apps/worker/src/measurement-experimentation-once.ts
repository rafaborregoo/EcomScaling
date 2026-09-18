import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runMeasurementExperimentationPlaybookEngineForAllOrganizations } from "@ecomscaling/api/measurement-experimentation-engine";

const logger = createLogger("measurement-experimentation-worker");

runMeasurementExperimentationPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("measurement_experimentation_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("measurement_experimentation_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
