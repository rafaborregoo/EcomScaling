/**
 * F3/D04. Una pasada del motor de salud por capacidad.
 *
 * **Va detras de `signal-engine-once` y `symptoms-once`**: lee lo que ellos
 * escriben. Lanzarlo antes no rompe nada, pero mide un instante en que las
 * senales de hoy todavia no existen, asi que la lectura sale mas vacia de lo que
 * corresponde.
 */
import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runHealthEngineForAllOrganizations } from "@e-nora/api/health-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("health-cron");
const jobContext = createWorkerJobContext("health-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting capability health engine cron", workerJobMeta(jobContext));

  const result = await runHealthEngineForAllOrganizations(env);

  logger.info("Capability health engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Capability health engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
