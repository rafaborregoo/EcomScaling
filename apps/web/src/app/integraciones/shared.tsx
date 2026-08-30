"use client";

// Estado y piezas compartidas por el hub /integraciones y las paginas de cada
// conector (/integraciones/shopify, /meta, /klaviyo, /instagram). Antes todo
// vivia en un unico page.tsx de 1600 lineas con banners y texto plano
// mezclados; aqui se centraliza la carga, las acciones OAuth/retry y los
// bloques visuales reutilizables.

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import {
  Badge,
  Banner,
  Button,
  Card,
  IconChevronLeft,
  IntegrationActivationChecklist,
  IntegrationStatusBadge,
  Link,
} from "@/components/ui";

// --- Tipos de la respuesta del backend ------------------------------------

export type IntegrationProvider = {
  id: string;
  name: string;
  phase: string;
  description: string;
  available: boolean;
  feature_flag: string;
  configuration: {
    status:
      | "configured"
      | "credentials_missing"
      | "feature_disabled"
      | "not_implemented";
    reason: string;
  };
  capabilities: {
    oauth: boolean;
    tokenRefresh: boolean;
    webhooks: boolean;
    initialSync: boolean;
    incrementalSync: boolean;
    assetSelection: boolean;
  };
  health: {
    status: string;
    reason?: string;
    lastSyncAt: string | null;
  };
  activation: {
    ready: boolean;
    missing: string[];
  };
  connection: {
    id: string;
    provider_account_name: string | null;
    status: string;
    scopes: string[];
    api_version: string | null;
    connected_at: string | null;
    last_sync_at: string | null;
    last_error_message: string | null;
  } | null;
  latest_sync: {
    sync_type: string;
    status: string;
    records_read: number;
    records_written: number;
    records_failed: number;
    finished_at: string | null;
    error_message: string | null;
  } | null;
};

export type IntegrationsResponse = {
  organization_id: string;
  schema_ready: boolean;
  shopify_custom_app_available: boolean;
  meta_app_available: boolean;
  klaviyo_app_available: boolean;
  providers: IntegrationProvider[];
};

export type MetaAsset = {
  id: string;
  connection_id: string;
  external_id: string;
  name: string;
  is_selected: boolean;
  is_active: boolean;
  last_synced_at: string | null;
  currency_code?: string | null;
  timezone_name?: string | null;
};

export type MetaAssetsResponse = {
  connected: boolean;
  connection: {
    id: string;
    status: string;
    provider_account_name: string | null;
    last_sync_at: string | null;
  } | null;
  businesses: MetaAsset[];
  pages: MetaAsset[];
  ad_accounts: MetaAsset[];
};

export type KlaviyoMetricsResponse = {
  account_id: string;
  conversion_metric_id: string | null;
  metrics: Array<{
    id: string;
    external_metric_id: string;
    name: string;
    metric_type: string | null;
    is_conversion_candidate: boolean;
    selected: boolean;
  }>;
};

export type KlaviyoReportsResponse = {
  runs: Array<{
    id: string;
    report_type: string;
    entity_type: string;
    status: string;
    period_start: string | null;
    period_end: string | null;
    requested_at: string;
    completed_at?: string | null;
    finished_at?: string | null;
    error_message: string | null;
  }>;
  values: Array<{
    id: string;
    report_run_id: string;
    entity_type: string;
    external_entity_id: string | null;
    entity_name: string | null;
    statistic_name: string | null;
    value_numeric: number | string | null;
    conversions: number | string | null;
    revenue: number | string | null;
    currency_code: string | null;
    period_start: string;
    period_end: string;
  }>;
};

// Slug de la ruta por id de proveedor del backend.
export const PROVIDER_SLUG: Record<string, string> = {
  shopify: "shopify",
  meta_ads: "meta",
  klaviyo: "klaviyo",
  instagram: "instagram",
};

export async function readErr(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
    detail?: string;
  } | null;
  return (
    [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
      .filter(Boolean)
      .join(" · ") || `HTTP ${response.status}`
  );
}

export function integrationErrorMessage(
  provider: IntegrationProvider,
): string | null {
  return (
    provider.latest_sync?.error_message ??
    provider.connection?.last_error_message ??
    null
  );
}

