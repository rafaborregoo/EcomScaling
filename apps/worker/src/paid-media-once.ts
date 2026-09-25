import { loadApiEnv } from "@e-nora/config";
import { runPaidMediaPlaybookEngineForAllOrganizations } from "@e-nora/api/paid-media-engine";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("paid-media-worker");

runPaidMediaPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => {
    logger.info("paid_media_playbook_cron_completed", result);
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((error: unknown) => {
    logger.error("paid_media_playbook_cron_crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
