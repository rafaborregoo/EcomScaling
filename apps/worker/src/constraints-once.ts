import { loadApiEnv } from "@e-nora/config";
import { runConstraintsDependenciesEngineForAllOrganizations } from "@e-nora/api/constraints-engine";
import { createLogger } from "@e-nora/observability";
const logger = createLogger("constraints-worker");
runConstraintsDependenciesEngineForAllOrganizations(loadApiEnv(process.env)).then((result) => { logger.info("constraints_cron_completed", result); if (result.failed > 0) process.exitCode = 1; }).catch((error: unknown) => { logger.error("constraints_cron_crashed", { error: error instanceof Error ? error.message : String(error) }); process.exitCode = 1; });
