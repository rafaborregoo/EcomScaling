import crypto from "node:crypto";
import { createLogger } from "@ecomscaling/observability";
import { shopifyGraphql } from "./shopify-client.js";

const logger = createLogger("shopify-webhooks");

export const SHOPIFY_WEBHOOK_TOPICS = [
  { graphqlTopic: "ORDERS_CREATE", restTopic: "orders/create" },
  { graphqlTopic: "ORDERS_UPDATED", restTopic: "orders/updated" },
  { graphqlTopic: "REFUNDS_CREATE", restTopic: "refunds/create" },
  { graphqlTopic: "PRODUCTS_UPDATE", restTopic: "products/update" },
  { graphqlTopic: "INVENTORY_LEVELS_UPDATE", restTopic: "inventory_levels/update" },
] as const;

export function shopifyWebhookCallbackUrl(redirectUri: string) {
  return `${new URL(redirectUri).origin}/v1/shopify/webhooks`;
}

export function verifyShopifyWebhookHmac(rawBody: Buffer, hmacHeader: string | undefined, secret: string) {
  if (!hmacHeader) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest();

  let providedDigest: Buffer;
  try {
    providedDigest = Buffer.from(hmacHeader, "base64");
  } catch {
    return false;
  }

  if (providedDigest.length !== digest.length) {
    return false;
  }

  return crypto.timingSafeEqual(digest, providedDigest);
}

export async function registerShopifyWebhooks(shopDomain: string, accessToken: string, callbackUrl: string) {
  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    try {
      const result = await shopifyGraphql<{
        webhookSubscriptionCreate: {
          webhookSubscription: { id: string } | null;
          userErrors: Array<{ field: string[] | null; message: string }>;
        };
      }>(
        shopDomain,
        accessToken,
        `
          mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
              webhookSubscription { id }
              userErrors { field message }
            }
          }
        `,
        {
          topic: topic.graphqlTopic,
          webhookSubscription: { uri: callbackUrl },
        },
      );

      const userErrors = result.webhookSubscriptionCreate.userErrors;

      if (userErrors?.length) {
        logger.info("Shopify webhook subscription skipped", {
          shop_domain: shopDomain,
          topic: topic.graphqlTopic,
          errors: userErrors.map((item) => item.message).join("; "),
        });
        continue;
      }

      logger.info("Shopify webhook subscription registered", {
        shop_domain: shopDomain,
        topic: topic.graphqlTopic,
        subscription_id: result.webhookSubscriptionCreate.webhookSubscription?.id,
      });
    } catch (error) {
      logger.error("Shopify webhook subscription failed", {
        shop_domain: shopDomain,
        topic: topic.graphqlTopic,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
