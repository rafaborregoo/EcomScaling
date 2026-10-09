import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AuthContext,
  createUserScopedClient,
  isOperationalOrganizationError,
  requireOwnOrganizationAccess,
} from "./auth-context.js";
import { isErr } from "./result-guard.js";
import {
  deriveIntegrationHealth,
  evaluateIntegrationActivation,
  INTEGRATION_CATALOG,
  isIntegrationFeatureEnabled,
  type IntegrationHealth,
  type IntegrationActivationReadiness,
} from "@e-nora/integrations";

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
  provider_account_id: string | null;
  provider_account_name: string | null;
  status: string;
  scopes: string[];
  api_version: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string;
  // Opcional: las fixtures de los tests y cualquier lectura que no lo pida
  // siguen encajando. Lo que lo consume (classifyAuthorizationAttempt) ya cae
  // a created_at cuando falta.
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
  app_mode?: "public" | "custom" | null;
};

type ConnectionView = Omit<ConnectionRow, "metadata">;

function connectionAppMode(
  connection: Pick<ConnectionRow, "metadata">,
): "public" | "custom" | null {
  const mode = connection.metadata?.app_mode;
  return mode === "public" || mode === "custom" ? mode : null;
}

function toConnectionView(connection: ConnectionRow): ConnectionView {
  const { metadata: _metadata, ...safeConnection } = connection;
  return safeConnection;
}

/** Conexion establecida pegando una API key privada (Klaviyo pk_...), sin OAuth. */
function isApiKeyConnection(connection: ConnectionRow | null): boolean {
  return (
    connection?.metadata != null &&
    typeof connection.metadata === "object" &&
    (connection.metadata as { source?: unknown }).source === "api_key"
  );
}

type SyncRunRow = {
  id: string;
  connection_id: string;
  sync_type: string;
  sync_scope?: string | null;
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
  const apiKeyConnection = isApiKeyConnection(connection);
  const evidence = {
    credentialsValid: provider.configuration.status === "configured",
    // A persisted connection was only created after the configured callback
    // completed; this does not expose or persist the URI itself. Una conexion
    // por API key no pasa por callback.
    redirectUriExact: Boolean(
      connection && (apiKeyConnection || provider.capabilities.oauth),
    ),
    // Una conexion por API key no tiene scopes OAuth: la validacion de la key
    // contra /accounts al conectar es la evidencia equivalente de permisos.
    scopesGranted: Boolean(
      !provider.capabilities.oauth ||
        apiKeyConnection ||
        (connection && connection.scopes.length > 0),
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
          ? // Klaviyo se conecta pegando una private API key (pk_...), que NO
            // necesita credenciales de app en el servidor. Si la feature esta
            // disponible, la integracion es conectable; las vars OAuth solo
            // habilitan ademas la opcion de OAuth (klaviyo_app_available).
            available
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
        "provider_account_id",
        "provider_account_name",
        "status",
        "scopes",
        "api_version",
        "connected_at",
        "last_sync_at",
        "last_error_at",
        "last_error_message",
        "created_at",
        // Un intento de OAuth relanzado pisa la fila via upsert: updated_at es
        // la ultima vez que alguien lo intento, y es lo que distingue "en
        // curso" de "abandonado" (classifyAuthorizationAttempt).
        "updated_at",
        "metadata",
      ].join(", "),
    )
    .eq("organization_id", organizationId)
    .order("provider", { ascending: true });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return {
    ok: true as const,
    data: (data ?? []).map((row) => {
      const connection = row as unknown as ConnectionRow;
      return {
        ...connection,
        app_mode: connectionAppMode(connection),
      };
    }),
  };
}

// Severidad del estado de una conexion: mas alto = peor. Un solo orden para
// todo el producto.
//
// Antes habia dos y opuestos: la matriz de cartera colapsaba varias conexiones
// del mismo proveedor con "peor gana" y el detalle de un cliente con "mejor
// gana". Un cliente con dos tiendas y una por reautorizar salia rojo en la
// lista y verde al entrar -- y la que habia que arreglar no aparecia en
// ninguna pantalla.
//
// Un estado que no conocemos no es "sano": va por encima de connected, porque
// no saber que le pasa a una tienda es motivo para mirarla.
export function connectionSeverity(status: string): number {
  switch (status) {
    case "reauthorization_required":
    case "needs_reauth":
      return 5;
    case "error":
      return 4;
    case "pending_deletion":
      return 3;
    case "disconnected":
      return 2;
    case "pending":
      return 1;
    case "connected":
    case "syncing":
      return 0;
    default:
      return 1;
  }
}

