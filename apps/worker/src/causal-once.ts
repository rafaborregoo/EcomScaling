/**
 * F3/D07. Una pasada del motor causal.
 *
 * Recorre hacia atras el grafo declarado desde el target de cada caso abierto y
 * deja escritas **todas** las rutas candidatas: las que el caso apoya, las que
 * contradice y las que nadie ha podido comprobar.
 *
 * Va detras de D05 y D06 --sin senales no hay nada que recorrer-- y delante de
 * D11, que es quien lee si alguna causa quedo en pie.
 */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runCausalEngineForAllOrganizations } from "@ecomscaling/api/causal-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("causal-cron");
const jobContext = createWorkerJobContext("causal-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting causal engine cron", workerJobMeta(jobContext));

  const result = await runCausalEngineForAllOrganizations(env);

  logger.info("Causal engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Causal engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
