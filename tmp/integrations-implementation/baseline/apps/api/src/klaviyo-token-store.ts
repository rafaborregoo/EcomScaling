import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { credentialKeyVersion, decryptCredential, encryptCredential } from "./credential-crypto.js";
import {
  refreshKlaviyoAccessToken,
  type KlaviyoOAuthTokens,
} from "./klaviyo-oauth.js";

const CREDENTIAL_KIND = "klaviyo_oauth_tokens";
const API_KEY_CREDENTIAL_KIND = "klaviyo_private_api_key";
const REFRESH_BUFFER_MS = 2 * 60 * 1000;
const CLAIM_STALE_MS = 30 * 1000;
const CLAIM_POLL_MS = 1_500;
const CLAIM_MAX_ATTEMPTS = 4;

type KlaviyoCredentialPayload = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

function serviceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}



function decode(
  payload: string,
  env: LoadedApiEnv,
  connectionId: string,
): KlaviyoCredentialPayload | null {
  try {
    const parsed = JSON.parse(
      decryptCredential(payload, env, connectionId),
    ) as Partial<KlaviyoCredentialPayload>;
    if (!parsed.access_token || !parsed.refresh_token || !parsed.expires_at)
      return null;
    return parsed as KlaviyoCredentialPayload;
  } catch {
    return null;
  }
}

