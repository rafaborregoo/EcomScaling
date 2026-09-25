import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runUnitEconomicsPlaybookEngineForAllOrganizations } from "@e-nora/api/unit-economics-engine";

const logger = createLogger("unit-economics-worker");

runUnitEconomicsPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("unit_economics_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("unit_economics_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
