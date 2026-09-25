import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runDataQualityReliabilityPlaybookEngineForAllOrganizations } from "@e-nora/api/data-quality-reliability-engine";

const logger = createLogger("data-quality-reliability-worker");
runDataQualityReliabilityPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("data_quality_reliability_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("data_quality_reliability_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
