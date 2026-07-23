"use client";

import { FormEvent, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { Button, Field, Input, LoadingBlock, Select } from "@ecomscaling/ui";

type IntegrationProvider = {
  id: string;
  name: string;
  phase: string;
  description: string;
  available: boolean;
  feature_flag: string;
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
  providers: IntegrationProvider[];
};

function statusLabel(provider: IntegrationProvider) {
  if (!provider.connection) {
    return "No conectado";
  }

  return provider.connection.status;
}

function integrationErrorMessage(provider: IntegrationProvider) {
  return provider.latest_sync?.error_message ?? provider.connection?.last_error_message ?? null;
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
  const { organizationId: selectedOrganizationId, setOrganizationId: setSelectedOrganizationId } =
    useActiveOrganization();
  const [shopDomain, setShopDomain] = useState("marta-reyes-swimwear.myshopify.com");
  const [appMode, setAppMode] = useState<"public" | "custom">("public");
  const [payload, setPayload] = useState<IntegrationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);
  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ?? bootstrap.memberships[0]?.organization ?? null;

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      if (!organization) {
        setError("No hay organización activa.");
        setIsLoading(false);
        return;
      }

      const response = await apiFetch(`/v1/organizations/${organization.id}/integrations`);

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string; message?: string; detail?: string }
          | null;
        setError(
          [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
            .filter(Boolean)
            .join(" - "),
        );
        setIsLoading(false);
        return;
      }

      const data = (await response.json()) as IntegrationsResponse;
      setPayload(data);
      if (data.shopify_custom_app_available) {
        // La app publica todavia esta pendiente de revisión de Shopify: mientras tanto,
        // la unica que puede instalarse en tiendas reales de clientes es la personalizada.
        setAppMode("custom");
      }
      setIsLoading(false);
    }

    void load();
  }, [organization, token]);

  async function connectShopify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organization) {
      return;
    }

    setIsConnecting(true);
    setError(null);

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
      const body = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; detail?: string }
        | null;
      setError(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
          .filter(Boolean)
          .join(" - "),
      );
      setIsConnecting(false);
      return;
    }

    const body = (await response.json()) as { redirectUrl: string };
    window.location.assign(body.redirectUrl);
  }

  async function connectMeta() {
    if (!organization) {
      return;
    }

    setIsConnectingMeta(true);
    setError(null);

    const response = await apiFetch(
      `/v1/organizations/${organization.id}/integrations/meta/connect`,
      { method: "POST" },
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string; message?: string; detail?: string }
        | null;
      setError(
        [body?.error ?? `HTTP ${response.status}`, body?.message, body?.detail]
          .filter(Boolean)
          .join(" - "),
      );
      setIsConnectingMeta(false);
      return;
    }

    const body = (await response.json()) as { redirectUrl: string };
    window.location.assign(body.redirectUrl);
  }

  if (isLoading) {
    return <LoadingBlock label="Cargando integraciones..." />;
  }

  if (error) {
    return <div className="border-l-2 border-brand py-0.5 pl-3 text-sm text-brand-deep">{error}</div>;
  }

  if (!payload) {
    return null;
  }

  return (
    <div className="space-y-4">
      {!payload.schema_ready ? (
        <div className="border-l-2 border-brand py-0.5 pl-3 text-sm text-brand-deep">
          No se pudo cargar el estado de las integraciones ahora mismo. Reintenta en unos minutos o
          contacta con soporte si sigue igual.
        </div>
      ) : null}

      <section className="border-t border-ink/20 pt-5">
        <h3 className="font-display text-2xl">Conectar Shopify</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Introduce el dominio <span className="font-mono">*.myshopify.com</span> de la tienda.
          La URL de admin de Shopify no sirve como callback OAuth.
        </p>
        <div className="mt-3 border border-edge bg-surface p-3 text-sm leading-6 text-muted">
          <p className="font-medium text-ink">Como encontrar tu dominio .myshopify.com</p>
          <p className="mt-1">
            No es el dominio publico de tu web (p. ej. <span className="font-mono">mitienda.com</span>), sino el
            dominio interno que Shopify asigno al crear la tienda y que nunca cambia.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Entra al admin de tu tienda en Shopify y mira la URL del navegador:{" "}
              <span className="font-mono">admin.shopify.com/store/TU-HANDLE</span>. Tu dominio es{" "}
              <span className="font-mono">TU-HANDLE.myshopify.com</span>.
            </li>
            <li>
              O ve a <span className="font-medium">Configuración &rarr; Dominios</span> en el admin: ahi aparece
              el dominio <span className="font-mono">xxxx.myshopify.com</span> exacto.
            </li>
          </ol>
          <p className="mt-2">
            Si al conectar ves una pagina de Shopify tipo &quot;This store will be right back&quot;, el dominio
            introducido no corresponde a tu tienda activa: revisa el handle con los pasos de arriba.
          </p>
          <p className="mt-3 font-medium text-ink">Como conectar la tienda</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Escribe el dominio <span className="font-mono">TU-HANDLE.myshopify.com</span> en el campo de abajo
              y pulsa <span className="font-medium">Conectar Shopify</span>.
            </li>
            <li>
              Se abrira la pantalla de autorizacion de Shopify: revisa los permisos y pulsa{" "}
              <span className="font-medium">Instalar</span> (necesitas ser owner o staff con permisos de apps en
              esa tienda, con la sesión iniciada en Shopify).
            </li>
            <li>
              Volveras automáticamente a esta pagina y la sincronización inicial empezara sola. Los datos
              (catalogo, inventario, pedidos, clientes) aparecerán en la sección Shopify en unos minutos.
            </li>
          </ol>
        </div>
        <div className="mt-4">
          <Field label="Organización">
            <Select
              value={organization?.id ?? ""}
              onChange={(event) => {
                setSelectedOrganizationId(event.target.value);
                setError(null);
              }}
            >
              {bootstrap.memberships.map((membership) => (
                <option key={membership.organization_id} value={membership.organization_id}>
                  {membership.organization?.display_name ?? membership.organization_id}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {payload?.shopify_custom_app_available ? (
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <span className="font-medium">App de Shopify a usar</span>
            <div className="flex flex-wrap gap-2">
              <label
                className={[
                  "flex cursor-pointer items-center gap-2 border px-3 py-2",
                  appMode === "custom" ? "border-black bg-surface" : "border-edge-strong",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="app-mode"
                  checked={appMode === "custom"}
                  onChange={() => setAppMode("custom")}
                />
                App personalizada (para clientes reales, ya activa)
              </label>
              <label
                className={[
                  "flex cursor-pointer items-center gap-2 border px-3 py-2",
                  appMode === "public" ? "border-black bg-surface" : "border-edge-strong",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="app-mode"
                  checked={appMode === "public"}
                  onChange={() => setAppMode("public")}
                />
                App publica (pendiente de revisión de Shopify)
              </label>
            </div>
            <p className="text-xs text-muted">
              Usa &quot;App personalizada&quot; para conectar tiendas reales de clientes ahora mismo. Cuando la
              app publica pase la revisión de Shopify, cambia a esa opcion para los clientes nuevos.
            </p>
          </div>
        ) : null}
        <form className="mt-4 flex flex-col gap-3 md:flex-row" onSubmit={connectShopify}>
          <Input
            className="min-w-0 flex-1"
            aria-label="Dominio .myshopify.com de la tienda"
            value={shopDomain}
            onChange={(event) => setShopDomain(event.target.value)}
            placeholder="marta-reyes-swimwear.myshopify.com"
            autoComplete="off"
            required
          />
          <Button type="submit" disabled={isConnecting}>
            {isConnecting ? "Conectando..." : "Conectar Shopify"}
          </Button>
        </form>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {payload.providers.map((provider) => (
          <article key={provider.id} className="border-t border-ink/20 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl">{provider.name}</h3>
                <p className="mt-1 font-mono text-xs text-brand">{provider.phase}</p>
              </div>
              <span className="border border-brand px-2 py-1 text-xs text-brand">
                {statusLabel(provider)}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">{provider.description}</p>
            <p className="mt-2 text-xs text-muted">
              Salud: <span className="font-medium text-ink">{healthLabel(provider.health.status)}</span>
            </p>
            {provider.id === "meta_ads" && provider.available ? (
              payload.meta_app_available ? (
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
                <p className="mt-4 border border-edge bg-surface p-2 text-xs text-muted">
                  La app de Meta no esta configurada en el servidor todavia (META_APP_ID/SECRET).
                </p>
              )
            ) : null}
            {!provider.available ? (
              <div className="mt-4 border border-edge bg-surface p-3 text-xs leading-5 text-muted">
                <p className="font-medium text-ink">Disponible más adelante</p>
                <p className="mt-1">
                  La interfaz ya está preparada para este conector, pero todavía no se activa porque no hay
                  credenciales ni sincronización real configuradas. No se muestran datos simulados.
                </p>
              </div>
            ) : null}
            {integrationErrorMessage(provider) ? (
              <div className="mt-4 border border-brand bg-brand-tint p-3 text-xs leading-5 text-brand-deep">
                <p className="font-medium">Ultimo error</p>
                <p className="mt-1 font-mono break-words">{integrationErrorMessage(provider)}</p>
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
                  {provider.latest_sync?.status ?? provider.connection?.last_sync_at ?? "sin_sync"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Version API</dt>
                <dd className="font-mono">{provider.connection?.api_version ?? "n/a"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <PortalShell title="Integraciones">
      {(bootstrap, token) => <IntegrationsList bootstrap={bootstrap} token={token} />}
    </PortalShell>
  );
}
