"use client";

import { useEffect } from "react";

export type OverlayRole = "client" | "consultant" | "admin";

/**
 * Marca el rol del portal en `<body>`. Los modales y hojas se montan en un
 * portal fuera de `#portal-content`, asi que no heredan `.trabajo-theme`; el
 * bloque de overlays de `globals.css` toma su acento de `body[data-role]`.
 */
export function OverlayRole({ role }: { role: OverlayRole }) {
  useEffect(() => {
    document.body.dataset.role = role;
    return () => {
      delete document.body.dataset.role;
    };
  }, [role]);
  return null;
}
