import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { credentialKeyVersion, decryptCredential, encryptCredential, legacyCredentialSecret } from "./credential-crypto.js";
import {
  refreshShopifyOfflineToken,
  resolveShopifyAppEnv,
  type ShopifyAppMode,
  type ShopifyExpiringToken,
} from "./shopify-oauth.js";

type ApiEnv = LoadedApiEnv;

function parseAppMode(metadata: unknown): ShopifyAppMode {
  if (typeof metadata === "object" && metadata !== null && "app_mode" in metadata) {
    const value = (metadata as Record<string, unknown>).app_mode;
    if (value === "custom") {
      return "custom";
    }
  }

  return "public";
}

const logger = createLogger("shopify-token-store");
const CREDENTIAL_KIND = "shopify_offline_access_token";
const REFRESH_BUFFER_MS = 2 * 60 * 1000;
const CLAIM_STALE_MS = 20 * 1000;
const CLAIM_POLL_MS = 1500;
const CLAIM_POLL_ATTEMPTS = 4;

type ShopifyCredentialPayload = {
  access_token: string;
  refresh_token: string;
  scope: string;
  shop: string;
};

type CredentialRow = {
  encrypted_payload: string;
  expires_at: string | null;
  refresh_token_expires_at: string | null;
  refresh_locked_at: string | null;
};

/** Clave heredada (v1). Se mantiene exportada para quien aun la importe. */
export function resolveCredentialSecret(env: ApiEnv) {
  return legacyCredentialSecret(env);
}

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function encryptPayload(payload: ShopifyCredentialPayload, env: ApiEnv, connectionId: string) {
  return encryptCredential(JSON.stringify(payload), env, connectionId);
}

function decryptPayload(encryptedPayload: string, env: ApiEnv, connectionId: string): ShopifyCredentialPayload | null {
  try {
    return JSON.parse(decryptCredential(encryptedPayload, env, connectionId)) as ShopifyCredentialPayload;
  } catch {
    return null;
  }
}

/**
 * Persiste el access_token + refresh_token de una tienda tras el intercambio OAuth
 * inicial o una renovacion. Una sola fila/UPDATE por conexion => atomico por diseno.
 */
