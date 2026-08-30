"use client";

import {
  AdminComingSoon,
  PlatformAdminShell,
} from "@/components/platform-admin-shell";

export default function AdminLogsPage() {
  return (
    <PlatformAdminShell title="Logs de errores">
      {() => <AdminComingSoon area="Logs de errores" />}
    </PlatformAdminShell>
  );
}
