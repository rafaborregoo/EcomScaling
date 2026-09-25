import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runBenchmarkGuardrailsPlaybookEngineForAllOrganizations } from "@e-nora/api/benchmark-guardrails-engine";

const logger = createLogger("benchmark-guardrails-worker");
runBenchmarkGuardrailsPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("benchmark_guardrails_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("benchmark_guardrails_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
