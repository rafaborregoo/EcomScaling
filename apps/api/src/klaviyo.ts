import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { isIntegrationFeatureEnabled } from "@ecomscaling/integrations";
import type { AuthContext } from "./auth-context.js";
import { createKlaviyoClient } from "./klaviyo-client.js";
import { recordAuditLog } from "./audit-log.js";
import {
  buildKlaviyoAuthorizeUrl,
  createKlaviyoCodeChallenge,
  createKlaviyoCodeVerifier,
  exchangeKlaviyoCodeForTokens,
  resolveKlaviyoOAuthEnv,
} from "./klaviyo-oauth.js";
import { saveKlaviyoTokens } from "./klaviyo-token-store.js";
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

function canManage(context: AuthContext, organizationId: string) {
  const membership = context.memberships.find(
    (item) => item.organization_id === organizationId,
  );
  if (!membership) return "organization_access_denied";
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
      scopes: oauthEnv.KLAVIYO_SCOPES.split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
      api_version: "2026-04-15",
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
  if (typeof query.error === "string")
    return {
      ok: true,
      data: { redirectUrl: `${env.WEB_ORIGIN}/integraciones?klaviyo=denied` },
    };
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
    await saveKlaviyoTokens(env, pending.id, tokens);
    const api = createKlaviyoClient(tokens.access_token);
    const account = await api.getAccount();
    const accountAttributes = account.attributes ?? {};
    const now = new Date().toISOString();
    const { error: accountError } = await supabase
      .from("klaviyo_accounts")
      .upsert(
        {
          organization_id: pending.organization_id,
          connection_id: pending.id,
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
        scopes: oauthEnv.KLAVIYO_SCOPES.split(",")
          .map((scope) => scope.trim())
          .filter(Boolean),
        connected_at: now,
        metadata: { source: "oauth_callback", api_revision: "2026-04-15" },
      })
      .eq("id", pending.id);
    if (connectionError)
      throw new Error(
        `klaviyo_connection_update_failed:${connectionError.message}`,
      );

    await recordAuditLog(supabase, {
      organizationId: pending.organization_id,
      actorUserId: null,
      action: "klaviyo.oauth_connected",
      entityType: "integration_connection",
      entityId: pending.id,
      newData: {
        provider: "klaviyo",
        provider_account_id: account.id,
        scopes: oauthEnv.KLAVIYO_SCOPES.split(",")
          .map((scope) => scope.trim())
          .filter(Boolean),
      },
    });

    void runKlaviyoSync(env, pending.id, "initial").catch(() => undefined);
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
  if (
    !context.memberships.some((item) => item.organization_id === organizationId)
  ) {
    return { ok: false, statusCode: 403, error: "organization_access_denied" };
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
