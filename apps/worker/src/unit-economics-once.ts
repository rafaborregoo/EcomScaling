import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runUnitEconomicsPlaybookEngineForAllOrganizations } from "@ecomscaling/api/unit-economics-engine";

const logger = createLogger("unit-economics-worker");

runUnitEconomicsPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("unit_economics_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("unit_economics_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
