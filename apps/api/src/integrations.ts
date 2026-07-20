import type { SupabaseClient } from "@supabase/supabase-js";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SHOPIFY_CUSTOM_API_KEY?: string;
  SHOPIFY_CUSTOM_API_SECRET?: string;
  SHOPIFY_CUSTOM_SCOPES?: string;
  SHOPIFY_CUSTOM_REDIRECT_URI?: string;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_REDIRECT_URI?: string;
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
  id: "shopify" | "meta_ads" | "klaviyo";
  name: string;
  phase: string;
  description: string;
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

const providers: Provider[] = [
  {
    id: "shopify",
    name: "Shopify",
    phase: "INT-01",
    description: "Tienda, productos, inventario, pedidos y reembolsos.",
  },
  {
    id: "meta_ads",
    name: "Meta Ads",
    phase: "INT-02",
    description: "Campanas, conjuntos, anuncios, gasto y ROAS.",
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    phase: "INT-03",
    description: "Listas, segmentos, flows, campanas y revenue email.",
  },
];

function isMissingSchemaError(message: string) {
  return (
    message.includes("integration_connections") ||
    message.includes("integration_sync_runs") ||
    message.includes("Could not find the table")
  );
}

async function loadConnections(supabase: SupabaseClient, organizationId: string) {
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

  return { ok: true as const, data: (data ?? []) as unknown as ConnectionRow[] };
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
  const providerConnections = connections.filter((connection) => connection.provider === providerId);

  if (!providerConnections.length) {
    return null;
  }

  return [...providerConnections].sort((left, right) => {
    const statusDiff = rankConnectionStatus(right.status) - rankConnectionStatus(left.status);

    if (statusDiff !== 0) {
      return statusDiff;
    }

    const leftDate = new Date(left.connected_at ?? left.created_at).getTime();
    const rightDate = new Date(right.connected_at ?? right.created_at).getTime();

    return rightDate - leftDate;
  })[0] ?? null;
}

async function loadLatestRuns(supabase: SupabaseClient, connectionIds: string[]) {
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
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
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

  if (!connectionsResult.ok) {
    if (isMissingSchemaError(connectionsResult.error)) {
      return {
        ok: true as const,
        data: {
          organization_id: organizationId,
          schema_ready: false,
          shopify_custom_app_available: isCustomShopifyAppAvailable(env),
          meta_app_available: Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI),
          providers: providers.map((provider) => ({
            ...provider,
            connection: null,
            latest_sync: null,
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

  if (!latestRunsResult.ok) {
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
          meta_app_available: Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_REDIRECT_URI),
      providers: providers.map((provider) => {
        const connection = pickBestConnection(connectionsResult.data, provider.id);
        const latestSync = connection
          ? latestRunsResult.data.find((item) => item.connection_id === connection.id) ?? null
          : null;

        return {
          ...provider,
          connection,
          latest_sync: latestSync,
        };
      }),
    },
  };
}
