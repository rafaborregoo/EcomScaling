/**
 * F3/D08. Una pasada del motor de hipotesis.
 *
 * Convierte las rutas de D07 en hipotesis explicitas: las que siguen en pie, las
 * descartadas **con su motivo escrito**, y la que nadie propone nunca -- que no
 * haya pasado nada y sea la medida.
 *
 * Va detras de D07 y delante de D09.
 */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runHypothesisEngineForAllOrganizations } from "@ecomscaling/api/hypothesis-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("hypothesis-cron");
const jobContext = createWorkerJobContext("hypothesis-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting hypothesis engine cron", workerJobMeta(jobContext));

  const result = await runHypothesisEngineForAllOrganizations(env);

  logger.info("Hypothesis engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Hypothesis engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
