"use client";

import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { AsyncState, IconChevronLeft, Link } from "@/components/ui";
import { StoreScopeCard } from "../store-scope-card";

// A que tienda pertenece cada cuenta de Meta y de Klaviyo.
//
// Estaba en medio del hub, entre el estado de las integraciones y la rejilla de
// proveedores: un formulario largo de selects delante de quien solo venia a ver
// si su tienda estaba bien. Es una tarea aparte y ahora tiene su propia pagina,
// a la que se llega desde el hub y desde cada tienda cuando hay algo sin
// asignar.

export default function StoreScopePage() {
  return (
    <PortalShell title="Cuentas por tienda">
      {(bootstrap) => <StoreScopeSection bootstrap={bootstrap} />}
    </PortalShell>
  );
}

function StoreScopeSection({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId: selectedOrganizationId } = useActiveOrganization();

  // Igual que useIntegrations (../shared.tsx): repartir cuentas entre tiendas
  // es del cliente, no de la cartera. El selector del header puede tener un
  // cliente puesto para dashboard/tareas, pero esta pantalla toca conexiones
  // reales -- solo opera sobre una tienda propia.
  const ownMemberships = bootstrap.memberships.filter(
    (membership) => membership.accessSource !== "consultant_assignment",
  );
  const selectedIsOwn = ownMemberships.some(
    (membership) => membership.organization_id === selectedOrganizationId,
  );
  const organizationId = selectedIsOwn
    ? selectedOrganizationId
    : (ownMemberships[0]?.organization_id ?? null);

  return (
    <div className="portal-page space-y-6">
      <Link
        className="inline-flex items-center gap-1 text-sm"
        href="/integraciones"
      >
        <IconChevronLeft aria-hidden /> Todas las tiendas
      </Link>

      {organizationId ? (
        <StoreScopeCard organizationId={organizationId} />
      ) : (
        <AsyncState
          status="empty"
          emptyTitle="No hay tienda propia"
          emptyHint="Esta pantalla solo muestra las cuentas de tus tiendas. Las cuentas de los clientes no están disponibles en tu portal."
        />
      )}
    </div>
  );
}
