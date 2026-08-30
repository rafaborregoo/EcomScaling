"use client";

import { createContext, useContext } from "react";

// Selector de vista para platform_admin (solo en el nav del shell): "admin"
// mantiene las mutaciones (CRUD de clientes/tiendas); "consultant" previsualiza
// la experiencia de solo lectura del consultor. La vista de cliente no entra
// aqui todavia.
export type AdminViewMode = "admin" | "consultant";

export type AdminViewModeContextValue = {
  viewMode: AdminViewMode;
  setViewMode: (mode: AdminViewMode) => void;
};

export const AdminViewModeContext =
  createContext<AdminViewModeContextValue | null>(null);

export const ADMIN_VIEW_MODE_STORAGE_KEY = "ecomscaling.adminViewMode";

// Tolerante a falta de provider: fuera del PortalShell no hay selector y el
// valor por defecto ("admin") deja el comportamiento previo intacto.
export function useAdminViewMode(): AdminViewModeContextValue {
  return (
    useContext(AdminViewModeContext) ?? {
      viewMode: "admin",
      setViewMode: () => {},
    }
  );
}
