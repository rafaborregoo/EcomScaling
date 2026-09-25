/** F4/P03. Assessment temporal sin ranking; desarrollo/verificación usa .env.local. */
import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runTemporalUrgencyEngineForAllOrganizations } from "@e-nora/api/temporal-urgency-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("temporal-urgency-cron");
const context = createWorkerJobContext("temporal-urgency-cron");
runTemporalUrgencyEngineForAllOrganizations(loadApiEnv(process.env)).then((result) => {
  logger.info("Temporal urgency engine cron completed", workerJobMeta(context, result));
  if (result.failed > 0) process.exitCode = 1;
}).catch((error: unknown) => { logger.error("temporal_urgency_cron_crashed", { ...workerJobMeta(context), error }); process.exit(1); });
