/** F3/D14. Finaliza y valida salidas diagnósticas de todas las organizaciones. */
import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runDiagnosticOutputEngineForAllOrganizations } from "@e-nora/api/diagnostic-output-engine";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";
const logger = createLogger("diagnostic-output-cron");
const jobContext = createWorkerJobContext("diagnostic-output-cron");
async function main() { const result = await runDiagnosticOutputEngineForAllOrganizations(loadApiEnv(process.env)); logger.info("Diagnostic output engine cron completed", workerJobMeta(jobContext, result)); if (result.failed > 0) process.exitCode = 1; }
main().catch((error: unknown) => { logger.error("diagnostic_output_engine_cron_crashed", { ...workerJobMeta(jobContext), error }); process.exit(1); });
