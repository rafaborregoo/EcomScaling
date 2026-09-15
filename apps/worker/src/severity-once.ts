/**
 * F3/D10. Una pasada del motor de severidad e impacto.
 *
 * **Va detras de `signal-engine-once` y `symptoms-once`**: mide el impacto de lo
 * que ellos detectaron. Si corre antes, los casos abiertos no tienen senal en su
 * ventana y la evaluacion sale sin nada que cuantificar.
 *
 * No pone severidades: las cinco salen `unknown` y la evaluacion dice por que.
 * Lo que produce es la cuenta -- cuanto, sobre que base y con que supuestos.
 */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runSeverityEngineForAllOrganizations } from "@ecomscaling/api/severity-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("severity-cron");
const jobContext = createWorkerJobContext("severity-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting severity engine cron", workerJobMeta(jobContext));

  const result = await runSeverityEngineForAllOrganizations(env);

  logger.info("Severity engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Severity engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
