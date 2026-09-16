/** F3/D13. Ejecuta la película temporal para todas las organizaciones. */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runTemporalEngineForAllOrganizations } from "@ecomscaling/api/temporal-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";
const logger = createLogger("temporal-cron");
const jobContext = createWorkerJobContext("temporal-cron");
async function main() { const result = await runTemporalEngineForAllOrganizations(loadApiEnv(process.env)); logger.info("Temporal engine cron completed", workerJobMeta(jobContext, result)); if (result.failed > 0) process.exitCode = 1; }
main().catch((error: unknown) => { logger.error("temporal_engine_cron_crashed", { ...workerJobMeta(jobContext), error }); process.exit(1); });
