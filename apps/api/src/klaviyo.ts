import {
  summariseSubjectTraits,
  type KlaviyoSubjectRow,
  type SubjectTraitComparison,
} from "./klaviyo-subject-patterns.js";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { isIntegrationFeatureEnabled } from "@e-nora/integrations";
import { sanitizeGeneratedEmailHtml } from "@e-nora/ai";
import {
  requireOperationalOrganization,
  requireOwnOrganizationAccess,
  isOperationalOrganizationError,
  type AuthContext,
} from "./auth-context.js";
import { createKlaviyoClient } from "./klaviyo-client.js";
import {
  describeKlaviyoMissingPermissions,
  isKlaviyoPermissionError,
  klaviyoCapability,
  probeKlaviyoPermissions,
} from "./klaviyo-permissions.js";
import { recordAuditLog } from "./audit-log.js";
import { emailHtmlToPlainText } from "./email-body-text.js";
import {
  buildKlaviyoAuthorizeUrl,
  createKlaviyoCodeChallenge,
  createKlaviyoCodeVerifier,
  exchangeKlaviyoCodeForTokens,
  missingKlaviyoScopes,
  parseKlaviyoScopes,
  resolveKlaviyoOAuthEnv,
} from "./klaviyo-oauth.js";
import {
  getValidKlaviyoAccessToken,
  saveKlaviyoApiKey,
  saveKlaviyoTokens,
} from "./klaviyo-token-store.js";
import { runKlaviyoSync } from "./klaviyo-sync.js";

type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      statusCode: number;
      error: string;
      message?: string;
      detail?: string;
    };

function serviceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function markKlaviyoSyncFailure(
  env: LoadedApiEnv,
  connectionId: string,
  error: unknown,
  operation: string,
) {
  const message =
    error instanceof Error
      ? error.message
      : "klaviyo_background_sync_failed";
  const supabase = serviceClient(env);
  const { error: persistenceError } = await supabase
    .from("integration_connections")
    .update({
      status: "error",
      last_error_at: new Date().toISOString(),
      last_error_message: message.slice(0, 500),
    })
    .eq("id", connectionId);

  console.error("Klaviyo background sync failed", {
    connection_id: connectionId,
    operation,
    error: message,
    persistence_error: persistenceError?.message,
  });
}

function canManage(context: AuthContext, organizationId: string) {
  const operational = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(operational)) return operational.error;
  const { membership } = operational;
  if (
    context.profile.platform_role !== "platform_admin" &&
    !["owner", "manager"].includes(membership.role)
  ) {
    return "organization_manage_denied";
  }
  return null;
}

export async function createKlaviyoConnectionAuthUrl(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
): Promise<Result<{ redirectUrl: string }>> {
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false,
      statusCode: 404,
      error: "integration_feature_disabled",
    };
  }

  const oauthEnv = resolveKlaviyoOAuthEnv(env);
  if (!oauthEnv) {
    return {
      ok: false,
      statusCode: 400,
      error: "klaviyo_app_not_configured",
      message: "La app OAuth de Klaviyo no está configurada en el servidor.",
    };
  }
  const accessError = canManage(context, organizationId);
  if (accessError)
    return {
      ok: false,
      statusCode: accessError === "organization_access_denied" ? 403 : 403,
      error: accessError,
    };

  const state = crypto.randomUUID();
  const verifier = createKlaviyoCodeVerifier();
  const supabase = serviceClient(env);
  const { error } = await supabase.from("integration_connections").upsert(
    {
      organization_id: organizationId,
      provider: "klaviyo",
      provider_account_id: `pending:${state}`,
      provider_account_name: "Klaviyo",
      status: "pending",
      scopes: parseKlaviyoScopes(oauthEnv.KLAVIYO_SCOPES),
      api_version: "2026-07-15",
      metadata: { state, code_verifier: verifier, source: "oauth_start" },
    },
    { onConflict: "organization_id,provider,provider_account_id" },
  );
  if (error)
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_connection_seed_failed",
      detail: error.message,
    };

  return {
    ok: true,
    data: {
      redirectUrl: buildKlaviyoAuthorizeUrl(
        oauthEnv,
        state,
        createKlaviyoCodeChallenge(verifier),
      ),
    },
  };
}

/**
 * Conecta Klaviyo con una private API key (`pk_...`) en lugar de OAuth. No
 * requiere KLAVIYO_CLIENT_ID/SECRET: valida la key contra /accounts, persiste
 * la conexión + credencial cifrada y lanza el sync inicial.
 */
