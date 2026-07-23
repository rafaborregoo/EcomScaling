import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { resendShopifyWebhookRegistrations } from "@ecomscaling/api/shopify-webhooks";

const logger = createLogger("shopify-resend-webhooks-once");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Resending Shopify webhook registrations to existing connections");

  const result = await resendShopifyWebhookRegistrations(env);

  logger.info("Shopify webhook resend completed", result);

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  logger.error("Shopify webhook resend crashed", error);
  process.exit(1);
});
