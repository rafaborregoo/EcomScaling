"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode, useEffect, useState } from "react";
import {
  apiFetch,
  fetchAccountActions,
  fetchBootstrap,
  getAccessToken,
  type AccountAction,
  type BootstrapResponse,
} from "@/lib/bootstrap";
import { getSupabaseClient } from "@/lib/supabase";
import { invalidateCachedQueries } from "@/lib/use-cached-query";
import {
  Alert,
  Avatar,
  AsyncState,
  Breadcrumbs,
  Button,
  CloseIcon,
  CompassIcon,
  ConfirmDialog,
  DotGridIcon,
  EmptyState,
  ErrorBlock,
  HomeIcon,
  IconChevronRight,
  Link,
  LoadingBlock,
  MenuIcon,
  PhoneIcon,
  Select,
  TasksIcon,
  UsersIcon,
} from "@/components/ui";
import {
  ACTIVE_ORGANIZATION_STORAGE_KEY,
  ActiveOrganizationContext,
} from "@/components/active-organization";
import {
  ADMIN_VIEW_MODE_STORAGE_KEY,
  AdminViewModeContext,
  type AdminViewMode,
} from "@/components/admin-view-mode";
import {
  ACTIVE_CONNECTION_STORAGE_KEY,
  ActiveConnectionContext,
} from "@/components/active-connection";
import { CopilotPanel } from "@/components/copilot-panel";
import {
  ModuleSummaryProvider,
  type ModuleSummaryData,
} from "@/components/module-summary";
import { NotificationsBell } from "@/components/notifications-bell";

type PortalShellProps = {
  title: string;
  eyebrow?: string;
  children: (bootstrap: BootstrapResponse, token: string) => ReactNode;
};

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

// Valores centinela para las opciones "Vista general" (cliente) y "Todas las
// tiendas" de los selectores del header (el control no admite key vacia).
const GENERAL_VIEW_KEY = "__all__";
const ALL_STORES_KEY = "__all_stores__";

// Rutas que operan sobre un cliente concreto y todavia NO tienen estado de
// "vista general" propio: en vista general (sin cliente activo) muestran un
// aviso para elegir uno. Dashboard ya tiene su propia vista general, por eso
// no esta aqui. Segun cada modulo gane su parte general, sale de esta lista.
const ORG_SCOPED_PREFIXES = ["/agentes", "/configuracion"];

// Nav del consultor: lista plana, sin etiquetas de grupo. Solo lo que se opera
// a diario sobre el cliente activo. "Ejecuciones IA" (/agentes) sigue fuera del
// nav. Configuración vive al fondo (settingsNavItem).
//
// Fuera del nav a proposito (las rutas siguen vivas, se llega desde
// Configuración): /consultor y /tiendas son el inventario de tus clientes y tus
// tiendas -- se consultan de vez en cuando, no se operan.
//
// /shopify SI entra desde 2026-09-07. Estaba fuera por ser "el detalle de una
// integracion", y esa premisa ya no se sostiene: deja de contar el estado de
// una conexion -- eso se queda en Integraciones -- y pasa a ser los numeros de
// la tienda (recurrencia, LTV, atribucion, devoluciones, entregas). Un modulo
// de datos al que solo se llegaba por un boton suelto del panel.
const consultantNavGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      // Lo unico del nav que NO es de un cliente: es la pantalla del consultor
      // sobre si mismo, asi que va la primera y no cambia al cambiar de tienda.
      { href: "/mi-trabajo", label: "Mi trabajo" },
      { href: "/camino", label: "Mi Camino" },
      { href: "/tareas", label: "Tareas" },
      { href: "/agenda", label: "Agenda" },
      { href: "/mensajes", label: "Chats" },
      { href: "/llamadas", label: "Llamadas" },
      // Los dos modulos de cifras, juntos y en este orden: primero la tienda,
      // luego lo que la alimenta.
      { href: "/shopify", label: "Shopify" },
      { href: "/meta", label: "Meta Ads" },
      { href: "/klaviyo", label: "Klaviyo" },
      { href: "/marketing", label: "Marketing" },
      { href: "/planificacion", label: "Planificación" },
      { href: "/integraciones", label: "Integraciones" },
      { href: "/conocimiento", label: "Conocimiento" },
    ],
  },
];

// Configuración vive al fondo del nav, junto a la cuenta (convención de
// paneles minimalistas), no dentro de un grupo.
const settingsNavItem: NavItem = { href: "/configuracion", label: "Configuración" };

// Vista platform_admin: operacion de plataforma, no de clientes. Solo Rafa la
// usa. Conocimiento / dashboard / integraciones etc. son del consultor, no de
// aqui.
const platformAdminNavGroups: NavGroup[] = [
  {
    label: "Plataforma",
    items: [
      { href: "/admin/consultores", label: "Consultores" },
      { href: "/admin/clientes", label: "Clientes" },
      // La metodologia de EcomScaling: alimenta al copiloto de todos los
      // clientes y es lo unico del conocimiento que es nuestro. Vive aqui
      // porque el consultor no la gestiona -- el gestiona la de su cliente.
      { href: "/admin/conocimiento", label: "Metodología" },
      { href: "/admin/observabilidad", label: "Observabilidad" },
      { href: "/admin/logs", label: "Auditoría y errores" },
      { href: "/admin/facturacion", label: "Facturación" },
    ],
  },
];

