import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { isIntegrationFeatureEnabled } from "@ecomscaling/integrations";
import { createLogger } from "@ecomscaling/observability";
import {
  requireOperationalOrganization,
  isOperationalOrganizationError,
  type AuthContext,
} from "./auth-context.js";
import { isErr } from "./result-guard.js";
import { metaGraphGetAll, metaGraphGet } from "./meta-client.js";
import {
  createMetaState,
  debugMetaAccessToken,
  exchangeMetaCodeForLongLivedToken,
  META_REQUIRED_SCOPES,
  missingMetaScopes,
  resolveMetaAppEnv,
} from "./meta-oauth.js";
import {
  createIntegrationAdapters,
  toIntegrationConnection,
} from "./integration-adapters.js";
import {
  decryptShopifyCredential,
  encryptShopifyCredential,
} from "./shopify-oauth.js";
import { resolveCredentialSecret } from "./shopify-token-store.js";
import { recordAuditLog } from "./audit-log.js";

type ApiEnv = LoadedApiEnv;

const logger = createLogger("meta");
const CREDENTIAL_KIND = "meta_user_access_token";
const PROVIDER = "meta_ads";
const META_STALE_SYNCING_MS = 10 * 60 * 1000;

type Result =
  | { ok: true; data: { redirectUrl: string } }
  | {
      ok: false;
      statusCode: number;
      error: string;
      message?: string;
      detail?: string;
      missing_scopes?: string[];
    };

type MetaAssetSelectionInput = {
  businessIds?: unknown;
  pageIds?: unknown;
  adAccountIds?: unknown;
};

type MetaAssetRow = {
  id: string;
  connection_id: string;
  external_id: string;
  name: string;
  is_selected: boolean;
  is_active: boolean;
  last_synced_at: string | null;
};

export function normalizeAssetIds(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const ids = [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim()),
    ),
  ].filter(Boolean);

  return ids.length <= 100 ? ids : null;
}

function hasOrganizationAccess(
  authContext: AuthContext,
  organizationId: string,
) {
  return authContext.memberships.some(
    (membership) => membership.organization_id === organizationId,
  );
}

function canManageOrganization(
  authContext: AuthContext,
  organizationId: string,
) {
  const operational = requireOperationalOrganization(
    authContext,
    organizationId,
  );
  if (isOperationalOrganizationError(operational)) return false;
  const { membership } = operational;

  return Boolean(
    membership &&
    (authContext.profile.platform_role === "platform_admin" ||
      ["owner", "manager"].includes(membership.role)),
  );
}

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

async function markMetaSyncFailure(
  env: ApiEnv,
  connectionId: string,
  error: unknown,
  operation: string,
) {
  const message =
    error instanceof Error ? error.message : "meta_background_sync_failed";
  let persistenceError: string | undefined;
  try {
    const { error: updateError } = await createServiceClient(env)
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message: message.slice(0, 500),
      })
      .eq("id", connectionId);
    persistenceError = updateError?.message;
  } catch (updateError) {
    persistenceError =
      updateError instanceof Error ? updateError.message : String(updateError);
  }
  logger.error("meta_background_sync_failed", {
    connection_id: connectionId,
    operation,
    error: message,
    persistence_error: persistenceError,
  });
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

export function isMetaAppConfigured(env: ApiEnv) {
  return resolveMetaAppEnv(env) !== null;
}

export function getVerifiedMetaIdentity(
  me: { id?: string; name?: string } | null,
) {
  if (!me?.id?.trim()) {
    return {
      ok: false as const,
      error: "meta_identity_missing",
      message:
        "Meta no devolvió una identidad de cuenta verificable; la conexión no se activó.",
    };
  }

  return {
    ok: true as const,
    id: me.id,
    name: me.name?.trim() || "Meta Ads",
  };
}

