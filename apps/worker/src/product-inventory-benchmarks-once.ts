import { loadApiEnv } from "@e-nora/config";
import { runProductInventoryBenchmarksPlaybookEngineForAllOrganizations } from "@e-nora/api/product-inventory-benchmarks-engine";
import { createLogger } from "@e-nora/observability";
const logger = createLogger("product-inventory-benchmarks-worker");
runProductInventoryBenchmarksPlaybookEngineForAllOrganizations(loadApiEnv(process.env)).then((result) => { logger.info("product_inventory_benchmarks_completed", result); if (result.failed > 0) process.exitCode = 1; }).catch((error) => { logger.error("product_inventory_benchmarks_crashed", { error: error instanceof Error ? error.message : String(error) }); process.exitCode = 1; });
