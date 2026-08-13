/** Providers supported by the integration lifecycle tables. */
export const INTEGRATION_PROVIDERS = [
  "shopify",
  "meta_ads",
  "klaviyo",
  "instagram",
  "fathom",
  "loom",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type IntegrationCatalogEntry = {
  id: "shopify" | "meta_ads" | "klaviyo" | "instagram";
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
];

/**
 * Optional runtime allowlist. An unset value preserves catalog defaults;
 * when set, only listed catalog entries remain enabled. A future provider
 * still cannot become available by flag alone: it needs a real implementation.
 */
export function isIntegrationFeatureEnabled(
  provider: IntegrationProvider,
  configuredFlags?: string,
): boolean {
  const catalogEntry = INTEGRATION_CATALOG.find((item) => item.id === provider);
  if (!catalogEntry?.available) return false;
  if (!configuredFlags?.trim()) return true;

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

const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

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
