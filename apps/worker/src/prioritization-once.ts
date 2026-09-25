/** F4/P00. El contexto de ejecución es .env.local en desarrollo/verificación. */
import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runPrioritizationEngineForAllOrganizations } from "@e-nora/api/prioritization-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("prioritization-cron");
const jobContext = createWorkerJobContext("prioritization-cron");
async function main() {
  const result = await runPrioritizationEngineForAllOrganizations(loadApiEnv(process.env));
  logger.info("Prioritization engine cron completed", workerJobMeta(jobContext, result));
  if (result.failed > 0) process.exitCode = 1;
}
main().catch((error: unknown) => { logger.error("prioritization_engine_cron_crashed", { ...workerJobMeta(jobContext), error }); process.exit(1); });

