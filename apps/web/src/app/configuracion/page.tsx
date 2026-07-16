"use client";

import { PortalShell } from "@/components/portal-shell";

export default function SettingsPage() {
  return (
    <PortalShell title="Configuracion">
      {(bootstrap) => {
        const organization = bootstrap.memberships[0]?.organization;
        const subscription = organization
          ? bootstrap.subscriptions.find((item) => item.organization_id === organization.id)
          : null;

        return (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-[#d8d8d8] p-4">
              <h3 className="font-medium">Perfil</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5f5f5f]">Nombre</dt>
                  <dd className="text-right">{bootstrap.profile.full_name ?? "Sin nombre"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5f5f5f]">Email</dt>
                  <dd className="text-right">{bootstrap.user.email ?? "Sin email"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5f5f5f]">Rol plataforma</dt>
                  <dd className="font-mono text-[#dc1f26]">{bootstrap.profile.platform_role}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-md border border-[#d8d8d8] p-4">
              <h3 className="font-medium">Organizacion activa</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5f5f5f]">Nombre</dt>
                  <dd className="text-right">{organization?.display_name ?? "Sin organizacion"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5f5f5f]">Zona horaria</dt>
                  <dd className="font-mono">{organization?.timezone ?? "n/a"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5f5f5f]">Moneda</dt>
                  <dd className="font-mono">{organization?.currency_code ?? "n/a"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#5f5f5f]">Plan</dt>
                  <dd className="font-mono text-[#dc1f26]">
                    {subscription ? `${subscription.plan_code}/${subscription.status}` : "sin_plan"}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        );
      }}
    </PortalShell>
  );
}
