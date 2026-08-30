"use client";

import {
  AdminComingSoon,
  PlatformAdminShell,
} from "@/components/platform-admin-shell";

export default function AdminFacturacionPage() {
  return (
    <PlatformAdminShell title="Facturación">
      {() => <AdminComingSoon area="Facturación y Stripe" />}
    </PlatformAdminShell>
  );
}
