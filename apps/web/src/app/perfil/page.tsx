"use client";

import { PortalShell } from "@/components/portal-shell";
import { ProfileSection } from "@/app/configuracion/profile-section";

// El perfil vive en Configuración › Perfil. Esta ruta se mantiene para los
// enlaces antiguos y para el panel de administración, que no tiene ese módulo.
export default function ProfilePage() {
  return (
    <PortalShell title="Perfil">
      {(bootstrap) => (
        <div className="portal-page mx-auto max-w-3xl">
          <ProfileSection bootstrap={bootstrap} />
        </div>
      )}
    </PortalShell>
  );
}
