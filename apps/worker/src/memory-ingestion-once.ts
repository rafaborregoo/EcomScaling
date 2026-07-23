import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { processMemoryIngestionQueue } from "@ecomscaling/api/memory-ingestion";

const logger = createLogger("memory-ingestion-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting memory ingestion queue processing");

  const result = await processMemoryIngestionQueue(env);

  logger.info("Memory ingestion queue processing completed", result);
}

main().catch((error: unknown) => {
  logger.error("Memory ingestion queue processing crashed", error);
  process.exit(1);
});
