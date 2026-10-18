"use client";

import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { ZoneNotesProvider } from "@/components/zone-notes";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { ClientDashboard } from "./client-dashboard";
import { ConsultantDashboard } from "./consultant-desk";
import s from "./client-pulse.module.css";

function DashboardRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();

  // Dos paneles porque responden preguntas distintas:
  //   consultor -> "¿qué cliente necesita mi atención y qué hago hoy?"
  //                (cartera, un cliente o una tienda según el selector)
  //   cliente   -> "¿cómo va mi tienda y qué tengo que hacer?"
  // Las notas del consultor en las tarjetas: las dos vistas leen las mismas.
  return (
    <ZoneNotesProvider organizationId={organizationId || null} connectionId={connectionId || null} asConsultant={isConsultant}>
      {isConsultant ? <ConsultantDashboard bootstrap={bootstrap} /> : <ClientDashboard bootstrap={bootstrap} />}
    </ZoneNotesProvider>
  );
}

export default function DashboardPage() {
  return (
    <PortalShell title="Dashboard">
      {(bootstrap) => <div className={s.workspace}><DashboardRouter bootstrap={bootstrap} /></div>}
    </PortalShell>
  );
}
