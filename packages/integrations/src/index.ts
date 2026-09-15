/** Providers supported by the integration lifecycle tables. */
export const INTEGRATION_PROVIDERS = [
  "shopify",
  "meta_ads",
  "klaviyo",
  "instagram",
  "fathom",
  "loom",
] as const;

export * from "./meta-ad-write-contract.js";
export * from "./meta-ad-executor.js";

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type IntegrationCatalogEntry = {
  id: "shopify" | "meta_ads" | "klaviyo" | "instagram" | "fathom";
  name: string;
  phase: string;
  description: string;
  available: boolean;
  featureFlag: string;
  capabilities: IntegrationCapabilities;
};

/** Product-facing connector catalog. Availability is a product flag, not a claim that credentials exist. */
export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    id: "shopify",
    name: "Shopify",
    phase: "INT-01",
    description: "Tienda, productos, inventario, pedidos y reembolsos.",
    available: true,
    featureFlag: "integration.shopify",
    capabilities: {
      oauth: true,
      tokenRefresh: true,
      webhooks: true,
      initialSync: true,
      incrementalSync: true,
      assetSelection: false,
    },
  },
  {
    id: "meta_ads",
    name: "Meta Ads",
    phase: "INT-02",
    description: "Campañas, conjuntos, anuncios, gasto y ROAS.",
    available: true,
    featureFlag: "integration.meta_ads",
    capabilities: {
      oauth: true,
      tokenRefresh: false,
      webhooks: false,
      initialSync: true,
      incrementalSync: true,
      assetSelection: true,
    },
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    phase: "INT-03",
    description: "Listas, segmentos, flows, campañas y revenue email.",
    available: true,
    featureFlag: "integration.klaviyo",
    capabilities: {
      oauth: true,
      tokenRefresh: true,
      webhooks: false,
      initialSync: true,
      incrementalSync: true,
      assetSelection: false,
    },
  },
  {
    id: "instagram",
    name: "Instagram",
    phase: "INT-05",
    description: "Contenido orgánico, publicaciones y rendimiento.",
    available: false,
    featureFlag: "integration.instagram",
    capabilities: {
      oauth: true,
      tokenRefresh: false,
      webhooks: false,
      initialSync: true,
      incrementalSync: true,
      assetSelection: true,
      authStrategies: ["instagram_login", "facebook_login"],
    },
  },
  {
    id: "fathom",
    name: "Fathom",
    phase: "INT-04",
    description: "Reuniones, transcripciones y análisis de llamadas con aprobación humana.",
    available: true,
    featureFlag: "integration.fathom",
    capabilities: {
      oauth: false,
      tokenRefresh: false,
      webhooks: true,
      initialSync: false,
      incrementalSync: false,
      assetSelection: false,
    },
  },
];

/**
 * Runtime allowlist. An unset value enables only the currently operational
 * connector (Shopify); future connectors require explicit opt-in. A future
 * provider still cannot become available by flag alone: it needs a real
 * implementation.
 */
