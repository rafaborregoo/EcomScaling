import { loadApiEnv } from "@e-nora/config";
import { runRetentionCrmBenchmarksPlaybookEngineForAllOrganizations } from "@e-nora/api/retention-crm-benchmarks-engine";
import { createLogger } from "@e-nora/observability";
const logger = createLogger("retention-crm-benchmarks-worker");
runRetentionCrmBenchmarksPlaybookEngineForAllOrganizations(loadApiEnv(process.env)).then((result) => { logger.info("retention_crm_benchmarks_completed", result); if (result.failed > 0) process.exitCode = 1; }).catch((error: unknown) => { logger.error("retention_crm_benchmarks_crashed", { error: error instanceof Error ? error.message : String(error) }); process.exitCode = 1; });
