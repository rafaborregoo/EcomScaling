import { loadApiEnv } from "@e-nora/config";
import { runDecisionImpactEngineForAllOrganizations } from "@e-nora/api/decision-impact-engine";
import { createLogger } from "@e-nora/observability";
const logger = createLogger("decision-impact-worker");
runDecisionImpactEngineForAllOrganizations(loadApiEnv(process.env)).then((result) => { logger.info("decision_impact_cron_completed", result); if (result.failed > 0) process.exitCode = 1; }).catch((error: unknown) => { logger.error("decision_impact_cron_crashed", { error: error instanceof Error ? error.message : String(error) }); process.exitCode = 1; });
