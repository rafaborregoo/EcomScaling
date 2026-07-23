import { writeFileSync } from "node:fs";
import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runOpsHealthCheck } from "@ecomscaling/api/ops-health-check";

const logger = createLogger("ops-health-check-cron");
const OUTPUT_PATH = process.env.OPS_HEALTH_CHECK_OUTPUT ?? "ops-health-findings.json";

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting ops health check");

  const result = await runOpsHealthCheck(env);

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  logger.info("Ops health check completed", { findingsCount: result.findings.length });

  if (result.findings.length > 0) {
    for (const finding of result.findings) {
      logger.info(`[ops-alert] ${finding.summary}`, finding);
    }
  }
}

main().catch((error: unknown) => {
  logger.error("Ops health check crashed", error);
  process.exit(1);
});
