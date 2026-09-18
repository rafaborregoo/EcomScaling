import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runProductInventoryPlaybookEngineForAllOrganizations } from "@ecomscaling/api/product-inventory-engine";

const logger = createLogger("product-inventory-worker");

runProductInventoryPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("product_inventory_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("product_inventory_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
