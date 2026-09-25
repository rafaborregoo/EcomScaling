import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runRecoveryCrisisPlaybookEngineForAllOrganizations } from "@e-nora/api/recovery-crisis-engine";

const logger = createLogger("recovery-crisis-worker");
runRecoveryCrisisPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("recovery_crisis_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("recovery_crisis_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
