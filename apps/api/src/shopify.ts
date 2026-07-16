import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { AuthContext } from "./auth-context.js";
import {
  createShopifyState,
  encryptShopifyCredential,
  exchangeShopifyCodeForToken,
  parseProviderAccountName,
  type ShopifyOAuthEnv,
  verifyShopifyHmac,
} from "./shopify-oauth.js";
import { runShopifyInitialSync } from "./shopify-sync.js";
import { registerShopifyWebhooks, shopifyWebhookCallbackUrl } from "./shopify-webhooks.js";
import type { LoadedApiEnv } from "@ecomscaling/config";

type ApiEnv = LoadedApiEnv & ShopifyOAuthEnv;

type Result =
  | { ok: true; data: { redirectUrl: string } }
  | { ok: false; statusCode: number; error: string; message?: string; detail?: string };

type SyncTriggerResult =
  | { ok: true; data: { status: string; connectionId: string } }
  | { ok: false; statusCode: number; error: string; message?: string; detail?: string };

const STALE_SYNCING_MS = 10 * 60 * 1000;

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
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function parseState(metadata: unknown) {
  if (typeof metadata === "object" && metadata !== null && "state" in metadata) {
    const value = (metadata as Record<string, unknown>).state;
    return typeof value === "string" ? value : null;
  }

  return null;
}

export async function createShopifyConnectionAuthUrl(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
  shopDomainInput: string,
): Promise<Result> {
  const shopDomain = normalizeShopDomain(shopDomainInput);

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

  if (authContext.profile.platform_role !== "platform_admin" && !["owner", "manager"].includes(membership.role)) {
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

  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.set("client_id", env.SHOPIFY_API_KEY);
  url.searchParams.set("scope", env.SHOPIFY_SCOPES);
  url.searchParams.set("redirect_uri", env.SHOPIFY_REDIRECT_URI);
  url.searchParams.set("state", state);

  return {
    ok: true,
    data: {
      redirectUrl: url.toString(),
    },
  };
}

export async function triggerShopifySync(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
): Promise<SyncTriggerResult> {
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

  if (authContext.profile.platform_role !== "platform_admin" && !["owner", "manager"].includes(membership.role)) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_manage_denied",
      message: "Solo owner, manager o platform admin pueden sincronizar Shopify.",
    };
  }

  const supabase = createServiceClient(env);

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, status, updated_at")
    .eq("organization_id", organizationId)
    .eq("provider", "shopify")
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
    const updatedAt = connection.updated_at ? new Date(connection.updated_at).getTime() : Date.now();
    const isStale = Date.now() - updatedAt > STALE_SYNCING_MS;

    if (!isStale) {
      return {
        ok: false,
        statusCode: 409,
        error: "shopify_sync_already_running",
        message: "Ya hay una sincronizacion de Shopify en curso para esta organizacion.",
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
      message: "La conexion Shopify debe estar conectada antes de poder sincronizar.",
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

  void runShopifyInitialSync(env, connection.id, "manual").catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : "shopify_manual_sync_background_failed";
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
  const shop = typeof query.shop === "string" ? normalizeShopDomain(query.shop) : null;
  const code = typeof query.code === "string" ? query.code : null;
  const state = typeof query.state === "string" ? query.state : null;

  if (!shop || !code || !state) {
    return {
      ok: false,
      statusCode: 400,
      error: "missing_oauth_parameters",
    };
  }

  if (!verifyShopifyHmac(query, env.SHOPIFY_API_SECRET)) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_shopify_hmac",
    };
  }

  const supabase = createServiceClient(env);
  const { data: connections, error: lookupError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider, provider_account_id, provider_account_name, status, metadata")
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

  const pending = (connections ?? []).find((connection) => parseState(connection.metadata) === state) ??
    (connections ?? [])[0];

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

  if (parseState(pendingConnection.metadata) !== state) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_oauth_state",
      detail:
        "La sesion OAuth ha caducado o se inicio otra conexion Shopify en otra pestaña. Repite el flujo desde Integraciones.",
    };
  }

  const tokenResult = await exchangeShopifyCodeForToken(env, shop, code);
  const encryptedToken = encryptShopifyCredential(
    JSON.stringify({
      access_token: tokenResult.accessToken,
      scope: tokenResult.scope,
      shop,
      connected_at: new Date().toISOString(),
    }),
    env.SUPABASE_JWT_SECRET ?? env.SUPABASE_SERVICE_ROLE_KEY ?? env.SHOPIFY_API_SECRET,
  );

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
        ...(typeof pendingConnection.metadata === "object" && pendingConnection.metadata !== null
          ? (pendingConnection.metadata as Record<string, unknown>)
          : {}),
        state,
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

  const { error: credentialInsertError } = await supabase
    .schema("private")
    .from("integration_credentials")
    .upsert(
      {
        connection_id: pendingConnection.id,
        credential_kind: "shopify_offline_access_token",
        encrypted_payload: encryptedToken,
        encryption_key_version: "v1",
        rotated_at: now,
      },
      { onConflict: "connection_id,credential_kind" },
    );

  if (credentialInsertError) {
    const { error: fallbackUpdateError } = await supabase
      .from("integration_connections")
      .update({
        metadata: {
          ...(typeof pendingConnection.metadata === "object" && pendingConnection.metadata !== null
            ? (pendingConnection.metadata as Record<string, unknown>)
            : {}),
          state,
          shop_domain: shop,
          auth_mode: "offline",
          credential_storage: "metadata_fallback",
          encrypted_credential_fallback: encryptedToken,
          credential_storage_error: credentialInsertError.message,
        },
      })
      .eq("id", pendingConnection.id);

    if (fallbackUpdateError) {
      return {
        ok: false,
        statusCode: 500,
        error: "shopify_credential_store_failed",
        detail: fallbackUpdateError.message,
      };
    }
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

  void registerShopifyWebhooks(shop, tokenResult.accessToken, shopifyWebhookCallbackUrl(env.SHOPIFY_REDIRECT_URI)).catch(
    (error: unknown) => {
      console.error("Shopify webhook registration failed", {
        connection_id: pendingConnection.id,
        organization_id: pendingConnection.organization_id,
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );

  void runShopifyInitialSync(env, pendingConnection.id).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "shopify_initial_sync_background_failed";
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
