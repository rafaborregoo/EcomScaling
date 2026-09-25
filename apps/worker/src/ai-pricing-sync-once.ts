import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { syncModelPrices } from "@ecomscaling/api/ai-model-pricing";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

// Tarifa de modelos de IA desde LiteLLM a `ai_model_prices`, y coste para las
// ejecuciones que se quedaron sin el. Diario en el crontab del VPS.
const logger = createLogger("ai-pricing-sync-cron");
const jobContext = createWorkerJobContext("ai-pricing-sync-cron");

async function main() {
  const env = loadApiEnv(process.env);
  const summary = await syncModelPrices(env);
  logger.info("ai_pricing_sync_completed", workerJobMeta(jobContext, summary));
}

main().catch((error: unknown) => {
  logger.error("ai_pricing_sync_failed", {
    ...workerJobMeta(jobContext),
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
