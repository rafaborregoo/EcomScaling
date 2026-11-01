import type { ComponentPropsWithoutRef, ComponentType } from "react";
import {
  ActivityIcon,
  BookOpenIcon,
  ChartIcon,
  CompassIcon,
  HomeIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  GearIcon,
  UsersIcon,
  WalletIcon,
} from "./ui/icons";

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
];

// Marketing: el trabajo diario arriba (Hoy, Campañas, Flows, Plantillas,
// Audiencias, Rendimiento) y las herramientas de creación en su grupo.
const marketingItems: PortalNavItem[] = [
  { href: "/marketing?section=plan", label: "Hoy", defaultForPath: true },
  { href: "/marketing?section=campanas", label: "Campañas" },
  { href: "/marketing?section=flows", label: "Flows" },
  { href: "/marketing?section=plantillas", label: "Plantillas" },
  { href: "/marketing?section=audiencias", label: "Audiencias" },
  { href: "/marketing?section=rendimiento", label: "Rendimiento" },
  { href: "/marketing?section=crear", label: "Crear contenido", group: "Crear" },
  { href: "/marketing?section=contenido", label: "Revisión de piezas", group: "Crear" },
  { href: "/marketing/plantillas", label: "Biblioteca de plantillas", group: "Crear" },
  { href: "/marketing/imagenes", label: "Banco de imágenes", group: "Crear" },
  { href: "/marketing/guia", label: "Guía de marca", group: "Crear" },
];

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

// Integraciones vive dentro de Configuración (2026-10-12): no ocupa un hueco
// del menú general. Las fichas de cada conector cuelgan de esta entrada.
const INTEGRATION_SUBPATHS = [
  "/integraciones/shopify",
  "/integraciones/meta",
  "/integraciones/klaviyo",
  "/integraciones/instagram",
  "/integraciones/tienda",
  "/integraciones/cuentas",
];

export type SettingsNavContext = {
  hasActiveOrganization: boolean;
  canManageClientAccess: boolean;
  /** La organización activa es una tienda propia, no un cliente de la cartera. */
  activeIsOwnStore: boolean;
};

function settingsItems(role: PortalRole, context: SettingsNavContext): PortalNavItem[] {
  const org = context.hasActiveOrganization;
  const section = (value: string) => `/configuracion?section=${value}`;
  // El consultor configura tres cosas distintas: su consultoría, el cliente (o
  // la tienda propia) que tiene activo, y su propia cuenta.
  if (role !== "client") {
    const store = context.activeIsOwnStore ? "Tu tienda" : "Este cliente";
    const own = "Mi consultoría";
    return [
      { href: section("cartera"), label: "Resumen de cartera", group: own, defaultForPath: !org },
      { href: "/integraciones?vista=cartera", label: "Integraciones de la cartera", group: own },
      { href: section("accesos"), label: "Equipo y reparto", group: own },
      { href: section("consultora"), label: "Plan, plazas y marca", group: own },
      { href: section("permisos"), label: "Tus permisos", group: own },
      ...(org
        ? [
            { href: section("resumen"), label: "Resumen", group: store, defaultForPath: true },
            { href: section("tienda"), label: "Datos de la tienda", group: store },
            {
              href: "/integraciones?vista=tienda",
              label: "Integraciones",
              group: store,
              defaultForPath: true,
              matchPrefixes: INTEGRATION_SUBPATHS,
            },
            { href: section("rentabilidad"), label: "Costes y márgenes", group: store },
            { href: section("objetivos"), label: "Objetivos", group: store },
            { href: section("negocio"), label: "Contexto del negocio", group: store },
            { href: section("alertas"), label: "Alertas", group: store },
            { href: section("copiloto"), label: "Copiloto IA", group: store },
            ...(context.activeIsOwnStore
              ? []
              : [{ href: section("consultor"), label: "Tus permisos aquí", group: store }]),
            ...(context.canManageClientAccess
              ? [{ href: section("equipo"), label: "Personas y roles", group: store }]
              : []),
          ]
        : []),
      { href: section("notificaciones"), label: "Notificaciones", group: "Tú" },
      { href: section("perfil"), label: "Perfil", group: "Tú" },
      { href: section("seguridad"), label: "Seguridad y actividad", group: "Tú" },
    ];
  }
  return [
    { href: section("resumen"), label: "Resumen", defaultForPath: true },
    ...(org
      ? [
          { href: section("tienda"), label: "Datos de la tienda", group: "Tu tienda" },
          { href: "/integraciones", label: "Integraciones", group: "Tu tienda", matchPrefixes: INTEGRATION_SUBPATHS },
          { href: section("rentabilidad"), label: "Costes y márgenes", group: "Tu tienda" },
          { href: section("objetivos"), label: "Objetivos", group: "Tu tienda" },
          { href: section("negocio"), label: "Mi negocio", group: "Tu tienda" },
          { href: section("alertas"), label: "Alertas", group: "Tu tienda" },
          ...(context.canManageClientAccess
            ? [{ href: section("equipo"), label: "Personas y roles", group: "Equipo" }]
            : []),
          { href: section("consultor"), label: "Tu consultor y sus permisos", group: "Equipo" },
        ]
      : []),
    { href: section("notificaciones"), label: "Notificaciones", group: "Avisos e IA" },
    ...(org ? [{ href: section("copiloto"), label: "Copiloto IA", group: "Avisos e IA" }] : []),
    ...(org && context.canManageClientAccess
      ? [{ href: section("plan"), label: "Plan y facturación", group: "Cuenta" }]
      : []),
    { href: section("perfil"), label: "Perfil", group: "Cuenta" },
    { href: section("seguridad"), label: "Seguridad y actividad", group: "Cuenta" },
    ...(org ? [{ href: section("privacidad"), label: "Privacidad y datos", group: "Cuenta" }] : []),
  ];
}

