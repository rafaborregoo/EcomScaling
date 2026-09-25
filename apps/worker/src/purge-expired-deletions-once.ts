import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { purgeExpiredDeletions } from "@e-nora/api/consultant";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("purge-expired-deletions-cron");
const jobContext = createWorkerJobContext("purge-expired-deletions-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info(
    "Starting purge of expired soft-deletions",
    workerJobMeta(jobContext),
  );

  const result = await purgeExpiredDeletions(env);

  if (result.ok === false) {
    logger.error("Purge of expired soft-deletions failed", {
      ...workerJobMeta(jobContext),
      result,
    });
    process.exitCode = 1;
    return;
  }

  logger.info(
    "Purge of expired soft-deletions completed",
    workerJobMeta(jobContext, result.data),
  );

  // R-008 (bug real corregido 2026-07-22): antes un fallo de purga individual
  // se tragaba en silencio sin marcar el job como fallido en ningun sitio.
  if (
    result.data.failedOrganizationIds.length > 0 ||
    result.data.failedConnectionIds.length > 0
  ) {
    logger.error("Some purges failed, see individual error logs above", {
      ...workerJobMeta(jobContext),
      failedOrganizationIds: result.data.failedOrganizationIds,
      failedConnectionIds: result.data.failedConnectionIds,
    });
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Purge of expired soft-deletions crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
