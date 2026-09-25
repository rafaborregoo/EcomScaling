import { loadApiEnv } from "@e-nora/config";
import { runOfferPricingBenchmarksPlaybookEngineForAllOrganizations } from "@e-nora/api/offer-pricing-benchmarks-engine";
import { createLogger } from "@e-nora/observability";
const logger = createLogger("offer-pricing-benchmarks-worker");
runOfferPricingBenchmarksPlaybookEngineForAllOrganizations(loadApiEnv(process.env)).then((result) => { logger.info("offer_pricing_benchmarks_completed", result); if (result.failed > 0) process.exitCode = 1; }).catch((error: unknown) => { logger.error("offer_pricing_benchmarks_crashed", { error: error instanceof Error ? error.message : String(error) }); process.exitCode = 1; });
