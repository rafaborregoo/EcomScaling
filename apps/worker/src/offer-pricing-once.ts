import { loadApiEnv } from "@e-nora/config";
import { runOfferPricingPlaybookEngineForAllOrganizations } from "@e-nora/api/offer-pricing-engine";
import { createLogger } from "@e-nora/observability";

const logger = createLogger("offer-pricing-worker");

runOfferPricingPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => {
    logger.info("offer_pricing_playbook_cron_completed", result);
    if (result.failed > 0) process.exitCode = 1;
  })
  .catch((error: unknown) => {
    logger.error("offer_pricing_playbook_cron_crashed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  });