export async function connectKlaviyoWithApiKey(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  apiKey: string,
): Promise<Result<{ connectionId: string; accountName: string }>> {
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS)) {
    return { ok: false, statusCode: 404, error: "integration_feature_disabled" };
  }
  const accessError = canManage(context, organizationId);
  if (accessError) return { ok: false, statusCode: 403, error: accessError };

  const key = apiKey.trim();
  // Las private keys de Klaviyo son `pk_` + alfanumericos, guiones y guiones
  // bajos (el formato actual embebe el id de compañia: `pk_WCssZb_<hex>`). La
  // validacion real la hace la llamada a /accounts de abajo; esto solo descarta
  // pegar algo que claramente no es una key.
  if (!/^pk_[A-Za-z0-9_-]{6,}$/.test(key)) {
    return {
      ok: false,
      statusCode: 400,
      error: "invalid_klaviyo_api_key",
      message:
        "La API key privada de Klaviyo debe empezar por 'pk_' (formato pk_XXXXXX_...).",
    };
  }

  const supabase = serviceClient(env);
  let account;
  try {
    account = await createKlaviyoClient(key).getAccount();
  } catch (error) {
    return {
      ok: false,
      statusCode: 502,
      error: "klaviyo_api_key_rejected",
      message: "Klaviyo rechazó la API key. Revisa que sea correcta y con permisos de lectura.",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }

  // /accounts solo prueba que la key existe. Sin sondear el resto, una key
  // sin permisos se guarda "conectada" y falla despues en el sync, donde la
  // persona ya no tiene el panel de Klaviyo delante.
  const probe = await probeKlaviyoPermissions(createKlaviyoClient(key));
  const missingRequired = probe.missing.filter((item) => item.required);
  if (missingRequired.length > 0) {
    return {
      ok: false,
      statusCode: 403,
      error: "klaviyo_api_key_missing_permissions",
      message: describeKlaviyoMissingPermissions(missingRequired, "api_key"),
      detail: missingRequired.map((item) => item.key).join(","),
    };
  }

  const attributes = account.attributes ?? {};
  const accountName =
    typeof attributes.name === "string" ? attributes.name : "Klaviyo";
  const now = new Date().toISOString();

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .upsert(
      {
        organization_id: organizationId,
        provider: "klaviyo",
        provider_account_id: account.id,
        provider_account_name: accountName,
        status: "connected",
        // Lo que la key puede hacer de verdad, no una lista vacia: asi la UI
        // puede decir "esta key no publica plantillas" sin volver a preguntar.
        scopes: probe.granted,
        api_version: "2026-07-15",
        connected_at: now,
        last_error_at: null,
        last_error_message: null,
        metadata: { source: "api_key" },
      },
      { onConflict: "organization_id,provider,provider_account_id" },
    )
    .select("id")
    .single();
  if (connectionError || !connection)
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_connection_seed_failed",
      detail: connectionError?.message,
    };

  try {
    await saveKlaviyoApiKey(env, connection.id, key);
  } catch (error) {
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_credential_store_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }

  const { error: accountError } = await supabase
    .from("klaviyo_accounts")
    .upsert(
      {
        organization_id: organizationId,
        connection_id: connection.id,
        external_account_id: account.id,
        name: accountName,
        timezone:
          typeof attributes.timezone === "string" ? attributes.timezone : null,
        currency_code:
          typeof attributes.currency_code === "string"
            ? attributes.currency_code.toUpperCase()
            : null,
        raw_data: attributes,
        last_synced_at: now,
      },
      { onConflict: "connection_id,external_account_id" },
    );
  if (accountError)
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_account_store_failed",
      detail: accountError.message,
    };

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "klaviyo.api_key_connected",
    entityType: "integration_connection",
    entityId: connection.id,
    newData: { provider: "klaviyo", provider_account_id: account.id },
  });

  void runKlaviyoSync(env, connection.id, "initial").catch((error: unknown) =>
    markKlaviyoSyncFailure(env, connection.id, error, "api_key_initial_sync"),
  );

  return {
    ok: true,
    data: { connectionId: connection.id, accountName },
  };
}

export async function triggerKlaviyoSync(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId?: string,
): Promise<Result<{ status: "syncing"; connectionId: string }>> {
  const accessError = canManage(context, organizationId);
  if (accessError) {
    return {
      ok: false,
      statusCode: 403,
      error: accessError,
    };
  }

  const supabase = serviceClient(env);
  let query = supabase
    .from("integration_connections")
    .select("id, organization_id, status")
    .eq("organization_id", organizationId)
    .eq("provider", "klaviyo");
  if (connectionId) query = query.eq("id", connectionId);
  const { data: connection, error } = await query
    .order("updated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_connection_load_failed",
      detail: error.message,
    };
  }
  if (!connection) {
    return {
      ok: false,
      statusCode: 404,
      error: "klaviyo_connection_not_found",
    };
  }
  if (connection.status === "syncing") {
    return {
      ok: false,
      statusCode: 409,
      error: "klaviyo_sync_already_running",
      message: "Ya hay una sincronización de Klaviyo en curso.",
    };
  }
  if (connection.status !== "connected" && connection.status !== "error") {
    return {
      ok: false,
      statusCode: 409,
      error: "klaviyo_connection_not_ready",
      message:
        "La conexión Klaviyo debe estar conectada antes de poder sincronizar.",
    };
  }

  const { data: claimedConnection, error: updateError } = await supabase
    .from("integration_connections")
    .update({ status: "syncing" })
    .eq("id", connection.id)
    .eq("status", connection.status)
    .select("id")
    .maybeSingle();
  if (updateError) {
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_sync_trigger_failed",
      detail: updateError.message,
    };
  }
  if (!claimedConnection) {
    return {
      ok: false,
      statusCode: 409,
      error: "klaviyo_sync_already_running",
      message:
        "Otra sincronización de Klaviyo comenzó antes de completar esta solicitud.",
    };
  }

  // force: es un disparo manual explícito -> ignora la idempotencia diaria.
  void runKlaviyoSync(env, connection.id, "initial", true).catch(
    (error: unknown) =>
      markKlaviyoSyncFailure(env, connection.id, error, "manual_sync"),
  );
  return {
    ok: true,
    data: { status: "syncing", connectionId: connection.id },
  };
}

