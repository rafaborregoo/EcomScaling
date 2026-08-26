import type { SupabaseClient } from "@supabase/supabase-js";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { isErr } from "./result-guard.js";
import {
  deriveIntegrationHealth,
  evaluateIntegrationActivation,
  INTEGRATION_CATALOG,
  isIntegrationFeatureEnabled,
  type IntegrationHealth,
  type IntegrationActivationReadiness,
} from "@ecomscaling/integrations";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SHOPIFY_SCOPES?: string;
  SHOPIFY_REDIRECT_URI?: string;
  SHOPIFY_CUSTOM_API_KEY?: string;
  SHOPIFY_CUSTOM_API_SECRET?: string;
  SHOPIFY_CUSTOM_SCOPES?: string;
  SHOPIFY_CUSTOM_REDIRECT_URI?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_REDIRECT_URI?: string;
  KLAVIYO_CLIENT_ID?: string;
  KLAVIYO_CLIENT_SECRET?: string;
  KLAVIYO_REDIRECT_URI?: string;
  INTEGRATION_FEATURE_FLAGS?: string;
  FATHOM_API_KEY?: string;
  FATHOM_WEBHOOK_SECRET?: string;
};

function isCustomShopifyAppAvailable(env: ApiEnv) {
  return Boolean(
    env.SHOPIFY_CUSTOM_API_KEY &&
    env.SHOPIFY_CUSTOM_API_SECRET &&
    env.SHOPIFY_CUSTOM_SCOPES &&
    env.SHOPIFY_CUSTOM_REDIRECT_URI,
  );
}

type Provider = {
  id: "shopify" | "meta_ads" | "klaviyo" | "instagram" | "fathom";
  name: string;
  phase: string;
  description: string;
  available: boolean;
  feature_flag: string;
  capabilities: (typeof INTEGRATION_CATALOG)[number]["capabilities"];
  configuration: IntegrationConfiguration;
  health: IntegrationHealth;
  activation: IntegrationActivationReadiness;
};

export type IntegrationConfiguration = {
  status:
    | "configured"
    | "credentials_missing"
    | "feature_disabled"
    | "not_implemented";
  reason: string;
};

type ConnectionRow = {
  id: string;
  organization_id: string;
  provider: string;
  provider_account_name: string | null;
  status: string;
  scopes: string[];
  api_version: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string;
};

type SyncRunRow = {
  id: string;
  connection_id: string;
  sync_type: string;
  status: string;
  records_read: number;
  records_written: number;
  records_failed: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at: string;
};

export function deriveIntegrationActivation(
  provider: Pick<Provider, "configuration" | "capabilities">,
  connection: ConnectionRow | null,
  latestSync: SyncRunRow | null,
  health: IntegrationHealth,
  recoveryVerified = false,
): IntegrationActivationReadiness {
  const evidence = {
    credentialsValid: provider.configuration.status === "configured",
    // A persisted connection was only created after the configured callback
    // completed; this does not expose or persist the URI itself.
    redirectUriExact: Boolean(connection && provider.capabilities.oauth),
    scopesGranted: Boolean(
      !provider.capabilities.oauth || (connection && connection.scopes.length > 0),
    ),
    providerResponseValid: Boolean(connection?.status === "connected"),
    assetSelected: Boolean(
      !provider.capabilities.assetSelection || connection?.provider_account_name,
    ),
    initialSyncSucceeded: Boolean(
      !provider.capabilities.initialSync || latestSync?.status === "succeeded",
    ),
    freshnessAvailable: health.status === "healthy",
    reauthorizationVerified: Boolean(
      !provider.capabilities.oauth || connection?.status === "connected",
    ),
    recoverableErrorVerified: recoveryVerified,
  };
  return evaluateIntegrationActivation(evidence, provider.capabilities);
}

/**
 * A successful run after a failed/partial run is durable evidence that the
 * connector recovered. It is deliberately scoped to one connection and uses
 * only run metadata, never provider payloads or credentials.
 */