export async function saveShopifyTokens(
  supabase: SupabaseClient,
  connectionId: string,
  shop: string,
  env: ApiEnv,
  token: ShopifyExpiringToken,
) {
  const payload: ShopifyCredentialPayload = {
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    scope: token.scope,
    shop,
  };

  const { error } = await supabase
    .schema("private")
    .from("integration_credentials")
    .upsert(
      {
        connection_id: connectionId,
        credential_kind: CREDENTIAL_KIND,
        encrypted_payload: encryptPayload(payload, env, connectionId),
        encryption_key_version: credentialKeyVersion(env),
        expires_at: token.accessTokenExpiresAt,
        refresh_token_expires_at: token.refreshTokenExpiresAt,
        refresh_locked_at: null,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,credential_kind" },
    );

  if (error) {
    throw new Error(`shopify_credential_store_failed: ${error.message}`);
  }
}

async function loadCredentialRow(supabase: SupabaseClient, connectionId: string) {
  const { data, error } = await supabase
    .schema("private")
    .from("integration_credentials")
    .select("encrypted_payload, expires_at, refresh_token_expires_at, refresh_locked_at")
    .eq("connection_id", connectionId)
    .eq("credential_kind", CREDENTIAL_KIND)
    .maybeSingle();

  if (error) {
    throw new Error(`shopify_credential_load_failed: ${error.message}`);
  }

  return data as CredentialRow | null;
}

async function markConnectionNeedsReauth(supabase: SupabaseClient, connectionId: string, reason: string) {
  await supabase
    .from("integration_connections")
    .update({
      status: "error",
      last_error_at: new Date().toISOString(),
      last_error_message: reason,
    })
    .eq("id", connectionId);
}

/** Shopify dijo que no (400/401/403), no que no pudo contestar. */
export function isShopifyRefreshRejection(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && [400, 401, 403].includes(status);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Unica puerta de entrada para obtener un access_token de Shopify valido. Renueva
 * proactivamente con el refresh_token antes de que expire (buffer 2 min), evita que
 * dos procesos renueven a la vez con un claim en `refresh_locked_at`, y solo exige
 * reconectar (OAuth completo) cuando el refresh_token ya no es utilizable.
 */
export async function getValidShopifyAccessToken(env: ApiEnv, connectionId: string): Promise<string> {
  const supabase = createServiceClient(env);

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, provider_account_id, status, metadata")
    .eq("id", connectionId)
    .maybeSingle();

  if (connectionError) {
    throw new Error(`shopify_connection_load_failed: ${connectionError.message}`);
  }

  if (!connection || !connection.provider_account_id) {
    throw new Error("shopify_connection_not_found");
  }

  if (connection.status === "disconnected" || connection.status === "revoked") {
    throw new Error("shopify_connection_not_active");
  }

  const shop = connection.provider_account_id;
  const appEnv = resolveShopifyAppEnv(env, parseAppMode(connection.metadata));

  for (let attempt = 0; attempt < CLAIM_POLL_ATTEMPTS + 1; attempt += 1) {
    const row = await loadCredentialRow(supabase, connectionId);

    if (!row?.encrypted_payload) {
      throw new Error("shopify_access_token_unavailable");
    }

    if (!row.expires_at) {
      // Token guardado antes de migrar a expiring=1 (o legado non-expiring): Shopify ya
      // no lo acepta y no tenemos refresh_token para renovarlo. Hace falta reconectar.
      await markConnectionNeedsReauth(
        supabase,
        connectionId,
        "Token Shopify sin expiracion registrada (formato antiguo). Reconecta la tienda para emitir un token expiring.",
      );
      throw new Error("shopify_reauthorization_required");
    }

    const expiresAtMs = new Date(row.expires_at).getTime();

    if (expiresAtMs - Date.now() > REFRESH_BUFFER_MS) {
      const payload = decryptPayload(row.encrypted_payload, env, connectionId);
      if (!payload?.access_token) {
        throw new Error("shopify_access_token_unavailable");
      }
      return payload.access_token;
    }

    if (row.refresh_token_expires_at && new Date(row.refresh_token_expires_at).getTime() <= Date.now()) {
      await markConnectionNeedsReauth(
        supabase,
        connectionId,
        "El refresh token de Shopify expiro. Reconecta la tienda para volver a autorizar el acceso.",
      );
      throw new Error("shopify_reauthorization_required");
    }

    const claimStaleBefore = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
    const { data: claimed, error: claimError } = await supabase
      .schema("private")
      .from("integration_credentials")
      .update({ refresh_locked_at: new Date().toISOString() })
      .eq("connection_id", connectionId)
      .eq("credential_kind", CREDENTIAL_KIND)
      .eq("expires_at", row.expires_at)
      .or(`refresh_locked_at.is.null,refresh_locked_at.lt.${claimStaleBefore}`)
      .select("encrypted_payload")
      .maybeSingle();

    if (claimError) {
      throw new Error(`shopify_token_refresh_claim_failed: ${claimError.message}`);
    }

    if (!claimed) {
      // No ganamos el claim: alguien mas ya esta renovando (o ya lo hizo). Esperamos
      // un poco y releemos en la siguiente vuelta del bucle.
      await sleep(CLAIM_POLL_MS);
      continue;
    }

    const currentPayload = decryptPayload(claimed.encrypted_payload, env, connectionId);
    if (!currentPayload?.refresh_token) {
      throw new Error("shopify_refresh_token_unavailable");
    }

    try {
      const refreshed = await refreshShopifyOfflineToken(appEnv, shop, currentPayload.refresh_token);
      await saveShopifyTokens(supabase, connectionId, shop, env, refreshed);
      return refreshed.accessToken;
    } catch (error) {
      logger.error("Shopify token refresh failed", {
        connection_id: connectionId,
        shop_domain: shop,
        error: error instanceof Error ? error.message : "unknown_error",
      });

      // Solo un rechazo de Shopify (4xx: refresh token inválido, app
      // desinstalada) obliga a reconectar. Un 5xx, un 429 o un corte de red
      // se reintenta en la siguiente pasada: antes cualquiera de ellos dejaba
      // la tienda pidiendo reconexión para siempre.
      if (!isShopifyRefreshRejection(error)) {
        await supabase
          .schema("private")
          .from("integration_credentials")
          .update({ refresh_locked_at: null })
          .eq("connection_id", connectionId)
          .eq("credential_kind", CREDENTIAL_KIND);
        throw new Error(
          `shopify_token_refresh_transient: ${error instanceof Error ? error.message : "unknown_error"}`,
        );
      }

      await markConnectionNeedsReauth(
        supabase,
        connectionId,
        "Shopify rechazó el permiso guardado. Reconecta la tienda.",
      );
      throw new Error("shopify_reauthorization_required");
    }
  }

  throw new Error("shopify_token_refresh_contended");
}
