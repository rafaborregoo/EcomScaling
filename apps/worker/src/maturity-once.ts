/**
 * F3/D03. Una pasada del motor de madurez.
 *
 * Es el unico de los cinco que **no depende de los demas**: mide de que es
 * capaz el negocio, no que se ha movido esta semana. Puede correr el primero o
 * el ultimo de la cadena; da igual.
 */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runMaturityEngineForAllOrganizations } from "@ecomscaling/api/maturity-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("maturity-cron");
const jobContext = createWorkerJobContext("maturity-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting maturity engine cron", workerJobMeta(jobContext));

  const result = await runMaturityEngineForAllOrganizations(env);

  logger.info("Maturity engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Maturity engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
