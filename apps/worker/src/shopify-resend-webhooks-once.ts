import { loadApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { resendShopifyWebhookRegistrations } from "@e-nora/api/shopify-webhooks";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("shopify-resend-webhooks-once");
const jobContext = createWorkerJobContext("shopify-resend-webhooks-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info(
    "Resending Shopify webhook registrations to existing connections",
    workerJobMeta(jobContext),
  );

  const result = await resendShopifyWebhookRegistrations(env);

  logger.info(
    "Shopify webhook resend completed",
    workerJobMeta(jobContext, result),
  );

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Shopify webhook resend crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
