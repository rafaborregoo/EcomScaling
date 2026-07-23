import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { purgeExpiredDeletions } from "@ecomscaling/api/consultant";

const logger = createLogger("purge-expired-deletions-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting purge of expired soft-deletions");

  const result = await purgeExpiredDeletions(env);

  if (result.ok === false) {
    logger.error("Purge of expired soft-deletions failed", result);
    process.exitCode = 1;
    return;
  }

  logger.info("Purge of expired soft-deletions completed", result.data);

  // R-008 (bug real corregido 2026-07-22): antes un fallo de purga individual
  // se tragaba en silencio sin marcar el job como fallido en ningun sitio.
  if (result.data.failedOrganizationIds.length > 0 || result.data.failedConnectionIds.length > 0) {
    logger.error("Some purges failed, see individual error logs above", {
      failedOrganizationIds: result.data.failedOrganizationIds,
      failedConnectionIds: result.data.failedConnectionIds,
    });
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Purge of expired soft-deletions crashed", error);
  process.exit(1);
});
