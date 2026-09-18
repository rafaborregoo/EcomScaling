import { loadApiEnv } from "@ecomscaling/config";
import { runProductInventoryBenchmarksPlaybookEngineForAllOrganizations } from "@ecomscaling/api/product-inventory-benchmarks-engine";
import { createLogger } from "@ecomscaling/observability";
const logger = createLogger("product-inventory-benchmarks-worker");
runProductInventoryBenchmarksPlaybookEngineForAllOrganizations(loadApiEnv(process.env)).then((result) => { logger.info("product_inventory_benchmarks_completed", result); if (result.failed > 0) process.exitCode = 1; }).catch((error) => { logger.error("product_inventory_benchmarks_crashed", { error: error instanceof Error ? error.message : String(error) }); process.exitCode = 1; });