export async function createMetaConnectionAuthUrl(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
): Promise<Result> {
  if (!isIntegrationFeatureEnabled("meta_ads", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false,
      statusCode: 404,
      error: "integration_disabled",
      message: "La integracion Meta Ads esta desactivada por feature flag.",
    };
  }

  const appEnv = resolveMetaAppEnv(env);

  if (!appEnv) {
    return {
      ok: false,
      statusCode: 400,
      error: "meta_app_not_configured",
      message:
        "La app de Meta no esta configurada en el servidor (META_APP_ID/SECRET/REDIRECT_URI).",
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
      message: "Solo owner, manager o platform admin pueden conectar Meta Ads.",
    };
  }

  const state = createMetaState();
  const supabase = createServiceClient(env);

  // Reconectar reutiliza la fila existente de la organizacion (si hay una) en
  // vez de sembrar una nueva con un placeholder aleatorio. La fila vieja
  // suele estar en status "error" porque el token de 60 dias caduco: si se
  // crea una fila nueva, el UPDATE final del callback -- que le escribe el ID
  // real de Meta -- choca contra la unique constraint
  // (organization_id, provider, provider_account_id) de esa fila vieja y la
  // reconexion entera revienta con meta_connection_update_failed.
  const { data: existingConnection, error: existingError } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", PROVIDER)
    .order("connected_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      statusCode: 500,
      error: "meta_connection_seed_failed",
      detail: existingError.message,
    };
  }

  const { error } = existingConnection
    ? await supabase
        .from("integration_connections")
        .update({
          status: "pending",
          metadata: { state, source: "oauth_start" },
        })
        .eq("id", existingConnection.id)
    : // El registro pendiente necesita una clave para el insert, pero no debe
      // simular una cuenta real. El callback la sustituye por el ID devuelto
      // por Meta antes de marcar la conexión como connected.
      await supabase.from("integration_connections").insert({
        organization_id: organizationId,
        provider: PROVIDER,
        provider_account_id: `pending:${state}`,
        provider_account_name: "Meta Ads",
        status: "pending",
        metadata: { state, source: "oauth_start" },
      });

  if (error) {
    return {
      ok: false,
      statusCode: 500,
      error: "meta_connection_seed_failed",
      detail: error.message,
    };
  }

  const authorization = await createIntegrationAdapters(
    env,
  ).meta_ads.buildAuthorizationUrl({
    organizationId,
    redirectUri: appEnv.META_REDIRECT_URI,
    state,
  });

  return { ok: true, data: { redirectUrl: authorization.url } };
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
        encrypted_payload: encryptShopifyCredential(
          payload,
          resolveCredentialSecret(env),
        ),
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

export async function getValidMetaAccessToken(
  env: ApiEnv,
  connectionId: string,
) {
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
      decryptShopifyCredential(
        data.encrypted_payload,
        resolveCredentialSecret(env),
      ),
    ) as { access_token?: string };
    return payload.access_token ?? null;
  } catch {
    return null;
  }
}

