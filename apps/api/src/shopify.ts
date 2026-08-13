import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { AuthContext } from "./auth-context.js";
import {
  createShopifyState,
  exchangeShopifyCodeForToken,
  parseProviderAccountName,
  resolveShopifyAppEnv,
  type ShopifyAppMode,
  type ShopifyMultiAppEnv,
  type ShopifyOAuthEnv,
  verifyShopifyHmac,
} from "./shopify-oauth.js";
import {
  createIntegrationAdapters,
  toIntegrationConnection,
} from "./integration-adapters.js";
import {
  resolveCredentialSecret,
  saveShopifyTokens,
} from "./shopify-token-store.js";
import {
  registerShopifyWebhooks,
  shopifyWebhookCallbackUrl,
} from "./shopify-webhooks.js";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { isIntegrationFeatureEnabled } from "@ecomscaling/integrations";
import { recordAuditLog } from "./audit-log.js";

type ApiEnv = LoadedApiEnv & ShopifyMultiAppEnv;

type Result =
  | { ok: true; data: { redirectUrl: string } }
  | {
      ok: false;
      statusCode: number;
      error: string;
      message?: string;
      detail?: string;
    };

type SyncTriggerResult =
  | { ok: true; data: { status: string; connectionId: string } }
  | {
      ok: false;
      statusCode: number;
      error: string;
      message?: string;
      detail?: string;
    };

export const STALE_SYNCING_MS = 10 * 60 * 1000;

function createServiceClient(env: ApiEnv) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Shopify OAuth");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: WebSocket as any,
    },
  });
}

function normalizeShopDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
}

function parseState(metadata: unknown) {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "state" in metadata
  ) {
    const value = (metadata as Record<string, unknown>).state;
    return typeof value === "string" ? value : null;
  }

  return null;
}

function parseAppMode(metadata: unknown): ShopifyAppMode {
  if (
    typeof metadata === "object" &&
    metadata !== null &&
    "app_mode" in metadata
  ) {
    const value = (metadata as Record<string, unknown>).app_mode;
    if (value === "custom") {
      return "custom";
    }
  }

  return "public";
}

export async function createShopifyConnectionAuthUrl(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
  shopDomainInput: string,
  appMode: ShopifyAppMode = "public",
): Promise<Result> {
  if (!isIntegrationFeatureEnabled("shopify", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false,
      statusCode: 404,
      error: "integration_disabled",
      message: "La integracion Shopify esta desactivada por feature flag.",
    };
  }

  const shopDomain = normalizeShopDomain(shopDomainInput);

  let appEnv: ShopifyOAuthEnv;
  try {
    appEnv = resolveShopifyAppEnv(env, appMode);
  } catch {
    return {
      ok: false,
      statusCode: 400,
      error: "shopify_custom_app_not_configured",
      message:
        "La app Shopify de distribucion personalizada no esta configurada todavia.",
    };
  }

  if (!authContext.profile.is_active) {
    return {
      ok: false,
      statusCode: 403,
      error: "inactive_user",
      message: "El usuario autenticado no esta activo.",
    };
  }

  if (!/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/.test(shopDomain)) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_shop_domain",
      message: "El dominio debe terminar en .myshopify.com",
    };
  }

  const membership = authContext.memberships.find(
    (item) => item.organization_id === organizationId,
  );

  if (!membership) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  if (
    authContext.profile.platform_role !== "platform_admin" &&
    !["owner", "manager"].includes(membership.role)
  ) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_manage_denied",
      message: "Solo owner, manager o platform admin pueden conectar Shopify.",
    };
  }

  const state = createShopifyState();
  const supabase = createServiceClient(env);

  const { error } = await supabase.from("integration_connections").upsert(
    {
      organization_id: organizationId,
      provider: "shopify",
      provider_account_id: shopDomain,
      provider_account_name: parseProviderAccountName(shopDomain),
      status: "pending",
      metadata: {
        state,
        shop_domain: shopDomain,
        source: "oauth_start",
        app_mode: appMode,
      },
    },
    { onConflict: "organization_id,provider,provider_account_id" },
  );

  if (error) {
    return {
      ok: false,
      statusCode: 500,
      error: "shopify_connection_seed_failed",
      detail: error.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: authContext.user.id,
    action: "shopify.oauth_started",
    entityType: "integration_connection",
    newData: {
      provider: "shopify",
      shop_domain: shopDomain,
      app_mode: appMode,
    },
  });

  const authorization = await createIntegrationAdapters(
    env,
  ).shopify.buildAuthorizationUrl({
    organizationId,
    shopDomain,
    appMode,
    redirectUri: appEnv.SHOPIFY_REDIRECT_URI,
    state,
  });

  return {
    ok: true,
    data: {
      redirectUrl: authorization.url,
    },
  };
}

