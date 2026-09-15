/**
 * F3/D06. Una pasada del motor de sintomas.
 *
 * Es el ultimo de la cadena y el orden importa mas aqui que en ninguno:
 * `data-quality` decide si el dato aguanta, `signal-engine` detecta que se
 * movio, `context-engine` decide si fue rendimiento o composicion, y esto
 * convierte lo coherente en un patron con nombre. Lanzarlo antes que el de
 * contexto produce sintomas sin revisar -- que no es un error, pero es peor
 * informacion de la disponible.
 */
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runSymptomEngineForAllOrganizations } from "@ecomscaling/api/symptom-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("symptoms-cron");
const jobContext = createWorkerJobContext("symptoms-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting symptom engine cron", workerJobMeta(jobContext));

  const result = await runSymptomEngineForAllOrganizations(env);

  logger.info("Symptom engine cron completed", workerJobMeta(jobContext, result));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Symptom engine cron crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