type MetaBusiness = {
  id: string;
  name?: string;
  verification_status?: string;
  vertical?: string;
};
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
type MetaPageNode = {
  id: string;
  name?: string;
  category?: string;
  tasks?: string[];
  picture?: { data?: { url?: string } };
};

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

  const businesses = await metaGraphGetAll<MetaBusiness>(
    "me/businesses",
    accessToken,
    {
      fields: "id,name,verification_status,vertical",
    },
    env.META_APP_SECRET,
  ).catch((error: unknown) => {
    // business_management puede no estar concedido; el resto del descubrimiento sigue.
    logger.info("meta_business_discovery_failed", {
      connection_id: connectionId,
      organization_id: organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
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

  const adAccounts = await metaGraphGetAll<MetaAdAccountNode>(
    "me/adaccounts",
    accessToken,
    {
      fields:
        "id,account_id,name,account_status,disable_reason,currency,timezone_name,timezone_offset_hours_utc,amount_spent,balance,spend_cap,min_daily_budget,business,created_time",
    },
    env.META_APP_SECRET,
  );

  for (const account of adAccounts) {
    const { error } = await supabase.from("meta_ad_accounts").upsert(
      {
        organization_id: organizationId,
        connection_id: connectionId,
        business_account_id: account.business?.id
          ? (businessIdMap.get(account.business.id) ?? null)
          : null,
        external_ad_account_id: account.id,
        account_name: account.name ?? account.account_id ?? account.id,
        account_status_code: account.account_status ?? null,
        disable_reason_code: account.disable_reason ?? null,
        currency_code: account.currency ?? null,
        timezone_name: account.timezone_name ?? null,
        timezone_offset_hours_utc: account.timezone_offset_hours_utc ?? null,
        amount_spent:
          account.amount_spent != null
            ? Number(account.amount_spent) / 100
            : null,
        balance: account.balance != null ? Number(account.balance) / 100 : null,
        spend_cap:
          account.spend_cap != null ? Number(account.spend_cap) / 100 : null,
        minimum_daily_budget:
          account.min_daily_budget != null
            ? account.min_daily_budget / 100
            : null,
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

  const pages = await metaGraphGetAll<MetaPageNode>(
    "me/accounts",
    accessToken,
    {
      fields: "id,name,category,tasks,picture",
    },
    env.META_APP_SECRET,
  ).catch((error: unknown) => {
    logger.info("meta_pages_discovery_failed", {
      connection_id: connectionId,
      organization_id: organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
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

  return {
    businesses: businesses.length,
    adAccounts: adAccounts.length,
    pages: pages.length,
    assets: [
      ...businesses.map((business) => ({
        id: business.id,
        name: business.name ?? business.id,
        type: "business",
      })),
      ...adAccounts.map((account) => ({
        id: account.id,
        name: account.name ?? account.account_id ?? account.id,
        type: "ad_account",
      })),
      ...pages.map((page) => ({
        id: page.id,
        name: page.name ?? page.id,
        type: "page",
      })),
    ],
  };
}

export async function listMetaAssets(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
) {
  if (!hasOrganizationAccess(authContext, organizationId)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const supabase = createServiceClient(env);
  const { data: connections, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, status, provider_account_name, last_sync_at")
    .eq("organization_id", organizationId)
    .eq("provider", PROVIDER)
    // Una conexion viva manda sobre un OAuth abandonado: cada pulsacion de
    // "Conectar" deja una fila pending, y ordenar solo por updated_at deja
    // que una fila muerta gane por milisegundos si algo toca todas a la vez.
    .order("connected_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (connectionError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_connections_load_failed",
      detail: connectionError.message,
    };
  }

  const connectionIds = (connections ?? []).map(
    (connection) => connection.id as string,
  );
  if (connectionIds.length === 0) {
    return {
      ok: true as const,
      data: {
        connected: false,
        connection: null,
        businesses: [],
        pages: [],
        ad_accounts: [],
      },
    };
  }

  const [businessesResult, pagesResult, adAccountsResult] = await Promise.all([
    supabase
      .from("meta_business_accounts")
      .select(
        "id, connection_id, external_business_id, name, is_selected, is_active, last_synced_at",
      )
      .eq("organization_id", organizationId)
      .in("connection_id", connectionIds)
      .order("name", { ascending: true }),
    supabase
      .from("meta_pages")
      .select(
        "id, connection_id, external_page_id, name, is_selected, is_active, last_synced_at",
      )
      .eq("organization_id", organizationId)
      .in("connection_id", connectionIds)
      .order("name", { ascending: true }),
    supabase
      .from("meta_ad_accounts")
      .select(
        "id, connection_id, external_ad_account_id, account_name, is_selected, is_active, last_synced_at, currency_code, timezone_name",
      )
      .eq("organization_id", organizationId)
      .in("connection_id", connectionIds)
      .order("account_name", { ascending: true }),
  ]);

  const firstError =
    businessesResult.error ?? pagesResult.error ?? adAccountsResult.error;
  if (firstError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_assets_load_failed",
      detail: firstError.message,
    };
  }

  const connection = connections[0] ?? null;
  return {
    ok: true as const,
    data: {
      connected: true,
      connection,
      businesses: (businessesResult.data ?? []).map((row) => ({
        id: row.id,
        connection_id: row.connection_id,
        external_id: row.external_business_id,
        name: row.name,
        is_selected: row.is_selected,
        is_active: row.is_active,
        last_synced_at: row.last_synced_at,
      })) as MetaAssetRow[],
      pages: (pagesResult.data ?? []).map((row) => ({
        id: row.id,
        connection_id: row.connection_id,
        external_id: row.external_page_id,
        name: row.name,
        is_selected: row.is_selected,
        is_active: row.is_active,
        last_synced_at: row.last_synced_at,
      })) as MetaAssetRow[],
      ad_accounts: (adAccountsResult.data ?? []).map((row) => ({
        id: row.id,
        connection_id: row.connection_id,
        external_id: row.external_ad_account_id,
        name: row.account_name,
        is_selected: row.is_selected,
        is_active: row.is_active,
        last_synced_at: row.last_synced_at,
        currency_code: row.currency_code,
        timezone_name: row.timezone_name,
      })),
    },
  };
}

export async function updateMetaAssetSelection(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
  input: MetaAssetSelectionInput,
) {
  if (!canManageOrganization(authContext, organizationId)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_manage_denied",
      message:
        "Solo owner, manager o platform admin pueden seleccionar activos de Meta.",
    };
  }

  const businessIds = normalizeAssetIds(input.businessIds);
  const pageIds = normalizeAssetIds(input.pageIds);
  const adAccountIds = normalizeAssetIds(input.adAccountIds);
  if (
    businessIds === null ||
    pageIds === null ||
    adAccountIds === null ||
    (businessIds === undefined &&
      pageIds === undefined &&
      adAccountIds === undefined)
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_meta_asset_selection",
      message:
        "Envía arrays de IDs internos de activos Meta (máximo 100 por tipo).",
    };
  }

  const supabase = createServiceClient(env);
  const { data: connections, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, metadata")
    .eq("organization_id", organizationId)
    .eq("provider", PROVIDER);

  if (connectionError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_connections_load_failed",
      detail: connectionError.message,
    };
  }

  const connectionIds = (connections ?? []).map(
    (connection) => connection.id as string,
  );
  if (connectionIds.length === 0) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "meta_connection_not_found",
    };
  }

  // Validate the submitted internal IDs before resetting any selection. This
  // keeps the endpoint atomic from the caller's perspective: a typo or an ID
  // belonging to another organization cannot silently produce a false save.
  const requestedAssets = [
    { ids: businessIds, table: "meta_business_accounts" },
    { ids: pageIds, table: "meta_pages" },
    { ids: adAccountIds, table: "meta_ad_accounts" },
  ] as const;
  for (const requested of requestedAssets) {
    if (!requested.ids?.length) continue;
    const { data, error } = await supabase
      .from(requested.table)
      .select("id")
      .eq("organization_id", organizationId)
      .in("connection_id", connectionIds)
      .eq("is_active", true)
      .in("id", requested.ids);
    if (error) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "meta_asset_selection_validation_failed",
        detail: error.message,
      };
    }
    const found = new Set((data ?? []).map((row) => row.id as string));
    const missing = requested.ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      return {
        ok: false as const,
        statusCode: 400,
        error: "invalid_meta_asset_selection",
        message:
          "Uno o más activos no pertenecen a la organización, no están activos o ya no existen.",
      };
    }
  }

  const updates: Array<PromiseLike<{ error: { message: string } | null }>> = [];
  if (businessIds !== undefined) {
    updates.push(
      supabase
        .from("meta_business_accounts")
        .update({ is_selected: false })
        .eq("organization_id", organizationId)
        .in("connection_id", connectionIds),
    );
  }
  if (pageIds !== undefined) {
    updates.push(
      supabase
        .from("meta_pages")
        .update({ is_selected: false })
        .eq("organization_id", organizationId)
        .in("connection_id", connectionIds),
    );
  }
  if (adAccountIds !== undefined) {
    updates.push(
      supabase
        .from("meta_ad_accounts")
        .update({ is_selected: false })
        .eq("organization_id", organizationId)
        .in("connection_id", connectionIds),
    );
  }

  const resetResults = await Promise.all(updates);
  const resetError = resetResults.find((result) => result.error)?.error;
  if (resetError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_asset_selection_reset_failed",
      detail: resetError.message,
    };
  }

  const selectedUpdates: Array<
    PromiseLike<{ error: { message: string } | null }>
  > = [];
  if (businessIds?.length) {
    selectedUpdates.push(
      supabase
        .from("meta_business_accounts")
        .update({ is_selected: true })
        .eq("organization_id", organizationId)
        .in("connection_id", connectionIds)
        .in("id", businessIds),
    );
  }
  if (pageIds?.length) {
    selectedUpdates.push(
      supabase
        .from("meta_pages")
        .update({ is_selected: true })
        .eq("organization_id", organizationId)
        .in("connection_id", connectionIds)
        .in("id", pageIds),
    );
  }
  if (adAccountIds?.length) {
    selectedUpdates.push(
      supabase
        .from("meta_ad_accounts")
        .update({ is_selected: true })
        .eq("organization_id", organizationId)
        .in("connection_id", connectionIds)
        .in("id", adAccountIds),
    );
  }

  const selectedResults = await Promise.all(selectedUpdates);
  const selectedError = selectedResults.find((result) => result.error)?.error;
  if (selectedError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_asset_selection_update_failed",
      detail: selectedError.message,
    };
  }

  const selectedAt = new Date().toISOString();
  await Promise.all(
    (connections ?? []).map((connection) => {
      const currentMetadata =
        typeof connection.metadata === "object" && connection.metadata !== null
          ? (connection.metadata as Record<string, unknown>)
          : {};
      return supabase
        .from("integration_connections")
        .update({
          metadata: {
            ...currentMetadata,
            asset_selection: { confirmed_at: selectedAt, source: "portal" },
          },
        })
        .eq("id", connection.id);
    }),
  );

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: authContext.user.id,
    action: "meta_asset_selection_updated",
    entityType: "meta_asset_selection",
    newData: {
      businesses: businessIds?.length ?? null,
      pages: pageIds?.length ?? null,
      ad_accounts: adAccountIds?.length ?? null,
      source: "portal",
    },
  });

  return {
    ok: true as const,
    data: {
      selected: {
        businesses: businessIds?.length ?? null,
        pages: pageIds?.length ?? null,
        ad_accounts: adAccountIds?.length ?? null,
      },
      confirmed_at: selectedAt,
    },
  };
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
    if (state) {
      const supabase = createServiceClient(env);
      const { data: pending } = await supabase
        .from("integration_connections")
        .select("id")
        .eq("provider", PROVIDER)
        .eq("status", "pending")
        .contains("metadata", { state })
        .maybeSingle();
      if (pending) {
        await supabase
          .from("integration_connections")
          .update({
            status: "error",
            last_error_at: new Date().toISOString(),
            last_error_message: `meta_oauth_denied:${oauthError}`,
          })
          .eq("id", pending.id);
      }
    }
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
    return {
      ok: false,
      statusCode: 500,
      error: "meta_pending_connection_lookup_failed",
      detail: lookupError.message,
    };
  }

  // El state se compara contra el sembrado server-side en /connect, pero no se ata a la
  // sesion del navegador: el flujo de negocio exige poder generar la URL de autorizacion
  // desde el portal y enviarsela al owner real de la cuenta (mismo criterio que Shopify,
  // commit f74fcc0). El state es un UUID aleatorio no adivinable y solo puede vincular la
  // cuenta Meta a la organizacion que lo sembro, nunca a una elegida por el atacante.
  const pending = (connections ?? []).find(
    (connection) => parseState(connection.metadata) === state,
  );

  if (!pending) {
    return { ok: false, statusCode: 400, error: "invalid_meta_oauth_state" };
  }

  let token;
  try {
    token = await exchangeMetaCodeForLongLivedToken(appEnv, code);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    // La respuesta HTTP se queda en el codigo corto, asi que sin esto el motivo
    // real de Graph -- que es el unico dato accionable -- no aparece en ningun
    // sitio.
    logger.info("meta_token_exchange_failed", {
      connection_id: pending.id,
      organization_id: pending.organization_id,
      redirect_uri: appEnv.META_REDIRECT_URI,
      detail,
    });
    return {
      ok: false,
      statusCode: 502,
      error: "meta_token_exchange_failed",
      detail,
    };
  }

  let debugToken;
  try {
    debugToken = await debugMetaAccessToken(appEnv, token.accessToken);
  } catch (error) {
    return {
      ok: false,
      statusCode: 502,
      error: "meta_token_debug_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }

  if (debugToken.appId && debugToken.appId !== appEnv.META_APP_ID) {
    return {
      ok: false,
      statusCode: 403,
      error: "meta_token_app_mismatch",
      message: "El token Meta pertenece a otra aplicación.",
    };
  }

  // Se comprueba lo imprescindible, no todo lo que se pidio: un permiso
  // opcional que Meta no conceda no puede dejar la conexion en error para
  // siempre. Ver META_REQUIRED_SCOPES.
  const missingScopes = missingMetaScopes(
    META_REQUIRED_SCOPES,
    debugToken.scopes,
  );
  if (missingScopes.length > 0) {
    await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message: `meta_permissions_missing:${missingScopes.join(",")}`,
      })
      .eq("id", pending.id);
    return {
      ok: false,
      statusCode: 403,
      error: "meta_permissions_missing",
      message: "Meta no ha concedido todos los permisos requeridos.",
      missing_scopes: missingScopes,
    };
  }

  const me = await metaGraphGet<{ id?: string; name?: string }>(
    "me",
    token.accessToken,
    {
      fields: "id,name",
    },
    env.META_APP_SECRET,
  ).catch(() => null);

  const verifiedIdentity = getVerifiedMetaIdentity(me);
  if (isErr(verifiedIdentity)) {
    return {
      ok: false,
      statusCode: 502,
      error: verifiedIdentity.error,
      message: verifiedIdentity.message,
    };
  }

  try {
    await saveMetaToken(
      supabase,
      env,
      pending.id,
      token.accessToken,
      debugToken.expiresAt ?? token.expiresAt,
      debugToken.scopes.join(","),
    );
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
    discovery = await discoverMetaAssets(
      env,
      pending.id,
      pending.organization_id,
      token.accessToken,
    );
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

    return {
      ok: false,
      statusCode: 502,
      error: "meta_discovery_failed",
      detail,
    };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("integration_connections")
    .update({
      provider_account_id: verifiedIdentity.id,
      provider_account_name: verifiedIdentity.name,
      status: "connected",
      scopes: debugToken.scopes,
      connected_at: now,
      last_sync_at: now,
      metadata: { state, source: "oauth_start", discovery },
    })
    .eq("id", pending.id);

  if (updateError) {
    return {
      ok: false,
      statusCode: 500,
      error: "meta_connection_update_failed",
      detail: updateError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId: pending.organization_id,
    actorUserId: null,
    action: "meta.oauth_connected",
    entityType: "integration_connection",
    entityId: pending.id,
    newData: {
      provider: "meta_ads",
      provider_account_id: verifiedIdentity.id,
      scopes: debugToken.scopes,
      discovery,
    },
  });

  const metaSyncAdapter = createIntegrationAdapters(env).meta_ads;
  void metaSyncAdapter
    .runInitialSync({
      mode: "initial",
      connection: toIntegrationConnection({
        id: pending.id,
        organization_id: pending.organization_id,
        provider: "meta_ads",
        status: "connected",
      }),
    })
    .catch((error: unknown) => {
      logger.error("meta_initial_sync_failed", {
        connection_id: pending.id,
        organization_id: pending.organization_id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return {
    ok: true,
    data: { redirectUrl: `${env.WEB_ORIGIN}/integraciones?meta=connected` },
  };
}

/**
 * action_type de compra que EcomScaling propone por defecto. `omni_purchase`
 * es la columna "Compras" que el anunciante ve en Ads Manager para ecommerce
 * (agrega web, app y offline); coincide con el default de la migracion
 * `20260803120000_int_02_canonical_purchase_action_type.sql`.
 */
export const DEFAULT_PURCHASE_ACTION_TYPE = "omni_purchase";

/** action_type que Meta reporta como compra bajo distintas convenciones. */
const PURCHASE_ACTION_TYPE_PATTERN = /purchase/i;

/**
 * Ordena los action_type observados dejando primero los que parecen compras.
 * Meta emite decenas de action_type por cuenta (page_engagement, link_click,
 * landing_page_view...) y quien elige la metrica no deberia tener que buscar
 * la de compra entre todas.
 */
export function rankPurchaseActionTypes<T extends { action_type: string }>(
  rows: T[],
): T[] {
  return [...rows].sort((left, right) => {
    const leftIsPurchase = PURCHASE_ACTION_TYPE_PATTERN.test(left.action_type);
    const rightIsPurchase = PURCHASE_ACTION_TYPE_PATTERN.test(
      right.action_type,
    );
    if (leftIsPurchase !== rightIsPurchase) return leftIsPurchase ? -1 : 1;
    return left.action_type.localeCompare(right.action_type);
  });
}

/**
 * action_type realmente observados en los insights de la organizacion, por
 * cuenta publicitaria. No inventa un catalogo: si Meta nunca reporto un tipo,
 * no aparece, y una cuenta sin insights devuelve lista vacia.
 */
export async function listMetaPurchaseActionTypes(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
) {
  if (!isIntegrationFeatureEnabled("meta_ads", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "integration_disabled",
      message: "La integracion Meta Ads esta desactivada por feature flag.",
    };
  }
  if (!hasOrganizationAccess(authContext, organizationId)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const supabase = createServiceClient(env);
  const { data: accounts, error: accountsError } = await supabase
    .from("meta_ad_accounts")
    .select(
      "id, external_ad_account_id, account_name, canonical_purchase_action_type, canonical_purchase_action_selected_at, canonical_purchase_action_selected_by",
    )
    .eq("organization_id", organizationId)
    .eq("is_selected", true)
    .eq("is_active", true);
  if (accountsError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_ad_accounts_load_failed",
      detail: accountsError.message,
    };
  }

  const { data: observed, error: observedError } = await supabase
    .from("meta_insight_action_metrics")
    .select("action_type, value, meta_insight_rows_daily!inner(ad_account_id)")
    .eq("organization_id", organizationId)
    .eq("metric_name", "actions");
  if (observedError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_action_types_load_failed",
      detail: observedError.message,
    };
  }

  const totals = new Map<string, Map<string, number>>();
  for (const row of observed ?? []) {
    const relation = row.meta_insight_rows_daily as unknown as {
      ad_account_id?: string;
    } | null;
    const adAccountId = relation?.ad_account_id;
    if (!adAccountId || typeof row.action_type !== "string") continue;
    const perAccount = totals.get(adAccountId) ?? new Map<string, number>();
    perAccount.set(
      row.action_type,
      (perAccount.get(row.action_type) ?? 0) + Number(row.value ?? 0),
    );
    totals.set(adAccountId, perAccount);
  }

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      default_action_type: DEFAULT_PURCHASE_ACTION_TYPE,
      accounts: (accounts ?? []).map((account) => ({
        id: account.id,
        external_ad_account_id: account.external_ad_account_id,
        account_name: account.account_name,
        canonical_purchase_action_type: account.canonical_purchase_action_type,
        // Sin decision humana la cuenta sigue el default del sistema; la UI
        // debe poder decirlo en vez de aparentar una eleccion del cliente.
        is_default: !account.canonical_purchase_action_selected_by,
        selected_at: account.canonical_purchase_action_selected_at,
        observed_action_types: rankPurchaseActionTypes(
          [...(totals.get(account.id) ?? new Map<string, number>())].map(
            ([action_type, total]) => ({ action_type, total }),
          ),
        ),
      })),
    },
  };
}

export async function selectMetaPurchaseActionType(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
  adAccountId: string,
  actionType: string,
) {
  if (!isIntegrationFeatureEnabled("meta_ads", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "integration_disabled",
      message: "La integracion Meta Ads esta desactivada por feature flag.",
    };
  }
  if (!canManageOrganization(authContext, organizationId)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_manage_denied",
      message:
        "Solo owner, manager o platform admin pueden elegir el action_type de compra.",
    };
  }
  const normalizedActionType = actionType?.trim();
  if (!normalizedActionType || normalizedActionType.length > 255) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_purchase_action_type",
    };
  }

  const supabase = createServiceClient(env);
  const { data: account, error: accountError } = await supabase
    .from("meta_ad_accounts")
    .select("id, canonical_purchase_action_type")
    .eq("id", adAccountId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (accountError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_ad_accounts_load_failed",
      detail: accountError.message,
    };
  }
  if (!account) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "meta_ad_account_not_found",
    };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("meta_ad_accounts")
    .update({
      canonical_purchase_action_type: normalizedActionType,
      canonical_purchase_action_selected_at: now,
      canonical_purchase_action_selected_by: authContext.user.id,
    })
    .eq("id", account.id)
    .eq("organization_id", organizationId);
  if (updateError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_purchase_action_type_update_failed",
      detail: updateError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: authContext.user.id,
    action: "meta_purchase_action_type_selected",
    entityType: "meta_ad_account",
    entityId: account.id,
    oldData: {
      canonical_purchase_action_type: account.canonical_purchase_action_type,
    },
    newData: { canonical_purchase_action_type: normalizedActionType },
  });

  return {
    ok: true as const,
    data: {
      ad_account_id: account.id,
      canonical_purchase_action_type: normalizedActionType,
      selected_at: now,
    },
  };
}