export function healthLabel(status: string): string {
  const labels: Record<string, string> = {
    healthy: "Saludable",
    syncing: "Sincronizando",
    degraded: "Degradado",
    reauthorization_required: "Reautorizar",
    stale: "Desactualizado",
    unknown: "Pendiente",
  };
  return labels[status] ?? displayValue(status);
}

export function healthTone(status: string): "success" | "warn" | "danger" | "neutral" {
  if (status === "healthy") return "success";
  if (status === "syncing") return "neutral";
  if (["degraded", "stale"].includes(status)) return "warn";
  if (["reauthorization_required", "needs_reauth", "error"].includes(status))
    return "danger";
  return "neutral";
}

export function readOAuthNotice(): {
  tone: "success" | "warn" | "danger";
  text: string;
} | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const provider = ["shopify", "meta", "klaviyo"].find((item) =>
    params.has(item),
  );
  if (!provider) return null;
  const labels: Record<string, string> = {
    shopify: "Shopify",
    meta: "Meta Ads",
    klaviyo: "Klaviyo",
  };
  const label = labels[provider];
  const result = params.get(provider);
  if (result === "connected")
    return { tone: "success", text: `${label} se conectó correctamente.` };
  if (result === "denied")
    return {
      tone: "warn",
      text: `Cancelaste la autorización de ${label}. La conexión no se activó; puedes intentarlo de nuevo.`,
    };
  return {
    tone: "danger",
    text: `La conexión de ${label} no se completó (${result ?? "resultado desconocido"}). Revisa el estado y vuelve a autorizarla.`,
  };
}

// --- Hook principal: estado del payload + acciones -----------------------

export function useIntegrations(bootstrap: BootstrapResponse) {
  const {
    organizationId: selectedOrganizationId,
    setOrganizationId,
  } = useActiveOrganization();

  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;
  const organizationId = organization?.id ?? null;

  const [payload, setPayload] = useState<IntegrationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!organizationId) {
      setPayload(null);
      setError("No hay organización activa.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/integrations`,
      );
      if (!response.ok) {
        setError(await readErr(response));
        return;
      }
      setPayload((await response.json()) as IntegrationsResponse);
      setError(null);
    } catch {
      setError(
        "No se pudo cargar el estado de las integraciones por un error de red. Reintenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function withPending(key: string, fn: () => Promise<void>) {
    setPending(key);
    setActionError(null);
    try {
      await fn();
    } catch {
      setActionError("Error de red. Reintenta.");
    } finally {
      setPending(null);
    }
  }

  async function startOAuth(key: string, path: string, body?: unknown) {
    await withPending(key, async () => {
      const response = await apiFetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        setActionError(await readErr(response));
        return;
      }
      const data = (await response.json()) as { redirectUrl: string };
      window.location.assign(data.redirectUrl);
    });
  }

  const actions = {
    connectShopify: (shopDomain: string, appMode: "public" | "custom") =>
      startOAuth(
        "shopify",
        `/v1/organizations/${organizationId}/integrations/shopify/connect`,
        { shopDomain, appMode },
      ),
    connectMeta: () =>
      startOAuth(
        "meta",
        `/v1/organizations/${organizationId}/integrations/meta/connect`,
      ),
    connectKlaviyo: () =>
      startOAuth(
        "klaviyo",
        `/v1/organizations/${organizationId}/integrations/klaviyo/connect`,
      ),
    connectKlaviyoApiKey: (apiKey: string) =>
      withPending("klaviyo-key", async () => {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/integrations/klaviyo/connect-api-key`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: apiKey.trim() }),
          },
        );
        if (!response.ok) {
          setActionError(await readErr(response));
          return;
        }
        await reload();
      }),
    retrySync: (provider: "shopify" | "klaviyo", connectionId: string) =>
      withPending(`retry-${provider}`, async () => {
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/${provider}/sync?connectionId=${encodeURIComponent(connectionId)}`,
          { method: "POST" },
        );
        if (!response.ok) {
          setActionError(await readErr(response));
          return;
        }
        await reload();
      }),
  };

  return {
    organization,
    memberships: bootstrap.memberships,
    setOrganizationId,
    payload,
    provider: (id: string) =>
      payload?.providers.find((item) => item.id === id) ?? null,
    isLoading,
    error,
    reload,
    actions,
    pending,
    actionError,
    setActionError,
  };
}

