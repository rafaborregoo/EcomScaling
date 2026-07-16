"use client";

import { PortalShell } from "@/components/portal-shell";

const modules = [
  { name: "Shopify", status: "Pendiente de conexion", next: "Importar pedidos y catalogo" },
  { name: "Meta Ads", status: "Pendiente de conexion", next: "Activar lecturas de inversion" },
  { name: "Klaviyo", status: "Pendiente de conexion", next: "Sincronizar listas y campanas" },
  { name: "Agentes IA", status: "Bloqueado por datos", next: "Definir runtime y evaluaciones" },
];

export default function DashboardPage() {
  return (
    <PortalShell title="Dashboard">
      {(bootstrap) => (
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

          <section className="rounded-md border border-[#d8d8d8] bg-white">
            <div className="border-b border-[#e2e2e2] px-4 py-3">
              <h3 className="font-medium">Organizaciones autorizadas</h3>
            </div>
            <div className="divide-y divide-[#e2e2e2]">
              {bootstrap.memberships.map((membership) => {
                const organization = membership.organization;
                const subscription = bootstrap.subscriptions.find(
                  (item) => item.organization_id === membership.organization_id,
                );

                return (
                  <div
                    key={membership.organization_id}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_160px_160px]"
                  >
                    <div>
                      <p className="font-medium">
                        {organization?.display_name ?? "Organizacion sin nombre"}
                      </p>
                      <p className="text-sm text-[#5f5f5f]">{organization?.slug}</p>
                    </div>
                    <p className="font-mono text-sm text-[#dc1f26]">{membership.role}</p>
                    <p className="font-mono text-sm">
                      {subscription ? `${subscription.plan_code}/${subscription.status}` : "sin_plan"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
      )}
    </PortalShell>
  );
}
