import { loadApiEnv } from "@ecomscaling/config";
import { runPaidMediaBenchmarksPlaybookEngineForAllOrganizations } from "@ecomscaling/api/paid-media-benchmarks-engine";
import { createLogger } from "@ecomscaling/observability";

const logger = createLogger("paid-media-benchmarks-worker");

runPaidMediaBenchmarksPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => {
    logger.info("paid_media_benchmarks_playbook_cron_completed", result);
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((error: unknown) => {
    logger.error("paid_media_benchmarks_playbook_cron_crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