function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || !(key in metadata))
    return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function handleKlaviyoOAuthCallback(
  env: LoadedApiEnv,
  query: Record<string, string | string[] | undefined>,
): Promise<Result<{ redirectUrl: string }>> {
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false,
      statusCode: 404,
      error: "integration_feature_disabled",
    };
  }

  const oauthEnv = resolveKlaviyoOAuthEnv(env);
  if (!oauthEnv)
    return { ok: false, statusCode: 500, error: "klaviyo_app_not_configured" };
  const code = typeof query.code === "string" ? query.code : null;
  const state = typeof query.state === "string" ? query.state : null;
  if (typeof query.error === "string") {
    if (state) {
      const supabase = serviceClient(env);
      const { data: pending } = await supabase
        .from("integration_connections")
        .select("id")
        .eq("provider", "klaviyo")
        .eq("provider_account_id", `pending:${state}`)
        .eq("status", "pending")
        .maybeSingle();
      if (pending) {
        await supabase
          .from("integration_connections")
          .update({
            status: "error",
            last_error_at: new Date().toISOString(),
            last_error_message: `klaviyo_oauth_denied:${query.error}`,
          })
          .eq("id", pending.id);
      }
    }
    return {
      ok: true,
      data: { redirectUrl: `${env.WEB_ORIGIN}/integraciones?klaviyo=denied` },
    };
  }
  if (!code || !state)
    return { ok: false, statusCode: 400, error: "missing_oauth_parameters" };

  const supabase = serviceClient(env);
  const { data: pending, error: lookupError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, metadata")
    .eq("provider", "klaviyo")
    .eq("provider_account_id", `pending:${state}`)
    .eq("status", "pending")
    .maybeSingle();
  if (lookupError)
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_pending_connection_lookup_failed",
      detail: lookupError.message,
    };
  if (!pending || metadataString(pending.metadata, "state") !== state)
    return { ok: false, statusCode: 400, error: "invalid_klaviyo_oauth_state" };
  const verifier = metadataString(pending.metadata, "code_verifier");
  if (!verifier)
    return {
      ok: false,
      statusCode: 400,
      error: "missing_klaviyo_pkce_verifier",
    };

  try {
    const tokens = await exchangeKlaviyoCodeForTokens(oauthEnv, code, verifier);
    const grantedScopes = parseKlaviyoScopes(tokens.scope ?? "");
    const missingScopes = missingKlaviyoScopes(
      parseKlaviyoScopes(oauthEnv.KLAVIYO_SCOPES),
      grantedScopes,
    );
    if (!tokens.scope || missingScopes.length > 0) {
      await supabase
        .from("integration_connections")
        .update({
          status: "error",
          last_error_at: new Date().toISOString(),
          last_error_message: `klaviyo_permissions_missing:${missingScopes.join(",")}`,
        })
        .eq("id", pending.id);
      return {
        ok: false,
        statusCode: 403,
        error: "klaviyo_permissions_missing",
        message: "Klaviyo no ha devuelto todos los permisos solicitados.",
      };
    }
    const api = createKlaviyoClient(tokens.access_token);
    const account = await api.getAccount();
    const accountAttributes = account.attributes ?? {};
    const now = new Date().toISOString();

    // Cada "Conectar"/"Reautorizar" siembra una fila `pending` nueva
    // (provider_account_id = `pending:<state>`, siempre distinto). Si la
    // cuenta de Klaviyo autorizada ahora es la misma que ya tiene una
    // conexion real en esta organizacion, escribir el id de cuenta en ESTA
    // fila nueva chocaria con integration_connections_unique_provider
    // (organization_id, provider, provider_account_id) -- la fila vieja ya
    // lo tiene. Una reautorizacion tiene que terminar en la fila que ya
    // existe, no crear una segunda que nace muerta.
    const { data: existing, error: existingLookupError } = await supabase
      .from("integration_connections")
      .select("id")
      .eq("organization_id", pending.organization_id)
      .eq("provider", "klaviyo")
      .eq("provider_account_id", account.id)
      .neq("id", pending.id)
      .maybeSingle();
    if (existingLookupError)
      throw new Error(
        `klaviyo_existing_connection_lookup_failed:${existingLookupError.message}`,
      );
    const isReauthorization = Boolean(existing);
    const targetId = existing?.id ?? pending.id;

    await saveKlaviyoTokens(env, targetId, tokens);
    const { error: accountError } = await supabase
      .from("klaviyo_accounts")
      .upsert(
        {
          organization_id: pending.organization_id,
          connection_id: targetId,
          external_account_id: account.id,
          name:
            typeof accountAttributes.name === "string"
              ? accountAttributes.name
              : "Klaviyo",
          timezone:
            typeof accountAttributes.timezone === "string"
              ? accountAttributes.timezone
              : null,
          currency_code:
            typeof accountAttributes.currency_code === "string"
              ? accountAttributes.currency_code.toUpperCase()
              : null,
          raw_data: accountAttributes,
          last_synced_at: now,
        },
        { onConflict: "connection_id,external_account_id" },
      );
    if (accountError)
      throw new Error(`klaviyo_account_store_failed:${accountError.message}`);
    const { error: connectionError } = await supabase
      .from("integration_connections")
      .update({
        provider_account_id: account.id,
        provider_account_name:
          typeof accountAttributes.name === "string"
            ? accountAttributes.name
            : "Klaviyo",
        status: "connected",
        scopes: grantedScopes,
        connected_at: now,
        metadata: { source: "oauth_callback", api_revision: "2026-07-15" },
      })
      .eq("id", targetId);
    if (connectionError)
      throw new Error(
        `klaviyo_connection_update_failed:${connectionError.message}`,
      );

    // La fila `pending` solo era el sitio donde esperar el `state`/`verifier`
    // del OAuth. Si la reautorizacion escribio sobre la fila vieja, esta
    // queda huerfana y sin datos -- se borra, no se deja en `error` (no fue
    // un fallo, fue el sitio de paso).
    if (isReauthorization) {
      await supabase.from("integration_connections").delete().eq("id", pending.id);
    }

    await recordAuditLog(supabase, {
      organizationId: pending.organization_id,
      actorUserId: null,
      action: isReauthorization
        ? "klaviyo.oauth_reauthorized"
        : "klaviyo.oauth_connected",
      entityType: "integration_connection",
      entityId: targetId,
      newData: {
        provider: "klaviyo",
        provider_account_id: account.id,
        scopes: grantedScopes,
      },
    });

    void runKlaviyoSync(
      env,
      targetId,
      isReauthorization ? "incremental" : "initial",
    ).catch((error: unknown) =>
      markKlaviyoSyncFailure(env, targetId, error, "oauth_initial_sync"),
    );
    return {
      ok: true,
      data: {
        redirectUrl: `${env.WEB_ORIGIN}/integraciones?klaviyo=connected`,
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: new Date().toISOString(),
        last_error_message: detail.slice(0, 500),
      })
      .eq("id", pending.id);
    return {
      ok: false,
      statusCode: 502,
      error: "klaviyo_oauth_callback_failed",
      detail,
    };
  }
}

