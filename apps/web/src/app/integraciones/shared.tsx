"use client";

// Estado y piezas compartidas por el hub /integraciones y las paginas de cada
// conector (/integraciones/shopify, /meta, /klaviyo, /instagram). Antes todo
// vivia en un unico page.tsx de 1600 lineas con banners y texto plano
// mezclados; aqui se centraliza la carga, las acciones OAuth/retry y los
// bloques visuales reutilizables.

import { useState, type ReactNode } from "react";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { displayValue } from "@/lib/display-labels";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  Badge,
  Banner,
  Button,
  Card,
  IconChevronLeft,
  IntegrationActivationChecklist,
  IntegrationStatusBadge,
  Link,
  Select,
} from "@/components/ui";

// --- Tipos de la respuesta del backend ------------------------------------

export type IntegrationHealth = {
  status: string;
  reason?: string;
  lastSyncAt: string | null;
};

export type IntegrationActivation = {
  ready: boolean;
  missing: string[];
};

export type IntegrationSyncRun = {
  sync_type: string;
  status: string;
  records_read: number;
  records_written: number;
  records_failed: number;
  finished_at: string | null;
  error_message: string | null;
};

/** Una conexion = una tienda del proveedor, con su propio estado. El backend
 * las manda peor-primero: `provider.connection` es la primera de esta lista. */