export function isIntegrationFeatureEnabled(
  provider: IntegrationProvider,
  configuredFlags?: string,
): boolean {
  const catalogEntry = INTEGRATION_CATALOG.find((item) => item.id === provider);
  if (!catalogEntry?.available) return false;
  if (!configuredFlags?.trim()) return provider === "shopify" || provider === "fathom";

  const enabled = new Set(
    configuredFlags
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
  // Accept the short env form (`meta_ads`) and the canonical catalog form
  // (`integration.meta_ads`) so the public contract cannot disagree with the
  // runtime allowlist parser.
  return enabled.has(provider) || enabled.has(catalogEntry.featureFlag);
}

export type IntegrationCapabilities = {
  oauth: boolean;
  tokenRefresh: boolean;
  webhooks: boolean;
  initialSync: boolean;
  incrementalSync: boolean;
  assetSelection: boolean;
  authStrategies?: Array<"instagram_login" | "facebook_login">;
};

export type InstagramAuthStrategy = "instagram_login" | "facebook_login";

export type InstagramAuthStrategyContract = {
  strategy: InstagramAuthStrategy;
  apiHost: "graph.instagram.com" | "graph.facebook.com";
  requiresLinkedFacebookPage: boolean;
  supportedScopes: readonly string[];
  limitations: readonly string[];
};

/** Official route differences kept in the shared contract before credentials exist. */
export const INSTAGRAM_AUTH_STRATEGY_CONTRACTS: readonly InstagramAuthStrategyContract[] =
  [
    {
      strategy: "facebook_login",
      apiHost: "graph.facebook.com",
      requiresLinkedFacebookPage: true,
      supportedScopes: [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_insights",
      ],
      limitations: ["professional_account_only"],
    },
    {
      strategy: "instagram_login",
      apiHost: "graph.instagram.com",
      requiresLinkedFacebookPage: false,
      supportedScopes: [
        "instagram_business_basic",
        "instagram_business_content_publish",
        "instagram_business_manage_comments",
        "instagram_business_manage_messages",
      ],
      limitations: ["professional_account_only", "ads_and_tagging_unavailable"],
    },
  ] as const;

export function getInstagramAuthStrategyContract(
  strategy: InstagramAuthStrategy,
): InstagramAuthStrategyContract {
  const contract = INSTAGRAM_AUTH_STRATEGY_CONTRACTS.find(
    (item) => item.strategy === strategy,
  );
  if (!contract) {
    throw new Error(`instagram_auth_strategy_unsupported:${strategy}`);
  }
  return contract;
}

export type IntegrationConnection = {
  id: string;
  organizationId: string;
  storeId?: string | null;
  provider: IntegrationProvider;
  /** Instagram may be authorized through either official Meta login route. */
  authStrategy?: "instagram_login" | "facebook_login" | null;
  status:
    "pending" | "connected" | "syncing" | "error" | "disconnected" | "revoked";
  lastSyncAt?: string | null;
  lastErrorAt?: string | null;
  latestSyncStatus?: string | null;
};

export type IntegrationAuthorizationContext = {
  organizationId: string;
  storeId?: string;
  shopDomain?: string;
  appMode?: "public" | "custom";
  redirectUri: string;
  state: string;
  codeChallenge?: string;
  authStrategy?: "instagram_login" | "facebook_login";
};

export type AuthorizationUrlResult = { url: string };
export type AuthorizationCallbackInput = {
  code: string;
  state: string;
  codeVerifier?: string;
  shopDomain?: string;
  appMode?: "public" | "custom";
};
export type CredentialRefreshResult = { expiresAt?: string | null };
export type DiscoveredAsset = { id: string; name: string; type: string };

export type IntegrationAssetKind = "business" | "ad_account" | "page";
export type IntegrationAsset = {
  id: string;
  externalId: string;
  name: string;
  kind: IntegrationAssetKind;
  selected: boolean;
  active: boolean;
  parentId?: string | null;
};
export type IntegrationAssetSelection = {
  status: "unavailable" | "not_connected" | "empty" | "ready" | "degraded";
  source: "live" | "none";
  assets: IntegrationAsset[];
  selectedCount: number;
  message?: string;
};
export type RawWebhookRequest = {
  headers: Record<string, string | undefined>;
  body: string;
};
export type VerifiedWebhook = {
  provider: IntegrationProvider;
  topic: string;
  payload: unknown;
  rawBody?: string;
  headers?: Record<string, string | undefined>;
};
export type WebhookProcessingResult = {
  processed: boolean;
  duplicate?: boolean;
};
export type IntegrationSyncInput = {
  connection: IntegrationConnection;
  mode: "initial" | "incremental";
  syncRunId?: string;
};
export type IntegrationSyncResult = {
  status: "succeeded" | "partial" | "failed";
  scopes?: string[];
  recordsRead?: number;
  recordsWritten?: number;
};

export type IntegrationHealthState =
  | "healthy"
  | "syncing"
  | "degraded"
  | "reauthorization_required"
  | "permissions_missing"
  | "stale"
  | "external_outage"
  | "unknown";

export type IntegrationHealth = {
  status: IntegrationHealthState;
  reason?: string;
  lastSyncAt?: string | null;
};

export const INTEGRATION_ACTIVATION_GATE_KEYS = [
  "credentialsValid",
  "redirectUriExact",
  "scopesGranted",
  "providerResponseValid",
  "assetSelected",
  "initialSyncSucceeded",
  "freshnessAvailable",
  "reauthorizationVerified",
  "recoverableErrorVerified",
] as const;

export type IntegrationActivationEvidence = Record<
  (typeof INTEGRATION_ACTIVATION_GATE_KEYS)[number],
  boolean
>;

export type IntegrationActivationReadiness = {
  ready: boolean;
  missing: Array<(typeof INTEGRATION_ACTIVATION_GATE_KEYS)[number]>;
};

export type IntegrationActivationCapabilities = Pick<
  IntegrationCapabilities,
  "oauth" | "webhooks" | "initialSync" | "incrementalSync" | "assetSelection"
>;

/** Returns only gates that are meaningful for a provider's capabilities. */
export function getIntegrationActivationGateKeys(
  capabilities?: IntegrationActivationCapabilities,
): readonly (typeof INTEGRATION_ACTIVATION_GATE_KEYS)[number][] {
  // Omitted capabilities preserve the original strict shared contract.
  if (!capabilities) return INTEGRATION_ACTIVATION_GATE_KEYS;
  return INTEGRATION_ACTIVATION_GATE_KEYS.filter((key) => {
    if (key === "redirectUriExact" || key === "scopesGranted" || key === "reauthorizationVerified") return capabilities.oauth;
    if (key === "assetSelected") return capabilities.assetSelection;
    if (key === "initialSyncSucceeded") return capabilities.initialSync;
    if (key === "freshnessAvailable") return capabilities.webhooks || capabilities.initialSync || capabilities.incrementalSync;
    return true;
  });
}

/**
 * Final production-readiness gate shared by every connector. It deliberately
 * accepts booleans only: credentials, tokens and provider payloads never enter
 * this contract or get persisted as evidence.
 */
export function evaluateIntegrationActivation(
  evidence: Partial<IntegrationActivationEvidence>,
  capabilities?: IntegrationActivationCapabilities,
): IntegrationActivationReadiness {
  const missing = getIntegrationActivationGateKeys(capabilities).filter(
    (key) => evidence[key] !== true,
  );
  return { ready: missing.length === 0, missing };
}

const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Cuanto puede durar una sincronizacion antes de que "sincronizando" sea
 * mentira.
 *
 * Caso real (2026-09-14): reconexion de Shopify a las 21:50, el proceso de la
 * API se reinicio con el sync a medias, y la conexion se quedo en `syncing`
 * para siempre. La interfaz mostraba "Trayendo datos ahora mismo, no hay que
 * hacer nada" horas despues, sin un solo `integration_sync_run` nuevo. Nadie
 * reintentaba porque, segun la pantalla, no habia nada roto.
 *
 * Una hora es holgado: la importacion completa de una tienda grande va por
 * bulk operations y termina muy por debajo de eso.
 */
const SYNC_RUNNING_TIMEOUT_MS = 60 * 60 * 1000;

export type IntegrationHealthInput = {
  available: boolean;
  connectionStatus?: string | null;
  lastSyncAt?: string | null;
  lastErrorAt?: string | null;
  latestSyncStatus?: string | null;
  now?: Date;
  staleAfterMs?: number;
};

/** Derives a truthful product state from persisted connection/sync facts. */
export function deriveIntegrationHealth(
  input: IntegrationHealthInput,
): IntegrationHealth {
  const lastSyncAt = input.lastSyncAt ?? null;
  const base = { lastSyncAt };

  if (!input.available)
    return { ...base, status: "unknown", reason: "integration_not_available" };
  if (!input.connectionStatus)
    return { ...base, status: "unknown", reason: "not_connected" };
  if (input.connectionStatus === "revoked") {
    return {
      ...base,
      status: "reauthorization_required",
      reason: "authorization_revoked",
    };
  }
  if (
    input.connectionStatus === "syncing" ||
    input.latestSyncStatus === "running"
  ) {
    // "Sincronizando" con un error posterior al ultimo sync bueno no es una
    // sincronizacion en marcha: es una que se quedo colgada. Una conexion rota
    // que se pinta en gris neutro no la mira nadie.
    const errorAt = input.lastErrorAt
      ? new Date(input.lastErrorAt).getTime()
      : null;
    const syncAt = lastSyncAt ? new Date(lastSyncAt).getTime() : null;
    if (
      errorAt !== null &&
      Number.isFinite(errorAt) &&
      (syncAt === null || !Number.isFinite(syncAt) || errorAt > syncAt)
    ) {
      return { ...base, status: "degraded", reason: "sync_stuck" };
    }
    // Y una sincronizacion que lleva "en marcha" mas de lo que puede durar
    // tampoco esta en marcha: el proceso que la lanzo murio y nadie lo sabe.
    const now = (input.now ?? new Date()).getTime();
    if (
      syncAt !== null &&
      Number.isFinite(syncAt) &&
      now - syncAt > SYNC_RUNNING_TIMEOUT_MS
    ) {
      return { ...base, status: "degraded", reason: "sync_stuck" };
    }
    return { ...base, status: "syncing" };
  }
  if (input.connectionStatus === "error")
    return { ...base, status: "degraded", reason: "connection_error" };
  if (input.connectionStatus === "pending") {
    return { ...base, status: "unknown", reason: "authorization_pending" };
  }
  if (input.connectionStatus === "disconnected")
    return { ...base, status: "unknown", reason: "disconnected" };
  if (
    input.latestSyncStatus === "failed" ||
    input.latestSyncStatus === "partial"
  ) {
    return { ...base, status: "degraded", reason: "last_sync_failed" };
  }
  if (!lastSyncAt)
    return { ...base, status: "unknown", reason: "never_synced" };

  const lastSyncTime = new Date(lastSyncAt).getTime();
  const now = (input.now ?? new Date()).getTime();
  if (!Number.isFinite(lastSyncTime) || !Number.isFinite(now)) {
    return { ...base, status: "unknown", reason: "invalid_sync_timestamp" };
  }
  if (
    input.lastErrorAt &&
    new Date(input.lastErrorAt).getTime() > lastSyncTime
  ) {
    return { ...base, status: "degraded", reason: "recent_sync_error" };
  }
  if (now - lastSyncTime > (input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS)) {
    return { ...base, status: "stale", reason: "sync_stale" };
  }
  return { ...base, status: "healthy" };
}

export type IntegrationErrorCode =
  | "AUTHORIZATION_DENIED"
  | "INVALID_AUTHORIZATION_STATE"
  | "INVALID_CALLBACK_SIGNATURE"
  | "CREDENTIALS_MISSING"
  | "TOKEN_EXPIRED"
  | "TOKEN_REFRESH_FAILED"
  | "REAUTHORIZATION_REQUIRED"
  | "PERMISSION_MISSING"
  | "ASSET_NOT_SELECTED"
  | "EXTERNAL_RESOURCE_NOT_FOUND"
  | "RATE_LIMITED"
  | "EXTERNAL_API_UNAVAILABLE"
  | "INVALID_WEBHOOK_SIGNATURE"
  | "WEBHOOK_REPLAY_REJECTED"
  | "SYNC_PARTIAL_FAILURE"
  | "SYNC_PERMANENT_FAILURE"
  | "DATA_RECONCILIATION_MISMATCH";

export class IntegrationError extends Error {
  name = "IntegrationError";

  constructor(
    public readonly integrationCode: IntegrationErrorCode,
    public readonly provider: IntegrationProvider,
    message: string,
    public readonly retryable: boolean,
    public readonly userActionRequired: boolean,
    public readonly externalStatus?: number,
    public readonly externalCode?: string,
  ) {
    super(message);
  }
}

export type CredentialExchangeResult = {
  provider: IntegrationProvider;
  externalAccountId?: string;
};

export type IntegrationSyncAdapter = {
  readonly provider: IntegrationProvider;
  readonly capabilities: IntegrationCapabilities;
  runInitialSync(input: IntegrationSyncInput): Promise<IntegrationSyncResult>;
  runIncrementalSync(
    input: IntegrationSyncInput,
  ): Promise<IntegrationSyncResult>;
};

export type IntegrationAdapter = IntegrationSyncAdapter & {
  buildAuthorizationUrl(
    context: IntegrationAuthorizationContext,
  ): Promise<AuthorizationUrlResult>;
  exchangeAuthorizationCode(
    input: AuthorizationCallbackInput,
  ): Promise<CredentialExchangeResult>;
  refreshCredentials?(
    connection: IntegrationConnection,
  ): Promise<CredentialRefreshResult>;
  discoverAssets?(
    connection: IntegrationConnection,
  ): Promise<DiscoveredAsset[]>;
  verifyWebhook?(request: RawWebhookRequest): Promise<VerifiedWebhook>;
  processWebhook?(webhook: VerifiedWebhook): Promise<WebhookProcessingResult>;
  getConnectionHealth(
    connection: IntegrationConnection,
  ): Promise<IntegrationHealth>;
};

export const integrationsPackage = "ecomscaling-integrations";