export async function saveKlaviyoTokens(
  env: LoadedApiEnv,
  connectionId: string,
  tokens: KlaviyoOAuthTokens,
) {
  const payload: KlaviyoCredentialPayload = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
  const { error } = await serviceClient(env)
    .schema("private")
    .from("integration_credentials")
    .upsert(
      {
        connection_id: connectionId,
        credential_kind: CREDENTIAL_KIND,
        encrypted_payload: encryptCredential(JSON.stringify(payload), env, connectionId),
        encryption_key_version: credentialKeyVersion(env),
        expires_at: payload.expires_at,
        refresh_locked_at: null,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,credential_kind" },
    );
  if (error)
    throw new Error(`klaviyo_credential_store_failed:${error.message}`);
}

/**
 * Guarda una private API key (`pk_...`) para la conexión. No caduca ni se
 * refresca: el usuario la rota manualmente en Klaviyo y vuelve a conectar.
 */
export async function saveKlaviyoApiKey(
  env: LoadedApiEnv,
  connectionId: string,
  apiKey: string,
) {
  const { error } = await serviceClient(env)
    .schema("private")
    .from("integration_credentials")
    .upsert(
      {
        connection_id: connectionId,
        credential_kind: API_KEY_CREDENTIAL_KIND,
        encrypted_payload: encryptCredential(JSON.stringify({ api_key: apiKey }), env, connectionId),
        encryption_key_version: credentialKeyVersion(env),
        expires_at: null,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,credential_kind" },
    );
  if (error)
    throw new Error(`klaviyo_credential_store_failed:${error.message}`);
}

export async function getValidKlaviyoAccessToken(
  env: LoadedApiEnv,
  connectionId: string,
): Promise<string> {
  const client = serviceClient(env);
  const { data: connection, error: connectionError } = await client
    .from("integration_connections")
    .select("id, status")
    .eq("id", connectionId)
    .eq("provider", "klaviyo")
    .maybeSingle();
  if (connectionError)
    throw new Error(
      `klaviyo_connection_load_failed:${connectionError.message}`,
    );
  if (!connection || ["disconnected", "revoked"].includes(connection.status)) {
    throw new Error("klaviyo_connection_not_active");
  }

  const { data: apiKeyRow, error: apiKeyError } = await client
    .schema("private")
    .from("integration_credentials")
    .select("encrypted_payload")
    .eq("connection_id", connectionId)
    .eq("credential_kind", API_KEY_CREDENTIAL_KIND)
    .maybeSingle();
  if (apiKeyError)
    throw new Error(`klaviyo_credential_load_failed:${apiKeyError.message}`);
  if (apiKeyRow?.encrypted_payload) {
    try {
      const parsed = JSON.parse(
        decryptCredential(apiKeyRow.encrypted_payload, env, connectionId),
      ) as { api_key?: string };
      if (parsed.api_key) return parsed.api_key;
    } catch {
      throw new Error("klaviyo_access_token_unavailable");
    }
  }

  const { data: row, error } = await client
    .schema("private")
    .from("integration_credentials")
    .select("encrypted_payload, expires_at")
    .eq("connection_id", connectionId)
    .eq("credential_kind", CREDENTIAL_KIND)
    .maybeSingle();
  if (error) throw new Error(`klaviyo_credential_load_failed:${error.message}`);
  const current = row?.encrypted_payload
    ? decode(row.encrypted_payload, env, connectionId)
    : null;
  if (!current) throw new Error("klaviyo_access_token_unavailable");
  if (new Date(current.expires_at).getTime() - Date.now() > REFRESH_BUFFER_MS)
    return current.access_token;

  const oauthEnv =
    env.KLAVIYO_CLIENT_ID &&
    env.KLAVIYO_CLIENT_SECRET &&
    env.KLAVIYO_REDIRECT_URI
      ? {
          KLAVIYO_CLIENT_ID: env.KLAVIYO_CLIENT_ID,
          KLAVIYO_CLIENT_SECRET: env.KLAVIYO_CLIENT_SECRET,
          KLAVIYO_REDIRECT_URI: env.KLAVIYO_REDIRECT_URI,
          KLAVIYO_SCOPES: env.KLAVIYO_SCOPES ?? "",
        }
      : null;
  if (!oauthEnv) throw new Error("klaviyo_app_not_configured");

  // Un solo proceso renueva a la vez (mismo claim que Shopify): API y worker
  // podian renovar en paralelo y, si Klaviyo invalida el refresh anterior al
  // rotarlo, uno de los dos dejaba la conexion pidiendo reconectar.
  for (let attempt = 0; attempt < CLAIM_MAX_ATTEMPTS; attempt += 1) {
    const claimStaleBefore = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
    const { data: claimed, error: claimError } = await client
      .schema("private")
      .from("integration_credentials")
      .update({ refresh_locked_at: new Date().toISOString() })
      .eq("connection_id", connectionId)
      .eq("credential_kind", CREDENTIAL_KIND)
      .or(`refresh_locked_at.is.null,refresh_locked_at.lt.${claimStaleBefore}`)
      .select("encrypted_payload")
      .maybeSingle();
    if (claimError) throw new Error(`klaviyo_token_refresh_claim_failed:${claimError.message}`);

    if (!claimed) {
      // Otro proceso esta renovando: esperar y releer lo que haya guardado.
      await new Promise((resolve) => setTimeout(resolve, CLAIM_POLL_MS));
      const { data: again } = await client
        .schema("private")
        .from("integration_credentials")
        .select("encrypted_payload")
        .eq("connection_id", connectionId)
        .eq("credential_kind", CREDENTIAL_KIND)
        .maybeSingle();
      const latest = again?.encrypted_payload ? decode(again.encrypted_payload, env, connectionId) : null;
      if (latest && new Date(latest.expires_at).getTime() - Date.now() > REFRESH_BUFFER_MS) {
        return latest.access_token;
      }
      continue;
    }

    const latest = decode(claimed.encrypted_payload, env, connectionId) ?? current;
    // Quien tuvo el claim antes ya pudo renovar: no se gasta otro refresh.
    if (new Date(latest.expires_at).getTime() - Date.now() > REFRESH_BUFFER_MS) {
      await releaseRefreshClaim(client, connectionId);
      return latest.access_token;
    }
    try {
      const refreshed = await refreshKlaviyoAccessToken(oauthEnv, latest.refresh_token);
      await saveKlaviyoTokens(env, connectionId, refreshed);
      return refreshed.access_token;
    } catch (error) {
      await releaseRefreshClaim(client, connectionId);
      throw error;
    }
  }
  throw new Error("klaviyo_token_refresh_contended");
}

async function releaseRefreshClaim(client: ReturnType<typeof serviceClient>, connectionId: string) {
  await client
    .schema("private")
    .from("integration_credentials")
    .update({ refresh_locked_at: null })
    .eq("connection_id", connectionId)
    .eq("credential_kind", CREDENTIAL_KIND);
}
