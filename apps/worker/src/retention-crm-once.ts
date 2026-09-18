import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runRetentionCrmPlaybookEngineForAllOrganizations } from "@ecomscaling/api/retention-crm-engine";

const logger = createLogger("retention-crm-worker");

runRetentionCrmPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("retention_crm_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("retention_crm_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