function sharedModules(
  role: "client" | "consultant",
  context: SettingsNavContext,
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
        "/tareas",
        "/reuniones",
        "/mi-trabajo",
      ],
      items: consultant
        ? [
            { href: "/camino", label: "Camino" },
            { href: "/planificacion/calendario", label: "Agenda", defaultForPath: true },
            { href: "/planificacion/tracking", label: "Tracking" },
            { href: "/tareas", label: "Tareas" },
            { href: "/reuniones", label: "Reuniones" },
            { href: "/mi-trabajo", label: "Mi trabajo" },
          ]
        : [
            { href: "/camino", label: "Mi camino" },
            { href: "/planificacion/calendario", label: "Agenda", defaultForPath: true },
            { href: "/tareas", label: "Tareas" },
            { href: "/reuniones", label: "Reuniones" },
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
      id: "shopify",
      label: "Shopify",
      description: "Catálogo, inventario y promociones",
      icon: ActivityIcon,
      matchPrefixes: ["/shopify"],
      items: [
        { href: "/shopify", label: "Resumen" },
        { href: "/shopify/productos", label: "Productos", matchPrefixes: ["/shopify/productos/"] },
        { href: "/shopify/inventario", label: "Inventario", matchPrefixes: ["/shopify/inventario/"] },
        { href: "/shopify/promociones", label: "Promociones", matchPrefixes: ["/shopify/promociones/"] },
      ],
    },
    {
      id: "meta",
      label: "Meta",
      description: "Campañas y anuncios",
      icon: MegaphoneIcon,
      matchPrefixes: ["/meta"],
      items: [
        { href: "/meta", label: "Resumen" },
        { href: "/meta/campanas", label: "Campañas", matchPrefixes: ["/meta/campanas/"] },
        { href: "/meta/creativos", label: "Creatividades", matchPrefixes: ["/meta/creativos/"] },
      ],
    },
    {
      id: "klaviyo",
      label: "Klaviyo",
      description: "Campañas y automatizaciones email",
      icon: MessageSquareIcon,
      matchPrefixes: ["/klaviyo"],
      items: [
        { href: "/klaviyo", label: "Resumen" },
        { href: "/klaviyo/campanas", label: "Campañas" },
        { href: "/klaviyo/flows", label: "Flows" },
        { href: "/klaviyo/emails", label: "Emails", matchPrefixes: ["/klaviyo/emails/"] },
        { href: "/klaviyo/plantillas", label: "Plantillas" },
        { href: "/klaviyo/audiencias", label: "Audiencias" },
        { href: "/klaviyo/formularios", label: "Formularios" },
      ],
    },
    {
      id: "analitica",
      label: "Analítica",
      description: "Informes de negocio y comparación de canales",
      icon: ChartIcon,
      matchPrefixes: ["/informes"],
      items: [{ href: "/informes", label: "Informes" }],
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
              { href: "/tiendas", label: "Tiendas" },
            ],
          } satisfies PortalNavModule,
        ]
      : []),
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
      description: "Tu tienda, integraciones, equipo y cuenta",
      icon: GearIcon,
      matchPrefixes: ["/configuracion", "/perfil", "/integraciones"],
      items: settingsItems(role, context),
      utility: true,
    },
  ];
}

function platformSettingsModule(context: SettingsNavContext): PortalNavModule {
  return {
    id: "configuracion",
    label: "Configuración",
    description: "Cuenta, alertas y permisos",
    icon: GearIcon,
    matchPrefixes: ["/configuracion", "/perfil", "/integraciones"],
    items: settingsItems("platform_admin", { ...context, canManageClientAccess: true }),
    utility: true,
  };
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
  canManageClientAccess = role !== "client",
  activeIsOwnStore = false,
): PortalNavModule[] {
  const context = { hasActiveOrganization, canManageClientAccess, activeIsOwnStore };
  return role === "platform_admin"
    ? [...platformModules, platformSettingsModule(context)]
    : sharedModules(role, context);
}

function pathMatches(pathname: string, prefix: string) {
  const base = prefix.replace(/\/+$/, "");
  return pathname === base || pathname.startsWith(`${base}/`);
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
