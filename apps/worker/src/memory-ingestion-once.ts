import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { processMemoryIngestionQueue } from "@ecomscaling/api/memory-ingestion";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("memory-ingestion-cron");
const jobContext = createWorkerJobContext("memory-ingestion-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info(
    "Starting memory ingestion queue processing",
    workerJobMeta(jobContext),
  );

  const result = await processMemoryIngestionQueue(env);

  logger.info(
    "Memory ingestion queue processing completed",
    workerJobMeta(jobContext, result),
  );
}

main().catch((error: unknown) => {
  logger.error("Memory ingestion queue processing crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
