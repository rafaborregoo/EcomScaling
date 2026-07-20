import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import type { AuthContext } from "./auth-context.js";
import { metaGraphGetAll, metaGraphGet } from "./meta-client.js";
import {
  buildMetaAuthUrl,
  createMetaState,
  exchangeMetaCodeForLongLivedToken,
  resolveMetaAppEnv,
} from "./meta-oauth.js";
import { runMetaInitialSync } from "./meta-sync.js";
import { decryptShopifyCredential, encryptShopifyCredential } from "./shopify-oauth.js";
import { resolveCredentialSecret } from "./shopify-token-store.js";

type ApiEnv = LoadedApiEnv;

const logger = createLogger("meta");
const CREDENTIAL_KIND = "meta_user_access_token";
const PROVIDER = "meta_ads";

type Result =
  | { ok: true; data: { redirectUrl: string } }
  | { ok: false; statusCode: number; error: string; message?: string; detail?: string };

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function parseState(metadata: unknown) {
  if (typeof metadata === "object" && metadata !== null && "state" in metadata) {
    const value = (metadata as Record<string, unknown>).state;
    return typeof value === "string" ? value : null;
  }

  return null;
}

export function isMetaAppConfigured(env: ApiEnv) {
  return resolveMetaAppEnv(env) !== null;
}

export async function createMetaConnectionAuthUrl(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
): Promise<Result> {
  const appEnv = resolveMetaAppEnv(env);

  if (!appEnv) {
    return {
      ok: false,
      statusCode: 400,
      error: "meta_app_not_configured",
      message: "La app de Meta no esta configurada en el servidor (META_APP_ID/SECRET/REDIRECT_URI).",
    };
  }

  const membership = authContext.memberships.find((item) => item.organization_id === organizationId);

  if (!membership) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }

  if (
    authContext.profile.platform_role !== "platform_admin" &&
    !["owner", "manager"].includes(membership.role)
  ) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_manage_denied",
      message: "Solo owner, manager o platform admin pueden conectar Meta Ads.",
    };
  }

  const state = createMetaState();
  const supabase = createServiceClient(env);

  // Una conexion Meta por organizacion (MVP): provider_account_id placeholder
  // estable hasta que el callback resuelva el usuario real de Meta.
  const { error } = await supabase.from("integration_connections").upsert(
    {
      organization_id: organizationId,
      provider: PROVIDER,
      provider_account_id: "primary",
      provider_account_name: "Meta Ads",
      status: "pending",
      metadata: { state, source: "oauth_start" },
    },
    { onConflict: "organization_id,provider,provider_account_id" },
  );

  if (error) {
    return { ok: false, statusCode: 500, error: "meta_connection_seed_failed", detail: error.message };
  }

  return { ok: true, data: { redirectUrl: buildMetaAuthUrl(appEnv, state) } };
}

