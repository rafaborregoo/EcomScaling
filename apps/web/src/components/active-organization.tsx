"use client";

import { createContext, useContext } from "react";

// FE-08: organización activa global. La fija el selector del header del shell
// (persistida en localStorage) y las paginas la leen via useActiveOrganization
// en lugar de mantener cada una su propio selector.
export type ActiveOrganizationContextValue = {
  organizationId: string;
  setOrganizationId: (organizationId: string) => void;
};

export const ActiveOrganizationContext = createContext<ActiveOrganizationContextValue | null>(null);

export const ACTIVE_ORGANIZATION_STORAGE_KEY = "ecomscaling.activeOrganizationId";

export function useActiveOrganization(): ActiveOrganizationContextValue {
  const value = useContext(ActiveOrganizationContext);

  if (!value) {
    throw new Error("useActiveOrganization debe usarse dentro de PortalShell");
  }

  return value;
}
