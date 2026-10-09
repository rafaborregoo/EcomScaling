"use client";

import { PortalShell } from "@/components/portal-shell";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { ClientDashboard } from "./client-dashboard";
import { ConsultantDashboard } from "./consultant-desk";

function DashboardRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );

  // Dos paneles porque responden preguntas distintas:
  //   consultor -> "¿qué cliente necesita mi atención y qué hago hoy?"
  //                (cartera, un cliente o una tienda según el selector)
  //   cliente   -> "¿cómo va mi tienda y qué tengo que hacer?"
  return isConsultant ? (
    <ConsultantDashboard bootstrap={bootstrap} />
  ) : (
    <ClientDashboard bootstrap={bootstrap} />
  );
}

export default function DashboardPage() {
  return (
    <PortalShell title="Dashboard">
      {(bootstrap) => <DashboardRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