type KlaviyoMetricOption = {
  id: string;
  external_metric_id: string;
  name: string;
  metric_type: string | null;
  is_conversion_candidate: boolean;
  selected: boolean;
};

export async function listKlaviyoConversionMetrics(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
): Promise<
  Result<{
    account_id: string;
    conversion_metric_id: string | null;
    metrics: KlaviyoMetricOption[];
  }>
> {
  const access = requireOwnOrganizationAccess(context, organizationId);
  if (isOperationalOrganizationError(access)) {
    return {
      ok: false,
      statusCode: access.statusCode,
      error: access.error,
      ...(access.message ? { message: access.message } : {}),
    };
  }
  const supabase = serviceClient(env);
  const { data: account, error: accountError } = await supabase
    .from("klaviyo_accounts")
    .select("id, conversion_metric_id")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (accountError)
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_account_load_failed",
      detail: accountError.message,
    };
  if (!account)
    return {
      ok: true,
      data: { account_id: "", conversion_metric_id: null, metrics: [] },
    };
  const { data: metrics, error: metricsError } = await supabase
    .from("klaviyo_metrics")
    .select(
      "id, external_metric_id, name, metric_type, is_conversion_candidate",
    )
    .eq("organization_id", organizationId)
    .eq("account_id", account.id)
    .order("name", { ascending: true });
  if (metricsError)
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_metrics_load_failed",
      detail: metricsError.message,
    };
  return {
    ok: true,
    data: {
      account_id: account.id,
      conversion_metric_id: account.conversion_metric_id,
      metrics: (metrics ?? []).map((metric) => ({
        ...metric,
        selected: metric.external_metric_id === account.conversion_metric_id,
      })),
    },
  };
}

// --- Informe de email marketing para el panel del dashboard (cliente + consultor)
// Fuente: RPC klaviyo_email_report (ver migracion 20260829120000). Devuelve una
// fila por (mes, entidad); aqui se agrega la ventana, se parte flujos/campanas,
// se derivan rates y ranking de asuntos, y se calcula el periodo anterior para
// los deltas. Es de solo lectura: no propone escrituras.

type KlaviyoEmailReportRow = {
  bucket_month: string;
  entity_type: "campaign" | "flow";
  entity_id: string | null;
  entity_name: string | null;
  subject: string | null;
  send_time: string | null;
  trigger_type: string | null;
  revenue: number | string | null;
  conversions: number | string | null;
  recipients: number | string | null;
  delivered: number | string | null;
  opens_unique: number | string | null;
  clicks_unique: number | string | null;
  unsubscribes: number | string | null;
  bounced: number | string | null;
  spam_complaints: number | string | null;
};

const KLAVIYO_EMAIL_STAT_KEYS = [
  "revenue",
  "conversions",
  "recipients",
  "delivered",
  "opens_unique",
  "clicks_unique",
  "unsubscribes",
  "bounced",
  "spam_complaints",
] as const;
type KlaviyoEmailStatKey = (typeof KLAVIYO_EMAIL_STAT_KEYS)[number];
type KlaviyoEmailStatSums = Record<KlaviyoEmailStatKey, number>;

const num = (value: number | string | null | undefined): number => {
  const parsed = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(parsed) ? Number(parsed) : 0;
};
const ratio = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? numerator / denominator : null;

function zeroSums(): KlaviyoEmailStatSums {
  return Object.fromEntries(
    KLAVIYO_EMAIL_STAT_KEYS.map((key) => [key, 0]),
  ) as KlaviyoEmailStatSums;
}

function addRow(target: KlaviyoEmailStatSums, row: KlaviyoEmailReportRow): void {
  for (const key of KLAVIYO_EMAIL_STAT_KEYS) target[key] += num(row[key]);
}

function deriveTotals(
  all: KlaviyoEmailStatSums,
  campaign: KlaviyoEmailStatSums,
  flow: KlaviyoEmailStatSums,
) {
  return {
    ...all,
    campaign_revenue: campaign.revenue,
    flow_revenue: flow.revenue,
    flow_share_pct: ratio(flow.revenue, all.revenue),
    open_rate: ratio(all.opens_unique, all.delivered),
    click_rate: ratio(all.clicks_unique, all.delivered),
    ctor: ratio(all.clicks_unique, all.opens_unique),
    conversion_rate: ratio(all.conversions, all.delivered),
    revenue_per_recipient: ratio(all.revenue, all.recipients),
    unsub_rate: ratio(all.unsubscribes, all.delivered),
    bounce_rate: ratio(all.bounced, all.recipients),
    spam_rate: ratio(all.spam_complaints, all.delivered),
  };
}

