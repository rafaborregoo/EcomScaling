"use client";

import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
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
      {() => <StoreScopeSection />}
    </PortalShell>
  );
}

function StoreScopeSection() {
  const { organizationId } = useActiveOrganization();

  return (
    <div className="portal-page space-y-5 sm:space-y-6">
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
          emptyTitle="No hay cliente activo"
          emptyHint="Elige un cliente en el selector del encabezado para repartir sus cuentas entre tiendas."
        />
      )}
    </div>
  );
}
