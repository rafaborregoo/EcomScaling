"use client";

import { useEffect, useRef, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { EmptyState } from "@/components/ui";
import { PortfolioLevel } from "./portfolio-level";
import { ClientLevel } from "./client-level";
import { StoreLevel } from "./store-level";
import type { PanelNav } from "./panel-data";

/**
 * El panel de rentabilidad del consultor. Ver docs/PLAN_PANEL_MANAGER.md.
 *
 * Es la pantalla del CONSULTOR, no del cliente (decisión de Rafa, 2026-09-15):
 * dice cosas que hay que saber interpretar -- un CAC contra su techo, un margen
 * de contribución por pedido -- y en manos de un cliente sin contexto asustan o
 * se malinterpretan. El cliente sigue con su dashboard.
 *
 * Tres alcances, y el que se ve lo fija el selector del shell, no el panel:
 *
 *   sin cliente activo       -> la cartera entera (clientes y tiendas)
 *   cliente, "todas"         -> ese cliente y sus tiendas
 *   cliente + una tienda     -> esa tienda
 *
 * Las migas de arriba suben y bajan por esos mismos selectores, así que el
 * panel y la cabecera nunca se contradicen.
 */

function PanelRouter({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId, setOrganizationId } = useActiveOrganization();
  const { connectionId, setConnectionId } = useActiveConnection();
  const [days, setDays] = useState(30);

  // Bajar de la cartera a una tienda concreta son dos selecciones seguidas
  // (cliente y tienda), y el shell borra la tienda al cambiar de cliente. Se
  // apunta la tienda deseada y se aplica cuando el cliente nuevo ya es el
  // activo; hacerlo en el mismo gesto la perdería.
  const pendingStore = useRef<{ organizationId: string; connectionId: string } | null>(null);

  useEffect(() => {
    const pending = pendingStore.current;
    if (pending && pending.organizationId === organizationId) {
      pendingStore.current = null;
      setConnectionId(pending.connectionId);
    }
  }, [organizationId, setConnectionId]);

  const nav: PanelNav = {
    portfolio: () => setOrganizationId(""),
    client: (id) => setOrganizationId(id),
    clientOfStore: () => setConnectionId(""),
    store: (id, connection) => {
      if (id === organizationId) {
        if (connection) setConnectionId(connection);
        return;
      }
      if (connection) pendingStore.current = { organizationId: id, connectionId: connection };
      setOrganizationId(id);
    },
  };

  if (!organizationId) {
    return <PortfolioLevel days={days} onDays={setDays} nav={nav} />;
  }

  const organizationName =
    bootstrap.memberships.find((membership) => membership.organization_id === organizationId)?.organization?.display_name ??
    "Cliente";

  if (!connectionId) {
    return (
      <ClientLevel
        organizationId={organizationId}
        organizationName={organizationName}
        days={days}
        onDays={setDays}
        nav={nav}
      />
    );
  }

  return (
    <StoreLevel
      organizationId={organizationId}
      organizationName={organizationName}
      connectionId={connectionId}
      days={days}
      onDays={setDays}
      nav={nav}
    />
  );
}

export default function PanelPage() {
  return (
    <PortalShell title="Rentabilidad">
      {(bootstrap: BootstrapResponse) =>
        ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role) ? (
          <PanelRouter bootstrap={bootstrap} />
        ) : (
          <div className="portal-page">
            <EmptyState
              title="Esta pantalla es del consultor"
              hint="Las cifras de tu tienda están en «Dashboard»."
            />
          </div>
        )
      }
    </PortalShell>
  );
}