export async function triggerMetaSync(
  env: ApiEnv,
  authContext: AuthContext,
  organizationId: string,
): Promise<
  | { ok: true; data: { status: string; connectionId: string } }
  | (Result & { ok: false })
> {
  if (!isIntegrationFeatureEnabled("meta_ads", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false,
      statusCode: 404,
      error: "integration_disabled",
      message: "La integracion Meta Ads esta desactivada por feature flag.",
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
        "Solo owner, manager o platform admin pueden lanzar un sync de Meta Ads.",
    };
  }

  const supabase = createServiceClient(env);

  const { data: connection, error } = await supabase
    .from("integration_connections")
    .select("id, organization_id, status, updated_at")
    .eq("organization_id", organizationId)
    .eq("provider", PROVIDER)
    .order("connected_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      statusCode: 500,
      error: "meta_connection_load_failed",
      detail: error.message,
    };
  }

  if (!connection) {
    return { ok: false, statusCode: 404, error: "meta_connection_not_found" };
  }

  let connectionStatus = connection.status;
  if (connection.status === "syncing") {
    const updatedAt = connection.updated_at
      ? new Date(connection.updated_at).getTime()
      : Date.now();
    const isStale = Date.now() - updatedAt > META_STALE_SYNCING_MS;
    if (!isStale) {
      return {
        ok: false,
        statusCode: 409,
        error: "meta_sync_already_running",
        message: "Ya hay una sincronización de Meta Ads en curso.",
      };
    }

    const { error: staleRecoveryError } = await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message:
          "La sincronización anterior de Meta quedó abierta y fue marcada como error automáticamente.",
      })
      .eq("id", connection.id);
    if (staleRecoveryError) {
      return {
        ok: false,
        statusCode: 500,
        error: "meta_stale_sync_recovery_failed",
        detail: staleRecoveryError.message,
      };
    }
    connectionStatus = "error";
  }
  if (connectionStatus !== "connected" && connectionStatus !== "error") {
    return {
      ok: false,
      statusCode: 409,
      error: "meta_connection_not_ready",
      message:
        "La conexión Meta Ads debe estar conectada antes de sincronizar.",
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
      error: "meta_sync_trigger_failed",
      detail: statusUpdateError.message,
    };
  }
  if (!claimedConnection) {
    return {
      ok: false,
      statusCode: 409,
      error: "meta_sync_already_running",
      message:
        "Otra sincronización de Meta Ads comenzó antes de completar esta solicitud.",
    };
  }

  const metaSyncAdapter = createIntegrationAdapters(env).meta_ads;
  void metaSyncAdapter
    .runInitialSync({
      mode: "initial",
      connection: toIntegrationConnection({
        id: connection.id,
        organization_id: connection.organization_id,
        provider: "meta_ads",
        status: connectionStatus,
      }),
    })
    .catch((syncError: unknown) =>
      markMetaSyncFailure(env, connection.id, syncError, "manual_sync"),
    );

  return { ok: true, data: { status: "queued", connectionId: connection.id } };
}
