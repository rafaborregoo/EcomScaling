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
import { clearViewAs, getViewAs, setViewAs, type ViewAs } from "@/lib/view-as";
import {
  Alert,
  Avatar,
  AsyncState,
  BrandLogo,
  Button,
  CloseIcon,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  IconChevronRight,
  Link,
  LoadingBlock,
  MenuIcon,
  PanelLeftIcon,
  Popover,
  Select,
  Tooltip,
} from "@/components/ui";
import {
  ACTIVE_ORGANIZATION_STORAGE_KEY,
  ActiveOrganizationContext,
} from "@/components/active-organization";
import {
  ACTIVE_CONNECTION_STORAGE_KEY,
  ActiveConnectionContext,
} from "@/components/active-connection";
import { CopilotPanel } from "@/components/copilot-panel";
import { CopilotAskProvider, type CopilotAsk } from "@/components/copilot-ask";
import {
  ModuleSummaryProvider,
  type ModuleSummaryData,
} from "@/components/module-summary";
import { NotificationsBell } from "@/components/notifications-bell";
import { InsightsMenu } from "@/components/insights-menu";
import { InsightsProvider } from "@/components/insights-context";
import {
  getActivePortalModule,
  getPortalNavigation,
  isPortalNavItemActive,
  type PortalNavItem,
  type PortalNavModule,
  type PortalRole,
} from "@/components/portal-navigation";

type PortalShellProps = {
  title: string;
  children: (bootstrap: BootstrapResponse, token: string) => ReactNode;
};

// Valores centinela para las opciones "Vista general" (cliente) y "Todas las
// tiendas" de los selectores del header (el control no admite key vacia).
const GENERAL_VIEW_KEY = "__all__";
const ALL_STORES_KEY = "__all_stores__";
const PRIMARY_NAV_MODE_STORAGE_KEY = "ecomscaling:primary-nav-mode";

type PrimaryNavMode = "hover" | "collapsed" | "expanded";

// Rutas que operan sobre un cliente concreto y todavia NO tienen estado de
// "vista general" propio: en vista general (sin cliente activo) muestran un
// aviso para elegir uno. Dashboard ya tiene su propia vista general, por eso
// no esta aqui. Segun cada modulo gane su parte general, sale de esta lista.
// /configuracion NO entra: ahi viven Accesos (socios, reparto de trabajo) y
// Clientes y tiendas, que son del consultor y no de un cliente concreto. Con el
// prefijo puesto, un consultor sin cartera veia "elige un cliente" en la unica
// pantalla desde la que podia conseguir uno. La pagina ya degrada por pestaña
// cuando no hay organizacion activa.
const ORG_SCOPED_PREFIXES = ["/agentes"];

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
  at: number;
} | null = null;

// Ventana en la que un remontaje NO vuelve a pedir la cuenta. Sin esto, cada
// remontaje del shell costaba 2 peticiones (bootstrap + actions) y, al
// reasignar `bootstrap`, arrastraba a los efectos que cuelgan de el y a los
// de la pagina: una veintena de peticiones por vuelta. Con React Strict Mode
// montando dos veces en desarrollo, una sola visita al dashboard se comia
// casi todo el limite de 120/min.
const BOOTSTRAP_FRESH_MS = 30_000;

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