// Nav del cliente final: misma lista plana que el consultor pero sin "Clientes"
// (solo tiene la suya). Sin selector de cliente ni "vista general".
const clientNavGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/camino", label: "Mi Camino" },
      { href: "/tareas", label: "Tareas" },
      { href: "/mensajes", label: "Chats" },
      { href: "/llamadas", label: "Llamadas" },
      { href: "/shopify", label: "Shopify" },
      { href: "/meta", label: "Meta Ads" },
      { href: "/klaviyo", label: "Klaviyo" },
      { href: "/marketing", label: "Marketing" },
      { href: "/planificacion", label: "Planificación" },
      { href: "/integraciones", label: "Integraciones" },
      { href: "/conocimiento", label: "Conocimiento" },
    ],
  },
];

// Planificacion es una herramienta del consultor; el cliente no debe verla en
// navegacion ni llegar a ella por un enlace accidental.
for (const group of clientNavGroups) {
  group.items = group.items.filter((item) => item.href !== "/planificacion");
}

// Iconos para la barra de navegacion inferior en movil (las 4 primeras rutas
// del nav del rol + "Mas"). Sin icono -> icono generico.
const NAV_ICONS: Record<
  string,
  (props: { className?: string; "aria-hidden"?: boolean }) => ReactNode
> = {
  "/dashboard": HomeIcon,
  "/consultor": UsersIcon,
  "/camino": CompassIcon,
  "/tareas": TasksIcon,
  "/llamadas": PhoneIcon,
};

function formatRole(role: string) {
  return role.replaceAll("_", " ");
}

// FE-02: la banda de avisos trataba "error" y "warning" igual visualmente
// (siempre rojo de marca) aunque `severity` ya distinguia los dos casos desde
// el backend -- un error real (integracion caida) y un aviso (permisos
// pendientes) no deberian competir por la misma urgencia visual.
const actionSeverityStatus: Record<
  AccountAction["severity"],
  "danger" | "warning" | "default"
> = {
  error: "danger",
  warning: "warning",
  info: "default",
};

type ShopifyConnectionSummary = {
  id: string;
  provider_account_name: string | null;
  provider_account_id: string | null;
  status: string;
};

function readConnectionMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(ACTIVE_CONNECTION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeConnectionMap(organizationId: string, connectionId: string) {
  const map = readConnectionMap();
  map[organizationId] = connectionId;
  window.localStorage.setItem(
    ACTIVE_CONNECTION_STORAGE_KEY,
    JSON.stringify(map),
  );
}

function AccountStateBanner({
  organizationStatus,
  subscriptionStatus,
  needsShopifyReauthorization,
  isConsultant,
}: {
  organizationStatus: string;
  subscriptionStatus: string | null;
  needsShopifyReauthorization: boolean;
  isConsultant: boolean;
}) {
  // El consultor/admin es quien pausa a un cliente (status 'suspended'), a
  // propósito y desde /consultor -- no necesita que se lo recuerden en cada
  // página. El aviso es solo para el cliente, que sí queda bloqueado.
  if (organizationStatus === "suspended" && !isConsultant) {
    return (
      <Alert
        status="danger"
        className="border-b border-separator px-6 py-3 lg:px-10"
      >
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Organización suspendida</Alert.Title>
          <Alert.Description>
            El acceso operativo está pausado. Contacta con tu consultor para
            reactivar la cuenta.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    );
  }

  if (
    subscriptionStatus &&
    ["paused", "cancelled", "expired", "pending"].includes(subscriptionStatus)
  ) {
    return (
      <Alert
        status="warning"
        className="border-b border-separator px-6 py-3 lg:px-10"
      >
        <Alert.Indicator />
        <Alert.Content className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div>
            <Alert.Title>Suscripción no activa</Alert.Title>
            <Alert.Description>
              El plan está en estado {subscriptionStatus}. Verifica el acceso
              comercial antes de activar nuevas operaciones.
            </Alert.Description>
          </div>
          {isConsultant ? (
            <Link
              className="inline-flex items-center gap-1 whitespace-nowrap"
              href="/consultor"
            >
              Gestionar cliente
              <IconChevronRight aria-hidden />
            </Link>
          ) : null}
        </Alert.Content>
      </Alert>
    );
  }

  if (needsShopifyReauthorization) {
    return (
      <Alert
        status="warning"
        className="border-b border-separator px-6 py-3 lg:px-10"
      >
        <Alert.Indicator />
        <Alert.Content className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div>
            <Alert.Title>Shopify necesita autorización</Alert.Title>
            <Alert.Description>
              La tienda no puede sincronizar datos nuevos hasta que se complete
              la reautorización.
            </Alert.Description>
          </div>
          <Link
            className="inline-flex items-center gap-1 whitespace-nowrap"
            href="/integraciones"
          >
            Revisar integración
            <IconChevronRight aria-hidden />
          </Link>
        </Alert.Content>
      </Alert>
    );
  }

  return null;
}

// R-009: la URL es la fuente primaria del contexto activo (organizationId/
// connectionId como query params) -- localStorage es solo el fallback para
// cuando se navega sin esos params (ej. desde el menu lateral). Esto hace que
// un link compartido siempre abra la organizacion/tienda correcta, y que la
// URL actual refleje siempre lo que se esta viendo.
function buildUrlWithParams(
  pathname: string,
  current: URLSearchParams,
  updates: Record<string, string | undefined>,
) {
  const params = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

// Cada pagina monta su propio PortalShell (no vive en un layout compartido),
// asi que cada navegacion lo desmonta y remonta desde cero. Sin esta cache en
// memoria del modulo, eso significaba pedir el bootstrap otra vez y tapar
// tapar todo el shell (sidebar, cabecera, contenido) con "Cargando cuenta..." en
// cada clic de navegacion -- el sidebar "desaparecia" constantemente. Con la
// cache, solo se ve ese loader la primera vez que se abre el portal en la
// sesion; las siguientes navegaciones muestran el shell al instante con los
// ultimos datos conocidos mientras se refrescan en segundo plano.
let bootstrapCache: {
  bootstrap: BootstrapResponse;
  actions: AccountAction[];
  token: string;
} | null = null;

// `bootstrapCache` y la cache de paginas son variables de modulo, y el login
// entra al portal con navegacion de cliente (router.push, sin recarga): sin
// limpiarlas, la siguiente cuenta que entra en la misma pestana monta el
// portal con el bootstrap, la organizacion activa y la tienda de la anterior
// -- ve datos que no son suyos hasta que llega su propio bootstrap, y
// entonces la vista salta sola a su tienda. Se limpia al cerrar sesion y
// tambien si el bootstrap que llega es de otro usuario (sesion expirada,
// login desde otra pestana), que es el caso que cerrar sesion no cubre.
function clearPortalSession() {
  bootstrapCache = null;
  invalidateCachedQueries();
  window.localStorage.removeItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
  window.localStorage.removeItem(ACTIVE_CONNECTION_STORAGE_KEY);
}

function PortalShellContent({
  title,
  eyebrow = "EcomScaling IA",
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizationIdFromUrl = searchParams.get("organizationId");
  const connectionIdFromUrl = searchParams.get("connectionId");

  function updateUrlParams(updates: Record<string, string | undefined>) {
    router.replace(buildUrlWithParams(pathname, searchParams, updates), {
      scroll: false,
    });
  }

  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(
    bootstrapCache?.bootstrap ?? null,
  );
  const [actions, setActions] = useState<AccountAction[]>(
    bootstrapCache?.actions ?? [],
  );
  const [token, setToken] = useState<string | null>(
    bootstrapCache?.token ?? null,
  );
  // Mensajes sin leer -> numerito en la entrada "Chats" del nav.
  const [messagesUnread, setMessagesUnread] = useState(0);
  // null = todavía no se sabe. Importa tanto como el valor: apagar Chats y
  // volver a encenderlo un segundo después es peor que esperar un ciclo.
  const [hasConsultantThread, setHasConsultantThread] = useState<boolean | null>(
    null,
  );
  // Tareas nuevas que le ha aprobado el consultor -> numerito en "Tareas".
  const [tasksUnread, setTasksUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!bootstrapCache);
  const [activeOrganizationId, setActiveOrganizationId] = useState(() => {
    if (!bootstrapCache) {
      return organizationIdFromUrl ?? "";
    }
    const { memberships, profile } = bootstrapCache.bootstrap;
    const validIds = memberships.map(
      (membership) => membership.organization_id,
    );
    if (organizationIdFromUrl && validIds.includes(organizationIdFromUrl)) {
      return organizationIdFromUrl;
    }
    const stored = window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
    if (stored && validIds.includes(stored)) {
      return stored;
    }
    // Un consultor/admin arranca en "vista general" (sin cliente activo). Un
    // cliente normal, que tiene una sola organizacion, arranca en la suya.
    const isConsultantRole = ["platform_admin", "consultant"].includes(
      profile.platform_role,
    );
    return isConsultantRole ? "" : (validIds[0] ?? "");
  });
  const [adminViewMode, setAdminViewMode] = useState<AdminViewMode>("admin");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  // Resumen que publica el modulo activo (ver module-summary.tsx). Viaja al
  // Consultor IA como "vista actual" para que responda sobre lo que el
  // consultor tiene delante, no sobre el cliente en abstracto.
  const [moduleSummary, setModuleSummary] = useState<ModuleSummaryData | null>(
    null,
  );
  const [shopifyConnections, setShopifyConnections] = useState<
    ShopifyConnectionSummary[]
  >([]);
  const [activeConnectionId, setActiveConnectionId] = useState("");

  // El menú móvil se cierra al navegar a otra ruta.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  // Vista activa de platform_admin (persistida en localStorage). Se lee en un
  // efecto para no arriesgar un mismatch de hidratación con el valor por
  // defecto del render en servidor.
  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_VIEW_MODE_STORAGE_KEY);
    if (stored === "admin" || stored === "consultant") {
      setAdminViewMode(stored);
    }
  }, []);

  function selectAdminViewMode(mode: AdminViewMode) {
    setAdminViewMode(mode);
    window.localStorage.setItem(ADMIN_VIEW_MODE_STORAGE_KEY, mode);
  }

  // WCAG 2.4.2 (Page Titled): antes todas las paginas compartian el mismo
  // <title>"EcomScaling IA" del layout raiz (los componentes de pagina son
  // client components, no pueden exportar `metadata` de Next.js) -- se
  // reutiliza el `title` que cada pagina ya le pasa a PortalShell para el
  // encabezado movil/sidebar, sin introducir una API nueva.
  useEffect(() => {
    document.title = `${title} · EcomScaling IA`;
  }, [title]);

  // Numerito de mensajes sin leer en el nav. Se refresca al navegar (abrir
  // /mensajes marca como leído en el servidor) y cada 60 s.
  useEffect(() => {
    if (!bootstrap) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await apiFetch("/v1/consultant/message-threads");
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as {
          threads?: Array<{
            unread_count?: number;
            counterpart_user_id?: string | null;
          }>;
        };
        const threads = payload.threads ?? [];
        setMessagesUnread(
          threads.reduce((sum, thread) => sum + (thread.unread_count ?? 0), 0),
        );
        // Chats es la conversación con el consultor humano. Sale de la misma
        // respuesta que ya se pedía para el numerito: preguntar aparte "¿tengo
        // consultor?" sería una petición mas por pantalla para un dato que ya
        // viene aquí.
        setHasConsultantThread(
          threads.some((thread) => Boolean(thread.counterpart_user_id)),
        );
      } catch {
        /* transitorio: se reintenta en el siguiente ciclo */
      }
    };
    void refresh();
    const timer = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [bootstrap, pathname]);

  // Numerito de tareas nuevas en el nav. Son las notificaciones sin leer que
  // apuntan a /tareas: hoy solo las genera el consultor al aprobar propuestas
  // de la IA, que es justo lo que el cliente tiene que ver que le ha llegado.
  useEffect(() => {
    if (!bootstrap) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await apiFetch("/v1/notifications?status=unread");
        if (cancelled || !response.ok) return;
        const payload = (await response.json()) as {
          notifications?: Array<{ action_url?: string | null }>;
        };
        setTasksUnread(
          (payload.notifications ?? []).filter(
            (notification) => notification.action_url === "/tareas",
          ).length,
        );
      } catch {
        /* transitorio: se reintenta en el siguiente ciclo */
      }
    };
    void refresh();
    const timer = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [bootstrap, pathname]);

  // Tiendas Shopify de la organización activa, para el selector global de
  // tienda del header. Se recarga cada vez que cambia la organización, via
  // un endpoint liviano (solo conexiones, no el overview completo) para que
  // cambiar de cliente sea instantaneo. Limpiamos el estado ANTES de pedir
  // los datos nuevos para no mostrar por un instante las tiendas del cliente
  // anterior, y descartamos respuestas fuera de orden (una organizacion mas
  // vieja que responde tarde no debe pisar a una mas nueva).
  useEffect(() => {
    let cancelled = false;
    setShopifyConnections([]);

    async function loadConnections() {
      if (!activeOrganizationId || !token) {
        return;
      }

      const response = await apiFetch(
        `/v1/organizations/${activeOrganizationId}/shopify/connections`,
      );

      if (cancelled || !response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        connections: ShopifyConnectionSummary[];
        selected_connection_id: string | null;
      };

      if (cancelled) {
        return;
      }

      setShopifyConnections(payload.connections ?? []);

      const validIds = (payload.connections ?? []).map(
        (connection) => connection.id,
      );

      // Si una pagina ya fijo una tienda valida mientras esta carga estaba en
      // vuelo, no la pisamos. Si no, la URL (?connectionId=...) gana sobre
      // localStorage -- ver R-009.
      setActiveConnectionId((current) => {
        if (current && validIds.includes(current)) {
          return current;
        }

        if (connectionIdFromUrl && validIds.includes(connectionIdFromUrl)) {
          return connectionIdFromUrl;
        }

        const stored = readConnectionMap()[activeOrganizationId];
        // Por defecto: "" = todas las tiendas del cliente agregadas. Se elige
        // una tienda concreta para el dashboard de esa tienda.
        return stored && validIds.includes(stored) ? stored : "";
      });
    }

    void loadConnections();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connectionIdFromUrl solo debe aplicarse una vez por carga, no en cada re-render por cambio de URL propio (lo escribe selectConnection).
  }, [activeOrganizationId, token]);

  function selectConnection(connectionId: string) {
    setActiveConnectionId(connectionId);
    if (activeOrganizationId) {
      writeConnectionMap(activeOrganizationId, connectionId);
    }
    updateUrlParams({ connectionId: connectionId || undefined });
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // FE-01: si ya habia una sesion guardada (aunque `getAccessToken`
        // no pudiera refrescarla), es una sesion expirada -- distinto de
        // nunca haber iniciado sesion. Solo el primer caso justifica
        // explicarle al usuario por que aterrizo en /login.
        const {
          data: { session: existingSession },
        } = await getSupabaseClient().auth.getSession();
        const accessToken = await getAccessToken();

        if (!accessToken) {
          router.replace(
            existingSession ? "/login?reason=session_expired" : "/login",
          );
          return;
        }

        const payload = await fetchBootstrap(accessToken);
        if (cancelled) {
          return;
        }

        // El bootstrap cacheado es de otra cuenta: no vale nada de lo que se
        // monto con el (organizacion activa, tienda, datos de paginas).
        if (
          bootstrapCache &&
          bootstrapCache.bootstrap.user.id !== payload.user.id
        ) {
          clearPortalSession();
          setActiveConnectionId("");
        }

        // Gate de onboarding: hasta terminar contraseña + perfil, el usuario
        // invitado va a /onboarding y no ve el portal.
        if (!payload.profile.onboarding_completed_at) {
          router.replace("/onboarding");
          return;
        }

        const accountActions = await fetchAccountActions(accessToken);
        if (cancelled) {
          return;
        }
        setToken(accessToken);
        setBootstrap(payload);
        setActions(accountActions);
        bootstrapCache = {
          bootstrap: payload,
          actions: accountActions,
          token: accessToken,
        };

        // Organización activa global: la URL (?organizationId=...) gana sobre
        // todo -- es la fuente primaria (R-009). Si no hay URL valida, la que
        // ya estaba activa (remontaje via cache), si no la ultima elegida en
        // localStorage. Un consultor/admin sin nada de eso queda en "vista
        // general" (""); un cliente normal cae en su unica organizacion.
        const stored = window.localStorage.getItem(
          ACTIVE_ORGANIZATION_STORAGE_KEY,
        );
        const validIds = payload.memberships.map(
          (membership) => membership.organization_id,
        );
        const isConsultantRole = ["platform_admin", "consultant"].includes(
          payload.profile.platform_role,
        );
        setActiveOrganizationId((current) => {
          if (
            organizationIdFromUrl &&
            validIds.includes(organizationIdFromUrl)
          ) {
            return organizationIdFromUrl;
          }
          if (current && validIds.includes(current)) {
            return current;
          }
          if (stored && validIds.includes(stored)) {
            return stored;
          }
          return isConsultantRole ? "" : (validIds[0] ?? "");
        });
      } catch (loadError) {
        // React Strict Mode (dev) monta este efecto dos veces: la primera
        // peticion queda cancelada por el remount y llega aqui como
        // AbortError ("The user aborted a request.") sin ser un fallo real
        // -- el segundo montaje ya la reintenta. Ignorarla evita pintar ese
        // mensaje crudo del navegador como si la cuenta no hubiera cargado.
        if (cancelled || (loadError instanceof DOMException && loadError.name === "AbortError")) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Error cargando la cuenta",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [organizationIdFromUrl, router]);

  function selectOrganization(organizationId: string) {
    setActiveOrganizationId(organizationId);
    // Los datos cacheados de las páginas son del tenant anterior: se descartan
    // para que la vista nueva no muestre por un instante datos de otro cliente.
    invalidateCachedQueries();
    if (organizationId) {
      window.localStorage.setItem(
        ACTIVE_ORGANIZATION_STORAGE_KEY,
        organizationId,
      );
    } else {
      // Vista general: sin cliente activo guardado.
      window.localStorage.removeItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
    }
    // La tienda activa es especifica de cada organizacion; se recalcula en
    // cuanto llega la lista de tiendas de la nueva organizacion.
    setActiveConnectionId("");
    updateUrlParams({
      organizationId: organizationId || undefined,
      connectionId: undefined,
    });
  }

  async function signOut() {
    await getSupabaseClient().auth.signOut();
    clearPortalSession();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="min-h-dvh bg-white p-6 text-foreground">
        <AsyncState status="loading" loadingLabel="Cargando cuenta..." />
      </main>
    );
  }

  if (error || !bootstrap || !token) {
    return (
      <main className="min-h-dvh bg-white p-6 text-foreground">
        <ErrorBlock>{error ?? "No se pudo resolver la sesión"}</ErrorBlock>
      </main>
    );
  }

  const visibleActions = actions.slice(0, 3);
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const isPlatformAdmin = bootstrap.profile.platform_role === "platform_admin";
  const inPlatformAdminView = isPlatformAdmin && adminViewMode === "admin";
  // Consultor en vista general (sin cliente activo) sobre una ruta que necesita
  // un cliente concreto: se muestra un aviso en vez del contenido de la pagina.
  const needsClientForRoute =
    isConsultant &&
    !inPlatformAdminView &&
    !activeOrganizationId &&
    ORG_SCOPED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  const visibleGroups = inPlatformAdminView
    ? platformAdminNavGroups
    : isConsultant
      ? consultantNavGroups
      : clientNavGroups;

  const navRowClass = (active: boolean) =>
    [
      "flex items-center px-2 py-1.5 text-[0.8125rem] no-underline transition-colors hover:no-underline active:no-underline",
      active
        ? "font-medium text-accent"
        : "text-muted hover:text-foreground",
    ].join(" ");

  const navGroupLabelClass =
    "px-2 text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted";

  // Numeritos por ruta del nav ("igual que las notificaciones"). Ampliable a
  // otros módulos.
  const navBadges: Record<string, number> = {
    "/mensajes": messagesUnread,
    "/tareas": tasksUnread,
  };

  // Chats sirve para hablar con el consultor. Sin consultor asignado no hay
  // nadie al otro lado, así que el módulo se apaga -- y se enciende solo en
  // cuanto le asignen uno. No hay interruptor que se pueda quedar apagado con
  // consultor puesto. Al consultor no se le apaga nunca: su lista vacía ya le
  // dice lo que pasa.
  const chatsDisabled = !isConsultant && hasConsultantThread === false;

  const navigation = (
    <nav className="grid gap-6" aria-label="Navegacion principal">
      {isPlatformAdmin ? (
        <div className="grid gap-1.5">
          <p className={navGroupLabelClass}>Vista</p>
          <Select
            className="w-full"
            aria-label="Cambiar vista"
            value={adminViewMode}
            onChange={(value) => selectAdminViewMode(value as AdminViewMode)}
            options={[
              { value: "admin", label: "Platform admin" },
              { value: "consultant", label: "Consultor" },
            ]}
          />
        </div>
      ) : null}
      {visibleGroups.map((group) => (
        <div key={group.label}>
          {group.label ? (
            <p className={navGroupLabelClass}>{group.label}</p>
          ) : null}
          <div className="mt-1.5 grid gap-px">
            {group.items.map((item) => {
              const badge = navBadges[item.href] ?? 0;

              if (item.href === "/mensajes" && chatsDisabled) {
                return (
                  <span
                    key={item.href}
                    aria-disabled="true"
                    title="Se activa en cuanto tengas un consultor asignado"
                    className={`${navRowClass(false)} cursor-not-allowed opacity-50 hover:text-muted`}
                  >
                    <span className="flex-1">{item.label}</span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={navRowClass(pathname === item.href)}
                  href={item.href}
                >
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 ? (
                    <span
                      className="ml-2 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-medium leading-4 text-white"
                      aria-label={`${badge} sin leer`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {!inPlatformAdminView ? (
        <div className="border-t border-separator pt-4">
          <Link
            aria-current={
              pathname === settingsNavItem.href ? "page" : undefined
            }
            className={navRowClass(pathname === settingsNavItem.href)}
            href={settingsNavItem.href}
          >
            {settingsNavItem.label}
          </Link>
        </div>
      ) : null}
    </nav>
  );

  const accountBlock = (
    <div className="border-t border-separator pt-4 text-sm text-muted">
      <Link
        href="/perfil"
        aria-current={pathname === "/perfil" ? "page" : undefined}
        className="flex items-center gap-2.5 rounded-md px-2 py-1 no-underline transition-colors hover:bg-surface hover:no-underline"
      >
        <Avatar
          name={bootstrap.profile.full_name ?? bootstrap.user.email ?? "?"}
          src={bootstrap.profile.avatar_url ?? undefined}
          size="sm"
          color="accent"
        />
        <div className="min-w-0">
          <p className="truncate text-[0.8125rem] text-foreground">
            {bootstrap.profile.full_name ?? bootstrap.user.email}
          </p>
          {/* Para consultor/admin el rol es informativo; para un cliente final
            "user" no dice nada -- se muestra su organizacion. */}
          <p className="truncate text-xs text-muted">
            {isConsultant
              ? formatRole(bootstrap.profile.platform_role)
              : (bootstrap.memberships.find(
                  (membership) =>
                    membership.organization_id === activeOrganizationId,
                )?.organization?.display_name ??
                bootstrap.memberships[0]?.organization?.display_name ??
                "")}
          </p>
        </div>
      </Link>
      <ConfirmDialog
        trigger={
          <Button
            variant="secondary"
            className="mt-1.5 flex w-full items-center border-0 bg-transparent px-2 py-1.5 text-left text-[0.8125rem] text-muted transition-colors hover:text-foreground"
          >
            Cerrar sesión
          </Button>
        }
        title="Cerrar sesión"
        description="Vas a salir de tu cuenta en este dispositivo."
        confirmLabel="Cerrar sesión"
        status="default"
        onConfirm={signOut}
      />
    </div>
  );

  // Barra inferior movil: las 4 primeras rutas del nav del rol + "Mas".
  const bottomNavItems = visibleGroups.flatMap((group) => group.items).slice(0, 4);

  // Selector de cliente / tienda: se muestra en la barra superior en desktop y
  // en una fila propia en movil. Mismo contenido en ambos sitios.
  const showClientSelect =
    !inPlatformAdminView &&
    (isConsultant
      ? bootstrap.memberships.length >= 1
      : bootstrap.memberships.length >= 2);
  // Con una sola tienda tambien se muestra: el pricing es por numero de
  // tiendas, asi que el cliente tiene que ver cuantas tiene sin contarlas a
  // ojo, y las cifras dejan de ser ambiguas sobre a que tienda pertenecen.
  const showStoreSelect =
    Boolean(activeOrganizationId) && shopifyConnections.length >= 1;

  // Un consultor puede tener tiendas propias (membership real) ademas de las de
  // su cartera (consultant_assignment). Solo cuando tiene de las dos clases se
  // agrupan bajo encabezados; si no, la lista va plana como siempre.
  const ownMemberships = bootstrap.memberships.filter(
    (membership) => membership.accessSource === "membership",
  );
  const groupClientSelect =
    isConsultant &&
    ownMemberships.length > 0 &&
    ownMemberships.length < bootstrap.memberships.length;
  const clientSelectOptions = [
    ...(isConsultant
      ? [{ value: GENERAL_VIEW_KEY, label: "Vista general" }]
      : []),
    ...bootstrap.memberships.map((membership) => ({
      value: membership.organization_id,
      label: membership.organization?.display_name ?? membership.organization_id,
      ...(groupClientSelect
        ? {
            section:
              membership.accessSource === "membership"
                ? "Mis tiendas"
                : "Clientes",
          }
        : {}),
    })),
  ];
  const clientSelectNode = showClientSelect ? (
    <Select
      bare
      className="max-w-[16rem]"
      aria-label="Cliente activo"
      value={
        isConsultant ? activeOrganizationId || GENERAL_VIEW_KEY : activeOrganizationId
      }
      onChange={(value) =>
        selectOrganization(value === GENERAL_VIEW_KEY ? "" : value)
      }
      options={clientSelectOptions}
    />
  ) : null;
  const storeSelectNode = showStoreSelect ? (
    <Select
      bare
      className="max-w-[14rem]"
      aria-label="Tienda"
      value={activeConnectionId || ALL_STORES_KEY}
      onChange={(value) =>
        selectConnection(value === ALL_STORES_KEY ? "" : value)
      }
      options={[
        { value: ALL_STORES_KEY, label: "Todas las tiendas" },
        ...shopifyConnections.map((connection) => ({
          value: connection.id,
          label:
            connection.provider_account_id ??
            connection.provider_account_name ??
            connection.id,
        })),
      ]}
    />
  ) : null;

  const activeMembership =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === activeOrganizationId,
    ) ?? bootstrap.memberships[0];
  const activeOrganization = activeMembership?.organization;
  const activeSubscription = bootstrap.subscriptions.find(
    (subscription) => subscription.organization_id === activeOrganization?.id,
  );

  return (
    <>
      {/* dvh, no vh: en Safari movil 100vh incluye la barra de URL, asi que
          la pagina siempre quedaba un poco scrolleable aunque no hubiera
          contenido de sobra. */}
      <main className="min-h-dvh bg-white text-foreground lg:pt-2">
        <a className="skip-link" href="#portal-content">
          Saltar al contenido principal
        </a>
        {/* App móvil (estilo Claude): barra superior aireada -- avatar/menú
          circular a la izquierda, título + eyebrow centrados, notificaciones a
          la derecha. La navegación vive en la barra inferior fija. */}
        <div className="sticky top-0 z-30 bg-white pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 text-foreground">
            <button
              type="button"
              aria-label="Menú y cuenta"
              aria-controls="mobile-nav"
              aria-expanded={isMobileNavOpen}
              onClick={() => setIsMobileNavOpen(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface pointer-coarse:size-11"
            >
              <Avatar
                name={
                  bootstrap.profile.full_name ?? bootstrap.user.email ?? "?"
                }
                size="sm"
              />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[0.7rem] leading-tight text-muted">
                {eyebrow}
              </p>
              <p className="truncate text-[0.95rem] font-semibold leading-tight">
                {title}
              </p>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center pointer-coarse:size-11">
              <NotificationsBell token={token} />
            </div>
          </div>
          {clientSelectNode || storeSelectNode ? (
            <div className="flex items-center justify-center gap-2 overflow-x-auto px-4 pb-2">
              {clientSelectNode}
              {storeSelectNode}
            </div>
          ) : null}
        </div>

        {/* Hoja inferior "Más": el resto del nav + la cuenta. */}
        {isMobileNavOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute inset-0 bg-black/30"
              onClick={() => setIsMobileNavOpen(false)}
            />
            <div
              id="mobile-nav"
              className="absolute inset-x-0 bottom-0 max-h-[82svh] overflow-y-auto rounded-t-[1rem] border-t border-separator bg-white px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 [&_a]:py-2.5 pointer-coarse:[&_a]:py-3"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-edge" />
              {navigation}
              <div className="mt-6">{accountBlock}</div>
            </div>
          </div>
        ) : null}

        <div className="grid min-h-dvh lg:grid-cols-[232px_1fr]">
          <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-separator bg-white px-3 py-5 text-foreground lg:flex">
            <div>
              <p className="px-2 text-sm font-semibold tracking-tight">
                {eyebrow}
              </p>
              <div className="mt-6">{navigation}</div>
            </div>
            {accountBlock}
          </aside>

          <section id="portal-content" tabIndex={-1} className="min-w-0">
            {/* Barra superior fija: breadcrumb + selector de cliente/tienda
              activos, inline y minimalista (estilo Supabase). El consultor
              siempre tiene el selector de cliente, con "Vista general" (sin
              cliente) como estado por defecto. Un cliente normal solo lo ve si
              pertenece a mas de una organizacion, y sin la opcion "Vista
              general". Al elegir un cliente/tienda todo se scopea a el. */}
            <div className="sticky top-0 z-20 hidden items-center gap-3 border-b border-separator bg-white px-6 py-2 lg:flex lg:px-10">
              <Breadcrumbs items={[{ label: title }]} />
              {clientSelectNode ? (
                <>
                  <span aria-hidden className="text-line">
                    /
                  </span>
                  {clientSelectNode}
                </>
              ) : null}
              {/* El selector de tienda solo aporta con >=2 tiendas. Con una
                sola, "Todas" y esa tienda son lo mismo. */}
              {storeSelectNode ? (
                <>
                  <span aria-hidden className="text-line">
                    /
                  </span>
                  {storeSelectNode}
                </>
              ) : null}
              <div className="ml-auto">
                <NotificationsBell token={token} />
              </div>
            </div>

            {activeOrganization ? (
              <AccountStateBanner
                organizationStatus={activeOrganization.status}
                subscriptionStatus={activeSubscription?.status ?? null}
                needsShopifyReauthorization={
                  shopifyConnections.some((connection) =>
                    ["reauthorization_required", "needs_reauth"].includes(
                      connection.status,
                    ),
                  ) ||
                  actions.some(
                    (action) =>
                      action.type === "shopify_reauthorization_required",
                  )
                }
                isConsultant={isConsultant}
              />
            ) : null}

            {visibleActions.map((action) => (
              <div
                key={action.id}
                className="border-b border-separator px-6 py-3 lg:px-10"
              >
                <Alert
                  status={actionSeverityStatus[action.severity]}
                  className="items-center"
                >
                  <Alert.Indicator />
                  <Alert.Content className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-2">
                    <div>
                      <Alert.Title>{action.title}</Alert.Title>
                      <Alert.Description>
                        {action.organization_name
                          ? `${action.organization_name}: `
                          : ""}
                        {action.message}
                        {action.missing_scopes?.length
                          ? ` (${action.missing_scopes.length} permisos pendientes)`
                          : ""}
                      </Alert.Description>
                    </div>
                    <Link
                      className="inline-flex items-center gap-1 whitespace-nowrap"
                      href={action.cta_href}
                    >
                      {action.cta_label}
                      <IconChevronRight aria-hidden />
                    </Link>
                  </Alert.Content>
                </Alert>
              </div>
            ))}
            {actions.length > visibleActions.length ? (
              <div className="border-b border-separator px-6 py-2 font-mono text-xs text-muted lg:px-10">
                {actions.length - visibleActions.length} avisos más en
                Integraciones.
              </div>
            ) : null}
            <div className="px-4 pt-4 pb-28 sm:px-6 lg:px-10 lg:pt-6 lg:pb-14">
              <AdminViewModeContext.Provider
                value={{
                  viewMode: adminViewMode,
                  setViewMode: selectAdminViewMode,
                }}
              >
                <ActiveOrganizationContext.Provider
                  value={{
                    // Un consultor puede estar en vista general -> "" real.
                    // Un cliente normal siempre tiene su organizacion.
                    organizationId: isConsultant
                      ? activeOrganizationId
                      : activeOrganizationId ||
                        (bootstrap.memberships[0]?.organization_id ?? ""),
                    setOrganizationId: selectOrganization,
                  }}
                >
                  <ActiveConnectionContext.Provider
                    value={{
                      connectionId: activeConnectionId,
                      setConnectionId: selectConnection,
                    }}
                  >
                    {needsClientForRoute ? (
                      <EmptyState
                        title="Estás en vista general"
                        hint="Esta sección opera sobre un cliente concreto. Elige uno en el selector «Cliente activo» de arriba, o abre tu cartera en Clientes."
                        action={
                          <Link href="/consultor">Ir a Clientes</Link>
                        }
                      />
                    ) : (
                      <ModuleSummaryProvider publish={setModuleSummary}>
                        {children(bootstrap, token)}
                      </ModuleSummaryProvider>
                    )}
                  </ActiveConnectionContext.Provider>
                </ActiveOrganizationContext.Provider>
              </AdminViewModeContext.Provider>
            </div>
          </section>
        </div>

        {/* Barra de navegación inferior (solo móvil): app nativa en web. */}
        <nav
          aria-label="Navegación principal"
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-separator bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {bottomNavItems.map((item) => {
            const Icon = NAV_ICONS[item.href] ?? DotGridIcon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.65rem] no-underline transition-colors hover:no-underline",
                  active ? "text-accent" : "text-muted",
                ].join(" ")}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-expanded={isMobileNavOpen}
            aria-controls="mobile-nav"
            onClick={() => setIsMobileNavOpen((open) => !open)}
            className={[
              "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.65rem] transition-colors",
              isMobileNavOpen ? "text-accent" : "text-muted",
            ].join(" ")}
          >
            {isMobileNavOpen ? (
              <CloseIcon aria-hidden className="text-[1.15rem]" />
            ) : (
              <MenuIcon aria-hidden className="text-[1.15rem]" />
            )}
            Más
          </button>
        </nav>

        {/* El Consultor IA existe en cualquier pantalla, tambien en vista
          general: A09 es mono-tenant (el gateway SQL fija la organizacion por
          transaccion y toda la aislacion cuelga de ahi), asi que en vista
          general no se consulta "la cartera" -- el panel pide el cliente
          sobre el que preguntar. Antes el boton simplemente no existia y el
          consultor tenia que salir a elegir cliente para poder preguntar. */}
        {bootstrap.memberships.length > 0 ? (
          <>
            <Button
              className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 sm:right-6 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
              aria-expanded={isCopilotOpen}
              aria-controls="copilot-panel"
              onClick={() => setIsCopilotOpen((open) => !open)}
            >
              {isCopilotOpen ? "Cerrar Consultor IA" : "Consultor IA"}
            </Button>
            {isCopilotOpen ? (
              <CopilotPanel
                organizationId={activeOrganizationId}
                organizations={bootstrap.memberships.map((membership) => ({
                  id: membership.organization_id,
                  name:
                    membership.organization?.display_name ??
                    membership.organization_id,
                }))}
                view={{
                  route: pathname,
                  title,
                  storeId: activeConnectionId || undefined,
                  storeLabel:
                    shopifyConnections.find(
                      (connection) => connection.id === activeConnectionId,
                    )?.provider_account_id ?? undefined,
                  summary: moduleSummary,
                }}
                onClose={() => setIsCopilotOpen(false)}
              />
            ) : null}
          </>
        ) : null}
      </main>
    </>
  );
}

/**
 * PortalShell reads URL state for the active organization/store. Keeping the
 * navigation-dependent tree behind Suspense makes every App Router page safe
 * to prerender in production builds, including pages that only render the
 * shell indirectly.
 */
export function PortalShell(props: PortalShellProps) {
  return (
    <Suspense fallback={<LoadingBlock label="Cargando EcomScaling..." />}>
      <PortalShellContent {...props} />
    </Suspense>
  );
}
