"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";

type IntegrationProvider = {
  id: string;
  name: string;
  phase: string;
  description: string;
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

function IntegrationsList({
  bootstrap,
  token,
}: {
  bootstrap: BootstrapResponse;
  token: string;
}) {
  const searchParams = useSearchParams();
  const requestedOrganizationId = searchParams.get("organizationId");
  const initialOrganizationId =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === requestedOrganizationId,
    )?.organization_id ??
    bootstrap.memberships[0]?.organization?.id ??
    "";
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(initialOrganizationId);
  const [shopDomain, setShopDomain] = useState("marta-reyes-swimwear.myshopify.com");
  const [payload, setPayload] = useState<IntegrationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const organization =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === selectedOrganizationId,
    )?.organization ?? bootstrap.memberships[0]?.organization ?? null;

  useEffect(() => {
    const validOrganizationId = bootstrap.memberships.find(
      (membership) => membership.organization_id === requestedOrganizationId,
    )?.organization_id;

    if (validOrganizationId && validOrganizationId !== selectedOrganizationId) {
      setSelectedOrganizationId(validOrganizationId);
      setError(null);
    }
  }, [bootstrap.memberships, requestedOrganizationId, selectedOrganizationId]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      if (!organization) {
        setError("No hay organizacion activa.");
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

      setPayload((await response.json()) as IntegrationsResponse);
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
        body: JSON.stringify({ shopDomain }),
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

  if (isLoading) {
    return <div className="rounded-md border border-[#d8d8d8] p-4">Cargando integraciones...</div>;
  }

  if (error) {
    return <div className="rounded-md border border-[#dc1f26] p-4 text-[#b5121b]">{error}</div>;
  }

  if (!payload) {
    return null;
  }

  return (
    <div className="space-y-4">
      {!payload.schema_ready ? (
        <div className="rounded-md border border-[#dc1f26] bg-white p-4 text-sm text-[#b5121b]">
          DB-04 todavia no esta aplicada en Supabase remoto. La UI ya esta preparada y
          mostrara conexiones reales cuando exista la migracion.
        </div>
      ) : null}

      <section className="rounded-md border border-[#d8d8d8] bg-white p-4">
        <h3 className="font-medium">Conectar Shopify</h3>
        <p className="mt-2 text-sm leading-6 text-[#5f5f5f]">
          Introduce el dominio <span className="font-mono">*.myshopify.com</span> de la tienda.
          La URL de admin de Shopify no sirve como callback OAuth.
        </p>
        <div className="mt-3 rounded-md border border-[#d8d8d8] bg-[#fafafa] p-3 text-sm leading-6 text-[#5f5f5f]">
          <p className="font-medium text-[#111]">Como encontrar tu dominio .myshopify.com</p>
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
              O ve a <span className="font-medium">Configuracion &rarr; Dominios</span> en el admin: ahi aparece
              el dominio <span className="font-mono">xxxx.myshopify.com</span> exacto.
            </li>
          </ol>
          <p className="mt-2">
            Si al conectar ves una pagina de Shopify tipo &quot;This store will be right back&quot;, el dominio
            introducido no corresponde a tu tienda activa: revisa el handle con los pasos de arriba.
          </p>
          <p className="mt-3 font-medium text-[#111]">Como conectar la tienda</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Escribe el dominio <span className="font-mono">TU-HANDLE.myshopify.com</span> en el campo de abajo
              y pulsa <span className="font-medium">Conectar Shopify</span>.
            </li>
            <li>
              Se abrira la pantalla de autorizacion de Shopify: revisa los permisos y pulsa{" "}
              <span className="font-medium">Instalar</span> (necesitas ser owner o staff con permisos de apps en
              esa tienda, con la sesion iniciada en Shopify).
            </li>
            <li>
              Volveras automaticamente a esta pagina y la sincronizacion inicial empezara sola. Los datos
              (catalogo, inventario, pedidos, clientes) apareceran en la seccion Shopify en unos minutos.
            </li>
          </ol>
        </div>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Organizacion</span>
          <select
            className="mt-2 w-full rounded-md border border-[#cfcfcf] bg-white px-3 py-2 outline-none focus:border-[#dc1f26]"
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
          </select>
        </label>
        <form className="mt-4 flex flex-col gap-3 md:flex-row" onSubmit={connectShopify}>
          <input
            className="min-w-0 flex-1 rounded-md border border-[#cfcfcf] px-3 py-2 outline-none focus:border-[#dc1f26]"
            value={shopDomain}
            onChange={(event) => setShopDomain(event.target.value)}
            placeholder="marta-reyes-swimwear.myshopify.com"
            autoComplete="off"
            required
          />
          <button
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-[#dc1f26] disabled:cursor-not-allowed disabled:bg-[#808080]"
            type="submit"
            disabled={isConnecting}
          >
            {isConnecting ? "Conectando..." : "Conectar Shopify"}
          </button>
        </form>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {payload.providers.map((provider) => (
          <article key={provider.id} className="rounded-md border border-[#d8d8d8] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{provider.name}</h3>
                <p className="mt-1 font-mono text-xs text-[#dc1f26]">{provider.phase}</p>
              </div>
              <span className="rounded-sm border border-[#dc1f26] px-2 py-1 text-xs text-[#dc1f26]">
                {statusLabel(provider)}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-[#5f5f5f]">{provider.description}</p>
            {integrationErrorMessage(provider) ? (
              <div className="mt-4 rounded-md border border-[#dc1f26] bg-[#fff7f7] p-3 text-xs leading-5 text-[#9f1119]">
                <p className="font-medium">Ultimo error</p>
                <p className="mt-1 font-mono break-words">{integrationErrorMessage(provider)}</p>
              </div>
            ) : null}

            <dl className="mt-4 space-y-2 border-t border-[#e2e2e2] pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#5f5f5f]">Cuenta</dt>
                <dd className="text-right">
                  {provider.connection?.provider_account_name ?? "Pendiente"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#5f5f5f]">Ultimo sync</dt>
                <dd className="font-mono text-right">
                  {provider.latest_sync?.status ?? provider.connection?.last_sync_at ?? "sin_sync"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#5f5f5f]">Version API</dt>
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
