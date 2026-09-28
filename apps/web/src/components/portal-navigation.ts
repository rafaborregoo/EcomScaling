import type { ComponentPropsWithoutRef, ComponentType } from "react";
import {
  ActivityIcon,
  BookOpenIcon,
  ChartIcon,
  CompassIcon,
  HomeIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PlugIcon,
  GearIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui";

export type PortalRole = "client" | "consultant" | "platform_admin";

export type PortalNavItem = {
  href: string;
  label: string;
  group?: string;
  defaultForPath?: boolean;
  matchPrefixes?: string[];
};

export type PortalNavModule = {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<ComponentPropsWithoutRef<"svg">>;
  items: PortalNavItem[];
  matchPrefixes: string[];
  utility?: boolean;
};

const dashboardItems: PortalNavItem[] = [
  {
    href: "/dashboard?tab=todo",
    label: "Prioridades",
    defaultForPath: true,
  },
  { href: "/dashboard?tab=shopify", label: "Shopify" },
  { href: "/dashboard?tab=meta", label: "Meta Ads" },
  { href: "/dashboard?tab=klaviyo", label: "Klaviyo" },
];

const marketingItems: PortalNavItem[] = [
  {
    href: "/marketing?section=plan",
    label: "Plan",
    defaultForPath: true,
  },
  { href: "/marketing?section=contenido", label: "Contenido" },
  { href: "/marketing?section=crear", label: "Crear" },
  { href: "/marketing/imagenes", label: "Banco de imágenes" },
  { href: "/marketing/guia", label: "Guía de marca" },
  { href: "/marketing?section=rendimiento", label: "Rendimiento" },
];

marketingItems.push(
  {
    href: "/marketing/plantillas",
    label: "Biblioteca de plantillas",
  },
);

const marketingNavigationOrder = [
  "/marketing?section=plan",
  "/marketing?section=rendimiento",
  "/marketing?section=contenido",
  "/marketing?section=crear",
  "/marketing/plantillas",
  "/marketing/imagenes",
  "/marketing/guia",
];
marketingItems.sort(
  (left, right) =>
    marketingNavigationOrder.indexOf(left.href) -
    marketingNavigationOrder.indexOf(right.href),
);

const knowledgeItems: PortalNavItem[] = [
  {
    href: "/conocimiento?section=cuestionario",
    label: "Cuéntanos tu tienda",
    defaultForPath: true,
  },
  { href: "/conocimiento?section=reglas", label: "Reglas" },
  { href: "/conocimiento?section=documentos", label: "Documentos" },
  { href: "/conocimiento?section=ia", label: "Gestor IA" },
];

const integrationItems: PortalNavItem[] = [
  { href: "/integraciones", label: "Resumen" },
  { href: "/integraciones/cuentas", label: "Cuentas" },
  { href: "/integraciones/shopify", label: "Shopify" },
  { href: "/integraciones/meta", label: "Meta Ads" },
  { href: "/integraciones/klaviyo", label: "Klaviyo" },
  { href: "/integraciones/instagram", label: "Instagram" },
];

function settingsItems(
  role: PortalRole,
  hasActiveOrganization: boolean,
): PortalNavItem[] {
  return [
    {
      href: "/configuracion?section=general",
      label: "General",
      defaultForPath: true,
    },
    ...(role === "consultant"
      ? [
          {
            href: "/configuracion?section=accesos",
            label: "Accesos",
            group: "Consultoría",
          },
        ]
      : []),
    ...(hasActiveOrganization
      ? [{ href: "/configuracion?section=alertas", label: "Alertas" }]
      : []),
    ...(role === "consultant"
      ? [
          {
            href: "/configuracion?section=cartera",
            label: "Clientes y tiendas",
            group: "Consultoría",
          },
        ]
      : []),
    { href: "/perfil", label: "Perfil", group: "Cuenta" },
  ];
}

function sharedModules(
  role: "client" | "consultant",
  hasActiveOrganization: boolean,
): PortalNavModule[] {
  const consultant = role === "consultant";

  return [
    {
      id: "inicio",
      label: "Inicio",
      description: consultant
        ? "Prioridades y lectura ejecutiva"
        : "Estado de tu tienda y siguientes pasos",
      icon: HomeIcon,
      matchPrefixes: ["/dashboard", "/panel"],
      items: [
        ...dashboardItems,
        ...(consultant
          ? [{ href: "/panel", label: "Rentabilidad", group: "Consultoría" }]
          : []),
      ],
    },
    {
      id: "trabajo",
      label: "Trabajo",
      description: consultant
        ? "Estrategia, planificación y ejecución"
        : "Plan y tareas de la semana",
      icon: CompassIcon,
      matchPrefixes: [
        "/camino",
        "/planificacion",
        "/contexto",
        "/tareas",
        "/mi-trabajo",
      ],
      items: consultant
        ? [
            { href: "/camino", label: "Camino" },
            { href: "/contexto", label: "Contexto" },
            { href: "/planificacion", label: "Resumen" },
            { href: "/planificacion/calendario", label: "Agenda" },
            { href: "/planificacion/recomendaciones", label: "Recomendaciones IA" },
            { href: "/planificacion/tracking", label: "Tracking" },
            { href: "/tareas", label: "Tareas" },
            { href: "/mi-trabajo", label: "Mi trabajo" },
          ]
        : [
            { href: "/camino", label: "Mi camino" },
            { href: "/contexto", label: "Mi negocio" },
            { href: "/planificacion/calendario", label: "Agenda" },
            { href: "/tareas", label: "Tareas" },
          ],
    },
    {
      id: "marketing",
      label: "Marketing",
      description: "De la campaña al resultado",
      icon: MegaphoneIcon,
      matchPrefixes: ["/marketing"],
      items: marketingItems,
    },
    {
      id: "comunicacion",
      label: "Comunicación",
      description: consultant
        ? "Conversaciones, llamadas y agenda"
        : "Habla con tu consultor",
      icon: MessageSquareIcon,
      matchPrefixes: ["/mensajes", "/llamadas", "/agenda"],
      items: [
        { href: "/mensajes", label: "Chats" },
        { href: "/llamadas", label: "Llamadas" },
        ...(consultant ? [{ href: "/agenda", label: "Agenda" }] : []),
      ],
    },
    {
      id: "analitica",
      label: "Analítica",
      description: "Datos por canal y fuente",
      icon: ChartIcon,
      matchPrefixes: ["/shopify", "/meta", "/klaviyo"],
      items: [
        { href: "/shopify", label: "Shopify" },
        { href: "/meta", label: "Meta Ads" },
        { href: "/klaviyo", label: "Klaviyo" },
      ],
    },
    ...(consultant
      ? [
          {
            id: "cartera",
            label: "Cartera",
            description: "Clientes y tiendas que gestionas",
            icon: UsersIcon,
            matchPrefixes: ["/consultor", "/tiendas"],
            items: [
              { href: "/consultor", label: "Clientes" },
              { href: "/tiendas", label: "Mis tiendas" },
              { href: "/consultor/referidos", label: "Mi código" },
            ],
          } satisfies PortalNavModule,
        ]
      : []),
    {
      id: "integraciones",
      label: "Integraciones",
      description: "Conexiones y estado de los datos",
      icon: PlugIcon,
      matchPrefixes: ["/integraciones"],
      items: integrationItems,
    },
    {
      id: "conocimiento",
      label: "Conocimiento",
      description: "Contexto que utiliza el copiloto",
      icon: BookOpenIcon,
      matchPrefixes: ["/conocimiento"],
      items: knowledgeItems,
    },
    {
      id: "configuracion",
      label: "Configuración",
      description: "Cuenta, alertas y permisos",
      icon: GearIcon,
      matchPrefixes: ["/configuracion", "/perfil"],
      items: settingsItems(role, hasActiveOrganization),
      utility: true,
    },
  ];
}

const platformModules: PortalNavModule[] = [
  {
    id: "plataforma",
    label: "Plataforma",
    description: "Consultores, clientes y metodología",
    icon: UsersIcon,
    matchPrefixes: [
      "/admin/consultores",
      "/admin/programa-consultores",
      "/admin/clientes",
      "/admin/conocimiento",
    ],
    items: [
      { href: "/admin/consultores", label: "Consultores" },
      {
        href: "/admin/programa-consultores",
        label: "Programa de consultores",
      },
      { href: "/admin/clientes", label: "Clientes" },
      { href: "/admin/conocimiento", label: "Metodología" },
    ],
  },
  {
    id: "operacion",
    label: "Operación IA",
    description: "Observabilidad, auditoría y errores",
    icon: ActivityIcon,
    matchPrefixes: [
      "/admin/observabilidad",
      "/admin/tools",
      "/admin/logs",
      "/admin/agentes",
      "/admin/laboratorio-mailing",
    ],
    items: [
      { href: "/admin/observabilidad", label: "Observabilidad" },
      { href: "/admin/agentes", label: "Configuración de IA" },
      { href: "/admin/laboratorio-mailing", label: "Laboratorio de mailing" },
      { href: "/admin/tools", label: "Tools del copiloto" },
      { href: "/admin/logs/auditoria", label: "Auditoría" },
      { href: "/admin/logs/errores-sync", label: "Errores de sync" },
      { href: "/admin/logs/errores-agentes", label: "Errores de agentes" },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    description: "Control económico de la plataforma",
    icon: WalletIcon,
    matchPrefixes: ["/admin/finanzas", "/admin/facturacion"],
    items: [
      { href: "/admin/finanzas", label: "Finanzas" },
      { href: "/admin/facturacion", label: "Facturación" },
    ],
  },
];

export function getPortalNavigation(
  role: PortalRole,
  hasActiveOrganization = true,
): PortalNavModule[] {
  return role === "platform_admin"
    ? platformModules
    : sharedModules(role, hasActiveOrganization);
}

function pathMatches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPortalNavItemActive(
  item: PortalNavItem,
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">,
) {
  const [itemPath, query = ""] = item.href.split("?");
  const isExactPath = pathname === itemPath;
  const isMatchedChild = item.matchPrefixes?.some((prefix) =>
    pathMatches(pathname, prefix),
  );

  if (!isExactPath && !isMatchedChild) return false;
  if (isMatchedChild && !isExactPath) return true;
  if (!query) return true;

  const expected = new URLSearchParams(query);
  for (const [key, value] of expected.entries()) {
    const current = searchParams.get(key);
    if (current === value) continue;
    if (item.defaultForPath && current === null) continue;
    return false;
  }
  return true;
}

export function getActivePortalModule(
  modules: PortalNavModule[],
  pathname: string,
) {
  return (
    modules.find((module) =>
      module.matchPrefixes.some((prefix) => pathMatches(pathname, prefix)),
    ) ?? modules[0]
  );
}
