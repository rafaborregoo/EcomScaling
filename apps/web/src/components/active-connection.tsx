"use client";

import { createContext, useContext } from "react";

// Tienda Shopify activa dentro de la organización activa. La fija el selector
// del header del shell (persistida en localStorage por organización) y las
// páginas la leen via useActiveConnection en lugar de mantener cada una su
// propio selector de tienda.
export type ActiveConnectionContextValue = {
  connectionId: string;
  setConnectionId: (connectionId: string) => void;
  /** Tiendas del cliente activo, para elegir una (p. ej. la etiqueta de una tarea interna). */
  stores?: Array<{ connectionId: string; label: string }>;
};

export const ActiveConnectionContext = createContext<ActiveConnectionContextValue | null>(null);

export const ACTIVE_CONNECTION_STORAGE_KEY = "ecomscaling.activeConnectionByOrg";

export function useActiveConnection(): ActiveConnectionContextValue {
  const value = useContext(ActiveConnectionContext);

  if (!value) {
    throw new Error("useActiveConnection debe usarse dentro de PortalShell");
  }

  return value;
}
