"use client";

import { FormEvent, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import {
  AsyncState,
  EmptyState,
  ErrorBlock,
  Heading,
  Badge,
  Banner,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  IntegrationStatusBadge,
  IntegrationActivationChecklist,
  Label,
  LoadingBlock,
  Radio,
  RadioGroup,
  Select,
} from "@/components/ui";

type IntegrationProvider = {
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

type IntegrationsResponse = {
  organization_id: string;
  schema_ready: boolean;
  shopify_custom_app_available: boolean;
  meta_app_available: boolean;
  klaviyo_app_available: boolean;
  providers: IntegrationProvider[];
};

type MetaAsset = {
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

type MetaAssetsResponse = {
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

type KlaviyoMetricsResponse = {
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

type KlaviyoReportsResponse = {
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

function integrationErrorMessage(provider: IntegrationProvider) {
  return (
    provider.latest_sync?.error_message ??
    provider.connection?.last_error_message ??
    null
  );
}

function readOAuthNotice(): {
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
    return { tone: "success", text: `${label} conectado correctamente.` };
  if (result === "denied")
    return {
      tone: "warn",
      text: `La autorización de ${label} fue cancelada. La conexión no se activó; puedes intentarlo de nuevo.`,
    };
  return {
    tone: "danger",
    text: `La conexión de ${label} no se completó (${result ?? "resultado desconocido"}). Revisa el estado y vuelve a autorizarla.`,
  };
}

function healthLabel(status: string) {
  const labels: Record<string, string> = {
    healthy: "Saludable",
    syncing: "Sincronizando",
    degraded: "Degradado",
    reauthorization_required: "Reautorizar",
    stale: "Desactualizado",
    unknown: "Pendiente",
  };

  return labels[status] ?? status;
}

function IntegrationsList({
  bootstrap,
  token,
}: {
  bootstrap: BootstrapResponse;
  token: string;
}) {
  // Organizacion activa compartida con el resto del portal (header, otras
  // paginas) -- antes esta pagina mantenia su propio estado leido solo de la
  // URL, lo que podia desincronizarla del selector "Cliente activo" del
  // header. Ver R-009.
  const {
    organizationId: selectedOrganizationId,
    setOrganizationId: setSelectedOrganizationId,
  } = useActiveOrganization();
  const [shopDomain, setShopDomain] = useState("");
  const [appMode, setAppMode] = useState<"public" | "custom">("public");
  const [payload, setPayload] = useState<IntegrationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRetryingShopify, setIsRetryingShopify] = useState(false);
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const [isConnectingKlaviyo, setIsConnectingKlaviyo] = useState(false);
  const [isRetryingKlaviyo, setIsRetryingKlaviyo] = useState(false);
  const [klaviyoMetrics, setKlaviyoMetrics] =
    useState<KlaviyoMetricsResponse | null>(null);
  const [isLoadingKlaviyoMetrics, setIsLoadingKlaviyoMetrics] = useState(false);
  const [isSavingKlaviyoMetric, setIsSavingKlaviyoMetric] = useState(false);
  const [klaviyoMetricError, setKlaviyoMetricError] = useState<string | null>(
    null,
  );
  const [klaviyoReports, setKlaviyoReports] =
    useState<KlaviyoReportsResponse | null>(null);
  const [isLoadingKlaviyoReports, setIsLoadingKlaviyoReports] = useState(false);
  const [klaviyoReportsError, setKlaviyoReportsError] = useState<string | null>(
    null,
  );
  const [metaAssets, setMetaAssets] = useState<MetaAssetsResponse | null>(null);
  const [metaAssetsError, setMetaAssetsError] = useState<string | null>(null);
  const [isLoadingMetaAssets, setIsLoadingMetaAssets] = useState(false);
  const [isSavingMetaAssets, setIsSavingMetaAssets] = useState(false);
  const [metaAssetsMessage, setMetaAssetsMessage] = useState<string | null>(
    null,
  );
  const [oauthNotice, setOauthNotice] =
    useState<ReturnType<typeof readOAuthNotice>>(null);
  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ??
    bootstrap.memberships[0]?.organization ??
    null;

  useEffect(() => {
    setOauthNotice(readOAuthNotice());
  }, []);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      if (!organization) {
        setError("No hay organización activa.");
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiFetch(
          `/v1/organizations/${organization.id}/integrations`,
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
            detail?: string;
          } | null;
          setError(
            [
              body?.error ?? `HTTP ${response.status}`,
              body?.message,
              body?.detail,
            ]
              .filter(Boolean)
              .join(" - "),
          );
          return;
        }

        const data = (await response.json()) as IntegrationsResponse;
        setPayload(data);
        setError(null);
        if (data.shopify_custom_app_available) {
          // La app publica todavia esta pendiente de revisión de Shopify: mientras tanto,
          // la unica que puede instalarse en tiendas reales de clientes es la personalizada.
          setAppMode("custom");
        }
      } catch {
        setPayload(null);
        setError(
          "No se pudo cargar el estado de las integraciones por un error de red. Reintenta.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [organization, token]);

  const metaProvider =
    payload?.providers.find((provider) => provider.id === "meta_ads") ?? null;
  const metaConnectionId = metaProvider?.connection?.id ?? null;
  const klaviyoProvider =
    payload?.providers.find((provider) => provider.id === "klaviyo") ?? null;
  const klaviyoConnectionId = klaviyoProvider?.connection?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    async function loadKlaviyoMetrics() {
      if (!organization || !klaviyoConnectionId) {
        setKlaviyoMetrics(null);
        setKlaviyoMetricError(null);
        setIsLoadingKlaviyoMetrics(false);
        return;
      }
      setIsLoadingKlaviyoMetrics(true);
      setKlaviyoMetricError(null);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organization.id}/klaviyo/metrics`,
        );
        if (cancelled) return;
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
          } | null;
          setKlaviyoMetricError(
            [body?.error ?? `HTTP ${response.status}`, body?.message]
              .filter(Boolean)
              .join(" - "),
          );
          setKlaviyoMetrics(null);
        } else {
          setKlaviyoMetrics((await response.json()) as KlaviyoMetricsResponse);
        }
      } catch {
        if (!cancelled) {
          setKlaviyoMetrics(null);
          setKlaviyoMetricError(
            "No se pudieron cargar las métricas de Klaviyo por un error de red. Reintenta.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingKlaviyoMetrics(false);
        }
      }
    }
    void loadKlaviyoMetrics();
    return () => {
      cancelled = true;
    };
  }, [organization, klaviyoConnectionId]);

  useEffect(() => {
    let cancelled = false;
    async function loadKlaviyoReports() {
      if (!organization || !klaviyoConnectionId) {
        setKlaviyoReports(null);
        setKlaviyoReportsError(null);
        setIsLoadingKlaviyoReports(false);
        return;
      }
      setIsLoadingKlaviyoReports(true);
      setKlaviyoReportsError(null);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organization.id}/klaviyo/reporting?connectionId=${encodeURIComponent(klaviyoConnectionId)}`,
        );
        if (cancelled) return;
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
            detail?: string;
          } | null;
          setKlaviyoReportsError(
            [body?.error ?? `HTTP ${response.status}`, body?.detail]
              .filter(Boolean)
              .join(" - "),
          );
          setKlaviyoReports(null);
        } else {
          setKlaviyoReports((await response.json()) as KlaviyoReportsResponse);
        }
      } catch {
        if (!cancelled) {
          setKlaviyoReports(null);
          setKlaviyoReportsError(
            "No se pudieron cargar los informes de Klaviyo por un error de red. Reintenta.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingKlaviyoReports(false);
        }
      }
    }
    void loadKlaviyoReports();
    return () => {
      cancelled = true;
    };
  }, [organization, klaviyoConnectionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadMetaAssets() {
      if (!organization || !metaConnectionId) {
        setMetaAssets(null);
        setMetaAssetsError(null);
        setIsLoadingMetaAssets(false);
        return;
      }

      setIsLoadingMetaAssets(true);
      setMetaAssetsError(null);
      try {
        const response = await apiFetch(
          `/v1/organizations/${organization.id}/meta/assets`,
        );
        if (cancelled) return;

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
            message?: string;
            detail?: string;
          } | null;
          setMetaAssetsError(
            [
              body?.error ?? `HTTP ${response.status}`,
              body?.message,
              body?.detail,
            ]
              .filter(Boolean)
              .join(" - "),
          );
          setMetaAssets(null);
          return;
        }

        setMetaAssets((await response.json()) as MetaAssetsResponse);
      } catch {
        if (!cancelled) {
          setMetaAssets(null);
          setMetaAssetsError(
            "No se pudieron cargar los activos de Meta por un error de red. Reintenta.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMetaAssets(false);
        }
      }
    }

    void loadMetaAssets();
    return () => {
      cancelled = true;
    };
  }, [organization, metaConnectionId]);

  async function connectShopify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organization) {
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/integrations/shopify/connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ shopDomain, appMode }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
          detail?: string;
        } | null;
        setError(
          [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
            .filter(Boolean)
            .join(" - "),
        );
        return;
      }

      const body = (await response.json()) as { redirectUrl: string };
      window.location.assign(body.redirectUrl);
    } catch {
      setError(
        "No se pudo iniciar la conexión con Shopify por un error de red. Reintenta.",
      );
    } finally {
      setIsConnecting(false);
    }
  }

  async function connectMeta() {
    if (!organization) {
      return;
    }

    setIsConnectingMeta(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/integrations/meta/connect`,
        { method: "POST" },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
          detail?: string;
        } | null;
        setError(
          [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
            .filter(Boolean)
            .join(" - "),
        );
        return;
      }

      const body = (await response.json()) as { redirectUrl: string };
      window.location.assign(body.redirectUrl);
    } catch {
      setError(
        "No se pudo iniciar la conexión con Meta por un error de red. Reintenta.",
      );
    } finally {
      setIsConnectingMeta(false);
    }
  }

  async function connectKlaviyo() {
    if (!organization) return;
    setIsConnectingKlaviyo(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/integrations/klaviyo/connect`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
          detail?: string;
        } | null;
        setError(
          [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
            .filter(Boolean)
            .join(" - "),
        );
        return;
      }
      const body = (await response.json()) as { redirectUrl: string };
      window.location.assign(body.redirectUrl);
    } catch {
      setError(
        "No se pudo iniciar la conexión con Klaviyo por un error de red. Reintenta.",
      );
    } finally {
      setIsConnectingKlaviyo(false);
    }
  }

  async function retryShopifySync(connectionId: string) {
    if (!organization) return;
    setIsRetryingShopify(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/shopify/sync?connectionId=${encodeURIComponent(connectionId)}`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
          detail?: string;
        } | null;
        setError(
          [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
            .filter(Boolean)
            .join(" - "),
        );
        return;
      }

      setPayload((current) =>
        current
          ? {
              ...current,
              providers: current.providers.map((provider) =>
                provider.id === "shopify" && provider.connection
                  ? {
                      ...provider,
                      connection: {
                        ...provider.connection,
                        status: "syncing",
                        last_error_message: null,
                      },
                    }
                  : provider,
              ),
            }
          : current,
      );
    } catch {
      setError(
        "No se pudo relanzar la sincronización de Shopify por un error de red. Reintenta.",
      );
    } finally {
      setIsRetryingShopify(false);
    }
  }

  async function retryKlaviyoSync(connectionId: string) {
    if (!organization) return;
    setIsRetryingKlaviyo(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/klaviyo/sync?connectionId=${encodeURIComponent(connectionId)}`,
        { method: "POST" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
          detail?: string;
        } | null;
        setError(
          [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
            .filter(Boolean)
            .join(" - "),
        );
        return;
      }
      setPayload((current) =>
        current
          ? {
              ...current,
              providers: current.providers.map((provider) =>
                provider.id === "klaviyo" && provider.connection
                  ? {
                      ...provider,
                      connection: {
                        ...provider.connection,
                        status: "syncing",
                        last_error_message: null,
                      },
                    }
                  : provider,
              ),
            }
          : current,
      );
    } catch {
      setError(
        "No se pudo relanzar la sincronización de Klaviyo por un error de red. Reintenta.",
      );
    } finally {
      setIsRetryingKlaviyo(false);
    }
  }

  async function saveKlaviyoMetric(metricId: string) {
    if (!organization || !metricId) return;
    setIsSavingKlaviyoMetric(true);
    setKlaviyoMetricError(null);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/klaviyo/conversion-metric`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metricId, source: "klaviyo" }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        setKlaviyoMetricError(
          [body?.error ?? `HTTP ${response.status}`, body?.message]
            .filter(Boolean)
            .join(" - "),
        );
      } else {
        setKlaviyoMetrics((current) =>
          current
            ? {
                ...current,
                conversion_metric_id: metricId,
                metrics: current.metrics.map((metric) => ({
                  ...metric,
                  selected: metric.external_metric_id === metricId,
                })),
              }
            : current,
        );
      }
    } catch {
      setKlaviyoMetricError(
        "No se pudo guardar la métrica de Klaviyo por un error de red. Reintenta.",
      );
    } finally {
      setIsSavingKlaviyoMetric(false);
    }
  }

  async function saveMetaAssetSelection() {
    if (!organization || !metaAssets) return;

    setIsSavingMetaAssets(true);
    setMetaAssetsError(null);
    setMetaAssetsMessage(null);
    const selectedAdAccountIds = metaAssets.ad_accounts
      .filter((asset) => asset.is_selected)
      .map((asset) => asset.id);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organization.id}/meta/assets/selection`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adAccountIds: selectedAdAccountIds }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
          detail?: string;
        } | null;
        setMetaAssetsError(
          [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
            .filter(Boolean)
            .join(" - "),
        );
        return;
      }

      const syncResponse = await apiFetch(
        `/v1/organizations/${organization.id}/meta/sync`,
        { method: "POST" },
      );
      if (!syncResponse.ok) {
        const body = (await syncResponse.json().catch(() => null)) as {
          error?: string;
          message?: string;
          detail?: string;
        } | null;
        setMetaAssetsError(
          [
            body?.error ?? `HTTP ${syncResponse.status}`,
            body?.message,
            body?.detail,
          ]
            .filter(Boolean)
            .join(" - "),
        );
        return;
      }

      setMetaAssetsMessage(
        "Activos guardados. La sincronización inicial se ha puesto en cola.",
      );
    } catch {
      setMetaAssetsError(
        "No se pudieron guardar los activos de Meta por un error de red. Reintenta.",
      );
    } finally {
      setIsSavingMetaAssets(false);
    }
  }

  if (isLoading) {
    return (
      <AsyncState status="loading" loadingLabel="Cargando integraciones..." />
    );
  }

  if (error) {
    return <ErrorBlock>{error}</ErrorBlock>;
  }

  if (!payload) {
    return (
      <AsyncState
        status="empty"
        emptyTitle="No hay integraciones para mostrar"
        emptyHint="Selecciona una organización activa y vuelve a intentarlo."
      />
    );
  }

  const shopifyEnabled =
    payload.providers.find((provider) => provider.id === "shopify")
      ?.available ?? false;
  const shopifyConfigured =
    payload.providers.find((provider) => provider.id === "shopify")
      ?.configuration.status === "configured";

  return (
    <div className="portal-page space-y-6">
      {oauthNotice ? (
        <Banner tone={oauthNotice.tone}>{oauthNotice.text}</Banner>
      ) : null}
      {!payload.schema_ready ? (
        <Banner tone="danger">
          No se pudo cargar el estado de las integraciones ahora mismo.
          Reintenta en unos minutos o contacta con soporte si sigue igual.
        </Banner>
      ) : null}

      <Card>
        <Heading size="lg">Conectar Shopify</Heading>
        {!shopifyEnabled ? (
          <Banner tone="warn" className="mt-3">
            Shopify esta desactivado por configuracion. El administrador puede
            habilitarlo con
            <span className="font-mono"> INTEGRATION_FEATURE_FLAGS</span>.
          </Banner>
        ) : null}
        {shopifyEnabled && !shopifyConfigured ? (
          <Banner tone="warn" className="mt-3">
            Shopify está habilitado en la interfaz, pero faltan las credenciales
            de la app en el servidor. La conexión se habilitará automáticamente
            cuando estén completas.
          </Banner>
        ) : null}
        <p className="mt-2 text-sm leading-6 text-muted">
          Introduce el dominio{" "}
          <span className="font-mono">*.myshopify.com</span> de la tienda. La
          URL de admin de Shopify no sirve como callback OAuth.
        </p>
        <div className="mt-4 rounded-md border border-edge bg-surface p-4 text-sm leading-6 text-muted">
          <p className="font-medium text-ink">
            Como encontrar tu dominio .myshopify.com
          </p>
          <p className="mt-1">
            No es el dominio publico de tu web (p. ej.{" "}
            <span className="font-mono">mitienda.com</span>), sino el dominio
            interno que Shopify asigno al crear la tienda y que nunca cambia.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Entra al admin de tu tienda en Shopify y mira la URL del
              navegador:{" "}
              <span className="font-mono">
                admin.shopify.com/store/TU-HANDLE
              </span>
              . Tu dominio es{" "}
              <span className="font-mono">TU-HANDLE.myshopify.com</span>.
            </li>
            <li>
              O ve a{" "}
              <span className="font-medium">Configuración &rarr; Dominios</span>{" "}
              en el admin: ahi aparece el dominio{" "}
              <span className="font-mono">xxxx.myshopify.com</span> exacto.
            </li>
          </ol>
          <p className="mt-2">
            Si al conectar ves una pagina de Shopify tipo &quot;This store will
            be right back&quot;, el dominio introducido no corresponde a tu
            tienda activa: revisa el handle con los pasos de arriba.
          </p>
          <p className="mt-3 font-medium text-ink">Como conectar la tienda</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Escribe el dominio{" "}
              <span className="font-mono">TU-HANDLE.myshopify.com</span> en el
              campo de abajo y pulsa{" "}
              <span className="font-medium">Conectar Shopify</span>.
            </li>
            <li>
              Se abrira la pantalla de autorizacion de Shopify: revisa los
              permisos y pulsa <span className="font-medium">Instalar</span>{" "}
              (necesitas ser owner o staff con permisos de apps en esa tienda,
              con la sesión iniciada en Shopify).
            </li>
            <li>
              Volveras automáticamente a esta pagina y la sincronización inicial
              empezara sola. Los datos (catalogo, inventario, pedidos, clientes)
              aparecerán en la sección Shopify en unos minutos.
            </li>
          </ol>
        </div>
        <div className="mt-4">
          <Field label="Organización">
            <Select
              aria-label="Organización"
              value={organization?.id ?? ""}
              onChange={(value) => {
                setSelectedOrganizationId(value);
                setError(null);
              }}
              options={bootstrap.memberships.map((membership) => ({
                value: membership.organization_id,
                label:
                  membership.organization?.display_name ??
                  membership.organization_id,
              }))}
            />
          </Field>
        </div>
        {payload?.shopify_custom_app_available ? (
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <RadioGroup
              value={appMode}
              onChange={(value) => setAppMode(value as "custom" | "public")}
            >
              <Label className="font-medium">App de Shopify a usar</Label>
              <div className="flex flex-wrap gap-2">
                <Radio value="custom">
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    App personalizada (para clientes reales, ya activa)
                  </Radio.Content>
                </Radio>
                <Radio value="public">
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    App publica (pendiente de revisión de Shopify)
                  </Radio.Content>
                </Radio>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted">
              Usa &quot;App personalizada&quot; para conectar tiendas reales de
              clientes ahora mismo. Cuando la app publica pase la revisión de
              Shopify, cambia a esa opcion para los clientes nuevos.
            </p>
          </div>
        ) : null}
        <form
          className="mt-4 flex flex-col gap-3 md:flex-row"
          onSubmit={connectShopify}
        >
          <Input
            className="min-w-0 flex-1"
            aria-label="Dominio .myshopify.com de la tienda"
            value={shopDomain}
            onChange={(event) => setShopDomain(event.target.value)}
            placeholder="tu-tienda.myshopify.com"
            autoComplete="off"
            required
          />
          <Button
            type="submit"
            disabled={isConnecting || !shopifyEnabled || !shopifyConfigured}
          >
            {isConnecting ? "Conectando..." : "Conectar Shopify"}
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {payload.providers.map((provider) => (
          <Card key={provider.id} className="h-full">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Heading level={3} size="lg">{provider.name}</Heading>
                <p className="mt-1 font-mono text-xs text-brand">
                  {provider.phase}
                </p>
              </div>
              <IntegrationStatusBadge
                available={provider.available}
                configurationStatus={provider.configuration.status}
                connectionStatus={provider.connection?.status}
                healthStatus={provider.health.status}
              />
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">
              {provider.description}
            </p>
            <p className="mt-2 text-xs text-muted">
              Salud:{" "}
              <span className="font-medium text-ink">
                {healthLabel(provider.health.status)}
              </span>
            </p>
            <IntegrationActivationChecklist
              ready={provider.activation.ready}
              missing={provider.activation.missing}
            />
            {provider.configuration.status === "credentials_missing" ? (
              <Banner className="mt-3" tone="warn">
                El conector está preparado, pero faltan las credenciales de la
                app del proveedor en el servidor. Cuando se configuren, esta
                tarjeta habilitará OAuth y sincronización real.
              </Banner>
            ) : null}
            {provider.configuration.status === "feature_disabled" ? (
              <Banner className="mt-3" tone="warn">
                El conector está configurado, pero su feature flag está
                desactivado. No se iniciarán llamadas al proveedor hasta
                habilitarlo explícitamente.
              </Banner>
            ) : null}
            {provider.id === "meta_ads" && provider.available ? (
              provider.configuration.status === "configured" ? (
                <Button
                  className="mt-4"
                  type="button"
                  onClick={() => void connectMeta()}
                  disabled={isConnectingMeta}
                >
                  {isConnectingMeta
                    ? "Conectando..."
                    : provider.connection
                      ? "Reautorizar Meta Ads"
                      : "Conectar Meta Ads"}
                </Button>
              ) : (
                <div className="mt-4">
                  <Banner tone="warn">
                    La app de Meta no esta configurada en el servidor todavia
                    (META_APP_ID/SECRET).
                  </Banner>
                </div>
              )
            ) : null}
            {provider.id === "klaviyo" && provider.available ? (
              provider.configuration.status === "configured" ? (
                <Button
                  className="mt-4"
                  type="button"
                  onClick={() => void connectKlaviyo()}
                  disabled={isConnectingKlaviyo}
                >
                  {isConnectingKlaviyo
                    ? "Conectando..."
                    : provider.connection
                      ? "Reautorizar Klaviyo"
                      : "Conectar Klaviyo"}
                </Button>
              ) : (
                <div className="mt-4">
                  <Banner tone="warn">
                    Klaviyo está preparado, pero faltan
                    KLAVIYO_CLIENT_ID/SECRET/REDIRECT_URI en el servidor.
                  </Banner>
                </div>
              )
            ) : null}
            {provider.id === "instagram" ? (
              <div className="mt-4">
                <Banner tone="warn">
                  Instagram está preparado, pero todavía no está disponible:
                  requiere una conexión Meta válida o Instagram Login y los
                  permisos de una cuenta profesional. No se muestran métricas
                  simuladas ni se ofrece un botón de conexión prematuro.
                </Banner>
              </div>
            ) : null}
            {provider.id === "klaviyo" && provider.connection ? (
              <div className="mt-4 rounded-md border border-edge bg-surface p-4 text-sm">
                <p className="font-medium text-ink">
                  Métrica primaria de conversión
                </p>
                {isLoadingKlaviyoMetrics ? (
                  <LoadingBlock label="Cargando métricas Klaviyo..." />
                ) : klaviyoMetricError ? (
                  <Banner className="mt-2" tone="danger">
                    {klaviyoMetricError}
                  </Banner>
                ) : !klaviyoMetrics || klaviyoMetrics.metrics.length === 0 ? (
                  <EmptyState
                    title="Aún no hay métricas sincronizadas"
                    hint="Ejecuta una sincronización de Klaviyo para poder elegir la métrica de conversión."
                  />
                ) : (
                  <Select
                    className="mt-2"
                    aria-label="Métrica primaria de conversión"
                    value={klaviyoMetrics.conversion_metric_id ?? ""}
                    onChange={(value) => void saveKlaviyoMetric(value)}
                    disabled={isSavingKlaviyoMetric}
                    options={klaviyoMetrics.metrics.map((metric) => ({
                      value: metric.external_metric_id,
                      label: `${metric.name}${metric.metric_type ? ` · ${metric.metric_type}` : ""}`,
                    }))}
                  />
                )}
              </div>
            ) : null}
            {provider.id === "klaviyo" && provider.connection ? (
              <div className="mt-4 rounded-md border border-edge bg-surface p-4 text-sm">
                <p className="font-medium text-ink">Reporting Klaviyo</p>
                <p className="mt-1 text-muted">
                  Solo se muestran ejecuciones y valores recibidos de Klaviyo;
                  una ausencia de filas no se interpreta como cero.
                </p>
                {isLoadingKlaviyoReports ? (
                  <div className="mt-3">
                    <LoadingBlock label="Cargando reporting Klaviyo..." />
                  </div>
                ) : klaviyoReportsError ? (
                  <Banner className="mt-3" tone="danger">
                    {klaviyoReportsError}
                  </Banner>
                ) : !klaviyoReports || klaviyoReports.runs.length === 0 ? (
                  <div className="mt-3">
                    <EmptyState
                      title="Aún no hay ejecuciones de reporting"
                      hint="El reporting aparecerá cuando Klaviyo esté conectado, tenga una métrica de conversión seleccionada y el reconciliador complete una consulta."
                    />
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {klaviyoReports.runs.slice(0, 5).map((run) => (
                      <div
                        key={run.id}
                        className="rounded border border-edge px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium text-ink">
                            {run.entity_type} ·{" "}
                            {run.period_start ?? "periodo pendiente"}
                            {run.period_end ? ` → ${run.period_end}` : ""}
                          </span>
                          <Badge>{displayValue(run.status)}</Badge>
                        </div>
                        {run.error_message ? (
                          <p className="mt-1 text-danger">
                            {run.error_message}
                          </p>
                        ) : null}
                        {klaviyoReports.values.filter(
                          (value) => value.report_run_id === run.id,
                        ).length > 0 ? (
                          <div className="mt-2 space-y-1 text-muted">
                            {klaviyoReports.values
                              .filter((value) => value.report_run_id === run.id)
                              .slice(0, 5)
                              .map((value) => (
                                <div
                                  key={value.id}
                                  className="flex justify-between gap-3"
                                >
                                  <span>
                                    {value.entity_name ??
                                      value.external_entity_id ??
                                      "Entidad externa"}
                                  </span>
                                  <span>
                                    {value.revenue != null
                                      ? `${Number(value.revenue).toLocaleString("es-ES")} ${value.currency_code ?? ""}`
                                      : value.conversions != null
                                        ? `${Number(value.conversions).toLocaleString("es-ES")} conversiones`
                                        : "Valor recibido"}
                                  </span>
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {provider.id === "meta_ads" && provider.connection ? (
              <div className="mt-4 rounded-md border border-edge bg-surface p-4 text-sm">
                <p className="font-medium text-ink">
                  Seleccionar cuentas publicitarias
                </p>
                {isLoadingMetaAssets ? (
                  <div className="mt-3">
                    <LoadingBlock label="Cargando cuentas publicitarias..." />
                  </div>
                ) : metaAssetsError ? (
                  <Banner className="mt-3" tone="danger">
                    {metaAssetsError}
                  </Banner>
                ) : !metaAssets || metaAssets.ad_accounts.length === 0 ? (
                  <EmptyState
                    title="Aún no hay cuentas descubiertas"
                    hint="Meta no ha devuelto cuentas publicitarias para esta conexión. Revisa permisos o vuelve a autorizar cuando el acceso esté listo."
                  />
                ) : (
                  <>
                    <p className="mt-1 text-muted">
                      Solo se sincronizarán las cuentas marcadas. Los
                      identificadores externos se muestran para que el consultor
                      pueda verificar el acceso.
                    </p>
                    <fieldset
                      className="mt-3 space-y-2"
                      aria-label="Cuentas publicitarias Meta"
                    >
                      <legend className="sr-only">
                        Cuentas publicitarias Meta
                      </legend>
                      {metaAssets.ad_accounts.map((asset) => (
                        <Checkbox
                          key={asset.id}
                          checked={asset.is_selected}
                          disabled={!asset.is_active || isSavingMetaAssets}
                          className="flex items-start gap-3 border border-line p-3"
                          onChange={(checked) => {
                            setMetaAssets((current) =>
                              current
                                ? {
                                    ...current,
                                    ad_accounts: current.ad_accounts.map(
                                      (item) =>
                                        item.id === asset.id
                                          ? { ...item, is_selected: checked }
                                          : item,
                                    ),
                                  }
                                : current,
                            );
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">
                              {asset.name}
                            </span>
                            <span className="block font-mono text-xs text-muted">
                              {asset.external_id}
                            </span>
                            {asset.currency_code || asset.timezone_name ? (
                              <span className="block text-xs text-muted">
                                {[asset.currency_code, asset.timezone_name]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            ) : null}
                          </span>
                        </Checkbox>
                      ))}
                    </fieldset>
                    {metaAssetsMessage ? (
                      <p className="mt-3 text-xs text-success">
                        {metaAssetsMessage}
                      </p>
                    ) : null}
                    <Button
                      className="mt-3"
                      type="button"
                      onClick={() => void saveMetaAssetSelection()}
                      disabled={isSavingMetaAssets}
                    >
                      {isSavingMetaAssets
                        ? "Guardando..."
                        : "Guardar y sincronizar"}
                    </Button>
                  </>
                )}
              </div>
            ) : null}
            {!provider.available ? (
              <div className="mt-4">
                <Banner tone="warn">
                  <span className="font-medium">Disponible más adelante.</span>{" "}
                  La interfaz ya está preparada para este conector, pero todavía
                  no se activa porque no hay credenciales ni sincronización real
                  configuradas. No se muestran datos simulados.
                </Banner>
              </div>
            ) : null}
            {integrationErrorMessage(provider) ? (
              <div className="mt-4">
                <Banner tone="danger">
                  <span className="font-medium">Ultimo error:</span>{" "}
                  <span className="font-mono break-words">
                    {integrationErrorMessage(provider)}
                  </span>
                </Banner>
                {provider.id === "shopify" && provider.connection ? (
                  <Button
                    className="mt-3"
                    type="button"
                    onClick={() =>
                      void retryShopifySync(provider.connection!.id)
                    }
                    disabled={isRetryingShopify}
                  >
                    {isRetryingShopify
                      ? "Reintentando sincronización..."
                      : "Reintentar sincronización"}
                  </Button>
                ) : null}
                {provider.id === "klaviyo" && provider.connection ? (
                  <Button
                    className="mt-3"
                    type="button"
                    onClick={() =>
                      void retryKlaviyoSync(provider.connection!.id)
                    }
                    disabled={isRetryingKlaviyo}
                  >
                    {isRetryingKlaviyo
                      ? "Reintentando sincronización..."
                      : "Reintentar sincronización"}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Cuenta</dt>
                <dd className="text-right">
                  {provider.connection?.provider_account_name ?? "Pendiente"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Ultimo sync</dt>
                <dd className="font-mono text-right">
                  {provider.latest_sync?.status ??
                    provider.connection?.last_sync_at ??
                    "sin_sync"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Version API</dt>
                <dd className="font-mono">
                  {provider.connection?.api_version ?? "n/a"}
                </dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <PortalShell title="Integraciones">
      {(bootstrap, token) => (
        <IntegrationsList bootstrap={bootstrap} token={token} />
      )}
    </PortalShell>
  );
}
