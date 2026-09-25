import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { runProductInventoryPlaybookEngineForAllOrganizations } from "@e-nora/api/product-inventory-engine";

const logger = createLogger("product-inventory-worker");

runProductInventoryPlaybookEngineForAllOrganizations(loadApiEnv(process.env))
  .then((result) => logger.info("product_inventory_playbook_cron_completed", result))
  .catch((error: unknown) => {
    logger.error("product_inventory_playbook_cron_crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
