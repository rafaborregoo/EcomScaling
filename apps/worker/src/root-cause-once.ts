/**
 * F3/D09. Una pasada del motor de causa raiz y constraint.
 *
 * Dos pipelines independientes: causa raiz desde las hipotesis vivas de D08 y
 * la cadena en el grafo de D07; constraint desde la salud por capacidad de D04.
 * Casi todo sale `unresolved` o `latent` hoy, porque cerrar mas exigiria una
 * evidencia que la plataforma todavia no mide.
 *
 * Va detras de D04 y D08, y delante de D11.
 */
import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runRootCauseEngineForAllOrganizations } from "@e-nora/api/root-cause-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("root-cause-cron");
const jobContext = createWorkerJobContext("root-cause-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting root cause engine cron", workerJobMeta(jobContext));

  const result = await runRootCauseEngineForAllOrganizations(env);

  logger.info("Root cause engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Root cause engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
