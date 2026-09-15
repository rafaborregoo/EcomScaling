/**
 * F3/D02. Una pasada del motor de contextualizacion.
 *
 * Es el tercero de la cadena y el orden importa: `data-quality` decide si el
 * dato aguanta, `signal-engine` detecta que se movio, y esto decide si lo que
 * se movio fue el rendimiento o solo la composicion. Lanzarlo antes que los
 * otros dos produce lecturas mas limpias de lo que el dato permite.
 */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runContextEngineForAllOrganizations } from "@ecomscaling/api/context-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("context-cron");
const jobContext = createWorkerJobContext("context-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting context engine cron", workerJobMeta(jobContext));

  const result = await runContextEngineForAllOrganizations(env);

  logger.info("Context engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Context engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