function summariseKlaviyoEmailRows(rows: KlaviyoEmailReportRow[]) {
  const all = zeroSums();
  const campaign = zeroSums();
  const flow = zeroSums();
  const trendByMonth = new Map<string, { campaign: number; flow: number }>();
  const entities = new Map<
    string,
    {
      id: string;
      entity_type: "campaign" | "flow";
      name: string;
      subject: string | null;
      trigger_type: string | null;
      send_time: string | null;
      sums: KlaviyoEmailStatSums;
    }
  >();

  for (const row of rows) {
    addRow(all, row);
    const bucket = row.entity_type === "flow" ? flow : campaign;
    addRow(bucket, row);

    const month = row.bucket_month;
    const trend = trendByMonth.get(month) ?? { campaign: 0, flow: 0 };
    trend[row.entity_type === "flow" ? "flow" : "campaign"] += num(row.revenue);
    trendByMonth.set(month, trend);

    if (!row.entity_id) continue;
    const key = `${row.entity_type}:${row.entity_id}`;
    const entity = entities.get(key) ?? {
      id: row.entity_id,
      entity_type: row.entity_type,
      name: row.entity_name ?? "(sin nombre)",
      subject: row.subject,
      trigger_type: row.trigger_type,
      send_time: row.send_time,
      sums: zeroSums(),
    };
    addRow(entity.sums, row);
    // Conserva el asunto/nombre mas informativo si aparece en un mes posterior.
    if (!entity.subject && row.subject) entity.subject = row.subject;
    entities.set(key, entity);
  }

  const shapeEntity = (entity: {
    id: string;
    entity_type: "campaign" | "flow";
    name: string;
    subject: string | null;
    trigger_type: string | null;
    send_time: string | null;
    sums: KlaviyoEmailStatSums;
  }) => ({
    id: entity.id,
    name: entity.name,
    subject: entity.subject,
    trigger_type: entity.trigger_type,
    send_time: entity.send_time,
    revenue: entity.sums.revenue,
    conversions: entity.sums.conversions,
    recipients: entity.sums.recipients,
    delivered: entity.sums.delivered,
    opens_unique: entity.sums.opens_unique,
    clicks_unique: entity.sums.clicks_unique,
    open_rate: ratio(entity.sums.opens_unique, entity.sums.delivered),
    click_rate: ratio(entity.sums.clicks_unique, entity.sums.delivered),
    ctor: ratio(entity.sums.clicks_unique, entity.sums.opens_unique),
    revenue_per_recipient: ratio(entity.sums.revenue, entity.sums.recipients),
  });

  const list = [...entities.values()];
  const byRevenue = <T extends { revenue: number }>(a: T, b: T) =>
    b.revenue - a.revenue;

  return {
    totals: deriveTotals(all, campaign, flow),
    trend: [...trendByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => ({
        month,
        campaign_revenue: value.campaign,
        flow_revenue: value.flow,
      })),
    campaigns: list
      .filter((entity) => entity.entity_type === "campaign")
      .map(shapeEntity)
      .sort(byRevenue),
    flows: list
      .filter((entity) => entity.entity_type === "flow")
      .map(shapeEntity)
      .sort(byRevenue),
  };
}

type KlaviyoEmailReport = {
  organization_id: string;
  connected: boolean;
  period: { days: number; start: string; end: string };
  totals: ReturnType<typeof deriveTotals>;
  previous: ReturnType<typeof deriveTotals> | null;
  trend: ReturnType<typeof summariseKlaviyoEmailRows>["trend"];
  campaigns: ReturnType<typeof summariseKlaviyoEmailRows>["campaigns"];
  flows: ReturnType<typeof summariseKlaviyoEmailRows>["flows"];
  // null cuando su funcion falla: el resto del panel no depende de ellos.
  subject_traits: SubjectTraitComparison[] | null;
  top_links: KlaviyoLinkClicks[] | null;
};

export type KlaviyoLinkClicks = {
  url: string;
  clicks: number;
  personas: number;
  mensajes: number;
};

const KLAVIYO_TOP_LINKS = 8;

const KLAVIYO_EMAIL_DEFAULT_DAYS = 90;
const KLAVIYO_EMAIL_MAX_DAYS = 365;