export function hasRecoveredSync(
  connectionId: string,
  runs: readonly Pick<SyncRunRow, "connection_id" | "status" | "created_at">[],
): boolean {
  const connectionRuns = runs
    .filter((run) => run.connection_id === connectionId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  const latest = connectionRuns[0];
  if (!latest || latest.status !== "succeeded") return false;
  return connectionRuns
    .slice(1)
    .some((run) => run.status === "failed" || run.status === "partial");
}

function buildProviders(env: ApiEnv): Provider[] {
  return INTEGRATION_CATALOG.map((provider) => {
    const available = isIntegrationFeatureEnabled(
      provider.id,
      env.INTEGRATION_FEATURE_FLAGS,
    );
    const configuration = deriveIntegrationConfiguration(
      provider.id,
      available,
      env,
    );
    const health = deriveIntegrationHealth({ available });
    return {
      ...provider,
      available,
      feature_flag: provider.featureFlag,
      configuration,
      health,
      activation: deriveIntegrationActivation(
        {
          configuration,
          capabilities: provider.capabilities,
        },
        null,
        null,
        health,
      ),
    };
  });
}

function isMissingSchemaError(message: string) {
  return (
    message.includes("integration_connections") ||
    message.includes("integration_sync_runs") ||
    message.includes("Could not find the table")
  );
}

/** Resolves connector activation truth without exposing secret values. */
export function deriveIntegrationConfiguration(
  providerId: Provider["id"],
  available: boolean,
  env: ApiEnv,
): IntegrationConfiguration {
  const credentialsConfigured =
    providerId === "shopify"
      ? Boolean(
          (env.SHOPIFY_API_KEY &&
            env.SHOPIFY_API_SECRET &&
            env.SHOPIFY_SCOPES &&
            env.SHOPIFY_REDIRECT_URI) ||
            isCustomShopifyAppAvailable(env),
        )
      : providerId === "meta_ads"
        ? Boolean(
            env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI,
          )
        : providerId === "klaviyo"
          ? Boolean(
              env.KLAVIYO_CLIENT_ID &&
              env.KLAVIYO_CLIENT_SECRET &&
              env.KLAVIYO_REDIRECT_URI,
            )
          : providerId === "fathom"
            ? Boolean(env.FATHOM_API_KEY && env.FATHOM_WEBHOOK_SECRET)
            : false;

  if (providerId === "instagram") {
    return {
      status: "not_implemented",
      reason: "instagram_connector_not_implemented",
    };
  }
  if (!available) {
    return { status: "feature_disabled", reason: "feature_flag_disabled" };
  }
  if (!credentialsConfigured) {
    return {
      status: "credentials_missing",
      reason: "provider_app_credentials_missing",
    };
  }
  return { status: "configured", reason: "provider_app_configured" };
}

async function loadConnections(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data, error } = await supabase
    .from("integration_connections")
    .select(
      [
        "id",
        "organization_id",
        "provider",
        "provider_account_name",
        "status",
        "scopes",
        "api_version",
        "connected_at",
        "last_sync_at",
        "last_error_at",
        "last_error_message",
        "created_at",
      ].join(", "),
    )
    .eq("organization_id", organizationId)
    .order("provider", { ascending: true });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return {
    ok: true as const,
    data: (data ?? []) as unknown as ConnectionRow[],
  };
}

function rankConnectionStatus(status: string) {
  switch (status) {
    case "connected":
      return 4;
    case "syncing":
      return 3;
    case "error":
      return 2;
    case "pending":
      return 1;
    default:
      return 0;
  }
}

function pickBestConnection(connections: ConnectionRow[], providerId: string) {
  const providerConnections = connections.filter(
    (connection) => connection.provider === providerId,
  );

  if (!providerConnections.length) {
    return null;
  }

  return (
    [...providerConnections].sort((left, right) => {
      const statusDiff =
        rankConnectionStatus(right.status) - rankConnectionStatus(left.status);

      if (statusDiff !== 0) {
        return statusDiff;
      }

      const leftDate = new Date(left.connected_at ?? left.created_at).getTime();
      const rightDate = new Date(
        right.connected_at ?? right.created_at,
      ).getTime();

      return rightDate - leftDate;
    })[0] ?? null
  );
}

