import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  requireOperationalOrganization,
  isOperationalOrganizationError,
  type AuthContext,
} from "./auth-context.js";
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
import {
  describeShopifyMissingScopes,
  missingShopifyScopes,
  parseShopifyScopes,
} from "./shopify-permissions.js";

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

/**
 * Tope de tiendas del plan (pricing por numero de tiendas: 2 -> 100 EUR,
 * 3 -> 139 EUR...). Devuelve un fallo si conectar esta tienda pasaria del
 * limite, o null si puede seguir.
 *
 * El conteo sale de `billable_store_count`, la misma funcion que usara la
 * factura: si el limite y el cobro contaran distinto, un cliente pagaria por
 * tiendas que la app no le deja conectar, o al reves.
 */
export async function assertStoreLimit(
  supabase: SupabaseClient,
  organizationId: string,
  shopDomain: string,
): Promise<{
  ok: false;
  statusCode: number;
  error: string;
  message: string;
} | null> {
  const { data: subscription } = await supabase
    .from("service_subscriptions")
    .select("store_limit")
    .eq("organization_id", organizationId)
    .in("status", ["active", "trial"])
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const limit = subscription?.store_limit as number | null | undefined;
  if (limit === null || limit === undefined) return null;

  // Una tienda que ya esta conectada no consume cupo nuevo: reconectarla tras
  // caducar el token, o reinstalar la app, no puede toparse con el limite.
  const { data: existing } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", "shopify")
    .eq("provider_account_id", shopDomain)
    .maybeSingle();
  if (existing) return null;

  const { data: used, error: countError } = await supabase.rpc(
    "billable_store_count",
    { target_organization_id: organizationId },
  );
  // Si el conteo falla no se bloquea la conexion: dejar a un cliente sin poder
  // conectar por un error de lectura es peor que una tienda de mas, que se ve
  // en la facturacion y se corrige.
  if (countError) return null;

  if ((used ?? 0) >= limit) {
    return {
      ok: false,
      statusCode: 409,
      error: "store_limit_reached",
      message: `Tu plan incluye ${limit} ${limit === 1 ? "tienda" : "tiendas"} y ya tienes ${used}. Amplia el plan para conectar otra.`,
    };
  }

  return null;
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

  const operational = requireOperationalOrganization(
    authContext,
    organizationId,
  );
  if (isOperationalOrganizationError(operational)) return operational;
  const { membership } = operational;

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

  // Limite de tiendas del plan. Se comprueba antes de sembrar la conexion
  // pendiente para que el cliente vea el tope aqui y no despues de haber
  // aprobado los permisos en Shopify. Reconectar una tienda que ya existe no
  // consume cupo: el upsert la pisa, no la duplica.
  const limitCheck = await assertStoreLimit(
    supabase,
    organizationId,
    shopDomain,
  );
  if (limitCheck) return limitCheck;

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

  const operational = requireOperationalOrganization(
    authContext,
    organizationId,
  );
  if (isOperationalOrganizationError(operational)) return operational;
  const { membership } = operational;

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

  let connectionStatus = connection.status;
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

    const { error: staleRecoveryError } = await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message:
          "La sincronizacion anterior quedo abierta y fue marcada como error automaticamente.",
      })
      .eq("id", connection.id);

    if (staleRecoveryError) {
      return {
        ok: false,
        statusCode: 500,
        error: "shopify_stale_sync_recovery_failed",
        detail: staleRecoveryError.message,
      };
    }
    connectionStatus = "error";
  }

  if (connectionStatus !== "connected" && connectionStatus !== "error") {
    return {
      ok: false,
      statusCode: 409,
      error: "shopify_connection_not_ready",
      message:
        "La conexion Shopify debe estar conectada antes de poder sincronizar.",
    };
  }

  const { data: claimedConnection, error: statusUpdateError } = await supabase
    .from("integration_connections")
    .update({ status: "syncing" })
    .eq("id", connection.id)
    .eq("status", connectionStatus)
    .select("id")
    .maybeSingle();

  if (statusUpdateError) {
    return {
      ok: false,
      statusCode: 500,
      error: "shopify_sync_trigger_failed",
      detail: statusUpdateError.message,
    };
  }
  if (!claimedConnection) {
    return {
      ok: false,
      statusCode: 409,
      error: "shopify_sync_already_running",
      message:
        "Otra sincronización de Shopify comenzó antes de completar esta solicitud.",
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
        status: connectionStatus,
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

  if (typeof query.error === "string") {
    return {
      ok: true,
      data: { redirectUrl: `${env.WEB_ORIGIN}/integraciones?shopify=denied` },
    };
  }

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

  let tokenResult: Awaited<ReturnType<typeof exchangeShopifyCodeForToken>>;
  try {
    tokenResult = await exchangeShopifyCodeForToken(appEnv, shop, code);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message: `shopify_token_exchange_failed: ${detail}`,
      })
      .eq("id", pendingConnection.id);
    return {
      ok: false,
      statusCode: 502,
      error: "shopify_token_exchange_failed",
      detail,
    };
  }
  const now = new Date().toISOString();

  // Shopify concede lo que concede: si la instalacion se quedo corta (permiso
  // pendiente de aprobacion, instalacion vieja con menos scopes) hay que
  // decirlo AQUI, no dejar que el sync devuelva una tienda a medias sin
  // explicacion. Se compara contra lo pedido, no contra la tabla entera.
  const grantedScopes = parseShopifyScopes(tokenResult.scope);
  const missingScopes = missingShopifyScopes(
    parseShopifyScopes(appEnv.SHOPIFY_SCOPES),
    grantedScopes,
  );
  const missingRequired = missingScopes.filter((item) => item.required);

  // Una tienda de Shopify solo puede colgar de una organizacion:
  // shopify_stores.myshopify_domain es unique GLOBAL, no por organizacion. Sin
  // esta comprobacion el conflicto no aparece aqui sino mucho despues, dentro
  // de la sincronizacion, como una violacion de constraint en crudo: el cliente
  // ve una tienda "conectada" que nunca trae datos y nadie sabe por que.
  //
  // Pasa de verdad cuando alguien pierde el acceso a su cuenta y abre otra: la
  // tienda sigue atada a la cuenta muerta y no hay forma de reconectarla desde
  // la interfaz. Por eso ademas de cortar se deja registro, que es lo que
  // soporte necesita para liberarla.
  const { data: tiendaExistente } = await supabase
    .from("shopify_stores")
    .select("organization_id")
    .eq("myshopify_domain", shop)
    .maybeSingle();

  if (
    tiendaExistente &&
    tiendaExistente.organization_id !== pendingConnection.organization_id
  ) {
    await recordAuditLog(supabase, {
      organizationId: pendingConnection.organization_id,
      actorUserId: null,
      action: "shopify.oauth_store_already_claimed",
      entityType: "integration_connection",
      entityId: pendingConnection.id,
      newData: {
        shop_domain: shop,
        claimed_by_organization_id: tiendaExistente.organization_id,
      },
    });

    await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: now,
        last_error_message: `shopify_store_already_claimed:${shop}`,
      })
      .eq("id", pendingConnection.id);

    // Vuelve al portal en vez de escupir JSON: aqui el usuario esta en mitad
    // de un OAuth, en su navegador, y lo que tiene que ver es una frase que
    // entienda, no un cuerpo de error.
    return {
      ok: true,
      data: {
        redirectUrl: `${env.WEB_ORIGIN}/integraciones?shopify=ya_conectada&tienda=${encodeURIComponent(shop)}`,
      },
    };
  }

  const { error: connectionUpdateError } = await supabase
    .from("integration_connections")
    .update({
      provider_account_id: shop,
      provider_account_name: parseProviderAccountName(shop),
      // Con un permiso obligatorio sin conceder la conexion no esta sana, por
      // mucho que el token funcione: queda en error con el motivo escrito.
      status: missingRequired.length > 0 ? "error" : "connected",
      ...(missingRequired.length > 0
        ? {
            last_error_at: now,
            last_error_message: describeShopifyMissingScopes(missingRequired),
          }
        : { last_error_at: null, last_error_message: null }),
      scopes: grantedScopes,
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
        missing_scopes: missingScopes.map((item) => item.scope),
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

  // Los permisos que faltan viajan en la URL. Sin esto, el aviso de vuelta
  // decia "Shopify no concedio permisos imprescindibles" sin nombrar ninguno, y
  // la unica salida que ofrecia -- reinstalar aceptandolo todo -- no arregla
  // nada cuando el permiso ni siquiera esta en el TOML de la app: Shopify no
  // puede conceder lo que no tiene declarado, por mucho que aceptes.
  const resultado =
    missingRequired.length > 0
      ? "missing_scopes"
      : missingScopes.length > 0
        ? "connected_partial"
        : "connected";
  const faltan =
    missingScopes.length > 0
      ? `&faltan=${encodeURIComponent(missingScopes.map((item) => item.scope).join(","))}`
      : "";

  return {
    ok: true,
    data: {
      redirectUrl: `${env.WEB_ORIGIN}/integraciones?shopify=${resultado}${faltan}`,
    },
  };
}