// Lo mismo para la salud derivada (deriveIntegrationHealth), que no es el
// estado crudo de la conexion: una tienda 'connected' que lleva dos semanas sin
// sincronizar sale 'stale'.
export function healthSeverity(status: string): number {
  switch (status) {
    case "reauthorization_required":
    case "needs_reauth":
      return 5;
    case "error":
      return 4;
    case "degraded":
      return 3;
    case "stale":
      return 2;
    case "unknown":
      return 1;
    case "healthy":
    case "syncing":
      return 0;
    default:
      return 1;
  }
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
        "sync_scope",
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
    // Un upsert de reintento actualiza started_at, pero conserva created_at;
    // ordenar por inicio evita que la UI lea como actual una pasada anterior.
    .order("started_at", { ascending: false, nullsFirst: false })
    // Unas 30 por conexion: el historial de la ficha y, por bloque, lo ultimo
    // que trajo cada uno.
    .limit(Math.min(1000, connectionIds.length * 30));

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

  const access = requireOwnOrganizationAccess(context, organizationId);
  if (isOperationalOrganizationError(access)) {
    return {
      ok: false as const,
      statusCode: access.statusCode,
      error: access.error,
      message: access.message,
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
            connections: [],
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
        // Cada conexion es una tienda, y lleva su propia salud, su ultimo sync
        // y su propia activacion. Antes se elegia una sola -- la mas sana -- y
        // de ella salia todo el estado del proveedor, asi que la tienda rota de
        // al lado no aparecia en ninguna parte de la interfaz.
        const connections = connectionsResult.data
          .filter((item) => {
            if (item.provider !== provider.id) return false;
            // Klaviyo uses `pending:<state>` rows only as temporary PKCE
            // storage while OAuth is in flight. A denied/abandoned attempt
            // is not an account and must not become the provider's health or
            // appear in the account picker.
            return !(
              provider.id === "klaviyo" &&
              typeof item.provider_account_id === "string" &&
              item.provider_account_id.startsWith("pending:")
            );
          })
          .map((connection) => {
            const runs = latestRunsResult.data
              .filter((item) => item.connection_id === connection.id)
              .slice(0, 30);
            const latestSync = runs[0] ?? null;
            const health = deriveIntegrationHealth({
              available: provider.available,
              connectionStatus: connection.status,
              lastSyncAt: connection.last_sync_at,
              lastErrorAt: connection.last_error_at,
              latestSyncStatus: latestSync?.status ?? null,
              latestSyncStartedAt: latestSync?.started_at ?? null,
            });

            return {
              ...toConnectionView(connection),
              latest_sync: latestSync,
              recent_syncs: runs,
              health,
              activation: deriveIntegrationActivation(
                provider,
                connection,
                latestSync,
                health,
                hasRecoveredSync(connection.id, runs),
              ),
            };
          })
          // Peor primero: lo que hay que atender se lee sin buscarlo.
          .sort(
            (left, right) =>
              healthSeverity(right.health.status) -
                healthSeverity(left.health.status) ||
              connectionSeverity(right.status) -
                connectionSeverity(left.status),
          );

        // Una baja programada ya no es una tienda activa: se conserva en
        // `connections` para que la interfaz permita restaurarla, pero no debe
        // convertirse en el resumen operativo ni mostrar datos obsoletos como
        // si fueran de una conexión activa.
        const worst =
          connections.find((connection) => connection.status !== "pending_deletion") ??
          null;
        const noConnectionHealth = deriveIntegrationHealth({
          available: provider.available,
        });

        return {
          ...provider,
          connection: worst,
          connections,
          latest_sync: worst?.latest_sync ?? null,
          health: worst?.health ?? noConnectionHealth,
          activation:
            worst?.activation ??
            deriveIntegrationActivation(
              provider,
              null,
              null,
              noConnectionHealth,
            ),
        };
      }),
    },
  };
}
