import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { resumeStalledMailingCampaigns } from "@e-nora/api/mailing-campaign";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

// ADR-0025: recoge las campañas de mailing que se quedaron paradas (la API se
// reinicio a mitad, una decision no llego al grafo). No hace nada con el
// interruptor MAILING_GRAPH_ENABLED apagado.
const logger = createLogger("mailing-campaign-resume-cron");
const jobContext = createWorkerJobContext("mailing-campaign-resume-cron");

async function main() {
  const env = loadApiEnv(process.env);
  if (env.MAILING_GRAPH_ENABLED !== "true") {
    logger.info("Mailing graph disabled; nothing to resume", workerJobMeta(jobContext));
    return;
  }
  const result = await resumeStalledMailingCampaigns(env);
  logger.info("Mailing campaign resume completed", workerJobMeta(jobContext, result));
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  logger.error("Mailing campaign resume crashed", { ...workerJobMeta(jobContext), error });
  process.exit(1);
});