export type IntegrationConnection = {
  id: string;
  provider_account_id: string | null;
  provider_account_name: string | null;
  app_mode?: "public" | "custom" | null;
  status: string;
  scopes: string[];
  api_version: string | null;
  connected_at: string | null;
  // Cuando se sembro la fila y la ultima vez que se toco. Distinguen una
  // autorizacion en marcha de un intento que nadie termino nunca
  // (classifyAuthorizationAttempt, en @ecomscaling/contracts).
  created_at?: string | null;
  updated_at?: string | null;
  last_sync_at: string | null;
  last_error_message: string | null;
  latest_sync: IntegrationSyncRun | null;
  health: IntegrationHealth;
  activation: IntegrationActivation;
};

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
  // Resumen del proveedor = el de su peor tienda. Para hablar de una tienda
  // concreta, `connections`.
  health: IntegrationHealth;
  activation: IntegrationActivation;
  connection: IntegrationConnection | null;
  connections: IntegrationConnection[];
  latest_sync: IntegrationSyncRun | null;
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
  // Una tienda de Shopify solo puede estar en una cuenta: myshopify_domain es
  // unique global. Es el caso de "perdi el acceso y abri otra cuenta", y sin
  // decirlo por su nombre reintentar no lleva a ningun sitio.
  if (result === "ya_conectada") {
    const tienda = params.get("tienda");
    return {
      tone: "danger",
      text: `${tienda ?? "Esa tienda"} ya está conectada en otra cuenta de EcomScaling, y una tienda solo puede estar en una. Hemos registrado el intento: escribe a soporte para liberarla.`,
    };
  }
  if (result === "denied")
    return {
      tone: "warn",
      text: `Cancelaste la autorización de ${label}. La conexión no se activó; puedes intentarlo de nuevo.`,
    };
  // Qué permisos faltan, por nombre. El callback los manda en `faltan` justo
  // porque "no concedió permisos imprescindibles" sin decir cuáles no deja
  // hacer nada: ni saber si es culpa tuya, ni si reinstalar lo arregla.
  const faltan = (params.get("faltan") ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const listaFaltan = faltan.length > 0 ? ` Falta: ${faltan.join(", ")}.` : "";

  if (result === "connected_partial")
    return {
      tone: "warn",
      text: `${label} se conectó, pero con menos permisos de los pedidos: parte de los datos no se podrá traer.${listaFaltan}`,
    };
  if (result === "missing_scopes")
    return {
      tone: "danger",
      text: `${label} no concedió permisos imprescindibles, así que la conexión queda en error.${listaFaltan} Si ese permiso no está declarado en la app de Shopify, reinstalar no lo arregla: hay que añadirlo al TOML de la app y volver a desplegarla.`,
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

  const integrationsQuery = useCachedQuery<IntegrationsResponse>(
    organizationId
      ? `/v1/organizations/${organizationId}/integrations`
      : null,
  );
  const payload = integrationsQuery.data ?? null;
  const error = organizationId
    ? integrationsQuery.error
    : "No hay organización activa.";
  const isLoading = organizationId ? integrationsQuery.isLoading : false;
  const reload = integrationsQuery.reload;
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
        reload();
      }),
    // Descartar un intento de OAuth que nadie termino. Reusa el endpoint de
    // borrado de tienda: el backend distingue el intento (borrado inmediato,
    // no hay nada que recuperar) de una tienda con datos (borrado programado a
    // 30 dias). Solo lo ofrece la interfaz a consultor/platform_admin, que es
    // quien ese endpoint autoriza.
    discardAuthorizationAttempt: (connectionId: string) =>
      withPending(`discard-${connectionId}`, async () => {
        const response = await apiFetch(
          `/v1/consultant/organizations/${organizationId}/stores/${connectionId}`,
          { method: "DELETE" },
        );
        if (!response.ok) {
          setActionError(await readErr(response));
          return;
        }
        reload();
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
        reload();
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
        {provider.connection?.provider_account_id ? (
          <span className="font-mono text-muted">
            · {provider.connection.provider_account_id}
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
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-tint font-mono text-xs font-semibold text-accent">
            {index + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}

// --- A que tienda pertenece cada cuenta ---------------------------------

// Se importan ademas de reexportarse: `export ... from` no trae los nombres al
// ambito de este fichero, y aqui dentro se usan.
import {
  storeLabel,
  type ScopeStore,
  type StoreScope,
} from "./store-scope-model";

export {
  storeLabel,
  storesByConnection,
  type ScopeAccount,
  type ScopeStore,
  type StoreScope,
} from "./store-scope-model";

/** El reparto de cuentas por tienda. Lo cargan la tarjeta de asignacion del hub
 * y las subpaginas de Meta y Klaviyo, que necesitan saber sobre que tienda
 * estan escribiendo. */
export function useStoreScope(organizationId: string | null) {
  const scopeQuery = useCachedQuery<StoreScope>(
    organizationId
      ? `/v1/organizations/${organizationId}/store-scope`
      : null,
  );

  return {
    scope: scopeQuery.data ?? null,
    error: scopeQuery.error,
    reload: scopeQuery.reload,
  };
}

/** Cual de las N conexiones del proveedor se esta viendo y configurando.
 *
 * Antes no habia eleccion: cada subpagina cogia `provider.connection`, que el
 * backend resolvia por su cuenta. Con dos cuentas Klaviyo o dos de Meta,
 * guardar los activos escribia sobre una de ellas sin decir cual -- y no
 * necesariamente la que el consultor creia estar mirando.
 *
 * Orden de preferencia: lo que el usuario elija aqui, luego la conexion de la
 * tienda activa del encabezado (`preferredId`), y si no hay ninguna, la primera
 * de la lista -- que es la peor, la que hay que atender. */
export function useProviderConnection(
  provider: IntegrationProvider | null,
  preferredId?: string | null,
) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const connections = provider?.connections ?? [];
  const connection =
    connections.find((item) => item.id === chosenId) ??
    connections.find((item) => item.id === preferredId) ??
    connections[0] ??
    null;

  return { connection, connections, setChosenId };
}

/** Selector de la conexion que se esta configurando. Con una sola no aparece:
 * no hay nada que elegir. */
export function ConnectionPicker({
  connections,
  connection,
  onChange,
  storeByConnection,
  activeStore,
}: {
  connections: IntegrationConnection[];
  connection: IntegrationConnection | null;
  onChange: (id: string) => void;
  storeByConnection?: Map<string, ScopeStore>;
  activeStore?: ScopeStore | null;
}) {
  if (connections.length < 2) return null;

  const currentStore = connection
    ? storeByConnection?.get(connection.id)
    : undefined;
  // Estas viendo una tienda en el encabezado y configurando la cuenta de otra:
  // es justo el error que este selector existe para hacer imposible.
  const mismatch = Boolean(
    activeStore && currentStore && currentStore.id !== activeStore.id,
  );

  return (
    <Card
      title="Cuenta que estás configurando"
      description="Esta organización tiene varias cuentas conectadas de este proveedor. Lo que guardes abajo se aplica solo a la elegida."
    >
      <Select
        aria-label="Cuenta conectada"
        value={connection?.id ?? ""}
        onChange={onChange}
        options={connections.map((item) => {
          const store = storeByConnection?.get(item.id);
          return {
            value: item.id,
            label: [
              item.provider_account_name ?? item.provider_account_id ?? item.id,
              store ? storeLabel(store) : null,
              healthLabel(item.health.status),
            ]
              .filter(Boolean)
              .join(" · "),
          };
        })}
      />

      {mismatch ? (
        <Banner className="mt-3" tone="warn">
          Estás viendo{" "}
          <span className="font-medium">{storeLabel(activeStore!)}</span> en el
          encabezado, pero esta cuenta es de{" "}
          <span className="font-medium">{storeLabel(currentStore!)}</span>. Lo
          que guardes se aplica a {storeLabel(currentStore!)}.
        </Banner>
      ) : null}
    </Card>
  );
}

/** El estado de cada tienda del proveedor, una linea por conexion.
 *
 * Existe porque el resumen del proveedor es el de su peor tienda: sin esta
 * lista, "Shopify · Reautorizar" no dice CUAL de las dos hay que reautorizar, y
 * antes ni siquiera eso -- ganaba la mas sana y la rota no se veia. */
export function ConnectionHealthList({
  connections,
  activeConnectionId,
}: {
  connections: IntegrationConnection[];
  activeConnectionId?: string | null;
}) {
  // Con una sola no hay nada que desambiguar: el resumen de arriba ya es esa.
  if (connections.length < 2) return null;

  return (
    <ul className="mt-3 space-y-2 border-t border-separator pt-3">
      {connections.map((connection) => (
        <li
          key={connection.id}
          className="flex flex-wrap items-center gap-2 text-xs"
        >
          <Badge tone={healthTone(connection.health.status)}>
            {healthLabel(connection.health.status)}
          </Badge>
          <span className="min-w-0 break-all font-mono">
            {connection.provider_account_id ??
              connection.provider_account_name ??
              connection.id}
          </span>
          {connection.id === activeConnectionId ? (
            <Badge tone="brand">Tienda activa</Badge>
          ) : null}
          {connection.last_error_message ? (
            <span className="w-full break-words text-danger">
              {connection.last_error_message}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ConnectionFacts({ provider }: { provider: IntegrationProvider }) {
  return (
    <dl className="mt-4 grid gap-3 border-t border-separator pt-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <dt className="text-xs text-muted">Cuenta</dt>
        <dd>{provider.connection?.provider_account_name ?? "Pendiente"}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Tienda Shopify</dt>
        <dd className="break-all font-mono">
          {provider.connection?.provider_account_id ?? "Pendiente"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Tipo de app</dt>
        <dd>
          {provider.connection?.app_mode === "custom"
            ? "Personalizada"
            : provider.connection?.app_mode === "public"
              ? "Pública"
              : "No informado"}
        </dd>
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
      {provider.connection?.provider_account_id ? (
        <p className="mt-2 text-xs text-muted">
          Tienda afectada: <span className="font-mono">{provider.connection.provider_account_id}</span>
        </p>
      ) : null}
    </Banner>
  );
}
