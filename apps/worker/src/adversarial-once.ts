/** F3/D12. Ejecuta una revisión adversarial para todas las organizaciones. */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runAdversarialEngineForAllOrganizations } from "@ecomscaling/api/adversarial-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("adversarial-cron");
const jobContext = createWorkerJobContext("adversarial-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting adversarial engine cron", workerJobMeta(jobContext));
  const result = await runAdversarialEngineForAllOrganizations(env);
  logger.info("Adversarial engine cron completed", workerJobMeta(jobContext, result));
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  logger.error("adversarial_engine_cron_crashed", { ...workerJobMeta(jobContext), error });
  process.exit(1);
});