export async function triggerShopifySync(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
  connectionId?: string,
): Promise<SyncTriggerResult> {
  if (!isIntegrationFeatureEnabled("shopify", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false,
      statusCode: 404,
      error: "integration_disabled",
      message: "La integracion Shopify esta desactivada por feature flag.",
    };
  }

  if (!authContext.profile.is_active) {
    return {
      ok: false,
      statusCode: 403,
      error: "inactive_user",
      message: "El usuario autenticado no esta activo.",
    };
  }

  const membership = authContext.memberships.find(
    (item) => item.organization_id === organizationId,
  );

  if (!membership) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  if (
    authContext.profile.platform_role !== "platform_admin" &&
    !["owner", "manager"].includes(membership.role)
  ) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_manage_denied",
      message:
        "Solo owner, manager o platform admin pueden sincronizar Shopify.",
    };
  }

  const supabase = createServiceClient(env);

  let connectionQuery = supabase
    .from("integration_connections")
    .select("id, organization_id, status, updated_at")
    .eq("organization_id", organizationId)
    .eq("provider", "shopify");

  if (connectionId) {
    connectionQuery = connectionQuery.eq("id", connectionId);
  }

  const { data: connection, error: connectionError } = await connectionQuery
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectionError) {
    return {
      ok: false,
      statusCode: 500,
      error: "shopify_connection_load_failed",
      detail: connectionError.message,
    };
  }

  if (!connection) {
    return {
      ok: false,
      statusCode: 404,
      error: "shopify_connection_not_found",
    };
  }

  if (connection.status === "syncing") {
    const updatedAt = connection.updated_at
      ? new Date(connection.updated_at).getTime()
      : Date.now();
    const isStale = Date.now() - updatedAt > STALE_SYNCING_MS;

    if (!isStale) {
      return {
        ok: false,
        statusCode: 409,
        error: "shopify_sync_already_running",
        message:
          "Ya hay una sincronizacion de Shopify en curso para esta organizacion.",
      };
    }

    await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message:
          "La sincronizacion anterior quedo abierta y fue marcada como error automaticamente.",
      })
      .eq("id", connection.id);
  }

  if (connection.status !== "connected" && connection.status !== "error") {
    return {
      ok: false,
      statusCode: 409,
      error: "shopify_connection_not_ready",
      message:
        "La conexion Shopify debe estar conectada antes de poder sincronizar.",
    };
  }

  const { error: statusUpdateError } = await supabase
    .from("integration_connections")
    .update({ status: "syncing" })
    .eq("id", connection.id);

  if (statusUpdateError) {
    return {
      ok: false,
      statusCode: 500,
      error: "shopify_sync_trigger_failed",
      detail: statusUpdateError.message,
    };
  }

  const shopifySyncAdapter = createIntegrationAdapters(env).shopify;
  void shopifySyncAdapter
    .runInitialSync({
      mode: "initial",
      connection: toIntegrationConnection({
        id: connection.id,
        organization_id: connection.organization_id,
        provider: "shopify",
        status: connection.status,
      }),
    })
    .catch(async (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "shopify_manual_sync_background_failed";
      await supabase
        .from("integration_connections")
        .update({
          status: "error",
          last_error_at: new Date().toISOString(),
          last_error_message: message,
        })
        .eq("id", connection.id);

      console.error("Shopify manual sync failed", {
        connection_id: connection.id,
        organization_id: organizationId,
        error: message,
      });
    });

  return {
    ok: true,
    data: {
      status: "syncing",
      connectionId: connection.id,
    },
  };
}

