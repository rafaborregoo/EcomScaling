/**
 * F3/D11. Una pasada del motor de confianza e incertidumbre.
 *
 * **El ultimo de la cadena.** Lee lo que escribieron D01, D05, D06 y D10 y dice,
 * capa por capa, cuanto se puede afirmar de cada cosa. Si corre antes que ellos,
 * califica un caso vacio: cierto en ese instante, pero inutil.
 */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runConfidenceEngineForAllOrganizations } from "@ecomscaling/api/confidence-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("confidence-cron");
const jobContext = createWorkerJobContext("confidence-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting confidence engine cron", workerJobMeta(jobContext));

  const result = await runConfidenceEngineForAllOrganizations(env);

  logger.info("Confidence engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Confidence engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
