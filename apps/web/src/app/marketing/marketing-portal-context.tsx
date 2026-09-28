"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import type { BootstrapResponse } from "@/lib/bootstrap";

type MarketingPortalContextValue = {
  bootstrap: BootstrapResponse;
  token: string;
};

const MarketingPortalContext =
  createContext<MarketingPortalContextValue | null>(null);

export function MarketingPortalProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title =
    pathname === "/marketing/guia"
      ? "Guía de marca"
      : pathname === "/marketing/plantillas"
      ? "Biblioteca de plantillas"
      : pathname.startsWith("/marketing/imagenes/")
        ? "Editor de pieza"
        : pathname === "/marketing/imagenes"
          ? "Banco de imágenes"
          : "Marketing IA";

  return (
    <PortalShell title={title}>
      {(bootstrap, token) => (
        <MarketingPortalContext.Provider value={{ bootstrap, token }}>
          {children}
        </MarketingPortalContext.Provider>
      )}
    </PortalShell>
  );
}

export function useMarketingPortal() {
  const context = useContext(MarketingPortalContext);
  if (!context) {
    throw new Error("useMarketingPortal debe usarse dentro de MarketingLayout");
  }
  return context;
}
