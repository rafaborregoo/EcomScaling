import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runBenchmarkGuardrailsPlaybookEngineForAllOrganizations } from "@ecomscaling/api/benchmark-guardrails-engine";

const logger = createLogger("benchmark-guardrails-worker");
runBenchmarkGuardrailsPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("benchmark_guardrails_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("benchmark_guardrails_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
