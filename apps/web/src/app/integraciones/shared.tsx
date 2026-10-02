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
  InfoIcon,
  Link,
  Modal,
  ProviderIcon,
} from "@/components/ui";
import { explainHealth } from "./store-view-model";
import { signalOf } from "./hub-model";
import hub from "./hub.module.css";

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
  /** El bloque (orders, catalog, insights…); null en pasadas de conexión entera. */
  sync_scope?: string | null;
  status: string;
  records_read: number;
  records_written: number;
  records_failed: number;
  started_at?: string | null;
  finished_at: string | null;
  error_message: string | null;
  created_at?: string;
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
  // (classifyAuthorizationAttempt, en @e-nora/contracts).
  created_at?: string | null;
  updated_at?: string | null;
  last_sync_at: string | null;
  last_error_message: string | null;
  latest_sync: IntegrationSyncRun | null;
  /** Las ~30 últimas, la más reciente primero (una por bloque y pasada). */
  recent_syncs?: IntegrationSyncRun[];
  health: IntegrationHealth;
  activation: IntegrationActivation;
};

export type IntegrationProvider = {
  id: string;
  name: string;
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
    integration?: string | null;
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

function notifyIntegrationStatusChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("integration-status-changed"));
  }
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

function integrationErrorSummary(message: string): string {
  if (
    /klaviyo_api_error:PERMISSION_MISSING:403/i.test(message) &&
    /events:read/i.test(message)
  ) {
    return "Falta events:read. Reautoriza Klaviyo y acepta el permiso para que la sincronización pueda continuar.";
  }
  if (message.includes("token_refresh")) {
    return "No hemos podido renovar el acceso a la cuenta. Vuelve a autorizarla o reintenta la sincronización.";
  }
  if (message.includes("reauthor")) {
    return "El proveedor pide que renueves la autorización antes de traer datos nuevos.";
  }
  return "La última sincronización no se pudo completar. Puedes reintentarlo o revisar el detalle técnico.";
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

export function healthTone(
  status: string,
): "success" | "warn" | "danger" | "neutral" {
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
      text: `${tienda ?? "Esa tienda"} ya está conectada en otra cuenta de E-NORA, y una tienda solo puede estar en una. Hemos registrado el intento: escribe a soporte para liberarla.`,
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
  const { organizationId: selectedOrganizationId, setOrganizationId } =
    useActiveOrganization();

  // Integraciones es de cada tienda, no de la cartera: las cuentas, tokens y
  // errores de Shopify/Meta/Klaviyo de un cliente no se ven ni se tocan desde
  // aqui, aunque el selector del header lo tenga puesto como "activo" (eso
  // solo sirve para dashboard/tareas/marketing, que si son del panel
  // consultor). El backend ya lo exige (requireOwnOrganizationAccess); esto
  // evita el viaje a la API y, sobre todo, que la pantalla intente pintar la
  // tienda de un cliente durante el instante antes de que llegue el 403.
  const ownMemberships = bootstrap.memberships.filter(
    (membership) => membership.accessSource !== "consultant_assignment",
  );
  const selectedIsOwn = ownMemberships.some(
    (membership) => membership.organization_id === selectedOrganizationId,
  );
  const organization = selectedIsOwn
    ? (bootstrap.memberships.find(
        (membership) => membership.organization_id === selectedOrganizationId,
      )?.organization ?? null)
    : (ownMemberships[0]?.organization ?? null);
  const organizationId = organization?.id ?? null;
  const noOwnStore = !selectedIsOwn && ownMemberships.length === 0;

  const integrationsQuery = useCachedQuery<IntegrationsResponse>(
    organizationId ? `/v1/organizations/${organizationId}/integrations` : null,
  );
  const payload = integrationsQuery.data ?? null;
  const error = organizationId
    ? integrationsQuery.error
    : noOwnStore
      ? "No tienes una tienda propia activa. Las integraciones de tus clientes no están disponibles en tu cuenta."
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
      notifyIntegrationStatusChanged();
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
        notifyIntegrationStatusChanged();
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
    scheduleStoreRemoval: async (connectionId: string) => {
      if (!organizationId) return false;
      setPending(`remove-${connectionId}`);
      setActionError(null);
      try {
        const response = await apiFetch(
          `/v1/consultant/organizations/${organizationId}/stores/${connectionId}`,
          { method: "DELETE" },
        );
        if (!response.ok) {
          setActionError(await readErr(response));
          return false;
        }
        await reload();
        notifyIntegrationStatusChanged();
        return true;
      } catch {
        setActionError("No se pudo retirar la tienda. Reintenta.");
        return false;
      } finally {
        setPending(null);
      }
    },
    restoreStoreRemoval: async (connectionId: string) => {
      if (!organizationId) return false;
      setPending(`restore-${connectionId}`);
      setActionError(null);
      try {
        const response = await apiFetch(
          `/v1/consultant/organizations/${organizationId}/stores/${connectionId}/restore`,
          { method: "POST" },
        );
        if (!response.ok) {
          setActionError(await readErr(response));
          return false;
        }
        await reload();
        notifyIntegrationStatusChanged();
        return true;
      } catch {
        setActionError("No se pudo restaurar la tienda. Reintenta.");
        return false;
      } finally {
        setPending(null);
      }
    },
    retrySync: (provider: "shopify" | "klaviyo" | "meta", connectionId: string) =>
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
        notifyIntegrationStatusChanged();
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
    <Link
      className={hub.back}
      href="/integraciones"
    >
      <IconChevronLeft aria-hidden /> Todas las integraciones
    </Link>
  );
}