function PortalShellContent({ title, children }: PortalShellProps) {
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

  // "Ver como" (view-as.ts): entra con ?organizationId=<id>&verComo=<nombre>
  // desde /admin. Un solo flanco de entrada -- en cuanto se detecta se
  // persiste en sessionStorage y se limpia de la URL, para que recargar la
  // misma pagina no lo reactive con un nombre desactualizado.
  const [viewAs, setViewAsState] = useState<ViewAs | null>(() => getViewAs());
  const verComoParam = searchParams.get("verComo");
  useEffect(() => {
    if (verComoParam && organizationIdFromUrl) {
      const next = {
        organizationId: organizationIdFromUrl,
        displayName: verComoParam,
      };
      setViewAs(next);
      setViewAsState(next);
      updateUrlParams({ verComo: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo en el flanco de entrada, no en cada cambio de URL.
  }, [verComoParam, organizationIdFromUrl]);

  function exitViewAs() {
    clearViewAs();
    setViewAsState(null);
    invalidateCachedQueries();
    router.push("/admin/clientes");
  }

  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(
    bootstrapCache?.bootstrap ?? null,
  );
  // Identidad estable de la cuenta cargada, para que los efectos que solo
  // necesitan saber "hay sesion y es esta" no se re-disparen cada vez que
  // `bootstrap` se reasigna con un objeto nuevo de contenido identico.
  const bootstrapUserId = bootstrap?.user.id ?? null;
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
  const [hasConsultantThread, setHasConsultantThread] = useState<
    boolean | null
  >(null);
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  // Por defecto "hover": pasar el raton por el rail lo expande. "collapsed"
  // (solo iconos, sin expandirse nunca) dejaba el rail mudo hasta que alguien
  // entrara al Control de navegacion y lo cambiara a mano -- eso es lo que
  // parecia roto.
  const [primaryNavMode, setPrimaryNavMode] = useState<PrimaryNavMode>(
    "hover",
  );
  const [isPrimaryNavHovered, setIsPrimaryNavHovered] = useState(false);
  const [isPrimaryNavControlOpen, setIsPrimaryNavControlOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  useEffect(() => {
    const savedMode = window.localStorage.getItem(PRIMARY_NAV_MODE_STORAGE_KEY);
    if (savedMode !== "expanded" && savedMode !== "collapsed" && savedMode !== "hover") return;

    const restorePrimaryNavMode = window.setTimeout(() => {
      setPrimaryNavMode(savedMode);
    }, 0);

    return () => window.clearTimeout(restorePrimaryNavMode);
  }, []);

  const handleModuleNavigation = (href: string) => {
    router.push(href);
  };

  const selectPrimaryNavMode = (nextMode: PrimaryNavMode) => {
    window.localStorage.setItem(PRIMARY_NAV_MODE_STORAGE_KEY, nextMode);
    setPrimaryNavMode(nextMode);
    setIsPrimaryNavHovered(false);
    setIsPrimaryNavControlOpen(false);
  };

  const isPrimaryNavExpanded =
    primaryNavMode === "expanded" ||
    (primaryNavMode === "hover" && isPrimaryNavHovered);
  // Pregunta con la que un módulo abre el Consultor IA (ver copilot-ask.tsx).
  // Vive aquí porque el panel vive aquí: el módulo solo dice qué preguntar.
  const [copilotAsk, setCopilotAsk] = useState<CopilotAsk | null>(null);
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

  const searchParamsKey = searchParams.toString();

  // El menú móvil se cierra al cambiar de ruta o de sección. Las secciones de
  // segundo nivel comparten pathname y cambian solo el query string.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname, searchParamsKey]);

  // WCAG 2.4.2 (Page Titled): antes todas las paginas compartian el mismo
  // <title>"E-NORA IA" del layout raiz (los componentes de pagina son
  // client components, no pueden exportar `metadata` de Next.js) -- se
  // reutiliza el `title` que cada pagina ya le pasa a PortalShell para el
  // encabezado movil/sidebar, sin introducir una API nueva.
  useEffect(() => {
    document.title = `${title} · E-NORA IA`;
  }, [title]);

  // Numerito de mensajes sin leer en el nav. Se refresca al navegar (abrir
  // /mensajes marca como leído en el servidor) y cada 60 s.
  useEffect(() => {
    // Depende del id, no del objeto: `bootstrap` se reasigna con un objeto
    // nuevo en cada carga de la cuenta, y con el objeto en la lista estos
    // numeritos se volvian a pedir cada vez aunque la cuenta fuera la misma.
    if (!bootstrapUserId) return;
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
  }, [bootstrapUserId, pathname]);

  // Numerito de tareas nuevas en el nav. Son las notificaciones sin leer que
  // apuntan a /tareas: hoy solo las genera el consultor al aprobar propuestas
  // de la IA, que es justo lo que el cliente tiene que ver que le ha llegado.
  useEffect(() => {
    if (!bootstrapUserId) return;
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
  }, [bootstrapUserId, pathname]);

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
      // Remontaje con la cuenta recien cargada: el estado ya se sembro con
      // `bootstrapCache`, asi que volver a pedirla no cambiaria nada en
      // pantalla y si dispara toda la cascada. Las 401 las sigue cubriendo
      // `apiFetch`, que refresca el token en cualquier otra peticion.
      if (
        bootstrapCache &&
        Date.now() - bootstrapCache.at < BOOTSTRAP_FRESH_MS
      ) {
        setIsLoading(false);
        return;
      }

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
          at: Date.now(),
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
        if (
          cancelled ||
          (loadError instanceof DOMException && loadError.name === "AbortError")
        ) {
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
    // `router` solo se usa para navegar (replace a /login y /onboarding),
    // nunca como dato. Tenerlo en la lista re-disparaba la carga de la cuenta
    // cada vez que el router cambiaba de identidad, y cada vuelta arrastraba a
    // los efectos que dependen de `bootstrap` y a los de la pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationIdFromUrl]);

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

  // Dentro de /integraciones la propia pagina ya cuenta tienda por tienda que
  // le pasa a cada conexion y que hacer. Repetir arriba los mismos avisos --
  // todos apuntando a la pagina en la que ya estas -- era el triple de rojo
  // diciendo lo mismo, que es justo lo que hacia ilegible ese modulo.
  const inIntegrations = pathname.startsWith("/integraciones");
  const pageActions = inIntegrations
    ? actions.filter((action) => !action.cta_href.startsWith("/integraciones"))
    : actions;
  // "Ver como" fuerza el nav y los permisos de un cliente normal aunque el
  // rol real sea platform_admin: es lo que hace que la vista sea la misma
  // que ve el dueño de la organizacion, no la del admin mirandola por encima.
  // La escritura de verdad la bloquea `apiFetch` (bootstrap.ts) para
  // cualquier pantalla, esto es solo lo que se ve.
  const isConsultant =
    !viewAs &&
    ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role);
  const isPlatformAdmin =
    !viewAs && bootstrap.profile.platform_role === "platform_admin";
  // Consultor en vista general (sin cliente activo) sobre una ruta que necesita
  // un cliente concreto: se muestra un aviso en vez del contenido de la pagina.
  const needsClientForRoute =
    isConsultant &&
    !isPlatformAdmin &&
    !activeOrganizationId &&
    ORG_SCOPED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  const navigationRole: PortalRole = isPlatformAdmin
    ? "platform_admin"
    : isConsultant
      ? "consultant"
      : "client";
  const navigationModules = getPortalNavigation(
    navigationRole,
    Boolean(activeOrganizationId),
  );
  const activeModule = getActivePortalModule(navigationModules, pathname);

  // Numeritos por ruta del nav. El rail los agrega por módulo y el segundo
  // nivel los deja junto a la opción concreta.
  const navBadges: Record<string, number> = {
    "/mensajes": messagesUnread,
    "/tareas": tasksUnread,
  };

  // Chats sirve para hablar con el consultor. Sin consultor asignado no hay
  // nadie al otro lado; al consultor no se le desactiva nunca.
  const chatsDisabled = !isConsultant && hasConsultantThread === false;

  // Un consultor puede tener tiendas propias (membership real) ademas de las de
  // su cartera (consultant_assignment).
  const ownMemberships = bootstrap.memberships.filter(
    (membership) => membership.accessSource === "membership",
  );
  const activeIsOwnStore = ownMemberships.some(
    (membership) => membership.organization_id === activeOrganizationId,
  );

  const navItemPath = (item: PortalNavItem) => item.href.split("?")[0];

  const renderModuleItems = (
    module: PortalNavModule,
    compact = false,
  ) => (
    <div className={compact ? "grid gap-1" : "grid gap-0.5"}>
      {module.items.map((item, index) => {
        const itemPath = navItemPath(item);
        const active = isPortalNavItemActive(item, pathname, searchParams);
        const badge = navBadges[itemPath] ?? 0;
        const previousGroup = module.items[index - 1]?.group;
        const showGroup = Boolean(item.group && item.group !== previousGroup);

        return (
          <div key={item.href}>
            {showGroup ? (
              <p className="mb-1 mt-5 px-2 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted first:mt-0">
                {item.group}
              </p>
            ) : null}
            {itemPath === "/mensajes" && chatsDisabled ? (
              <span
                aria-disabled="true"
                title="Se activa en cuanto tengas un consultor asignado"
                className="flex min-h-10 cursor-not-allowed items-center rounded-lg px-3 py-2.5 text-[0.9375rem] text-muted opacity-50"
              >
                <span className="flex-1">{item.label}</span>
              </span>
            ) : (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "group flex min-h-10 items-center rounded-lg px-3 py-2.5 text-[0.9375rem] no-underline transition-[background-color,color,transform] duration-200 hover:bg-surface hover:no-underline active:translate-y-px",
                  active
                    ? "bg-surface font-medium text-foreground"
                    : "text-muted hover:text-foreground",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badge > 0 ? (
                  <span
                    className="ml-2 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.65rem] font-medium leading-4 text-white"
                    aria-label={`${badge} sin leer`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );

  const contextNavigation = (
    <nav aria-label={`${activeModule.label}: secciones`}>
      {renderModuleItems(activeModule)}
    </nav>
  );

  const contextPanel = (
    <aside className="sticky top-0 hidden h-dvh min-h-0 flex-col overflow-hidden border-r border-separator bg-white text-foreground lg:flex">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-separator px-4">
        <BrandLogo className="h-4 min-w-0 max-w-[9.5rem]" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {contextNavigation}
      </div>
    </aside>
  );

  const mobileNavigation = (
    <nav className="grid gap-6" aria-label="Navegación principal">
      {navigationModules.map((module) => (
        <section key={module.id} aria-labelledby={`mobile-module-${module.id}`}>
          <div className="mb-2 flex items-center gap-2 px-2">
            <module.icon className="size-4 text-muted" aria-hidden />
            <h2
              id={`mobile-module-${module.id}`}
              className="text-sm font-semibold text-foreground"
            >
              {module.label}
            </h2>
          </div>
          {renderModuleItems(module, true)}
        </section>
      ))}
    </nav>
  );
  const profileMenu = (
    <Popover>
      <Popover.Trigger>
        <button
          type="button"
          aria-label="Abrir menú de perfil"
          className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent pointer-coarse:size-11"
        >
          <Avatar
            name={bootstrap.profile.full_name ?? bootstrap.user.email ?? "?"}
            src={bootstrap.profile.avatar_url ?? undefined}
            size="sm"
            color="accent"
          />
        </button>
      </Popover.Trigger>
      <Popover.Content
        placement="bottom end"
        className="w-64 overflow-hidden rounded-xl p-0 shadow-lg"
      >
        <Popover.Dialog aria-label="Menú de perfil" className="p-2">
          <div className="border-b border-separator px-2.5 pb-3 pt-1">
            <p className="truncate text-sm font-medium text-foreground">
              {bootstrap.profile.full_name ?? "Tu perfil"}
            </p>
            <p className="truncate text-xs text-muted">{bootstrap.user.email}</p>
          </div>
          <div className="grid gap-0.5 py-2">
            <Link
              href="/perfil"
              className="rounded-md px-2.5 py-2 text-sm text-foreground no-underline transition-colors hover:bg-surface hover:no-underline"
            >
              Ver perfil
            </Link>
            <Link
              href="/configuracion?section=general"
              className="rounded-md px-2.5 py-2 text-sm text-foreground no-underline transition-colors hover:bg-surface hover:no-underline"
            >
              Configuración
            </Link>
          </div>
          <div className="border-t border-separator pt-2">
            <ConfirmDialog
              trigger={
                <Button
                  variant="secondary"
                  className="flex w-full justify-start border-0 bg-transparent px-2.5 py-2 text-sm text-muted hover:bg-surface hover:text-foreground"
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
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );

  // Barra inferior móvil: cuatro módulos, no cuatro páginas sueltas. Así la
  // jerarquía es la misma que en escritorio y "Más" abre el mapa completo.
  const bottomNavItems = navigationModules
    .filter((module) => !module.utility)
    .slice(0, 4);

  // Selector de cliente / tienda: se muestra en la barra superior en desktop y
  // en una fila propia en movil. Mismo contenido en ambos sitios.
  const showClientSelect =
    !viewAs &&
    !isPlatformAdmin &&
    (isConsultant
      ? bootstrap.memberships.length >= 1
      : bootstrap.memberships.length >= 2);
  // Con una sola tienda tambien se muestra: el pricing es por numero de
  // tiendas, asi que el cliente tiene que ver cuantas tiene sin contarlas a
  // ojo, y las cifras dejan de ser ambiguas sobre a que tienda pertenecen.
  const showStoreSelect =
    Boolean(activeOrganizationId) && shopifyConnections.length >= 1;

  // Solo cuando tiene tiendas propias y clientes se agrupan bajo encabezados;
  // si no, la lista va plana como siempre.
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
      label:
        membership.organization?.display_name ?? membership.organization_id,
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
        isConsultant
          ? activeOrganizationId || GENERAL_VIEW_KEY
          : activeOrganizationId
      }
      onChange={(value) =>
        selectOrganization(value === GENERAL_VIEW_KEY ? "" : value)
      }
      options={clientSelectOptions}
    />
  ) : null;
  // Selector de tiendas propias. Va en la barra superior pero pegado a la
  // derecha, separado del de cliente/tienda que vive a la izquierda: son dos
  // preguntas distintas ("en que cliente estoy" contra "entrar en una tienda
  // mia") y juntas se leian como una sola lista de sitios a los que ir.
  const ownStoreSelectNode =
    isConsultant && !isPlatformAdmin && ownMemberships.length > 0 ? (
      <div className="flex shrink-0 items-center gap-2">
        <span className="whitespace-nowrap text-[0.7rem] font-medium uppercase tracking-[0.08em] text-muted">
          Mis Tiendas
        </span>
        <Select
          bare
          className="max-w-[12rem]"
          aria-label="Tienda propia activa"
          placeholder="Elegir..."
          // Vacio cuando el cliente activo es de la cartera: el selector dice
          // "no estas en ninguna tuya", no miente señalando una.
          value={activeIsOwnStore ? activeOrganizationId : ""}
          onChange={selectOrganization}
          options={ownMemberships.map((membership) => ({
            value: membership.organization_id,
            label:
              membership.organization?.display_name ??
              membership.organization_id,
          }))}
        />
      </div>
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
      <InsightsProvider
        scope={{
          organizationId: activeOrganizationId,
          connectionId: activeConnectionId,
          isConsultant,
        }}
      >
        <main className="min-h-dvh bg-white text-foreground lg:pt-2">
          <a className="skip-link" href="#portal-content">
            Saltar al contenido principal
          </a>
          {viewAs ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-foreground px-4 py-2 text-center text-xs text-white">
              <span>
                Viendo como <strong>{viewAs.displayName}</strong> · Solo lectura
              </span>
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={exitViewAs}
              >
                Salir
              </button>
            </div>
          ) : null}
          {/* En móvil, menú a la izquierda y acciones de cuenta a la derecha.
          La navegación completa vive en la barra inferior y en «Más». */}
          <div className="sticky top-0 z-30 bg-white pt-[env(safe-area-inset-top)] lg:hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 text-foreground">
              <button
                type="button"
                aria-label="Abrir navegación"
                aria-controls="mobile-nav"
                aria-expanded={isMobileNavOpen}
                onClick={() => setIsMobileNavOpen(true)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface pointer-coarse:size-11"
              >
                <MenuIcon aria-hidden className="size-5" />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <BrandLogo className="mx-auto h-3 w-auto" />
                <p className="truncate text-[0.95rem] font-semibold leading-tight">
                  {title}
                </p>
              </div>
              <div className="flex shrink-0 items-center">
                <InsightsMenu />
                <NotificationsBell token={token} />
                {profileMenu}
              </div>
            </div>
            {clientSelectNode || storeSelectNode || ownStoreSelectNode ? (
              <div className="flex items-center justify-center gap-2 overflow-x-auto px-4 pb-2">
                {clientSelectNode}
                {storeSelectNode}
                {/* En movil no hay barra superior donde separarlo a la derecha,
                  asi que va al final de la misma fila. */}
                {ownStoreSelectNode}
              </div>
            ) : null}
          </div>

          {/* Hoja inferior «Más»: el resto de módulos. */}
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
                {mobileNavigation}
              </div>
            </div>
          ) : null}

          <div
            className={[
              "relative grid min-h-dvh",
              isCopilotOpen
                ? primaryNavMode === "expanded"
                  ? "lg:grid-cols-[13rem_15.5rem_minmax(0,1fr)_26rem]"
                  : "lg:grid-cols-[4.75rem_15.5rem_minmax(0,1fr)_26rem]"
                : primaryNavMode === "expanded"
                  ? "lg:grid-cols-[13rem_15.5rem_minmax(0,1fr)]"
                  : "lg:grid-cols-[4.75rem_15.5rem_minmax(0,1fr)]",
            ].join(" ")}
          >
            <aside
              onMouseEnter={() => {
                if (primaryNavMode === "hover") setIsPrimaryNavHovered(true);
              }}
              onMouseLeave={() => {
                if (primaryNavMode === "hover") setIsPrimaryNavHovered(false);
              }}
              className={[
                "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-separator bg-white py-2 text-foreground transition-[width] duration-200 ease-out lg:flex",
                isPrimaryNavExpanded ? "w-[13rem] items-stretch" : "w-[4.75rem] items-center",
              ].join(" ")}
            >
              <Link
                href="/dashboard"
                aria-label="E-NORA"
                className={[
                  "mb-3 flex h-11 shrink-0 items-center rounded-md no-underline hover:bg-surface hover:no-underline",
                  isPrimaryNavExpanded ? "mx-3 gap-3 px-2" : "size-12 justify-center",
                ].join(" ")}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-[0.7rem] font-semibold tracking-[-0.02em] text-white shadow-sm">
                  ES
                </span>
                <span
                  className={[
                    "truncate text-sm font-semibold transition-opacity duration-150",
                    isPrimaryNavExpanded
                      ? "opacity-100"
                      : "hidden",
                  ].join(" ")}
                >
                  E-NORA
                </span>
              </Link>

              <nav
                aria-label="Módulos"
                className={[
                  "flex min-h-0 w-full flex-1 flex-col gap-1.5 overflow-y-auto px-2",
                  isPrimaryNavExpanded ? "items-stretch" : "items-center",
                ].join(" ")}
              >
                {navigationModules
                  .filter((module) => !module.utility)
                  .map((module) => {
                    const Icon = module.icon;
                    const active = module.id === activeModule.id;
                    const badge = module.items.reduce(
                      (total, item) => total + (navBadges[navItemPath(item)] ?? 0),
                      0,
                    );
                    const link = (
                      <Link
                        key={module.id}
                        href={module.items[0].href}
                        aria-label={module.label}
                        aria-current={active ? "page" : undefined}
                        onClick={() => handleModuleNavigation(module.items[0].href)}
                        className={[
                          "relative flex h-11 shrink-0 items-center rounded-lg no-underline transition-[background-color,color,transform] duration-200 hover:bg-surface hover:no-underline active:translate-y-px",
                          isPrimaryNavExpanded
                            ? "w-full gap-3 px-3"
                            : "size-11 justify-center",
                          active
                            ? "bg-surface text-foreground"
                            : "text-muted hover:text-foreground",
                        ].join(" ")}
                      >
                        <Icon className="size-5" aria-hidden />
                        {badge > 0 ? (
                          <span
                            aria-label={`${badge} sin leer`}
                            className="absolute right-0.5 top-0.5 size-2 rounded-full bg-accent ring-2 ring-white"
                          />
                        ) : null}
                        <span
                          className={[
                            "min-w-0 truncate text-sm font-medium transition-opacity duration-150",
                            isPrimaryNavExpanded
                              ? "opacity-100"
                              : "hidden",
                          ].join(" ")}
                        >
                          {module.label}
                        </span>
                      </Link>
                    );
                    // Colapsado el rail es solo iconos: sin tooltip no hay forma
                    // de saber que es cada uno sin pulsarlo.
                    if (isPrimaryNavExpanded) return link;
                    return (
                      <Tooltip key={module.id} delay={300}>
                        {link}
                        <Tooltip.Content placement="right">
                          <p>{module.label}</p>
                        </Tooltip.Content>
                      </Tooltip>
                    );
                  })}
              </nav>

              <div
                className={[
                  "mt-2 flex w-full shrink-0 flex-col gap-1.5 border-t border-separator px-2 pt-2",
                  isPrimaryNavExpanded ? "items-stretch" : "items-center",
                ].join(" ")}
              >
                {navigationModules
                  .filter((module) => module.utility)
                  .map((module) => {
                    const Icon = module.icon;
                    const active = module.id === activeModule.id;
                    const link = (
                      <Link
                        key={module.id}
                        href={module.items[0].href}
                        aria-label={module.label}
                        aria-current={active ? "page" : undefined}
                        onClick={() => handleModuleNavigation(module.items[0].href)}
                        className={[
                          "flex h-11 items-center rounded-lg no-underline transition-colors hover:bg-surface hover:no-underline",
                          isPrimaryNavExpanded
                            ? "w-full gap-3 px-3"
                            : "size-11 justify-center",
                          active
                            ? "bg-surface text-foreground"
                            : "text-muted hover:text-foreground",
                        ].join(" ")}
                      >
                        <Icon className="size-5" aria-hidden />
                        <span
                          className={[
                            "truncate text-sm font-medium transition-opacity duration-150",
                            isPrimaryNavExpanded
                              ? "opacity-100"
                              : "hidden",
                          ].join(" ")}
                        >
                          {module.label}
                        </span>
                      </Link>
                    );
                    if (isPrimaryNavExpanded) return link;
                    return (
                      <Tooltip key={module.id} delay={300}>
                        {link}
                        <Tooltip.Content placement="right">
                          <p>{module.label}</p>
                        </Tooltip.Content>
                      </Tooltip>
                    );
                  })}
                <Popover
                  isOpen={isPrimaryNavControlOpen}
                  onOpenChange={setIsPrimaryNavControlOpen}
                >
                  <Popover.Trigger>
                    <button
                      type="button"
                      title="Control de navegación"
                      aria-label="Control de navegación lateral"
                      className={[
                        "flex h-11 items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground",
                        isPrimaryNavExpanded
                          ? "w-full gap-3 px-3"
                          : "size-11 justify-center",
                      ].join(" ")}
                    >
                      <PanelLeftIcon className="size-5" aria-hidden />
                      <span
                        className={[
                          "truncate text-sm font-medium transition-opacity duration-150",
                          isPrimaryNavExpanded
                            ? "opacity-100"
                            : "hidden",
                        ].join(" ")}
                      >
                        Navegación
                      </span>
                    </button>
                  </Popover.Trigger>
                  <Popover.Content
                    placement="top start"
                    className="w-60 overflow-hidden rounded-xl p-0 shadow-lg"
                  >
                    <Popover.Dialog aria-label="Control de navegación lateral">
                      <p className="border-b border-separator px-4 py-3 text-sm font-medium text-foreground">
                        Control de navegación
                      </p>
                      <div className="grid gap-0.5 p-2">
                        {(
                          [
                            ["hover", "Expandir al pasar"],
                            ["collapsed", "Solo iconos"],
                            ["expanded", "Iconos y nombres"],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            aria-pressed={primaryNavMode === mode}
                            onClick={() => selectPrimaryNavMode(mode)}
                            className={[
                              "flex min-h-9 items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                              primaryNavMode === mode
                                ? "bg-surface font-medium text-foreground"
                                : "text-muted hover:bg-surface hover:text-foreground",
                            ].join(" ")}
                          >
                            <span
                              aria-hidden
                              className={[
                                "size-2 rounded-full",
                                primaryNavMode === mode
                                  ? "bg-foreground"
                                  : "bg-transparent ring-1 ring-inset ring-edge",
                              ].join(" ")}
                            />
                            {label}
                          </button>
                        ))}
                      </div>
                    </Popover.Dialog>
                  </Popover.Content>
                </Popover>
              </div>
            </aside>

            {contextPanel}

            <section id="portal-content" tabIndex={-1} className="min-w-0">
              {/* Barra superior fija: una sola fila, estilo Supabase --
              ubicación de la pantalla y selectores de ámbito a la izquierda;
              notificaciones y cuenta a la derecha. El
              consultor siempre tiene el selector de cliente, con "Vista
              general" (sin cliente) como estado por defecto. Un cliente
              normal solo lo ve si pertenece a mas de una organizacion. Al
              elegir un cliente/tienda todo se scopea a el. */}
              <div className="sticky top-0 z-20 hidden h-12 items-center gap-3 border-b border-separator bg-white px-6 py-2 lg:flex lg:px-10">
                <p className="shrink-0 text-[0.8125rem] font-medium text-foreground">
                  {title}
                </p>
                {clientSelectNode ? (
                  <span aria-hidden className="text-line">
                    /
                  </span>
                ) : null}
                {clientSelectNode}
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
                <div className="ml-auto flex items-center gap-3">
                  {ownStoreSelectNode}
                  <InsightsMenu />
                  <NotificationsBell token={token} />
                  {profileMenu}
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

              {pageActions.length > 0 ? (
                <div className="flex items-center gap-2 border-b border-separator px-6 py-2 font-mono text-xs text-muted lg:px-10">
                  <span
                    aria-hidden
                    className={`size-1.5 shrink-0 rounded-full ${
                      pageActions.some((action) => action.severity === "error")
                        ? "bg-danger"
                        : "bg-warning"
                    }`}
                  />
                  <span className="truncate">
                    {pageActions.length === 1
                      ? `${pageActions[0].organization_name ? `${pageActions[0].organization_name}: ` : ""}${pageActions[0].title}`
                      : `${pageActions.length} integraciones necesitan atención`}
                  </span>
                  <Link
                    className="ml-auto inline-flex items-center gap-1 whitespace-nowrap"
                    href={
                      pageActions.length === 1
                        ? pageActions[0].cta_href
                        : "/integraciones"
                    }
                  >
                    Revisar
                    <IconChevronRight aria-hidden />
                  </Link>
                </div>
              ) : null}
              <div className="px-4 pt-4 pb-28 sm:px-6 lg:px-10 lg:pt-6 lg:pb-14">
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
                        action={<Link href="/consultor">Ir a Clientes</Link>}
                      />
                    ) : (
                      <ModuleSummaryProvider publish={setModuleSummary}>
                        <CopilotAskProvider
                          ask={(next) => {
                            setCopilotAsk({ ...next, key: Date.now() });
                            setIsCopilotOpen(true);
                          }}
                        >
                          {children(bootstrap, token)}
                        </CopilotAskProvider>
                      </ModuleSummaryProvider>
                    )}
                  </ActiveConnectionContext.Provider>
                </ActiveOrganizationContext.Provider>
              </div>
            </section>
            {/* En escritorio CopilotPanel se convierte en un rail del grid: el
              contenido conserva su columna y no queda detrás de un backdrop.
              En móvil el propio componente elige el drawer accesible. */}
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
                ask={copilotAsk}
                onClose={() => {
                  setIsCopilotOpen(false);
                  setCopilotAsk(null);
                }}
              />
            ) : null}
          </div>

          {/* Barra de navegación inferior (solo móvil): app nativa en web. */}
          <nav
            aria-label="Navegación principal"
            className="fixed inset-x-0 bottom-0 z-40 flex border-t border-separator bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
          >
            {bottomNavItems.map((module) => {
              const Icon = module.icon;
              const active = module.id === activeModule.id;
              return (
                <Link
                  key={module.id}
                  href={module.items[0].href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.65rem] no-underline transition-colors hover:no-underline",
                    active ? "text-accent" : "text-muted",
                  ].join(" ")}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="max-w-full truncate">{module.label}</span>
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
                className={[
                  "fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 sm:right-6 lg:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
                  isCopilotOpen ? "lg:hidden" : "",
                ].join(" ")}
                aria-expanded={isCopilotOpen}
                aria-controls="copilot-panel"
                onClick={() => {
                  // Abrir el panel a mano lo devuelve a chat libre: si quedara la
                  // pregunta anterior colgada, se relanzaría al reabrirlo.
                  setCopilotAsk(null);
                  setIsCopilotOpen((open) => !open);
                }}
              >
                {isCopilotOpen ? "Cerrar Consultor IA" : "Consultor IA"}
              </Button>
            </>
          ) : null}
        </main>
      </InsightsProvider>
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
    <Suspense fallback={<LoadingBlock label="Cargando E-NORA..." />}>
      <PortalShellContent {...props} />
    </Suspense>
  );
}
