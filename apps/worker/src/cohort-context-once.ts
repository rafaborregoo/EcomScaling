import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runCohortContextPlaybookEngineForAllOrganizations } from "@e-nora/api/cohort-context-engine";

const logger = createLogger("cohort-context-worker");
runCohortContextPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("cohort_context_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("cohort_context_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
