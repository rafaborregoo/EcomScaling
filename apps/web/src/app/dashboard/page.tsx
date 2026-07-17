"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";

type ShopifyConnection = {
  id: string;
  provider_account_name: string | null;
  provider_account_id: string | null;
  status: string;
};

type ShopifyOverviewLite = {
  connections: ShopifyConnection[];
  selected_connection_id: string | null;
  authorized_scopes: string[];
  datasets: Array<{
    key: string;
    label: string;
    table: string | null;
    description: string;
    status: "active" | "planned";
    scopes: string[];
    count: number;
  }>;
};

const modules = [
  { name: "Meta Ads", status: "Pendiente de conexion", next: "Activar lecturas de inversion" },
  { name: "Klaviyo", status: "Pendiente de conexion", next: "Sincronizar listas y campanas" },
  { name: "Agentes IA", status: "Bloqueado por datos", next: "Definir runtime y evaluaciones" },
];

function DashboardContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    bootstrap.memberships[0]?.organization_id ?? "",
  );
  const [shopifyConnections, setShopifyConnections] = useState<ShopifyConnection[]>([]);
  const [shopifyOverview, setShopifyOverview] = useState<ShopifyOverviewLite | null>(null);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [storesLoadError, setStoresLoadError] = useState<string | null>(null);

  const organization =
    bootstrap.memberships.find((membership) => membership.organization_id === selectedOrganizationId)
      ?.organization ?? bootstrap.memberships[0]?.organization ?? null;

  useEffect(() => {
    async function loadStores() {
      if (!organization) {
        return;
      }

      setIsLoadingStores(true);
      const response = await apiFetch(`/v1/organizations/${organization.id}/shopify/overview`);

      if (response.ok) {
        const payload = (await response.json()) as ShopifyOverviewLite;
        setShopifyConnections(payload.connections ?? []);
        setShopifyOverview(payload);
        setStoresLoadError(null);
      } else {
        setShopifyConnections([]);
        setShopifyOverview(null);
        setStoresLoadError(
          `No se pudo cargar el estado de Shopify (HTTP ${response.status}). Reintenta o revisa los logs de la API.`,
        );
      }

      setIsLoadingStores(false);
    }

    void loadStores();
  }, [organization?.id]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-md border border-[#d8d8d8] bg-white p-4">
          <p className="text-sm text-[#5f5f5f]">Organizaciones</p>
          <p className="mt-2 font-mono text-2xl">{bootstrap.memberships.length}</p>
        </article>
        <article className="rounded-md border border-[#d8d8d8] bg-white p-4">
          <p className="text-sm text-[#5f5f5f]">Suscripciones activas</p>
          <p className="mt-2 font-mono text-2xl">
            {bootstrap.subscriptions.filter((item) => item.status === "active").length}
          </p>
        </article>
        <article className="rounded-md border border-[#d8d8d8] bg-white p-4">
          <p className="text-sm text-[#5f5f5f]">Rol</p>
          <p className="mt-2 font-mono text-lg">{bootstrap.profile.platform_role}</p>
        </article>
      </section>

      <section className="rounded-md border border-[#d8d8d8] bg-white p-4">
        <label className="block text-sm">
          <span className="font-medium">Organizacion activa</span>
          <select
            className="mt-2 w-full rounded-md border border-[#cfcfcf] bg-white px-3 py-2 outline-none focus:border-[#dc1f26]"
            value={selectedOrganizationId}
            onChange={(event) => {
              setSelectedOrganizationId(event.target.value);
              setShopifyConnections([]);
              setShopifyOverview(null);
            }}
          >
            {bootstrap.memberships.map((membership) => (
              <option key={membership.organization_id} value={membership.organization_id}>
                {membership.organization?.display_name ?? membership.organization_id}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-md border border-[#d8d8d8] bg-white">
        <div className="border-b border-[#e2e2e2] px-4 py-3">
          <h3 className="font-medium">Cobertura Shopify</h3>
          <p className="mt-1 text-sm text-[#5f5f5f]">
            Estado real de lo que EcomScaling guarda hoy frente a lo que la tienda puede autorizar.
          </p>
        </div>
        {shopifyOverview ? (
          <>
            <div className="grid gap-0 md:grid-cols-4">
              <article className="border-b border-[#e2e2e2] p-4 md:border-r">
                <p className="text-sm text-[#5f5f5f]">Bloques guardando datos</p>
                <p className="mt-2 font-mono text-2xl">
                  {shopifyOverview.datasets.filter((dataset) => dataset.status === "active").length}
                </p>
              </article>
              <article className="border-b border-[#e2e2e2] p-4 md:border-r">
                <p className="text-sm text-[#5f5f5f]">Registros visibles</p>
                <p className="mt-2 font-mono text-2xl">
                  {shopifyOverview.datasets
                    .filter((dataset) => dataset.status === "active")
                    .reduce((total, dataset) => total + dataset.count, 0)}
                </p>
              </article>
              <article className="border-b border-[#e2e2e2] p-4 md:border-r">
                <p className="text-sm text-[#5f5f5f]">Autorizado pendiente</p>
                <p className="mt-2 font-mono text-2xl">
                  {shopifyOverview.datasets.filter(
                    (dataset) =>
                      dataset.status === "planned" &&
                      dataset.scopes.some((scope) => shopifyOverview.authorized_scopes.includes(scope)),
                  ).length}
                </p>
              </article>
              <article className="border-b border-[#e2e2e2] p-4">
                <p className="text-sm text-[#5f5f5f]">Sin permiso concedido</p>
                <p className="mt-2 font-mono text-2xl">
                  {shopifyOverview.datasets.filter(
                    (dataset) =>
                      dataset.status === "planned" &&
                      !dataset.scopes.some((scope) => shopifyOverview.authorized_scopes.includes(scope)),
                  ).length}
                </p>
              </article>
            </div>
            <div className="grid gap-0 lg:grid-cols-3">
              {shopifyOverview.datasets.map((dataset) => {
                const hasAuthorizedScope = dataset.scopes.some((scope) =>
                  shopifyOverview.authorized_scopes.includes(scope),
                );
                const label =
                  dataset.status === "active"
                    ? "se vuelca"
                    : hasAuthorizedScope
                      ? "autorizado pendiente"
                      : "requiere permiso";

                return (
                  <article key={dataset.key} className="border-b border-[#e2e2e2] p-4 lg:border-r">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-medium">{dataset.label}</h4>
                        <p className="mt-1 font-mono text-xs text-[#5f5f5f]">
                          {dataset.table ?? "pendiente_modelo"}
                        </p>
                      </div>
                      <span
                        className={[
                          "rounded-sm border px-2 py-1 text-xs",
                          dataset.status === "active"
                            ? "border-black bg-black text-white"
                            : hasAuthorizedScope
                              ? "border-[#dc1f26] text-[#dc1f26]"
                              : "border-[#d8d8d8] text-[#5f5f5f]",
                        ].join(" ")}
                      >
                        {label}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#5f5f5f]">{dataset.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {dataset.scopes.map((scope) => (
                        <span key={scope} className="rounded-sm bg-[#f5f5f5] px-2 py-1 font-mono text-xs">
                          {scope}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 font-mono text-sm">{dataset.count} registros</p>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="p-4 text-sm text-[#5f5f5f]">
            Conecta una tienda Shopify para ver la cobertura de datos disponible.
          </div>
        )}
      </section>

      <section className="rounded-md border border-[#d8d8d8] bg-white">
        <div className="border-b border-[#e2e2e2] px-4 py-3">
          <h3 className="font-medium">Tiendas Shopify</h3>
        </div>
        <div className="divide-y divide-[#e2e2e2]">
          {isLoadingStores ? (
            <div className="px-4 py-3 text-sm text-[#5f5f5f]">Cargando tiendas...</div>
          ) : shopifyConnections.length ? (
            shopifyConnections.map((connection) => (
              <div
                key={connection.id}
                className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_140px_120px]"
              >
                <div>
                  <p className="font-medium">
                    {connection.provider_account_id ?? connection.provider_account_name ?? "Tienda Shopify"}
                  </p>
                  <p className="font-mono text-xs text-[#5f5f5f]">{connection.id}</p>
                </div>
                <p className="font-mono text-sm text-[#dc1f26]">{connection.status}</p>
                <Link
                  className="w-fit rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-[#dc1f26]"
                  href={`/shopify?organizationId=${selectedOrganizationId}&connectionId=${connection.id}`}
                >
                  Ver tienda
                </Link>
              </div>
            ))
          ) : storesLoadError ? (
            <div className="px-4 py-3 text-sm text-[#dc1f26]">{storesLoadError}</div>
          ) : (
            <div className="px-4 py-3 text-sm text-[#5f5f5f]">
              No hay tiendas Shopify conectadas para esta organizacion.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <article key={module.name} className="rounded-md border border-[#d8d8d8] p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{module.name}</h3>
              <span className="rounded-sm bg-[#f8e7e8] px-2 py-1 font-mono text-xs text-[#dc1f26]">
                {module.status}
              </span>
            </div>
            <p className="mt-4 text-sm text-[#5f5f5f]">{module.next}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PortalShell title="Dashboard">
      {(bootstrap) => <DashboardContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