export async function getKlaviyoEmailReport(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  daysInput: string | undefined,
  // Tienda activa del selector; sin ella, agregado del cliente.
  connectionId?: string,
): Promise<Result<KlaviyoEmailReport>> {
  if (!isIntegrationFeatureEnabled("klaviyo", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false,
      statusCode: 404,
      error: "integration_disabled",
      message: "La integracion Klaviyo esta desactivada por feature flag.",
    };
  }
  if (
    !context.memberships.some((item) => item.organization_id === organizationId)
  ) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }

  let periodDays = KLAVIYO_EMAIL_DEFAULT_DAYS;
  if (daysInput && daysInput !== "all") {
    const parsed = Number(daysInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      periodDays = Math.min(KLAVIYO_EMAIL_MAX_DAYS, Math.floor(parsed));
    }
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - periodDays * dayMs);
  const previousStart = new Date(periodStart.getTime() - periodDays * dayMs);
  const toDate = (value: Date) => value.toISOString().slice(0, 10);
  const period = {
    days: periodDays,
    start: periodStart.toISOString(),
    end: periodEnd.toISOString(),
  };

  const supabase = serviceClient(env);

  // El selector de la UI maneja ids de conexion Shopify; la funcion SQL filtra
  // por tienda. Se traduce aqui para que el frontend use un unico identificador
  // de tienda en todas las pantallas.
  let storeId: string | null = null;
  if (connectionId) {
    const { data: store } = await supabase
      .from("shopify_stores")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("connection_id", connectionId)
      .maybeSingle();
    storeId = (store?.id as string | undefined) ?? null;
  }

  // Antes era maybeSingle(), que con dos cuentas de Klaviyo en un mismo cliente
  // devuelve error y dejaba el panel entero vacio. Ahora se listan todas y, si
  // hay tienda activa, se mira solo la suya.
  let accountQuery = supabase
    .from("klaviyo_accounts")
    .select("id")
    .eq("organization_id", organizationId);
  if (storeId) accountQuery = accountQuery.eq("store_id", storeId);
  const { data: accounts, error: accountError } = await accountQuery.limit(1);
  const account = accounts?.[0] ?? null;
  if (accountError) {
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_account_load_failed",
      detail: accountError.message,
    };
  }
  if (!account) {
    const empty = summariseKlaviyoEmailRows([]);
    return {
      ok: true,
      data: {
        organization_id: organizationId,
        connected: false,
        period,
        totals: empty.totals,
        previous: null,
        trend: [],
        campaigns: [],
        flows: [],
        subject_traits: null,
        top_links: null,
      },
    };
  }

  const [currentResult, previousResult, subjectsResult, linksResult] = await Promise.all([
    supabase.rpc("klaviyo_email_report", {
      target_organization_id: organizationId,
      period_start: toDate(periodStart),
      period_end: toDate(periodEnd),
      target_store_id: storeId,
    }),
    supabase.rpc("klaviyo_email_report", {
      target_organization_id: organizationId,
      period_start: toDate(previousStart),
      period_end: toDate(periodStart),
      target_store_id: storeId,
    }),
    // Que rasgos del asunto se asocian con mas apertura en esta cuenta.
    supabase.rpc("klaviyo_subject_performance", {
      target_organization_id: organizationId,
      period_start: toDate(periodStart),
      period_end: toDate(periodEnd),
      target_store_id: storeId,
    }),
    // Que enlace se pulsa: responde "que CTA funciona", que el rendimiento por
    // envio no puede responder.
    supabase.rpc("klaviyo_link_clicks", {
      target_organization_id: organizationId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      target_store_id: storeId,
    }),
  ]);

  if (currentResult.error) {
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_email_report_failed",
      detail: currentResult.error.message,
    };
  }

  const current = summariseKlaviyoEmailRows(
    (currentResult.data ?? []) as KlaviyoEmailReportRow[],
  );
  const previous =
    !previousResult.error && Array.isArray(previousResult.data)
      ? summariseKlaviyoEmailRows(
          previousResult.data as KlaviyoEmailReportRow[],
        ).totals
      : null;

  return {
    ok: true,
    data: {
      organization_id: organizationId,
      connected: true,
      period,
      totals: current.totals,
      previous,
      trend: current.trend,
      campaigns: current.campaigns,
      flows: current.flows,
      subject_traits:
        subjectsResult.error || !Array.isArray(subjectsResult.data)
          ? null
          : summariseSubjectTraits(subjectsResult.data as KlaviyoSubjectRow[]),
      top_links:
        linksResult.error || !Array.isArray(linksResult.data)
          ? null
          : (linksResult.data as Array<Record<string, unknown>>)
              .slice(0, KLAVIYO_TOP_LINKS)
              .map((row) => ({
                url: String(row.url),
                clicks: Number(row.clicks ?? 0),
                personas: Number(row.personas ?? 0),
                mensajes: Number(row.mensajes ?? 0),
              })),
    },
  };
}

export async function selectKlaviyoConversionMetric(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  externalMetricId: string,
  source: "shopify" | "klaviyo" | "custom" | "other" = "klaviyo",
): Promise<
  Result<{ conversion_metric_id: string; conversion_metric_name: string }>
> {
  const accessError = canManage(context, organizationId);
  if (accessError) return { ok: false, statusCode: 403, error: accessError };
  if (!externalMetricId.trim())
    return {
      ok: false,
      statusCode: 400,
      error: "missing_conversion_metric_id",
    };
  const supabase = serviceClient(env);
  const { data: account, error: accountError } = await supabase
    .from("klaviyo_accounts")
    .select(
      "id, conversion_metric_id, conversion_metric_name, conversion_metric_source",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (accountError)
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_account_load_failed",
      detail: accountError.message,
    };
  if (!account)
    return { ok: false, statusCode: 409, error: "klaviyo_account_not_synced" };
  const { data: metric, error: metricError } = await supabase
    .from("klaviyo_metrics")
    .select("external_metric_id, name")
    .eq("organization_id", organizationId)
    .eq("account_id", account.id)
    .eq("external_metric_id", externalMetricId.trim())
    .maybeSingle();
  if (metricError)
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_metric_load_failed",
      detail: metricError.message,
    };
  if (!metric)
    return { ok: false, statusCode: 404, error: "klaviyo_metric_not_found" };

  const { error: updateError } = await supabase
    .from("klaviyo_accounts")
    .update({
      conversion_metric_id: metric.external_metric_id,
      conversion_metric_name: metric.name,
      conversion_metric_source: source,
      conversion_metric_selected_at: new Date().toISOString(),
      conversion_metric_selected_by: context.user.id,
    })
    .eq("id", account.id)
    .eq("organization_id", organizationId);
  if (updateError)
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_conversion_metric_update_failed",
      detail: updateError.message,
    };
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "klaviyo_conversion_metric_selected",
    entityType: "klaviyo_account",
    entityId: account.id,
    oldData: {
      conversion_metric_id: account.conversion_metric_id,
      conversion_metric_name: account.conversion_metric_name,
      conversion_metric_source: account.conversion_metric_source,
    },
    newData: {
      conversion_metric_id: metric.external_metric_id,
      conversion_metric_name: metric.name,
      conversion_metric_source: source,
    },
  });
  return {
    ok: true,
    data: {
      conversion_metric_id: metric.external_metric_id,
      conversion_metric_name: metric.name,
    },
  };
}

