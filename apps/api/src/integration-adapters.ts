import {
  deriveIntegrationHealth,
  INTEGRATION_CATALOG,
  IntegrationError,
  type IntegrationAdapter,
  type IntegrationConnection,
  type IntegrationProvider,
  type IntegrationSyncAdapter,
  type IntegrationSyncInput,
  type IntegrationSyncResult,
} from "@e-nora/integrations";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  buildMetaAuthUrl,
  exchangeMetaCodeForLongLivedToken,
  resolveMetaAppEnv,
} from "./meta-oauth.js";
import { discoverMetaAssets, getValidMetaAccessToken } from "./meta.js";
import { runMetaSync } from "./meta-sync.js";
import { handleShopifyWebhookRequest } from "./shopify-webhook-handler.js";
import { verifyShopifyWebhookHmac } from "./shopify-webhooks.js";
import {
  buildShopifyAuthorizeUrl,
  exchangeShopifyCodeForToken,
  resolveShopifyAppEnv,
  type ShopifyAppMode,
} from "./shopify-oauth.js";
import { getValidShopifyAccessToken } from "./shopify-token-store.js";
import { runShopifyInitialSync } from "./shopify-sync.js";
import {
  buildKlaviyoAuthorizeUrl,
  exchangeKlaviyoCodeForTokens,
  resolveKlaviyoOAuthEnv,
} from "./klaviyo-oauth.js";
import { getValidKlaviyoAccessToken } from "./klaviyo-token-store.js";
import { runKlaviyoSync } from "./klaviyo-sync.js";

type SyncRunner = (
  connectionId: string,
  mode: IntegrationSyncInput["mode"],
) => Promise<void>;

function result(
  status: IntegrationSyncResult["status"],
): IntegrationSyncResult {
  // Los runners existentes persisten métricas por bloque en integration_sync_runs.
  // No inventamos contadores aquí: el adaptador solo normaliza el resultado global.
  return { status };
}

function createAdapter(
  provider: Extract<IntegrationProvider, "shopify" | "meta_ads">,
  run: SyncRunner,
): IntegrationSyncAdapter {
  const catalogEntry = INTEGRATION_CATALOG.find((item) => item.id === provider);

  if (!catalogEntry) {
    throw new Error(`integration_catalog_entry_missing:${provider}`);
  }

  const execute = async (input: IntegrationSyncInput) => {
    try {
      await run(input.connection.id, input.mode);
      return result("succeeded");
    } catch (error) {
      // El runner ya registra el detalle y el estado de sus bloques; el caller
      // conserva el error original para logging/estado de la API.
      throw error;
    }
  };

  return {
    provider,
    capabilities: catalogEntry.capabilities,
    runInitialSync: (input) => execute({ ...input, mode: "initial" }),
    runIncrementalSync: (input) => execute({ ...input, mode: "incremental" }),
  };
}

export function createIntegrationSyncAdapters(env: LoadedApiEnv) {
  return {
    shopify: createAdapter("shopify", (connectionId, mode) =>
      runShopifyInitialSync(
        env,
        connectionId,
        mode === "incremental" ? "incremental" : "manual",
      ),
    ),
    meta_ads: createAdapter("meta_ads", (connectionId, mode) =>
      runMetaSync(
        env,
        connectionId,
        mode === "incremental" ? "incremental" : "initial",
      ),
    ),
  } satisfies Record<"shopify" | "meta_ads", IntegrationSyncAdapter>;
}

function connectionHealth(connection: IntegrationConnection) {
  return deriveIntegrationHealth({
    available: true,
    connectionStatus: connection.status,
    lastSyncAt: connection.lastSyncAt ?? null,
    lastErrorAt: connection.lastErrorAt ?? null,
    latestSyncStatus: connection.latestSyncStatus ?? null,
  });
}

function integrationFailure(
  code: ConstructorParameters<typeof IntegrationError>[0],
  provider: IntegrationConnection["provider"],
  message: string,
  userActionRequired = false,
) {
  return new IntegrationError(
    code,
    provider,
    message,
    false,
    userActionRequired,
  );
}

/**
 * Adapter de contrato para conectores que todavía no tienen credenciales ni
 * runner real. Mantiene el mismo ciclo de vida y permite que API/UI expresen
 * `not_available` sin aparentar que se ha conectado o sincronizado nada.
 */
function createUnavailableAdapter(
  provider: Extract<IntegrationProvider, "instagram">,
): IntegrationAdapter {
  const catalogEntry = INTEGRATION_CATALOG.find((item) => item.id === provider);
  if (!catalogEntry) {
    throw new Error(`integration_catalog_entry_missing:${provider}`);
  }

  const unavailable = async (): Promise<never> => {
    throw integrationFailure(
      "CREDENTIALS_MISSING",
      provider,
      `${provider}_connector_not_enabled`,
      true,
    );
  };

  return {
    provider,
    capabilities: catalogEntry.capabilities,
    buildAuthorizationUrl: unavailable,
    exchangeAuthorizationCode: unavailable,
    refreshCredentials: unavailable,
    discoverAssets: unavailable,
    runInitialSync: unavailable,
    runIncrementalSync: unavailable,
    getConnectionHealth: async (connection) =>
      deriveIntegrationHealth({
        available: false,
        connectionStatus: connection.status,
        lastSyncAt: connection.lastSyncAt ?? null,
        lastErrorAt: connection.lastErrorAt ?? null,
        latestSyncStatus: connection.latestSyncStatus ?? null,
      }),
  };
}

