import { loadApiEnv } from "@e-nora/config";
import { runDecisionBlocksEngineForAllOrganizations } from "@e-nora/api/decision-blocks-engine";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("decision-blocks-worker");

runDecisionBlocksEngineForAllOrganizations(loadApiEnv(process.env))
  .then((summary) => {
    logger.info("decision_blocks_completed", summary);
    if (summary.failed) process.exitCode = 1;
  })
  .catch((error) => {
    logger.error("decision_blocks_failed", { error: String(error) });
    process.exitCode = 1;
  });
