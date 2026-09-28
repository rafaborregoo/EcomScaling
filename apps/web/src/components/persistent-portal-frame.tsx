"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";

const PORTAL_PREFIXES = [
  "/admin",
  "/agentes",
  "/agenda",
  "/camino",
  "/configuracion",
  "/conocimiento",
  "/consultor",
  "/contexto",
  "/dashboard",
  "/integraciones",
  "/klaviyo",
  "/llamadas",
  "/marketing",
  "/mensajes",
  "/meta",
  "/mi-trabajo",
  "/panel",
  "/perfil",
  "/planificacion",
  "/shopify",
  "/tareas",
  "/tiendas",
];

const TITLES: Array<[string, string]> = [
  ["/admin", "Administración"],
  ["/agentes", "Agentes"],
  ["/agenda", "Agenda"],
  ["/camino", "Mi camino"],
  ["/configuracion", "Configuración"],
  ["/conocimiento", "Conocimiento"],
  ["/consultor", "Clientes"],
  ["/contexto", "Mi negocio"],
  ["/dashboard", "Dashboard"],
  ["/integraciones", "Integraciones"],
  ["/klaviyo", "Klaviyo"],
  ["/llamadas", "Llamadas"],
  ["/marketing", "Marketing IA"],
  ["/mensajes", "Chats"],
  ["/meta", "Meta Ads"],
  ["/mi-trabajo", "Mi trabajo"],
  ["/panel", "Rentabilidad"],
  ["/perfil", "Perfil"],
  ["/planificacion", "Planificación"],
  ["/shopify", "Shopify"],
  ["/tareas", "Tareas"],
  ["/tiendas", "Mis tiendas"],
];

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function getTitle(pathname: string) {
  if (pathname === "/marketing/plantillas") return "Biblioteca de plantillas";
  if (pathname === "/marketing/imagenes") return "Banco de imágenes";
  if (pathname.startsWith("/marketing/imagenes/")) return "Editor de pieza";
  if (pathname === "/planificacion/calendario") return "Agenda";
  if (pathname === "/planificacion/recomendaciones") return "Recomendaciones IA";
  if (pathname === "/planificacion/tracking") return "Tracking";
  return TITLES.find(([prefix]) => matchesPath(pathname, prefix))?.[1] ?? "E-NORA";
}

function PersistentPortalFrameContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPortalRoute = PORTAL_PREFIXES.some((prefix) =>
    matchesPath(pathname, prefix),
  );

  if (!isPortalRoute) return children;

  return (
    <PortalShell title={getTitle(pathname)}>
      {() => children}
    </PortalShell>
  );
}

export function PersistentPortalFrame({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <PersistentPortalFrameContent>{children}</PersistentPortalFrameContent>
    </Suspense>
  );
}
