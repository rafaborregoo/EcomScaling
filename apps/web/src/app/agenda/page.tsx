"use client";

import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { ConsultantAgenda } from "@/components/consultant-agenda";
import { WorkPageHeader } from "@/components/trabajo-ui";
import type { BootstrapResponse } from "@/lib/bootstrap";
import { ButtonLink, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

function AgendaContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { setOrganizationId } = useActiveOrganization();
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  if (!isConsultant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agenda del consultor</CardTitle>
          <CardDescription>Esta agenda es una herramienta interna del consultor.</CardDescription>
        </CardHeader>
        <CardContent>
          <ButtonLink href="/dashboard">Volver al dashboard</ButtonLink>
        </CardContent>
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
