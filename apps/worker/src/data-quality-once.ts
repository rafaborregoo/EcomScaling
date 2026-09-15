/**
 * F3/D01. Una pasada del motor de calidad de datos sobre todas las
 * organizaciones activas.
 *
 * Va **antes** que el motor de senales, no despues: D01 es la puerta que decide
 * si el dato aguanta la interpretacion, y una senal detectada sobre una fuente
 * que lleva cinco dias sin sincronizar no es una senal, es el sintoma de una
 * integracion rota.
 */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runDataQualityEngineForAllOrganizations } from "@ecomscaling/api/data-quality-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("data-quality-cron");
const jobContext = createWorkerJobContext("data-quality-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting data quality engine cron", workerJobMeta(jobContext));

  const result = await runDataQualityEngineForAllOrganizations(env);

  logger.info("Data quality engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Data quality engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