async function loadLatestRuns(
  supabase: SupabaseClient,
  connectionIds: string[],
) {
  if (connectionIds.length === 0) {
    return { ok: true as const, data: [] as SyncRunRow[] };
  }

  const { data, error } = await supabase
    .from("integration_sync_runs")
    .select(
      [
        "id",
        "connection_id",
        "sync_type",
        "status",
        "records_read",
        "records_written",
        "records_failed",
        "started_at",
        "finished_at",
        "error_message",
        "created_at",
      ].join(", "),
    )
    .in("connection_id", connectionIds)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const, data: (data ?? []) as unknown as SyncRunRow[] };
}

export async function listIntegrations(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  const providers = buildProviders(env);

  if (
    !context.memberships.some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
      message: "El usuario no pertenece a la organizacion solicitada.",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);
  const connectionsResult = await loadConnections(supabase, organizationId);

  if (isErr(connectionsResult)) {
    if (isMissingSchemaError(connectionsResult.error)) {
      return {
        ok: true as const,
        data: {
          organization_id: organizationId,
          schema_ready: false,
          shopify_custom_app_available: isCustomShopifyAppAvailable(env),
          meta_app_available: Boolean(
            env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI,
          ),
          klaviyo_app_available: Boolean(
            env.KLAVIYO_CLIENT_ID &&
            env.KLAVIYO_CLIENT_SECRET &&
            env.KLAVIYO_REDIRECT_URI,
          ),
      providers: providers.map((provider) => ({
            ...provider,
            connection: null,
            latest_sync: null,
            health: deriveIntegrationHealth({ available: provider.available }),
            activation: deriveIntegrationActivation(
              provider,
              null,
              null,
              deriveIntegrationHealth({ available: provider.available }),
            ),
          })),
        },
      };
    }

    return {
      ok: false as const,
      statusCode: 500,
      error: "integrations_load_failed",
      detail: connectionsResult.error,
    };
  }

  const latestRunsResult = await loadLatestRuns(
    supabase,
    connectionsResult.data.map((connection) => connection.id),
  );

  if (isErr(latestRunsResult)) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "integration_sync_runs_load_failed",
      detail: latestRunsResult.error,
    };
  }

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      schema_ready: true,
      shopify_custom_app_available: isCustomShopifyAppAvailable(env),
      meta_app_available: Boolean(
        env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI,
      ),
      klaviyo_app_available: Boolean(
        env.KLAVIYO_CLIENT_ID &&
        env.KLAVIYO_CLIENT_SECRET &&
        env.KLAVIYO_REDIRECT_URI,
      ),
      providers: providers.map((provider) => {
        const connection = pickBestConnection(
          connectionsResult.data,
          provider.id,
        );
        const latestSync = connection
          ? (latestRunsResult.data.find(
              (item) => item.connection_id === connection.id,
            ) ?? null)
          : null;

        return {
          ...provider,
          connection,
          latest_sync: latestSync,
          health: deriveIntegrationHealth({
            available: provider.available,
            connectionStatus: connection?.status ?? null,
            lastSyncAt: connection?.last_sync_at ?? null,
            lastErrorAt: connection?.last_error_at ?? null,
            latestSyncStatus: latestSync?.status ?? null,
          }),
          activation: deriveIntegrationActivation(
            provider,
            connection,
            latestSync,
            deriveIntegrationHealth({
              available: provider.available,
              connectionStatus: connection?.status ?? null,
              lastSyncAt: connection?.last_sync_at ?? null,
              lastErrorAt: connection?.last_error_at ?? null,
              latestSyncStatus: latestSync?.status ?? null,
            }),
            Boolean(
              connection &&
                hasRecoveredSync(connection.id, latestRunsResult.data),
            ),
          ),
        };
      }),
    },
  };
}