async function saveMetaToken(
  supabase: SupabaseClient,
  env: ApiEnv,
  connectionId: string,
  accessToken: string,
  expiresAt: string | null,
  scopes: string,
) {
  const payload = JSON.stringify({ access_token: accessToken, scope: scopes });

  const { error } = await supabase
    .schema("private")
    .from("integration_credentials")
    .upsert(
      {
        connection_id: connectionId,
        credential_kind: CREDENTIAL_KIND,
        encrypted_payload: encryptShopifyCredential(payload, resolveCredentialSecret(env)),
        encryption_key_version: "v1",
        expires_at: expiresAt,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,credential_kind" },
    );

  if (error) {
    throw new Error(`meta_credential_store_failed: ${error.message}`);
  }
}

export async function getValidMetaAccessToken(env: ApiEnv, connectionId: string) {
  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .schema("private")
    .from("integration_credentials")
    .select("encrypted_payload, expires_at")
    .eq("connection_id", connectionId)
    .eq("credential_kind", CREDENTIAL_KIND)
    .maybeSingle();

  if (error) {
    throw new Error(`meta_credential_load_failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
    // Meta no entrega refresh tokens de usuario: token caducado => reautorizar.
    await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message: "meta_token_expired_reauth_required",
      })
      .eq("id", connectionId);
    return null;
  }

  try {
    const payload = JSON.parse(
      decryptShopifyCredential(data.encrypted_payload, resolveCredentialSecret(env)),
    ) as { access_token?: string };
    return payload.access_token ?? null;
  } catch {
    return null;
  }
}

type MetaBusiness = { id: string; name?: string; verification_status?: string; vertical?: string };
type MetaAdAccountNode = {
  id: string;
  account_id?: string;
  name?: string;
  account_status?: number;
  disable_reason?: number;
  currency?: string;
  timezone_name?: string;
  timezone_offset_hours_utc?: number;
  amount_spent?: string;
  balance?: string;
  spend_cap?: string;
  min_daily_budget?: number;
  business?: { id: string };
  created_time?: string;
};
type MetaPageNode = { id: string; name?: string; category?: string; tasks?: string[]; picture?: { data?: { url?: string } } };

/**
 * Descubrimiento post-OAuth: businesses, ad accounts y pages accesibles con el
 * token del usuario. Todo upsert in-place (unique + onConflict), nunca append.
 */
export async function discoverMetaAssets(
  env: ApiEnv,
  connectionId: string,
  organizationId: string,
  accessToken: string,
) {
  const supabase = createServiceClient(env);

  const businesses = await metaGraphGetAll<MetaBusiness>("me/businesses", accessToken, {
    fields: "id,name,verification_status,vertical",
  }).catch((error: unknown) => {
    // business_management puede no estar concedido; el resto del descubrimiento sigue.
    logger.info(`meta_business_discovery_failed: ${error instanceof Error ? error.message : String(error)}`);
    return [] as MetaBusiness[];
  });

  const businessIdMap = new Map<string, string>();

  for (const business of businesses) {
    const { data, error } = await supabase
      .from("meta_business_accounts")
      .upsert(
        {
          organization_id: organizationId,
          connection_id: connectionId,
          external_business_id: business.id,
          name: business.name ?? business.id,
          verification_status: business.verification_status ?? null,
          vertical: business.vertical ?? null,
          raw_data: business,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "connection_id,external_business_id" },
      )
      .select("id")
      .single();

    if (error) {
      throw new Error(`meta_business_upsert_failed: ${error.message}`);
    }

    if (data) {
      businessIdMap.set(business.id, data.id);
    }
  }

  const adAccounts = await metaGraphGetAll<MetaAdAccountNode>("me/adaccounts", accessToken, {
    fields:
      "id,account_id,name,account_status,disable_reason,currency,timezone_name,timezone_offset_hours_utc,amount_spent,balance,spend_cap,min_daily_budget,business,created_time",
  });

  for (const account of adAccounts) {
    const { error } = await supabase.from("meta_ad_accounts").upsert(
      {
        organization_id: organizationId,
        connection_id: connectionId,
        business_account_id: account.business?.id ? businessIdMap.get(account.business.id) ?? null : null,
        external_ad_account_id: account.id,
        account_name: account.name ?? account.account_id ?? account.id,
        account_status_code: account.account_status ?? null,
        disable_reason_code: account.disable_reason ?? null,
        currency_code: account.currency ?? null,
        timezone_name: account.timezone_name ?? null,
        timezone_offset_hours_utc: account.timezone_offset_hours_utc ?? null,
        amount_spent: account.amount_spent != null ? Number(account.amount_spent) / 100 : null,
        balance: account.balance != null ? Number(account.balance) / 100 : null,
        spend_cap: account.spend_cap != null ? Number(account.spend_cap) / 100 : null,
        minimum_daily_budget: account.min_daily_budget != null ? account.min_daily_budget / 100 : null,
        raw_data: account,
        last_synced_at: new Date().toISOString(),
        external_created_at: account.created_time ?? null,
      },
      { onConflict: "connection_id,external_ad_account_id" },
    );

    if (error) {
      throw new Error(`meta_ad_account_upsert_failed: ${error.message}`);
    }
  }

  const pages = await metaGraphGetAll<MetaPageNode>("me/accounts", accessToken, {
    fields: "id,name,category,tasks,picture",
  }).catch((error: unknown) => {
    logger.info(`meta_pages_discovery_failed: ${error instanceof Error ? error.message : String(error)}`);
    return [] as MetaPageNode[];
  });

  for (const page of pages) {
    const { error } = await supabase.from("meta_pages").upsert(
      {
        organization_id: organizationId,
        connection_id: connectionId,
        external_page_id: page.id,
        name: page.name ?? page.id,
        category: page.category ?? null,
        tasks: page.tasks ?? null,
        picture_url: page.picture?.data?.url ?? null,
        raw_data: page,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,external_page_id" },
    );

    if (error) {
      throw new Error(`meta_page_upsert_failed: ${error.message}`);
    }
  }

  return { businesses: businesses.length, adAccounts: adAccounts.length, pages: pages.length };
}

export async function handleMetaOAuthCallback(
  env: ApiEnv,
  query: Record<string, string | string[] | undefined>,
): Promise<Result> {
  const appEnv = resolveMetaAppEnv(env);

  if (!appEnv) {
    return { ok: false, statusCode: 500, error: "meta_app_not_configured" };
  }

  const code = typeof query.code === "string" ? query.code : null;
  const state = typeof query.state === "string" ? query.state : null;
  const oauthError = typeof query.error === "string" ? query.error : null;

  if (oauthError) {
    return {
      ok: true,
      data: { redirectUrl: `${env.WEB_ORIGIN}/integraciones?meta=denied` },
    };
  }

  if (!code || !state) {
    return { ok: false, statusCode: 400, error: "missing_oauth_parameters" };
  }

  const supabase = createServiceClient(env);

  const { data: connections, error: lookupError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, metadata")
    .eq("provider", PROVIDER)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (lookupError) {
    return { ok: false, statusCode: 500, error: "meta_pending_connection_lookup_failed", detail: lookupError.message };
  }

  // El state se compara contra el sembrado server-side en /connect, pero no se ata a la
  // sesion del navegador: el flujo de negocio exige poder generar la URL de autorizacion
  // desde el portal y enviarsela al owner real de la cuenta (mismo criterio que Shopify,
  // commit f74fcc0). El state es un UUID aleatorio no adivinable y solo puede vincular la
  // cuenta Meta a la organizacion que lo sembro, nunca a una elegida por el atacante.
  const pending = (connections ?? []).find((connection) => parseState(connection.metadata) === state);

  if (!pending) {
    return { ok: false, statusCode: 400, error: "invalid_meta_oauth_state" };
  }

  let token;
  try {
    token = await exchangeMetaCodeForLongLivedToken(appEnv, code);
  } catch (error) {
    return {
      ok: false,
      statusCode: 502,
      error: "meta_token_exchange_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }

  const me = await metaGraphGet<{ id?: string; name?: string }>("me", token.accessToken, {
    fields: "id,name",
  }).catch(() => null);

  try {
    await saveMetaToken(supabase, env, pending.id, token.accessToken, token.expiresAt, appEnv.META_SCOPES);
  } catch (error) {
    return {
      ok: false,
      statusCode: 500,
      error: "meta_credential_store_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }

  let discovery = { businesses: 0, adAccounts: 0, pages: 0 };
  try {
    discovery = await discoverMetaAssets(env, pending.id, pending.organization_id, token.accessToken);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message: `meta_discovery_failed: ${detail}`,
      })
      .eq("id", pending.id);

    return { ok: false, statusCode: 502, error: "meta_discovery_failed", detail };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("integration_connections")
    .update({
      provider_account_id: me?.id ?? "primary",
      provider_account_name: me?.name ?? "Meta Ads",
      status: "connected",
      scopes: appEnv.META_SCOPES.split(",").map((scope) => scope.trim()),
      connected_at: now,
      last_sync_at: now,
      metadata: { state, source: "oauth_start", discovery },
    })
    .eq("id", pending.id);

  if (updateError) {
    return { ok: false, statusCode: 500, error: "meta_connection_update_failed", detail: updateError.message };
  }

  void runMetaInitialSync(env, pending.id).catch((error: unknown) => {
    logger.error(
      `meta_initial_sync_failed connection=${pending.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  return { ok: true, data: { redirectUrl: `${env.WEB_ORIGIN}/integraciones?meta=connected` } };
}

export async function triggerMetaSync(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
): Promise<{ ok: true; data: { status: string; connectionId: string } } | Result & { ok: false }> {
  const membership = authContext.memberships.find((item) => item.organization_id === organizationId);

  if (!membership) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }

  if (
    authContext.profile.platform_role !== "platform_admin" &&
    !["owner", "manager"].includes(membership.role)
  ) {
    return {
      ok: false,
      statusCode: 403,
      error: "organization_manage_denied",
      message: "Solo owner, manager o platform admin pueden lanzar un sync de Meta Ads.",
    };
  }

  const supabase = createServiceClient(env);

  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (error) {
    return { ok: false, statusCode: 500, error: "meta_connection_load_failed", detail: error.message };
  }

  if (!connection) {
    return { ok: false, statusCode: 404, error: "meta_connection_not_found" };
  }

  void runMetaInitialSync(env, connection.id).catch((syncError: unknown) => {
    logger.error(
      `meta_manual_sync_failed connection=${connection.id}: ${syncError instanceof Error ? syncError.message : String(syncError)}`,
    );
  });

  return { ok: true, data: { status: "queued", connectionId: connection.id } };
}
