/** F4/P01. Construye snapshots del contexto usando .env.local en desarrollo. */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runDecisionContextEngineForAllOrganizations } from "@ecomscaling/api/decision-context-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("decision-context-cron");
const jobContext = createWorkerJobContext("decision-context-cron");

async function main() {
  const result = await runDecisionContextEngineForAllOrganizations(loadApiEnv(process.env));
  logger.info("Decision context engine cron completed", workerJobMeta(jobContext, result));
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  logger.error("decision_context_cron_crashed", { ...workerJobMeta(jobContext), error });
  process.exit(1);
});
