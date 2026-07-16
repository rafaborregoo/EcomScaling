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
  const [isLoadingStores, setIsLoadingStores] = useState(false);

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
      } else {
        setShopifyConnections([]);
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
