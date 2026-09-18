import { loadApiEnv } from "@ecomscaling/config";
import { runInterventionEligibilityEngineForAllOrganizations } from "@ecomscaling/api/intervention-eligibility-engine";
import { createLogger } from "@ecomscaling/observability";

const logger = createLogger("intervention-eligibility-worker");

runInterventionEligibilityEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => {
    logger.info("intervention_eligibility_completed", result);
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((error) => {
    logger.error("intervention_eligibility_crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
