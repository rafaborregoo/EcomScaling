import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runCohortContextPlaybookEngineForAllOrganizations } from "@ecomscaling/api/cohort-context-engine";

const logger = createLogger("cohort-context-worker");
runCohortContextPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("cohort_context_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("cohort_context_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