// --- Piezas visuales reutilizables --------------------------------------

export function BackToHub() {
  return (
    <Link className="inline-flex items-center gap-1 text-sm" href="/integraciones">
      <IconChevronLeft aria-hidden /> Todas las integraciones
    </Link>
  );
}

/** Tarjeta de cabecera de cada subpagina: estado, salud, checklist de
 * activación y el banner de configuración que corresponda. Sustituye a los
 * cuatro-cinco banners sueltos que antes se apilaban en texto plano. */
export function ProviderStatusCard({
  provider,
  children,
}: {
  provider: IntegrationProvider;
  children?: ReactNode;
}) {
  const cfg = provider.configuration.status;
  return (
    <Card
      title={provider.name}
      description={`${provider.description} · Fase ${provider.phase}`}
      actions={
        <IntegrationStatusBadge
          available={provider.available}
          configurationStatus={provider.configuration.status}
          connectionStatus={provider.connection?.status}
          healthStatus={provider.health.status}
        />
      }
    >
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">Salud</span>
        <Badge tone={healthTone(provider.health.status)}>
          {healthLabel(provider.health.status)}
        </Badge>
        {provider.connection?.provider_account_name ? (
          <span className="text-muted">
            · {provider.connection.provider_account_name}
          </span>
        ) : null}
      </div>

      <IntegrationActivationChecklist
        ready={provider.activation.ready}
        missing={provider.activation.missing}
      />

      {!provider.available ? (
        <Banner className="mt-3" tone="warn">
          <span className="font-medium">Disponible más adelante.</span> La
          interfaz ya está lista, pero el conector no se activa hasta que haya
          credenciales y sincronización real. No se muestran datos simulados.
        </Banner>
      ) : cfg === "credentials_missing" ? (
        <Banner className="mt-3" tone="warn">
          Faltan las credenciales de la app del proveedor en el servidor. Cuando
          se configuren, esta página habilitará OAuth y sincronización real.
        </Banner>
      ) : cfg === "feature_disabled" ? (
        <Banner className="mt-3" tone="warn">
          El conector está configurado pero su feature flag{" "}
          <span className="font-mono">{provider.feature_flag}</span> está
          desactivado. No se llamará al proveedor hasta habilitarlo.
        </Banner>
      ) : null}

      {children}
    </Card>
  );
}

/** Lista de pasos numerada y legible (no un parrafo largo). */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-2 space-y-2 text-sm leading-6">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-tint font-mono text-xs font-semibold text-brand">
            {index + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function ConnectionFacts({ provider }: { provider: IntegrationProvider }) {
  return (
    <dl className="mt-4 grid gap-2 border-t border-edge pt-4 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-xs text-muted">Cuenta</dt>
        <dd>{provider.connection?.provider_account_name ?? "Pendiente"}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Último sync</dt>
        <dd>
          {provider.latest_sync?.status
            ? displayValue(provider.latest_sync.status)
            : provider.connection?.last_sync_at
              ? new Date(provider.connection.last_sync_at).toLocaleString("es-ES")
              : "Sin sincronización"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Versión API</dt>
        <dd className="font-mono">{provider.connection?.api_version ?? "n/a"}</dd>
      </div>
    </dl>
  );
}

export function LastErrorBanner({
  provider,
  onRetry,
  retrying,
}: {
  provider: IntegrationProvider;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const message = integrationErrorMessage(provider);
  if (!message) return null;
  return (
    <Banner className="mt-4" tone="danger">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="font-medium">Último error: </span>
          <span className="font-mono break-words">{message}</span>
        </span>
        {onRetry ? (
          <Button size="sm" type="button" onClick={onRetry} disabled={retrying}>
            {retrying ? "Reintentando..." : "Reintentar sincronización"}
          </Button>
        ) : null}
      </div>
    </Banner>
  );
}
