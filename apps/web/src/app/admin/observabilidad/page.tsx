"use client";

import {
  AdminComingSoon,
  PlatformAdminShell,
} from "@/components/platform-admin-shell";

export default function AdminObservabilidadPage() {
  return (
    <PlatformAdminShell title="Observabilidad">
      {() => <AdminComingSoon area="Observabilidad de agentes" />}
    </PlatformAdminShell>
  );
}