export async function handleShopifyOAuthCallback(
  env: ApiEnv,
  query: Record<string, string | string[] | undefined>,
): Promise<Result> {
  const shop =
    typeof query.shop === "string" ? normalizeShopDomain(query.shop) : null;
  const code = typeof query.code === "string" ? query.code : null;
  // Instalaciones gestionadas por Shopify (enlace de custom distribution del Dev
  // Dashboard) llegan sin nuestro state; en ese caso la garantia de autenticidad es el
  // HMAC y la conexion pendiente sembrada por dominio desde /integraciones.
  const state = typeof query.state === "string" ? query.state : null;

  if (!shop || !code) {
    return {
      ok: false,
      statusCode: 400,
      error: "missing_oauth_parameters",
    };
  }

  const supabase = createServiceClient(env);
  const { data: connections, error: lookupError } = await supabase
    .from("integration_connections")
    .select(
      "id, organization_id, provider, provider_account_id, provider_account_name, status, metadata",
    )
    .eq("provider", "shopify")
    .eq("provider_account_id", shop)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (lookupError) {
    return {
      ok: false,
      statusCode: 500,
      error: "shopify_pending_connection_lookup_failed",
      detail: lookupError.message,
    };
  }

  const pending =
    (connections ?? []).find(
      (connection) => parseState(connection.metadata) === state,
    ) ?? (connections ?? [])[0];

  const pendingConnection = pending as
    | {
        id: string;
        organization_id: string;
        metadata: unknown;
      }
    | undefined;

  if (!pendingConnection) {
    return {
      ok: false,
      statusCode: 404,
      error: "pending_shopify_connection_not_found",
    };
  }

  // El HMAC lo firma la app que inicio el flujo (publica o custom distribution, cada una
  // con su propio secret). El app_mode guardado al sembrar la conexion es la primera
  // apuesta, pero una instalacion gestionada por Shopify puede llegar sin que el metadata
  // refleje la app real, asi que si la firma no valida se intenta con la otra app.
  const seededAppMode = parseAppMode(pendingConnection.metadata);
  const candidateModes: ShopifyAppMode[] =
    seededAppMode === "custom" ? ["custom", "public"] : ["public", "custom"];

  let appEnv: ShopifyOAuthEnv | null = null;
  let resolvedAny = false;
  for (const mode of candidateModes) {
    let candidate: ShopifyOAuthEnv;
    try {
      candidate = resolveShopifyAppEnv(env, mode);
    } catch {
      continue;
    }
    resolvedAny = true;
    if (verifyShopifyHmac(query, candidate.SHOPIFY_API_SECRET)) {
      appEnv = candidate;
      break;
    }
  }

  if (!resolvedAny) {
    return {
      ok: false,
      statusCode: 500,
      error: "shopify_custom_app_not_configured",
      message:
        "La app Shopify de distribucion personalizada no esta configurada en el servidor.",
    };
  }

  if (!appEnv) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_shopify_hmac",
    };
  }

  const storedState = parseState(pendingConnection.metadata);
  if (state !== null && storedState !== null && storedState !== state) {
    // Con HMAC valido, un state distinto significa casi siempre que se repitio el flujo
    // desde otra pestaña o que Shopify inicio la instalacion por su cuenta (managed
    // install); se acepta pero queda rastro por si el supuesto falla.
    console.warn("Shopify OAuth state mismatch tolerated (HMAC valid)", {
      shop,
      connection_id: pendingConnection.id,
      has_incoming_state: state !== null,
    });
  }

  const tokenResult = await exchangeShopifyCodeForToken(appEnv, shop, code);
  const now = new Date().toISOString();

  const { error: connectionUpdateError } = await supabase
    .from("integration_connections")
    .update({
      provider_account_id: shop,
      provider_account_name: parseProviderAccountName(shop),
      status: "connected",
      scopes: tokenResult.scope
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
      connected_at: now,
      last_sync_at: now,
      metadata: {
        ...(typeof pendingConnection.metadata === "object" &&
        pendingConnection.metadata !== null
          ? (pendingConnection.metadata as Record<string, unknown>)
          : {}),
        state: state ?? storedState,
        shop_domain: shop,
        auth_mode: "offline",
      },
    })
    .eq("id", pendingConnection.id);

  if (connectionUpdateError) {
    return {
      ok: false,
      statusCode: 500,
      error: "shopify_connection_update_failed",
      detail: connectionUpdateError.message,
    };
  }

  try {
    await saveShopifyTokens(
      supabase,
      pendingConnection.id,
      shop,
      resolveCredentialSecret(env),
      tokenResult,
    );
  } catch (error) {
    // Sin fallback a metadata: el token expiring necesita access+refresh+ambas fechas
    // de forma consistente para poder renovarse despues, asi que una escritura parcial
    // es peor que fallar claro y dejar reintentar la conexion.
    return {
      ok: false,
      statusCode: 500,
      error: "shopify_credential_store_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }

  const syncRunIdempotencyKey = `oauth:${pendingConnection.id}`;
  const { error: syncRunInsertError } = await supabase
    .from("integration_sync_runs")
    .upsert(
      {
        connection_id: pendingConnection.id,
        organization_id: pendingConnection.organization_id,
        provider: "shopify",
        sync_type: "oauth",
        status: "succeeded",
        idempotency_key: syncRunIdempotencyKey,
        started_at: now,
        finished_at: now,
        records_read: 0,
        records_written: 0,
        records_failed: 0,
      },
      { onConflict: "provider,idempotency_key" },
    );

  if (syncRunInsertError) {
    return {
      ok: false,
      statusCode: 500,
      error: "shopify_sync_run_create_failed",
      detail: syncRunInsertError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId: pendingConnection.organization_id,
    actorUserId: null,
    action: "shopify.oauth_connected",
    entityType: "integration_connection",
    entityId: pendingConnection.id,
    newData: {
      provider: "shopify",
      shop_domain: shop,
      scopes: tokenResult.scope
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
    },
  });

  void registerShopifyWebhooks(
    shop,
    tokenResult.accessToken,
    shopifyWebhookCallbackUrl(env.SHOPIFY_REDIRECT_URI),
    pendingConnection.organization_id,
  ).catch((error: unknown) => {
    console.error("Shopify webhook registration failed", {
      connection_id: pendingConnection.id,
      organization_id: pendingConnection.organization_id,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  const shopifySyncAdapter = createIntegrationAdapters(env).shopify;
  void shopifySyncAdapter
    .runInitialSync({
      mode: "initial",
      connection: toIntegrationConnection({
        id: pendingConnection.id,
        organization_id: pendingConnection.organization_id,
        provider: "shopify",
        status: "pending",
      }),
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "shopify_initial_sync_background_failed";
      console.error("Shopify initial sync failed", {
        connection_id: pendingConnection.id,
        organization_id: pendingConnection.organization_id,
        error: message,
      });
    });

  return {
    ok: true,
    data: {
      redirectUrl: `${env.WEB_ORIGIN}/integraciones?shopify=connected`,
    },
  };
}
