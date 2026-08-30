"use client";

import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { Card, ErrorBlock } from "@/components/ui";

// Shell para las rutas /admin/*: monta el PortalShell y bloquea el contenido
// si el perfil no es platform_admin. El gate real de datos sigue en el backend
// (requirePlatformAdmin); esto solo evita renderizar la UII a quien no toca.
export function PlatformAdminShell({
  title,
  children,
}: {
  title: string;
  children: (bootstrap: BootstrapResponse, token: string) => ReactNode;
}) {
  return (
    <PortalShell title={title}>
      {(bootstrap, token) =>
        bootstrap.profile.platform_role === "platform_admin" ? (
          children(bootstrap, token)
        ) : (
          <ErrorBlock>Esta sección es solo para platform admin.</ErrorBlock>
        )
      }
    </PortalShell>
  );
}

// Placeholder para las áreas del panel que aún no se han construido.
export function AdminComingSoon({ area }: { area: string }) {
  return (
    <Card kicker="Panel platform admin" title={area}>
      <p className="text-sm leading-6 text-muted">
        Área pendiente de construir. La navegación ya está separada; esta
        sección se implementará por sí sola en su propio bloque de trabajo.
      </p>
    </Card>
  );
}
