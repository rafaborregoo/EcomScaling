import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
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
  { graphqlTopic: "RETURNS_REQUEST", restTopic: "returns/request" },
  { graphqlTopic: "RETURNS_APPROVE", restTopic: "returns/approve" },
  { graphqlTopic: "RETURNS_PROCESS", restTopic: "returns/process" },
  { graphqlTopic: "RETURNS_CLOSE", restTopic: "returns/close" },
  { graphqlTopic: "RETURNS_UPDATE", restTopic: "returns/update" },
  { graphqlTopic: "RETURNS_CANCEL", restTopic: "returns/cancel" },
  { graphqlTopic: "RETURNS_DECLINE", restTopic: "returns/decline" },
  { graphqlTopic: "RETURNS_REOPEN", restTopic: "returns/reopen" },
  { graphqlTopic: "PRODUCTS_CREATE", restTopic: "products/create" },
  { graphqlTopic: "PRODUCTS_UPDATE", restTopic: "products/update" },
  { graphqlTopic: "PRODUCTS_DELETE", restTopic: "products/delete" },
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

export function shopifyWebhookCallbackUrl(redirectUri: string, publicBaseUrl?: string) {
  return `${new URL(publicBaseUrl ?? redirectUri).origin}/v1/shopify/webhooks`;
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

export async function registerShopifyWebhooks(
  shopDomain: string,
  accessToken: string,
  callbackUrl: string,
  organizationId?: string,
) {
  const failed: Array<{ topic: string; error: string }> = [];
  let confirmed = 0;
  const subscriptions: Array<{ id: string; topic: string; uri: string }> = [];
  try {
    if (new URL(callbackUrl).protocol !== "https:") throw new Error("webhook_public_https_required");
    let after: string | null = null;
    do {
      const page: { webhookSubscriptions: { nodes: Array<{ id: string; topic: string; uri: string }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } = await shopifyGraphql(
        shopDomain, accessToken,
        `query IntegrationWebhooks($after: String) {
          webhookSubscriptions(first: 100, after: $after) {
            nodes { id topic uri }
            pageInfo { hasNextPage endCursor }
          }
        }`, { after },
      );
      subscriptions.push(...page.webhookSubscriptions.nodes);
      const next = page.webhookSubscriptions.pageInfo;
      if (!next.hasNextPage) break;
      if (!next.endCursor || next.endCursor === after) throw new Error("webhook_subscription_pagination_invalid");
      after = next.endCursor;
    } while (after);
  } catch (error) {
    failed.push({ topic: "subscriptions", error: error instanceof Error ? error.message : String(error) });
  }
  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    if (failed.some((item) => item.topic === "subscriptions")) break;
    try {
      const existing = subscriptions.find((item) => item.topic === topic.graphqlTopic && item.uri === callbackUrl)
        ?? subscriptions.find((item) => item.topic === topic.graphqlTopic);
      if (existing?.uri === callbackUrl) { confirmed += 1; continue; }
      if (existing) {
        const updated = await shopifyGraphql<{ webhookSubscriptionUpdate: { userErrors: Array<{ message: string }> } }>(
          shopDomain, accessToken,
          `mutation IntegrationWebhookUpdate($id: ID!, $input: WebhookSubscriptionInput!) {
            webhookSubscriptionUpdate(id: $id, webhookSubscription: $input) { userErrors { message } }
          }`, { id: existing.id, input: { uri: callbackUrl } },
        );
        if (updated.webhookSubscriptionUpdate.userErrors.length) throw new Error(updated.webhookSubscriptionUpdate.userErrors.map((item) => item.message).join("; "));
        confirmed += 1;
        continue;
      }
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
          organization_id: organizationId,
          topic: topic.graphqlTopic,
          errors: userErrors.map((item) => item.message).join("; "),
        });
        failed.push({ topic: topic.graphqlTopic, error: userErrors.map((item) => item.message).join("; ") });
        continue;
      }

      confirmed += 1;

      logger.info("Shopify webhook subscription registered", {
        shop_domain: shopDomain,
        organization_id: organizationId,
        topic: topic.graphqlTopic,
        subscription_id: result.webhookSubscriptionCreate.webhookSubscription?.id,
      });
    } catch (error) {
      failed.push({ topic: topic.graphqlTopic, error: error instanceof Error ? error.message : String(error) });
      logger.error("Shopify webhook subscription failed", {
        shop_domain: shopDomain,
        organization_id: organizationId,
        topic: topic.graphqlTopic,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const result = { status: failed.length ? "failed" : "healthy", confirmed, expected: SHOPIFY_WEBHOOK_TOPICS.length, checked_at: new Date().toISOString(), callback_url: callbackUrl, failures: failed.map((item) => ({ topic: item.topic, error: item.error.slice(0,300) })) };
  return result;
}

export async function persistShopifyWebhookHealth(env: ApiEnv, connectionId: string, health: Awaited<ReturnType<typeof registerShopifyWebhooks>>) {
  const { error } = await createServiceClient(env).rpc("set_integration_webhook_health", { target_connection: connectionId, health });
  if (error) throw new Error(`shopify_webhook_health_store_failed: ${error.message}`);
}

export async function ensureShopifyWebhooks(env: ApiEnv, connectionId: string, force = false) {
  const client = createServiceClient(env);
  const { data: connection, error } = await client.from("integration_connections")
    .select("provider_account_id, organization_id, metadata").eq("id", connectionId).eq("provider", "shopify").single();
  if (error || !connection) throw new Error(`shopify_webhook_connection_lookup_failed: ${error?.message}`);
  const callbackUrl = shopifyWebhookCallbackUrl(env.SHOPIFY_REDIRECT_URI, env.INTEGRATION_WEBHOOK_BASE_URL);
  const previous = connection.metadata?.webhooks as { status?: string; checked_at?: string; callback_url?: string } | undefined;
  if (!force && previous?.status === "healthy" && previous.callback_url === callbackUrl &&
    Date.now() - Date.parse(previous.checked_at ?? "") < 60 * 60 * 1000) return previous;
  const accessToken = await getValidShopifyAccessToken(env, connectionId);
  const result = await registerShopifyWebhooks(connection.provider_account_id, accessToken, callbackUrl, connection.organization_id);
  await persistShopifyWebhookHealth(env, connectionId, result);
  return result;
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

  const callbackUrl = shopifyWebhookCallbackUrl(env.SHOPIFY_REDIRECT_URI, env.INTEGRATION_WEBHOOK_BASE_URL);
  let attempted = 0;
  let failed = 0;

  for (const connection of connections ?? []) {
    if (!connection.provider_account_id) {
      continue;
    }

    attempted += 1;

    try {
      const accessToken = await getValidShopifyAccessToken(env, connection.id);
      const result = await registerShopifyWebhooks(connection.provider_account_id, accessToken, callbackUrl, connection.organization_id);
      await persistShopifyWebhookHealth(env, connection.id, result);
      if (result.status !== "healthy") failed += 1;
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
