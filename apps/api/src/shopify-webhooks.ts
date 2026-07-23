import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { shopifyGraphql } from "./shopify-client.js";
import { getValidShopifyAccessToken } from "./shopify-token-store.js";

type ApiEnv = LoadedApiEnv;

const logger = createLogger("shopify-webhooks");

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const SHOPIFY_WEBHOOK_TOPICS = [
  { graphqlTopic: "ORDERS_CREATE", restTopic: "orders/create" },
  { graphqlTopic: "ORDERS_UPDATED", restTopic: "orders/updated" },
  { graphqlTopic: "REFUNDS_CREATE", restTopic: "refunds/create" },
  { graphqlTopic: "PRODUCTS_UPDATE", restTopic: "products/update" },
  { graphqlTopic: "INVENTORY_LEVELS_UPDATE", restTopic: "inventory_levels/update" },
  // INT-01/R-010: sin app/uninstalled la conexion quedaba en "connected" para
  // siempre tras una desinstalacion hecha desde Shopify.
  { graphqlTopic: "APP_UNINSTALLED", restTopic: "app/uninstalled" },
] as const;

// customers/data_request, customers/redact y shop/redact NO se registran aqui:
// Shopify los trata como "compliance webhooks" configurados UNA VEZ en el
// Partner Dashboard (App setup > Compliance webhooks) con una URL fija que
// aplica a todas las tiendas de la app, no via webhookSubscriptionCreate por
// tienda. Requiere una accion manual (no de codigo): dar de alta esa URL
// (la misma `/v1/shopify/webhooks`) en el Partner Dashboard antes de que
// Shopify apruebe distribucion publica -- ver ADR-0011 e INT-01.
export const SHOPIFY_COMPLIANCE_WEBHOOK_TOPICS = [
  "customers/data_request",
  "customers/redact",
  "shop/redact",
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

/**
 * Reenvia el registro de webhooks a conexiones Shopify ya existentes.
 * registerShopifyWebhooks solo corre automaticamente en el callback OAuth de
 * conexiones nuevas -- las que ya estaban conectadas antes de que un topic se
 * anadiera a SHOPIFY_WEBHOOK_TOPICS (p. ej. app/uninstalled, INT-01/R-010)
 * nunca lo reciben salvo que se dispare esto manualmente. Es seguro repetir:
 * para los topics que una tienda ya tiene, Shopify responde un userError
 * ("ya existe") que registerShopifyWebhooks ya trata como no-fatal.
 */
export async function resendShopifyWebhookRegistrations(env: ApiEnv) {
  const supabase = createServiceClient(env);

  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider_account_id, status")
    .eq("provider", "shopify")
    .in("status", ["connected", "error"]);

  if (error) {
    throw new Error(`shopify_connections_lookup_failed: ${error.message}`);
  }

  const callbackUrl = shopifyWebhookCallbackUrl(env.SHOPIFY_REDIRECT_URI);
  let attempted = 0;
  let failed = 0;

  for (const connection of connections ?? []) {
    if (!connection.provider_account_id) {
      continue;
    }

    attempted += 1;

    try {
      const accessToken = await getValidShopifyAccessToken(env, connection.id);
      await registerShopifyWebhooks(connection.provider_account_id, accessToken, callbackUrl);
      logger.info("Shopify webhook registration resent", {
        connection_id: connection.id,
        organization_id: connection.organization_id,
        shop_domain: connection.provider_account_id,
      });
    } catch (resendError) {
      failed += 1;
      logger.error("Shopify webhook registration resend failed", {
        connection_id: connection.id,
        organization_id: connection.organization_id,
        error: resendError instanceof Error ? resendError.message : String(resendError),
      });
    }
  }

  return { attempted, failed };
}
