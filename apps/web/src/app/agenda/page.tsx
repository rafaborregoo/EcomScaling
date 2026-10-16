"use client";

import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { ConsultantAgenda } from "@/components/consultant-agenda";
import { WorkPageHeader } from "@/components/trabajo-ui";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { ButtonLink, Card } from "@/components/ui";

function AgendaContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { setOrganizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (!isConsultant) {
    return (
      <Card
        title="Agenda del consultor"
        description="Esta agenda es una herramienta interna del consultor."
      >
        <ButtonLink href="/dashboard">Volver al dashboard</ButtonLink>
      </Card>
    );
  }

  return (
    <div className="portal-page grid gap-5">
      <WorkPageHeader title="Agenda">Revisa tus próximos compromisos, tareas e hitos por cliente.</WorkPageHeader>
      <ConsultantAgenda onSelectClient={setOrganizationId} />
    </div>
  );
}

export default function AgendaPage() {
  return (
    <PortalShell title="Agenda">
      {(bootstrap) => <AgendaContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
