import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runScalabilityPlaybookEngineForAllOrganizations } from "@e-nora/api/scalability-constraints-engine";

const logger = createLogger("scalability-constraints-worker");
runScalabilityPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("scalability_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("scalability_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
