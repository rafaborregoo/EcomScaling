"use client";

import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { apiFetch } from "@/lib/bootstrap";

type ConsultantOrganization = {
  id: string;
  display_name: string;
  slug: string;
  status: string;
  timezone: string;
  currency_code: string;
  consultant_count: number;
  subscription: {
    organization_id: string;
    plan_code: string;
    status: string;
  } | null;
};

function ConsultantPanel({ token }: { token: string }) {
  const [organizations, setOrganizations] = useState<ConsultantOrganization[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const response = await apiFetch("/v1/consultant/organizations");

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; message?: string; detail?: string }
          | null;
        setError(
          [payload?.error ?? `HTTP ${response.status}`, payload?.message, payload?.detail]
            .filter(Boolean)
            .join(" - "),
        );
        setIsLoading(false);
        return;
      }

      const payload = (await response.json()) as { organizations: ConsultantOrganization[] };
      setOrganizations(payload.organizations);
      setIsLoading(false);
    }

    void load();
  }, [token]);

  if (isLoading) {
    return <div className="rounded-md border border-[#d8d8d8] p-4">Cargando clientes...</div>;
  }

  if (error) {
    return (
      <div className="rounded-md border border-[#dc1f26] p-4 text-[#b5121b]">
        {error}
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="rounded-md border border-[#d8d8d8] p-4">
        No hay organizaciones asignadas todavia.
      </div>
    );
  }

  return (
    <section className="rounded-md border border-[#d8d8d8] bg-white">
      <div className="grid border-b border-[#e2e2e2] px-4 py-3 text-xs font-medium uppercase text-[#5f5f5f] md:grid-cols-[1fr_140px_140px_120px]">
        <span>Cliente</span>
        <span>Estado</span>
        <span>Plan</span>
        <span>Consultores</span>
      </div>
      <div className="divide-y divide-[#e2e2e2]">
        {organizations.map((organization) => (
          <div
            key={organization.id}
            className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_140px_140px_120px]"
          >
            <div>
              <p className="font-medium">{organization.display_name}</p>
              <p className="text-sm text-[#5f5f5f]">{organization.slug}</p>
            </div>
            <p className="font-mono text-sm text-[#dc1f26]">{organization.status}</p>
            <p className="font-mono text-sm">
              {organization.subscription
                ? `${organization.subscription.plan_code}/${organization.subscription.status}`
                : "sin_plan"}
            </p>
            <p className="font-mono text-sm">{organization.consultant_count}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ConsultantPage() {
  return (
    <PortalShell title="Panel consultor">
      {(_, token) => <ConsultantPanel token={token} />}
    </PortalShell>
  );
}
