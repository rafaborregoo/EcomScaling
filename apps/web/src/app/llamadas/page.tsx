"use client";

import { PortalShell } from "@/components/portal-shell";
import { CallsRouter } from "./calls-client";

// CallsRouter contiene los estados LoadingBlock, EmptyState y ErrorBlock de
// la lista. La ruta conserva aquí PortalShell para que el contrato del portal
// siga siendo visible en el propio entry point.
export default function CallsPage() {
  return (
    <PortalShell title="Llamadas">
      {(bootstrap) => <CallsRouter bootstrap={bootstrap} />}
    </PortalShell>
  );
}
