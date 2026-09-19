"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /admin/logs se partio en pantallas propias: auditoria, errores-sync,
// errores-agentes (antes eran pestanas de una sola pagina). Este redirect es
// solo para no romper enlaces/marcadores antiguos a /admin/logs.
export default function AdminLogsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/logs/auditoria");
  }, [router]);

  return null;
}