/** Full lifecycle adapters over the existing provider implementations. */
export function createIntegrationAdapters(env: LoadedApiEnv): {
  shopify: IntegrationAdapter;
  meta_ads: IntegrationAdapter;
  klaviyo: IntegrationAdapter;
  instagram: IntegrationAdapter;
} {
  const shopify: IntegrationAdapter = {
    provider: "shopify",
    capabilities: INTEGRATION_CATALOG.find((item) => item.id === "shopify")!
      .capabilities,
    buildAuthorizationUrl: async (context) => {
      if (!context.shopDomain) {
        throw integrationFailure(
          "EXTERNAL_RESOURCE_NOT_FOUND",
          "shopify",
          "shopify_shop_domain_required",
          true,
        );
      }
      const appMode: ShopifyAppMode = context.appMode ?? "public";
      const appEnv = resolveShopifyAppEnv(env, appMode);
      const result = buildShopifyAuthorizeUrl(
        { ...appEnv, SHOPIFY_REDIRECT_URI: context.redirectUri },
        context.shopDomain,
        context.state,
      );
      return { url: result.url };
    },
    exchangeAuthorizationCode: async (input) => {
      if (!input.shopDomain) {
        throw integrationFailure(
          "EXTERNAL_RESOURCE_NOT_FOUND",
          "shopify",
          "shopify_shop_domain_required",
          true,
        );
      }
      const appEnv = resolveShopifyAppEnv(env, input.appMode ?? "public");
      await exchangeShopifyCodeForToken(appEnv, input.shopDomain, input.code);
      return { provider: "shopify", externalAccountId: input.shopDomain };
    },
    refreshCredentials: async (connection) => {
      await getValidShopifyAccessToken(env, connection.id);
      return {};
    },
    runInitialSync: (input) =>
      createIntegrationSyncAdapters(env).shopify.runInitialSync(input),
    runIncrementalSync: (input) =>
      createIntegrationSyncAdapters(env).shopify.runIncrementalSync(input),
    verifyWebhook: async (request) => {
      const hmac = request.headers["x-shopify-hmac-sha256"];
      const secrets = [
        env.SHOPIFY_API_SECRET,
        env.SHOPIFY_CUSTOM_API_SECRET,
      ].filter((secret): secret is string => Boolean(secret));
      const valid = secrets.some((secret) =>
        verifyShopifyWebhookHmac(Buffer.from(request.body), hmac, secret),
      );
      if (!valid) {
        throw integrationFailure(
          "INVALID_WEBHOOK_SIGNATURE",
          "shopify",
          "shopify_webhook_signature_invalid",
          true,
        );
      }
      let payload: unknown;
      try {
        payload = JSON.parse(request.body);
      } catch {
        throw integrationFailure(
          "INVALID_WEBHOOK_SIGNATURE",
          "shopify",
          "shopify_webhook_payload_invalid",
        );
      }
      return {
        provider: "shopify",
        topic: request.headers["x-shopify-topic"] ?? "unknown",
        payload,
        rawBody: request.body,
        headers: request.headers,
      };
    },
    processWebhook: async (webhook) => {
      if (!webhook.rawBody || !webhook.headers) {
        throw integrationFailure(
          "INVALID_WEBHOOK_SIGNATURE",
          "shopify",
          "shopify_webhook_context_missing",
        );
      }
      const result = await handleShopifyWebhookRequest(
        env,
        webhook.headers,
        Buffer.from(webhook.rawBody),
      );
      if (result.statusCode >= 400) {
        throw integrationFailure(
          result.statusCode === 401
            ? "INVALID_WEBHOOK_SIGNATURE"
            : "SYNC_PERMANENT_FAILURE",
          "shopify",
          typeof result.body.error === "string"
            ? result.body.error
            : "shopify_webhook_failed",
          result.statusCode === 401,
        );
      }
      return {
        processed: result.body.status === "processed",
        duplicate: result.body.status === "duplicate",
      };
    },
    getConnectionHealth: async (connection) => connectionHealth(connection),
  };

  const meta: IntegrationAdapter = {
    provider: "meta_ads",
    capabilities: INTEGRATION_CATALOG.find((item) => item.id === "meta_ads")!
      .capabilities,
    buildAuthorizationUrl: async (context) => {
      const appEnv = resolveMetaAppEnv(env);
      if (!appEnv) {
        throw integrationFailure(
          "CREDENTIALS_MISSING",
          "meta_ads",
          "meta_app_not_configured",
          true,
        );
      }
      return {
        url: buildMetaAuthUrl(
          { ...appEnv, META_REDIRECT_URI: context.redirectUri },
          context.state,
        ),
      };
    },
    exchangeAuthorizationCode: async (input) => {
      const appEnv = resolveMetaAppEnv(env);
      if (!appEnv) {
        throw integrationFailure(
          "CREDENTIALS_MISSING",
          "meta_ads",
          "meta_app_not_configured",
          true,
        );
      }
      await exchangeMetaCodeForLongLivedToken(appEnv, input.code);
      return { provider: "meta_ads" };
    },
    refreshCredentials: async (connection) => {
      const token = await getValidMetaAccessToken(env, connection.id);
      if (!token) {
        throw integrationFailure(
          "REAUTHORIZATION_REQUIRED",
          "meta_ads",
          "meta_token_expired_reauth_required",
          true,
        );
      }
      return {};
    },
    discoverAssets: async (connection) => {
      const token = await getValidMetaAccessToken(env, connection.id);
      if (!token) {
        throw integrationFailure(
          "REAUTHORIZATION_REQUIRED",
          "meta_ads",
          "meta_token_unavailable",
          true,
        );
      }
      const discovery = await discoverMetaAssets(
        env,
        connection.id,
        connection.organizationId,
        token,
      );
      return discovery.assets;
    },
    runInitialSync: (input) =>
      createIntegrationSyncAdapters(env).meta_ads.runInitialSync(input),
    runIncrementalSync: (input) =>
      createIntegrationSyncAdapters(env).meta_ads.runIncrementalSync(input),
    getConnectionHealth: async (connection) => connectionHealth(connection),
  };

  const klaviyoEnv = resolveKlaviyoOAuthEnv(env);
  const klaviyo: IntegrationAdapter = {
    provider: "klaviyo",
    capabilities: INTEGRATION_CATALOG.find((item) => item.id === "klaviyo")!
      .capabilities,
    buildAuthorizationUrl: async (context) => {
      if (!klaviyoEnv)
        throw integrationFailure(
          "CREDENTIALS_MISSING",
          "klaviyo",
          "klaviyo_app_not_configured",
          true,
        );
      if (!context.codeChallenge)
        throw integrationFailure(
          "INVALID_AUTHORIZATION_STATE",
          "klaviyo",
          "klaviyo_pkce_challenge_required",
          true,
        );
      return {
        url: buildKlaviyoAuthorizeUrl(
          klaviyoEnv,
          context.state,
          context.codeChallenge,
        ),
      };
    },
    exchangeAuthorizationCode: async (input) => {
      if (!klaviyoEnv)
        throw integrationFailure(
          "CREDENTIALS_MISSING",
          "klaviyo",
          "klaviyo_app_not_configured",
          true,
        );
      if (!input.codeVerifier)
        throw integrationFailure(
          "INVALID_AUTHORIZATION_STATE",
          "klaviyo",
          "klaviyo_pkce_verifier_required",
          true,
        );
      const tokens = await exchangeKlaviyoCodeForTokens(
        klaviyoEnv,
        input.code,
        input.codeVerifier,
      );
      return { provider: "klaviyo" };
    },
    refreshCredentials: async (connection) => {
      await getValidKlaviyoAccessToken(env, connection.id);
      return {};
    },
    runInitialSync: (input) =>
      runKlaviyoSync(env, input.connection.id, "initial").then((sync) => ({
        status: sync.status,
        recordsRead: sync.recordsRead,
        recordsWritten: sync.recordsWritten,
      })),
    runIncrementalSync: (input) =>
      runKlaviyoSync(env, input.connection.id, "incremental").then((sync) => ({
        status: sync.status,
        recordsRead: sync.recordsRead,
        recordsWritten: sync.recordsWritten,
      })),
    getConnectionHealth: async (connection) => connectionHealth(connection),
  };

  return {
    shopify,
    meta_ads: meta,
    klaviyo,
    instagram: createUnavailableAdapter("instagram"),
  };
}

export function toIntegrationConnection(row: {
  id: string;
  organization_id: string;
  provider: IntegrationProvider;
  status: string;
  store_id?: string | null;
  last_sync_at?: string | null;
  last_error_at?: string | null;
  latest_sync_status?: string | null;
}): IntegrationConnection {
  const status = [
    "pending",
    "connected",
    "syncing",
    "error",
    "disconnected",
    "revoked",
  ].includes(row.status)
    ? row.status
    : "error";

  const connection: IntegrationConnection = {
    id: row.id,
    organizationId: row.organization_id,
    provider: row.provider,
    status: status as IntegrationConnection["status"],
  };

  if (row.store_id !== undefined) {
    connection.storeId = row.store_id;
  }
  if (row.last_sync_at !== undefined) connection.lastSyncAt = row.last_sync_at;
  if (row.last_error_at !== undefined)
    connection.lastErrorAt = row.last_error_at;
  if (row.latest_sync_status !== undefined)
    connection.latestSyncStatus = row.latest_sync_status;

  return connection;
}