async function activeKlaviyoConnectionId(
  supabase: ReturnType<typeof serviceClient>,
  organizationId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("integration_connections")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("provider", "klaviyo")
    .in("status", ["connected", "syncing", "error"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

type KlaviyoTemplateSummary = {
  id: string;
  name: string;
  editor_type: string | null;
  updated: string | null;
};

/** Lista las plantillas de la cuenta Klaviyo conectada (solo lectura). */
export async function listKlaviyoTemplates(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
): Promise<Result<{ templates: KlaviyoTemplateSummary[] }>> {
  if (
    !context.memberships.some((item) => item.organization_id === organizationId)
  ) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }
  const supabase = serviceClient(env);
  const connectionId = await activeKlaviyoConnectionId(supabase, organizationId);
  if (!connectionId) {
    return {
      ok: false,
      statusCode: 409,
      error: "klaviyo_not_connected",
      message: "Conecta Klaviyo antes de importar plantillas.",
    };
  }

  try {
    const token = await getValidKlaviyoAccessToken(env, connectionId);
    const rows = await createKlaviyoClient(token).listResources("templates");
    const templates = rows
      .map((row) => {
        const attributes = (row.attributes ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          name:
            typeof attributes.name === "string" && attributes.name.trim()
              ? attributes.name
              : "(sin nombre)",
          editor_type:
            typeof attributes.editor_type === "string"
              ? attributes.editor_type
              : null,
          updated:
            typeof attributes.updated === "string" ? attributes.updated : null,
        };
      })
      .sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
    return { ok: true, data: { templates } };
  } catch (error) {
    return {
      ok: false,
      statusCode: 502,
      error: "klaviyo_templates_load_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

/** HTML saneado de una plantilla de Klaviyo, sin crear borrador (solo lectura). */
export async function previewKlaviyoTemplate(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  templateId: string,
): Promise<Result<{ html: string }>> {
  if (
    !context.memberships.some((item) => item.organization_id === organizationId)
  ) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
  }
  if (!templateId.trim()) {
    return { ok: false, statusCode: 400, error: "missing_template_id" };
  }
  const supabase = serviceClient(env);
  const connectionId = await activeKlaviyoConnectionId(supabase, organizationId);
  if (!connectionId) {
    return { ok: false, statusCode: 409, error: "klaviyo_not_connected" };
  }
  try {
    const token = await getValidKlaviyoAccessToken(env, connectionId);
    const response = await createKlaviyoClient(token).request<{
      data?: { attributes?: Record<string, unknown> };
    }>(`/templates/${encodeURIComponent(templateId)}`);
    const rawHtml =
      typeof response.data?.attributes?.html === "string"
        ? (response.data.attributes.html as string)
        : "";
    const html = sanitizeGeneratedEmailHtml(rawHtml);
    if (!html) {
      return {
        ok: false,
        statusCode: 422,
        error: "klaviyo_template_sin_html",
        message: "Esa plantilla de Klaviyo no tiene HTML importable.",
      };
    }
    return { ok: true, data: { html } };
  } catch (error) {
    return {
      ok: false,
      statusCode: 502,
      error: "klaviyo_template_fetch_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

/** Importa una plantilla de Klaviyo como borrador editable (solo HTML). */
export async function importKlaviyoTemplate(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  templateId: string,
): Promise<Result<{ draft_id: string }>> {
  const accessError = canManage(context, organizationId);
  if (accessError) return { ok: false, statusCode: 403, error: accessError };
  if (!templateId.trim()) {
    return { ok: false, statusCode: 400, error: "missing_template_id" };
  }

  const supabase = serviceClient(env);
  const connectionId = await activeKlaviyoConnectionId(supabase, organizationId);
  if (!connectionId) {
    return { ok: false, statusCode: 409, error: "klaviyo_not_connected" };
  }

  let attributes: Record<string, unknown>;
  try {
    const token = await getValidKlaviyoAccessToken(env, connectionId);
    const response = await createKlaviyoClient(token).request<{
      data?: { attributes?: Record<string, unknown> };
    }>(`/templates/${encodeURIComponent(templateId)}`);
    attributes = response.data?.attributes ?? {};
  } catch (error) {
    return {
      ok: false,
      statusCode: 502,
      error: "klaviyo_template_fetch_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }

  const rawHtml = typeof attributes.html === "string" ? attributes.html : "";
  const html = sanitizeGeneratedEmailHtml(rawHtml);
  if (!html) {
    return {
      ok: false,
      statusCode: 422,
      error: "klaviyo_template_sin_html",
      message: "Esa plantilla de Klaviyo no tiene HTML importable.",
    };
  }
  const name =
    typeof attributes.name === "string" && attributes.name.trim()
      ? attributes.name.slice(0, 160)
      : "Plantilla importada de Klaviyo";
  const plainText =
    typeof attributes.text === "string" && attributes.text.trim()
      ? attributes.text
      : emailHtmlToPlainText(html) || name;

  const { data: draft, error } = await supabase
    .from("marketing_content_drafts")
    .insert({
      organization_id: organizationId,
      created_by: context.user.id,
      content_type: "campaign",
      status: "draft",
      request: {
        channel: "email_klaviyo",
        source: "klaviyo_import",
        klaviyo_template_id: templateId,
      },
      summary: "Plantilla importada de Klaviyo.",
      template_name: name,
      subject: name.slice(0, 255),
      preheader: "",
      from_name: "",
      reply_to: null,
      purpose: "Plantilla reutilizada desde Klaviyo.",
      audience: "",
      locale: "es",
      tone: "brand",
      plain_text: plainText.slice(0, 100000),
      html,
      blocks: [],
      personalization_tokens: [],
      compliance_notes: [],
      sources: [],
      confidence: "high",
      warnings: [],
    })
    .select("id")
    .single();
  if (error || !draft) {
    return {
      ok: false,
      statusCode: 500,
      error: "klaviyo_template_import_failed",
      detail: error?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "klaviyo.template_imported",
    entityType: "marketing_content_draft",
    entityId: draft.id,
    newData: { klaviyo_template_id: templateId },
  });

  return { ok: true, data: { draft_id: draft.id } };
}

/** Atributos de plantilla que acepta Klaviyo desde un borrador nuestro. */
export type KlaviyoTemplateAttributes = {
  name: string;
  editor_type: "CODE";
  html: string;
  text: string;
};

/**
 * Peticion de escritura de plantilla: crear si no hay id, actualizar si lo hay.
 * Aparte del resto para poder comprobar la forma del cuerpo sin llamar a
 * Klaviyo -- `type` e `id` dentro de `data` son justo lo que rechaza la API
 * si se equivoca.
 */
export function klaviyoTemplateWriteRequest(
  existingId: string | null,
  attributes: KlaviyoTemplateAttributes,
): { path: string; init: RequestInit } {
  const body = existingId
    ? { data: { type: "template", id: existingId, attributes } }
    : { data: { type: "template", attributes } };
  return {
    path: existingId
      ? `/templates/${encodeURIComponent(existingId)}/`
      : "/templates/",
    init: {
      method: existingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  };
}

/**
 * Empuja el HTML de un borrador aprobado a Klaviyo como plantilla.
 *
 * Escritura en la cuenta del cliente, asi que exige borrador `approved` y rol
 * de gestion: el consultor decide, el software no publica solo. Idempotente
 * por `request.klaviyo_template_id`: la primera vez crea, despues actualiza la
 * misma plantilla en vez de sembrar duplicados en la cuenta. Si esa plantilla
 * ya no existe en Klaviyo (borrada a mano), se recrea.
 */
export async function pushDraftToKlaviyoTemplate(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  draftId: string,
): Promise<Result<{ klaviyo_template_id: string; created: boolean }>> {
  const accessError = canManage(context, organizationId);
  if (accessError) return { ok: false, statusCode: 403, error: accessError };
  if (!draftId.trim()) {
    return { ok: false, statusCode: 400, error: "missing_draft_id" };
  }

  const supabase = serviceClient(env);
  const { data: draft, error: draftError } = await supabase
    .from("marketing_content_drafts")
    .select("id, status, html, plain_text, template_name, subject, request")
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (draftError) {
    return {
      ok: false,
      statusCode: 500,
      error: "marketing_draft_load_failed",
      detail: draftError.message,
    };
  }
  if (!draft) {
    return { ok: false, statusCode: 404, error: "marketing_draft_not_found" };
  }
  if (draft.status !== "approved") {
    return {
      ok: false,
      statusCode: 409,
      error: "marketing_draft_not_approved",
      message: "Aprueba la pieza antes de enviarla a Klaviyo.",
    };
  }

  const html = sanitizeGeneratedEmailHtml(
    typeof draft.html === "string" ? draft.html : "",
  );
  if (!html) {
    return {
      ok: false,
      statusCode: 422,
      error: "marketing_draft_sin_html",
      message: "Esta pieza no tiene HTML que enviar.",
    };
  }
  const name = (
    (typeof draft.template_name === "string" && draft.template_name.trim()) ||
    (typeof draft.subject === "string" && draft.subject.trim()) ||
    "Plantilla de E-NORA"
  ).slice(0, 160);
  const text =
    typeof draft.plain_text === "string" && draft.plain_text.trim()
      ? draft.plain_text
      : emailHtmlToPlainText(html) || name;

  const connectionId = await activeKlaviyoConnectionId(supabase, organizationId);
  if (!connectionId) {
    return {
      ok: false,
      statusCode: 409,
      error: "klaviyo_not_connected",
      message: "Conecta Klaviyo antes de enviar plantillas.",
    };
  }

  const request = (draft.request ?? {}) as Record<string, unknown>;
  const existingId =
    typeof request.klaviyo_template_id === "string" &&
    request.klaviyo_template_id.trim()
      ? request.klaviyo_template_id
      : null;
  // `editor_type: CODE` es lo unico que acepta HTML propio; con el editor
  // visual Klaviyo ignora el cuerpo y guarda una plantilla vacia.
  const attributes: KlaviyoTemplateAttributes = {
    name,
    editor_type: "CODE",
    html,
    text,
  };

  let templateId: string;
  let created: boolean;
  try {
    const client = createKlaviyoClient(
      await getValidKlaviyoAccessToken(env, connectionId),
    );
    const create = async () => {
      const { path, init } = klaviyoTemplateWriteRequest(null, attributes);
      const response = await client.request<{ data?: { id?: string } }>(
        path,
        init,
      );
      const id = response.data?.id;
      if (!id) throw new Error("klaviyo_template_id_missing");
      return id;
    };

    if (existingId) {
      try {
        const update = klaviyoTemplateWriteRequest(existingId, attributes);
        await client.request(update.path, update.init);
        templateId = existingId;
        created = false;
      } catch (error) {
        // La plantilla pudo borrarse en Klaviyo; entonces recrear es lo
        // correcto, no fallar con un 404 que el consultor no puede arreglar.
        if (!(error instanceof Error && error.message.includes(":404:"))) {
          throw error;
        }
        templateId = await create();
        created = true;
      }
    } else {
      templateId = await create();
      created = true;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    // 403 aqui es casi siempre el scope: la conexion se autorizo solo de
    // lectura y hay que reconectar con `templates:write`.
    if (isKlaviyoPermissionError(message)) {
      const capability = klaviyoCapability("templates:write");
      return {
        ok: false,
        statusCode: 403,
        error: "klaviyo_template_write_denied",
        message: capability
          ? describeKlaviyoMissingPermissions([capability], "api_key") +
            " Si conectaste por OAuth, vuelve a autorizar la cuenta."
          : "Klaviyo rechaza la escritura de plantillas por falta de permisos.",
        detail: message,
      };
    }
    return {
      ok: false,
      statusCode: 502,
      error: "klaviyo_template_push_failed",
      detail: message,
    };
  }

  const { error: persistError } = await supabase
    .from("marketing_content_drafts")
    .update({ request: { ...request, klaviyo_template_id: templateId } })
    .eq("id", draftId)
    .eq("organization_id", organizationId);
  if (persistError) {
    return {
      ok: false,
      statusCode: 500,
      error: "marketing_draft_link_failed",
      detail: persistError.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: created ? "klaviyo.template_created" : "klaviyo.template_updated",
    entityType: "marketing_content_draft",
    entityId: draftId,
    newData: { klaviyo_template_id: templateId, name },
  });

  return { ok: true, data: { klaviyo_template_id: templateId, created } };
}