/** Ayuda contextual compacta para dejar visible la ficha que se está usando. */
export function InfoModalButton({
  title,
  children,
  label = "Ver información",
}: {
  title: string;
  children: ReactNode;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label={label}
        onClick={() => setIsOpen(true)}
      >
        <InfoIcon aria-hidden className="size-4" />
        {label}
      </Button>
      <Modal isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog aria-label={title}>
              <Modal.Header>
                <Modal.Heading>{title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="space-y-3 text-sm leading-6 text-muted">
                  {children}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onClick={() => setIsOpen(false)}>
                  Cerrar
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

/** Cabecera de cada subpágina, con la banda del hub: logo, estado de la
 * conexión y cuenta. Debajo, lo que falta para activarla y el aviso de
 * configuración del servidor que corresponda. */
export function ProviderStatusCard({
  provider,
  children,
}: {
  provider: IntegrationProvider;
  children?: ReactNode;
}) {
  const cfg = provider.configuration.status;
  const connection = provider.connection;
  const explanation = explainHealth(provider.health, connection);
  const signal = provider.available
    ? signalOf(connection?.health.status ?? null, Boolean(connection))
    : "off";
  const label =
    {
      shopify: "Datos de la tienda",
      meta_ads: "Rendimiento publicitario",
      klaviyo: "Email y SMS",
      instagram: "Contenido e insights",
    }[provider.id] ?? "Fuente de datos";
  return (
    <section className={hub.providerHead}>
      <header className={hub.band}>
        <span className={hub.bandLogo}>
          <ProviderIcon provider={provider.id} size={26} />
        </span>
        <div className={hub.bandText}>
          <p>{label}</p>
          <h1>{provider.name}</h1>
        </div>
        <div className={hub.bandState}>
          <span className={hub.st} data-s={signal}>
            <i aria-hidden />
            {!provider.available
              ? "Aún no disponible"
              : connection
                ? explanation.label
                : "Sin conectar"}
          </span>
          {connection?.provider_account_name || connection?.provider_account_id ? (
            <small>
              {connection.provider_account_name ?? connection.provider_account_id}
            </small>
          ) : null}
        </div>
      </header>
      <div className={hub.providerBody}>
        <p className={hub.note}>{provider.description}</p>
        <IntegrationActivationChecklist
          ready={provider.activation.ready}
          missing={provider.activation.missing}
        />
        {!provider.available ? (
          <Banner tone="warn">
            <span className="font-medium">Disponible más adelante.</span> El
            conector no se activa hasta que haya credenciales y sincronización
            real. No se muestran datos simulados.
          </Banner>
        ) : cfg === "credentials_missing" ? (
          <Banner tone="warn">
            Faltan las credenciales de la app del proveedor en el servidor.
            Cuando se configuren, esta página habilitará OAuth y sincronización
            real.
          </Banner>
        ) : cfg === "feature_disabled" ? (
          <Banner tone="warn">
            El conector está configurado pero su feature flag{" "}
            <span className="font-mono">{provider.feature_flag}</span> está
            desactivado. No se llamará al proveedor hasta habilitarlo.
          </Banner>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** Lista de pasos numerada y legible (no un parrafo largo). */
export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-3 space-y-3 text-sm leading-6">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center border border-accent bg-accent-soft text-xs font-semibold text-accent">
            {index + 1}
          </span>
          <span className="min-w-0 pt-0.5">{item}</span>
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
    organizationId ? `/v1/organizations/${organizationId}/store-scope` : null,
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
      <div className="flex flex-wrap gap-2" role="group" aria-label="Cuentas conectadas">
        {connections.map((item) => {
          const store = storeByConnection?.get(item.id);
          const selected = item.id === connection?.id;
          return (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={selected ? "primary" : "secondary"}
              aria-pressed={selected}
              onClick={() => onChange(item.id)}
            >
              <span className="max-w-48 truncate">
                {item.provider_account_name ?? item.provider_account_id ?? item.id}
              </span>
              <span className="text-xs opacity-75">
                {store ? storeLabel(store) : healthLabel(item.health.status)}
              </span>
            </Button>
          );
        })}
      </div>

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

export function ConnectionFacts({
  provider,
}: {
  provider: IntegrationProvider;
}) {
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
              ? new Date(provider.connection.last_sync_at).toLocaleString(
                  "es-ES",
                )
              : "Sin sincronización"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Versión API</dt>
        <dd className="font-mono">
          {provider.connection?.api_version ?? "n/a"}
        </dd>
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
  const needsKlaviyoEventsPermission =
    /klaviyo_api_error:PERMISSION_MISSING:403/i.test(message) &&
    /events:read/i.test(message);
  return (
    <Banner className="border-danger" tone="danger">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="font-medium">
            La sincronización necesita revisión.{" "}
          </span>
          <span>{integrationErrorSummary(message)}</span>
        </span>
        {needsKlaviyoEventsPermission ? (
          <Link
            className="inline-flex min-h-9 items-center rounded-md border border-current px-3 text-sm font-medium no-underline hover:underline"
            href="/integraciones/klaviyo"
          >
            Reautorizar Klaviyo
          </Link>
        ) : onRetry ? (
          <Button size="sm" type="button" onClick={onRetry} disabled={retrying}>
            {retrying ? "Reintentando..." : "Reintentar sincronización"}
          </Button>
        ) : null}
      </div>
      {provider.connection?.provider_account_id ? (
        <InfoModalButton title="Detalle técnico de la incidencia" label="Ver detalle técnico">
          <p className="break-words font-mono text-xs text-muted">{message}</p>
          <p className="mt-2 text-xs text-muted">
            Cuenta afectada: {provider.connection.provider_account_id}
          </p>
        </InfoModalButton>
      ) : null}
    </Banner>
  );
}
