"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  Suspense,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
  ScrollArea,
  Avatar,
  avatarInitials,
  AvatarImage,
  AvatarFallback,
  Banner,
  AsyncState,
  BrandLogo,
  Breadcrumbs,
  Button,
  CloseIcon,
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorBlock,
  IconChevronDown,
  IconChevronRight,
  Link,
  LoadingBlock,
  MenuIcon,
  OverlayRole,
  PanelLeftIcon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  PlusIcon,
  Select,
  SparklesIcon,
  StoreIcon,
  Tooltip,
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
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
import { ConsultantChatFloat } from "@/components/consultant-chat-float";
import { CopilotAskProvider, type CopilotAsk } from "@/components/copilot-ask";
import { buildCopilotEvidenceReference } from "@/lib/copilot-evidence";
import {
  ModuleSummaryProvider,
  type ModuleSummaryData,
} from "@/components/module-summary";
import { NotificationsBell } from "@/components/notifications-bell";
import { CommandPalette, CommandPaletteButton } from "@/components/command-palette";
import { FocusTarget } from "@/components/focus-target";
import { PortalFeedback } from "@/components/portal-feedback";
import { InsightsProvider } from "@/components/insights-context";
import { SettingsNavStatus } from "@/app/configuracion/settings-status";
import { IntegrationLiveUpdates } from "@/components/integration-live-updates";
import { MfaRequiredBanner } from "@/components/mfa-required-banner";
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

type ProfilePatch = Partial<Pick<BootstrapResponse["profile"], "full_name" | "avatar_url">>;
type PortalSession = {
  bootstrap: BootstrapResponse;
  token: string;
  /** Tras guardar el perfil: el shell (foto y nombre de arriba) lo refleja sin recargar. */
  updateProfile: (patch: ProfilePatch) => void;
};
const PortalSessionContext = createContext<PortalSession | null>(null);

export function usePortalSession() {
  const session = useContext(PortalSessionContext);
  if (!session) {
    throw new Error("usePortalSession debe usarse dentro del shell del portal");
  }
  return session;
}

// Valores centinela para las opciones "Vista general" (cliente) y "Todas las
// tiendas" de los selectores del header (el control no admite key vacia).
const GENERAL_VIEW_KEY = "__all__";
type ClientOption = { value: string; label: string; section?: string };
type ClientGroupOrOption = ClientOption | { value: string; items: ClientOption[] };
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
// Cartera (Clientes y Tiendas) solo existe para consultor/platform_admin. Un
// cliente que llegaba por URL veia la pagina con un error de carga (el API
// responde 403); se le dice que no es suya y se le devuelve a su panel.
const CONSULTANT_ONLY_PREFIXES = ["/consultor", "/tiendas"];

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

/** Un hilo de /v1/consultant/message-threads, lo que usan el nav y la ventanita del chat. */
type ConsultantThreadSummary = {
  organization_id: string;
  unread_count?: number;
  counterpart_user_id?: string | null;
  counterpart_name?: string | null;
  counterpart_avatar_url?: string | null;
};

function writeConnectionMap(organizationId: string, connectionId: string) {
  const map = readConnectionMap();
  map[organizationId] = connectionId;
  window.localStorage.setItem(
    ACTIVE_CONNECTION_STORAGE_KEY,
    JSON.stringify(map),
  );
}

const PLAN_STATE_TEXT: Record<string, string> = {
  paused: "está en pausa",
  cancelled: "está cancelado",
  expired: "ha caducado",
  pending: "está pendiente de pago",
};

function AccountStateBanner({
  organizationStatus,
  subscriptionStatus,
  isConsultant,
}: {
  organizationStatus: string;
  subscriptionStatus: string | null;
  isConsultant: boolean;
}) {
  // El consultor/admin es quien pausa a un cliente (status 'suspended'), a
  // propósito y desde /consultor -- no necesita que se lo recuerden en cada
  // página. El aviso es solo para el cliente, que sí queda bloqueado.
  if (organizationStatus === "suspended" && !isConsultant) {
    return (
      <Banner
        tone="danger"
        className="rounded-none border-x-0 border-t-0 px-6 py-3 lg:px-10"
        title="Tu cuenta está pausada"
      >
        Tu consultor ha pausado el acceso. Escríbele para reactivarla.
      </Banner>
    );
  }

  const planState = subscriptionStatus ? PLAN_STATE_TEXT[subscriptionStatus] : undefined;
  if (planState) {
    return (
      <Banner
        tone="warn"
        className="rounded-none border-x-0 border-t-0 px-6 py-3 lg:px-10"
        title={isConsultant ? `El plan de este cliente ${planState}` : `Tu plan ${planState}`}
        action={
          <Link
            className="inline-flex items-center gap-1 whitespace-nowrap"
            href={isConsultant ? "/consultor" : "/configuracion?section=plan"}
          >
            {isConsultant ? "Gestionar cliente" : "Ver mi plan"}
            <IconChevronRight aria-hidden />
          </Link>
        }
      >
        Mientras no esté activo, las funciones del plan se quedan paradas.
      </Banner>
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

// El shell persistente lo monta el layout raíz. Esta cache también sirve para
// la entrada inicial y para páginas fuera del marco persistente (p. ej. tests
// o rutas que renderizan PortalShell de forma aislada).
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
  const [messageThreads, setMessageThreads] = useState<ConsultantThreadSummary[]>([]);
  // Sube al leer o escribir en la ventanita del chat: refresca el numerito ya.
  const [messagesRefreshKey, setMessagesRefreshKey] = useState(0);
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
  const sectionTabsRef = useRef<HTMLElement>(null);
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
    if (primaryNavMode === "hover") setIsPrimaryNavHovered(false);
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
  // Organización cuya lista de tiendas ya llegó. Hasta entonces la tienda
  // vigente es la de la URL o la guardada para este cliente: sin esto cada
  // pantalla pedía sus métricas dos veces (sin tienda y, al llegar la lista,
  // con tienda) y con el pool de PostgREST pequeño la segunda tanda hacía cola.
  const [connectionsReadyFor, setConnectionsReadyFor] = useState<string | null>(null);
  const pendingConnectionId =
    connectionsReadyFor === activeOrganizationId || typeof window === "undefined"
      ? ""
      : connectionIdFromUrl || (activeOrganizationId ? (readConnectionMap()[activeOrganizationId] ?? "") : "");
  const currentConnectionId = activeConnectionId || pendingConnectionId;

  const searchParamsKey = searchParams.toString();

  // El menú móvil se cierra al cambiar de ruta o de sección. Las secciones de
  // segundo nivel comparten pathname y cambian solo el query string.
  useEffect(() => {
    setIsMobileNavOpen(false);
    // La pestaña activa a la vista, sin mover la página en vertical.
    const tabs = sectionTabsRef.current;
    const current = tabs?.querySelector<HTMLElement>('[aria-current="page"]');
    if (tabs && current) {
      tabs.scrollLeft =
        current.offsetLeft - (tabs.clientWidth - current.offsetWidth) / 2;
    }
  }, [pathname, searchParamsKey, bootstrap]);

  // WCAG 2.4.2 (Page Titled): antes todas las paginas compartian el mismo
  // <title>"E-NORA IA" del layout raiz (los componentes de pagina son
  // client components, no pueden exportar `metadata` de Next.js) -- se
  // reutiliza el `title` que cada pagina ya le pasa a PortalShell para el
  // encabezado movil/sidebar, sin introducir una API nueva.
  useEffect(() => {
    document.title = `${title} · E-NORA IA`;
  }, [title]);

  // Presencia agregada para el panel de salud: Redis cuenta una sola vez a
  // cada usuario con una pestaña autenticada y visible en los últimos 60 s.
  useEffect(() => {
    if (!bootstrapUserId || !token) return;
    let cancelled = false;
    const heartbeat = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        await apiFetch("/v1/platform-presence/heartbeat", {
          method: "POST",
          cache: "no-store",
          body: JSON.stringify({}),
        });
      } catch {
        // La presencia es una señal operativa; no debe bloquear el producto.
      }
    };
    const timer = window.setInterval(() => void heartbeat(), 20_000);
    document.addEventListener("visibilitychange", heartbeat);
    void heartbeat();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [bootstrapUserId, token]);

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
          threads?: ConsultantThreadSummary[];
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
        // La misma lista alimenta la ventanita del chat del cliente.
        setMessageThreads(threads);
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
  }, [bootstrapUserId, pathname, messagesRefreshKey]);

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

  // El contador del rail refleja el mismo estado que los avisos de cuenta, sin
  // repetir banners de error en cada pantalla. Se refresca al abrir
  // Integraciones, después de cambios locales y a baja frecuencia mientras el
  // portal está abierto para recoger fallos de sincronización en segundo plano.
  useEffect(() => {
    if (!bootstrapUserId || !token) return;
    let cancelled = false;
    const refreshIntegrationActions = async () => {
      try {
        const fresh = await fetchAccountActions(token);
        if (cancelled) return;
        setActions(fresh);
        if (bootstrapCache?.bootstrap.user.id === bootstrapUserId) {
          bootstrapCache = { ...bootstrapCache, actions: fresh };
        }
      } catch {
        /* Se conserva el último estado válido y se reintenta más tarde. */
      }
    };
    if (pathname.startsWith("/integraciones")) {
      void refreshIntegrationActions();
    }
    const onIntegrationStatusChanged = () => void refreshIntegrationActions();
    window.addEventListener("integration-status-changed", onIntegrationStatusChanged);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshIntegrationActions();
      }
    }, 3 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("integration-status-changed", onIntegrationStatusChanged);
    };
  }, [bootstrapUserId, pathname, token]);

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
        if (!cancelled) setConnectionsReadyFor(activeOrganizationId);
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
      setConnectionsReadyFor(activeOrganizationId);
    }

    void loadConnections();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connectionIdFromUrl solo debe aplicarse una vez por carga, no en cada re-render por cambio de URL propio (lo escribe selectConnection).
  }, [activeOrganizationId, token]);

  // Un enlace con ?organizationId= (los CTA de la mesa del consultor) cambia
  // de cliente. La carga de la cuenta también lo mira, pero se salta entera si
  // el bootstrap tiene menos de 30 s: navegar desde la mesa justo al entrar
  // dejaba la página en "Vista general" con la URL de otro cliente.
  useEffect(() => {
    if (
      bootstrap &&
      organizationIdFromUrl &&
      bootstrap.memberships.some((membership) => membership.organization_id === organizationIdFromUrl)
    ) {
      setActiveOrganizationId(organizationIdFromUrl);
    }
  }, [organizationIdFromUrl, bootstrap]);

  // Un enlace con ?connectionId= (p. ej. un hito de la mesa del consultor,
  // que vive en el camino de otra tienda) cambia la tienda aunque ya hubiera
  // una elegida: la carga de arriba solo mira la URL al cambiar de cliente.
  useEffect(() => {
    if (
      connectionIdFromUrl &&
      shopifyConnections.some((connection) => connection.id === connectionIdFromUrl)
    ) {
      setActiveConnectionId(connectionIdFromUrl);
    }
  }, [connectionIdFromUrl, shopifyConnections]);

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
    // La caché de páginas NO se vacía: cada clave lleva el id de la
    // organización en la URL, así que la vista nueva no puede pintar datos del
    // cliente anterior, y volver a un cliente ya visto es instantáneo.
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
      <main className="min-h-dvh p-6 text-foreground">
        <AsyncState status="loading" loadingLabel="Cargando cuenta..." />
      </main>
    );
  }

  if (error || !bootstrap || !token) {
    return (
      <main className="grid min-h-dvh place-content-center gap-4 p-6 text-foreground">
        <ErrorBlock>
          {/* "Failed to fetch" es el error crudo del navegador cuando la API no responde. */}
          {!error ? "No se pudo resolver la sesión." : /failed to fetch|networkerror|load failed/i.test(error) ? "No hemos podido conectar con E-NORA. Comprueba tu conexión y vuelve a intentarlo." : error}
        </ErrorBlock>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </main>
    );
  }

  // Dentro de /integraciones la propia pagina ya cuenta tienda por tienda que
  // le pasa a cada conexion y que hacer. Repetir arriba los mismos avisos --
  // todos apuntando a la pagina en la que ya estas -- era el triple de rojo
  // diciendo lo mismo, que es justo lo que hacia ilegible ese modulo.
  // Las incidencias de integración se resumen en el rail con su severidad.
  // Evita repetir el mismo aviso rojo en todas las páginas del dashboard.
  const pageActions = actions.filter(
    (action) =>
      action.type !== "integration_error" &&
      action.type !== "integration_reauthorization_required" &&
      action.type !== "shopify_reauthorization_required",
  );
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
  const consultantOnlyRoute =
    !isConsultant &&
    CONSULTANT_ONLY_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
  const navigationRole: PortalRole = isPlatformAdmin
    ? "platform_admin"
    : isConsultant
      ? "consultant"
      : "client";
  const canManageClientAccess =
    isConsultant ||
    bootstrap.memberships.some(
      (membership) =>
        membership.organization_id === activeOrganizationId &&
        membership.accessSource === "membership" &&
        ["owner", "manager"].includes(membership.role),
    );
  // Un consultor puede tener tiendas propias (membership real) ademas de las de
  // su cartera (consultant_assignment).
  const ownMemberships = bootstrap.memberships.filter(
    (membership) => membership.accessSource === "membership",
  );
  const activeIsOwnStore = ownMemberships.some(
    (membership) => membership.organization_id === activeOrganizationId,
  );
  const navigationModules = getPortalNavigation(
    navigationRole,
    Boolean(activeOrganizationId),
    canManageClientAccess,
    activeIsOwnStore,
  );
  const showAddStoreAction =
    navigationRole === "client" && Boolean(activeOrganizationId);
  const activeModule = getActivePortalModule(navigationModules, pathname);
  const hasActiveModuleMatch = navigationModules.some((module) =>
    module.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
  const activeNavItem = hasActiveModuleMatch
    ? activeModule.items.find((item) =>
        isPortalNavItemActive(item, pathname, searchParams),
      ) ?? activeModule.items.find((item) => item.defaultForPath) ?? activeModule.items[0]
    : undefined;
  const activeNavPath = activeNavItem?.href.split("?")[0];
  const isNestedNavPage = Boolean(activeNavItem && pathname !== activeNavPath);
  const currentBreadcrumbLabel =
    isNestedNavPage && title !== activeModule.label && title !== activeNavItem?.label
      ? title
      : activeNavItem?.label ?? title;
  const breadcrumbItems: Array<{ label: string; href?: string }> = [
    { label: "Inicio", href: "/dashboard?tab=todo" },
  ];
  if (activeModule.id !== "inicio" && activeModule.label !== activeNavItem?.label) {
    breadcrumbItems.push({
      label: activeModule.label,
      href: activeModule.items[0]?.href,
    });
  }
  if (
    activeNavItem &&
    activeNavItem.label !== activeModule.label &&
    currentBreadcrumbLabel !== activeNavItem.label
  ) {
    breadcrumbItems.push({ label: activeNavItem.label, href: activeNavItem.href });
  }
  if (breadcrumbItems.at(-1)?.label !== currentBreadcrumbLabel) {
    breadcrumbItems.push({ label: currentBreadcrumbLabel });
  }
  // Un módulo con una sola sección no abre la segunda columna: esa opción
  // solo repetiría el nombre del módulo.
  const hasSectionNav = activeModule.items.length > 1;

  // Numeritos por ruta del nav. El rail los agrega por módulo y el segundo
  // nivel los deja junto a la opción concreta.
  const visibleIntegrationActions = actions.filter((action) => {
    if (
      action.type !== "integration_error" &&
      action.type !== "integration_reauthorization_required" &&
      action.type !== "shopify_reauthorization_required"
    ) return false;
    return !activeOrganizationId || action.organization_id === activeOrganizationId;
  });
  const providerNavPath: Record<string, string> = {
    shopify: "/integraciones/shopify",
    meta_ads: "/integraciones/meta",
    klaviyo: "/integraciones/klaviyo",
    instagram: "/integraciones/instagram",
  };
  const integrationNavCounts: Record<string, number> = {};
  const integrationNavSeverity: Record<string, "error" | "warning"> = {};
  for (const action of visibleIntegrationActions) {
    const path = providerNavPath[action.provider];
    if (!path) continue;
    integrationNavCounts[path] = (integrationNavCounts[path] ?? 0) + 1;
    const severity = action.severity === "error" ? "error" : "warning";
    if (severity === "error" || !integrationNavSeverity[path]) {
      integrationNavSeverity[path] = severity;
    }
  }
  const integrationIssueCount = visibleIntegrationActions.length;
  const navBadges: Record<string, number> = {
    "/mensajes": messagesUnread,
    "/tareas": tasksUnread,
    "/integraciones": integrationIssueCount,
    ...integrationNavCounts,
  };
  const integrationSeverity = (path: string) =>
    path === "/integraciones"
      ? visibleIntegrationActions.some((action) => action.severity === "error")
        ? "error"
        : "warning"
      : integrationNavSeverity[path] ?? "warning";
  const navBadgeClass = (path: string) => {
    if (!path.startsWith("/integraciones")) return "bg-accent text-white";
    return integrationSeverity(path) === "error"
      ? "bg-danger text-white"
      : "bg-warning text-foreground";
  };

  // Chats sirve para hablar con el consultor. Sin consultor asignado no hay
  // nadie al otro lado; al consultor no se le desactiva nunca.
  const chatsDisabled = !isConsultant && hasConsultantThread === false;
  const clientChatThread =
    isConsultant || viewAs
      ? null
      : messageThreads.find(
          (thread) =>
            thread.counterpart_user_id &&
            (!activeOrganizationId || thread.organization_id === activeOrganizationId),
        ) ?? null;

  const navItemPath = (item: PortalNavItem) => item.href.split("?")[0];

  const renderModuleItems = (
    module: PortalNavModule,
    compact = false,
  ) =>
    // Configuración lleva un punto por sección (completa o pendiente). El
    // cálculo usa hooks, así que va en un componente propio y no aquí.
    module.id === "configuracion" ? (
      <SettingsNavStatus organizationId={activeOrganizationId || null}>
        {(dots) => renderItems(module, compact, dots)}
      </SettingsNavStatus>
    ) : (
      renderItems(module, compact, null)
    );

  const renderItems = (
    module: PortalNavModule,
    compact: boolean,
    dots: Record<string, boolean | null> | null,
  ) => (
    <div className={compact ? "grid gap-1" : "grid gap-0.5"}>
      {module.items.map((item, index) => {
        const dot = dots
          ? dots[new URLSearchParams(item.href.split("?")[1] ?? "").get("section") ?? ""]
          : undefined;
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
                  "group flex w-full min-w-0 min-h-10 items-center rounded-lg px-3 py-2.5 text-left text-[0.9375rem] no-underline transition-colors duration-150 hover:bg-surface hover:no-underline motion-reduce:transition-none",
                  active
                    ? "bg-surface font-medium text-[var(--nav-active)]"
                    : "text-muted hover:text-foreground",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {dot === true || dot === false ? (
                  <span
                    className={`ml-2 size-2 shrink-0 rounded-full ${dot ? "bg-success" : "bg-accent"}`}
                    role="img"
                    aria-label={dot ? "Completa" : "Pendiente"}
                  />
                ) : null}
                {badge > 0 ? (
                  <span
                    className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-none tabular-nums ${navBadgeClass(itemPath)}`}
                    aria-label={itemPath.startsWith("/integraciones")
                      ? `${badge} incidencias de integración, ${integrationSeverity(itemPath) === "error" ? "error" : "advertencia"}`
                      : `${badge} sin leer`}
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
    <aside className="sticky top-14 hidden h-[calc(100dvh/var(--ui-zoom)_-_3.5rem)] min-h-0 flex-col overflow-hidden border-r border-separator bg-white text-foreground lg:flex admin-context-nav">
      <ScrollArea className="min-h-0 flex-1 px-3 py-4">
        {contextNavigation}
      </ScrollArea>
    </aside>
  );

  // Barra inferior móvil: cuatro módulos, no cuatro páginas sueltas. Así la
  // jerarquía es la misma que en escritorio y "Más" abre el mapa completo.
  const bottomNavItems = navigationModules
    .filter((module) => !module.utility)
    .slice(0, 4);
  // En «Más» primero lo que no cabe abajo; luego el resto del mapa.
  const moreSheetModules = [
    ...navigationModules.filter((module) => !bottomNavItems.includes(module)),
    ...bottomNavItems,
  ];

  const mobileNavigation = (
    <nav className="grid gap-6" aria-label="Navegación completa">
      {moreSheetModules.map((module) => (
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
      {showAddStoreAction ? (
        <section aria-labelledby="mobile-add-store">
          <div className="mb-2 flex items-center gap-2 px-2">
            <StoreIcon className="size-4 text-muted" aria-hidden />
            <h2
              id="mobile-add-store"
              className="text-sm font-semibold text-foreground"
            >
              Tiendas
            </h2>
          </div>
          <Link
            href="/integraciones/shopify"
            className="flex min-h-11 items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-foreground no-underline transition-colors hover:bg-surface hover:no-underline"
          >
            <span className="relative inline-flex size-5 items-center justify-center" aria-hidden>
              <StoreIcon className="size-5" />
              <span className="absolute -right-1 -bottom-1 flex size-3 items-center justify-center rounded-full bg-accent text-white ring-2 ring-white">
                <PlusIcon className="size-1.5" />
              </span>
            </span>
            Añadir tienda
          </Link>
        </section>
      ) : null}
    </nav>
  );
  const profileMenu = (
    // Menú de acciones (role=menu, ↑↓ entre opciones): DropdownMenu, no un
    // Popover con enlaces sueltos.
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Abrir menú de perfil"
            className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent pointer-coarse:size-11"
          />
        }
      >
        <Avatar>
          <AvatarImage src={bootstrap.profile.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-accent text-white">{avatarInitials(bootstrap.profile.full_name ?? bootstrap.user.email ?? "?")}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" aria-label="Menú de perfil">
        <Item size="xs" className="px-2 pb-2 pt-1">
          <ItemContent>
            <ItemTitle className="block truncate">{bootstrap.profile.full_name ?? "Tu perfil"}</ItemTitle>
            <ItemDescription className="truncate">{bootstrap.user.email}</ItemDescription>
          </ItemContent>
        </Item>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/configuracion?section=perfil")}>Ver perfil</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/configuracion?section=resumen")}>Configuración</DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Sin confirmación: salir es reversible (se vuelve a entrar) y la
            pregunta frenaba más de lo que protegía. */}
        <DropdownMenuItem onSelect={() => void signOut()}>Cerrar sesión</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
  // El consultor ve las notificaciones agrupadas por tienda.
  const notificationStoreNames = isConsultant
    ? Object.fromEntries(
        bootstrap.memberships.map((membership) => [
          membership.organization_id,
          membership.organization?.display_name ?? membership.organization_id,
        ]),
      )
    : undefined;
  const clientSelectOptions: ClientOption[] = [
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
  const clientSelectValue = isConsultant
    ? activeOrganizationId || GENERAL_VIEW_KEY
    : activeOrganizationId;
  // Con muchos clientes un desplegable sin buscador no escala: botón discreto
  // que abre un buscador, con «Mis tiendas» y «Clientes» como grupos.
  const clientGroups = groupClientSelect
    ? ["", "Mis tiendas", "Clientes"]
        .map((section) => ({ value: section, items: clientSelectOptions.filter((option) => (option.section ?? "") === section) }))
        .filter((group) => group.items.length)
    : null;
  const renderClientOption = (option: ClientOption) => (
    <ComboboxItem key={option.value} value={option}>
      {option.label}
    </ComboboxItem>
  );
  const clientSelectNode = showClientSelect ? (
    <Combobox
      items={clientGroups ?? clientSelectOptions}
      value={clientSelectOptions.find((option) => option.value === clientSelectValue) ?? null}
      onValueChange={(option) => {
        if (option) selectOrganization(option.value === GENERAL_VIEW_KEY ? "" : option.value);
      }}
      autoHighlight
    >
      <ComboboxTrigger render={<button type="button" aria-label="Cliente activo" className="ui-combobox__bare max-w-[16rem]" />}>
        <ComboboxValue placeholder="Elegir cliente" />
        <IconChevronDown aria-hidden />
      </ComboboxTrigger>
      <ComboboxContent className="w-72">
        <ComboboxInput placeholder="Busca un cliente" aria-label="Buscar cliente" />
        <ComboboxEmpty>No hay ningún cliente con ese nombre.</ComboboxEmpty>
        <ComboboxList<ClientGroupOrOption>>
          {(entry) =>
            "items" in entry ? (
              <ComboboxGroup key={entry.value || "general"} items={entry.items}>
                {entry.value ? <ComboboxLabel>{entry.value}</ComboboxLabel> : null}
                <ComboboxCollection<ClientOption>>{renderClientOption}</ComboboxCollection>
                <ComboboxSeparator />
              </ComboboxGroup>
            ) : (
              renderClientOption(entry)
            )
          }
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
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
      value={currentConnectionId || ALL_STORES_KEY}
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
  // El perfil lo escribe el navegador contra Postgres; sin esto el shell
  // seguía con la foto vieja hasta recargar (y la caché de 30 s de abajo la
  // devolvía igual en cada navegación).
  function updateProfile(patch: ProfilePatch) {
    setBootstrap((current) =>
      current ? { ...current, profile: { ...current.profile, ...patch } } : current,
    );
    if (bootstrapCache) {
      bootstrapCache = {
        ...bootstrapCache,
        bootstrap: {
          ...bootstrapCache.bootstrap,
          profile: { ...bootstrapCache.bootstrap.profile, ...patch },
        },
      };
    }
  }
  const copilotLabel = isCopilotOpen
    ? "Cerrar Consultor IA"
    : "Abrir Consultor IA";
  const copilotToggle = (compact: boolean) => (
    <Button
      size="sm"
      variant={isCopilotOpen ? "secondary" : "ghost"}
      className={compact ? "min-w-9 px-2" : "gap-2"}
      aria-label={copilotLabel}
      title={compact ? copilotLabel : undefined}
      aria-expanded={isCopilotOpen}
      aria-controls="copilot-panel"
      onClick={() => {
        // Al abrirlo desde la navegación, se inicia el chat libre.
        setCopilotAsk(null);
        setIsCopilotOpen((open) => !open);
      }}
    >
      <SparklesIcon className="size-4 shrink-0" aria-hidden />
      <span className={compact ? "sr-only" : ""}>
        {isCopilotOpen ? "Cerrar" : "Consultor IA"}
      </span>
    </Button>
  );

  return (
    <>
      {/* dvh, no vh: en Safari movil 100vh incluye la barra de URL, asi que
          la pagina siempre quedaba un poco scrolleable aunque no hubiera
          contenido de sobra. */}
      <PortalSessionContext.Provider value={{ bootstrap, token, updateProfile }}>
        <IntegrationLiveUpdates organizationId={activeOrganizationId} />
        <InsightsProvider
          scope={{
            organizationId: activeOrganizationId,
            connectionId: currentConnectionId,
            isConsultant,
          }}
        >
        <main className={`min-h-dvh text-foreground${isPlatformAdmin ? " admin-portal" : ""}`}>
          <OverlayRole role={navigationRole === "platform_admin" ? "admin" : navigationRole} />
          <a className="skip-link" href="#portal-content">
            Saltar al contenido principal
          </a>
          <MfaRequiredBanner
            required={bootstrap.memberships.some(
              (membership) =>
                membership.organization_id === activeOrganizationId &&
                membership.accessSource === "membership" &&
                Boolean(membership.organization?.require_mfa),
            )}
          />
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
          {/* En móvil: marca y título a la izquierda, acciones de cuenta a la
          derecha. La navegación vive en la barra inferior («Más» abre el mapa
          completo) y las secciones del módulo activo en la fila de pestañas. */}
          <div className="sticky top-0 z-30 border-b border-separator bg-white pt-[env(safe-area-inset-top)] lg:hidden admin-mobile-legacy">
            <div className="flex items-center gap-2 px-3 py-2 text-foreground">
              <Link
                href="/dashboard"
                aria-label="E-NORA, ir al inicio"
                className="flex size-9 shrink-0 items-center justify-center rounded-md no-underline hover:bg-surface hover:no-underline"
              >
                <BrandLogo variant="simple" alt="" className="size-7" />
              </Link>
              <p className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold leading-tight">
                {title}
              </p>
              <div className="flex shrink-0 items-center">
                <CommandPaletteButton compact />
                {bootstrap.memberships.length > 0 ? copilotToggle(true) : null}
                <NotificationsBell token={token} storeNames={notificationStoreNames} />
                {profileMenu}
              </div>
            </div>
            {clientSelectNode || storeSelectNode || ownStoreSelectNode ? (
              <ScrollArea className="flex items-center gap-2 px-3 pb-2 [&>*]:shrink-0">
                {clientSelectNode}
                {storeSelectNode}
                {/* En movil no hay barra superior donde separarlo a la derecha,
                  asi que va al final de la misma fila. */}
                {ownStoreSelectNode}
              </ScrollArea>
            ) : null}
            {/* Secciones del módulo activo: en escritorio son la columna
              lateral; aquí, pestañas desplazables. Sin ellas solo se llegaba
              a una sección abriendo «Más». */}
            {activeModule.items.length > 1 ? (
              <nav
                aria-label={`${activeModule.label}: secciones`}
                ref={sectionTabsRef}
                className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none]"
              >
                {activeModule.items
                  .filter((item) => !(navItemPath(item) === "/mensajes" && chatsDisabled))
                  .map((item) => {
                  const active = isPortalNavItemActive(item, pathname, searchParams);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm no-underline transition-colors hover:no-underline",
                        active
                          ? "bg-surface font-medium text-[var(--nav-active)]"
                          : "text-muted hover:text-foreground",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </div>

          {/* Cajón inferior «Más»: el resto de módulos. */}
          <Drawer open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen} swipeDirection="down" showSwipeHandle>
            <DrawerContent id="mobile-nav" className="lg:hidden">
              <DrawerHeader>
                <DrawerTitle>Más</DrawerTitle>
              </DrawerHeader>
              <ScrollArea className="flex-1 overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] [&_a]:py-2.5 pointer-coarse:[&_a]:py-3">
                {mobileNavigation}
              </ScrollArea>
            </DrawerContent>
          </Drawer>

          {/* Barra superior de escritorio a todo el ancho, por encima de los
          dos navs: logo en el hueco de las columnas de navegación, y a partir
          de ahí la ubicación y los selectores de ámbito (alineados con el
          contenido); notificaciones y cuenta a la derecha. El consultor
          siempre tiene el selector de cliente, con "Vista general" (sin
          cliente) como estado por defecto. Un cliente normal solo lo ve si
          pertenece a mas de una organizacion. */}
          <header className="sticky top-0 z-40 hidden h-14 items-center border-b border-separator bg-white lg:flex admin-desktop-header">
            {/* pl-7 = (4.75rem del rail - 1.25rem del icono) / 2: el logo
              arranca en la misma vertical que los iconos del rail, y el
              borde derecho continúa el de la columna de secciones. */}
            <div
              className={`flex h-full shrink-0 items-center border-r border-separator ${
                hasSectionNav
                  ? primaryNavMode === "expanded" ? "w-[28.5rem] pl-7 pr-5" : "w-[20.25rem] pl-7 pr-5"
                  : primaryNavMode === "expanded" ? "w-[13rem] pl-7 pr-5" : "w-[4.75rem] justify-center"
              }`}
            >
              <Link
                href="/dashboard"
                aria-label="E-NORA, ir al inicio"
                className="flex items-center no-underline hover:no-underline"
              >
                {/* Sin columna de secciones y con el rail plegado no cabe el logo entero. */}
                {hasSectionNav || primaryNavMode === "expanded" ? (
                  <BrandLogo variant="full" alt="" className="h-5 w-auto" />
                ) : (
                  <BrandLogo variant="simple" alt="" className="size-7" />
                )}
              </Link>
            </div>
            <div className="flex h-full min-w-0 flex-1 items-center gap-3 px-6 lg:px-10">
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
                {!isConsultant && activeOrganization ? <PortalFeedback organizationId={activeOrganization.id} /> : null}
                <CommandPaletteButton />
                {bootstrap.memberships.length > 0 ? copilotToggle(false) : null}
                <NotificationsBell token={token} storeNames={notificationStoreNames} />
                {profileMenu}
              </div>
            </div>
          </header>

          <div
            className={[
              "relative grid min-h-dvh lg:min-h-[calc(100dvh/var(--ui-zoom)_-_3.5rem)] admin-shell-grid",
              !hasSectionNav
                ? primaryNavMode === "expanded"
                  ? "lg:grid-cols-[13rem_minmax(0,1fr)]"
                  : "lg:grid-cols-[4.75rem_minmax(0,1fr)]"
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
                "sticky top-14 z-40 hidden h-[calc(100dvh/var(--ui-zoom)_-_3.5rem)] shrink-0 flex-col overflow-hidden border-r border-separator bg-white py-3 text-foreground transition-[width] duration-200 ease-out lg:flex admin-primary-nav",
                isPrimaryNavExpanded ? "w-[13rem] items-stretch" : "w-[4.75rem] items-center",
              ].join(" ")}
            >
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
                          "relative flex h-11 shrink-0 items-center rounded-lg no-underline transition-colors duration-150 hover:bg-surface hover:no-underline motion-reduce:transition-none",
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
                        {badge > 0 && isPrimaryNavExpanded ? (
                          <span className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-none tabular-nums bg-accent text-white`}>
                            {badge > 99 ? "99+" : badge}
                          </span>
                        ) : null}
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
                {showAddStoreAction
                  ? (() => {
                      const link = (
                        <Link
                          key="add-store"
                          href="/integraciones/shopify"
                          aria-label="Añadir tienda Shopify"
                          onClick={() =>
                            handleModuleNavigation("/integraciones/shopify")
                          }
                          className={[
                            "flex h-11 items-center rounded-lg no-underline transition-colors hover:bg-surface hover:no-underline",
                            isPrimaryNavExpanded
                              ? "w-full gap-3 px-3"
                              : "size-11 justify-center",
                            pathname === "/integraciones/shopify"
                              ? "bg-surface text-accent"
                              : "text-muted hover:text-foreground",
                          ].join(" ")}
                        >
                          <span
                            className="relative inline-flex size-5 shrink-0 items-center justify-center"
                            aria-hidden
                          >
                            <StoreIcon className="size-5" />
                            <span className="absolute -right-1 -bottom-1 flex size-3 items-center justify-center rounded-full bg-accent text-white ring-2 ring-white">
                              <PlusIcon className="size-1.5" />
                            </span>
                          </span>
                          <span
                            className={[
                              "truncate text-sm font-medium transition-opacity duration-150",
                              isPrimaryNavExpanded ? "opacity-100" : "hidden",
                            ].join(" ")}
                          >
                            Añadir tienda
                          </span>
                        </Link>
                      );
                      if (isPrimaryNavExpanded) return link;
                      return (
                        <Tooltip key="add-store-tooltip" delay={300}>
                          {link}
                          <Tooltip.Content placement="right">
                            <p>Añadir tienda</p>
                          </Tooltip.Content>
                        </Tooltip>
                      );
                    })()
                  : null}
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
                          "relative flex h-11 items-center rounded-lg no-underline transition-colors hover:bg-surface hover:no-underline",
                          isPrimaryNavExpanded
                            ? "w-full gap-3 px-3"
                            : "size-11 justify-center",
                          active
                            ? "bg-surface text-foreground"
                            : "text-muted hover:text-foreground",
                        ].join(" ")}
                      >
                        <Icon className="size-5" aria-hidden />
                        {/* Integraciones vive dentro de Configuración: sus
                            incidencias se señalan en este icono. */}
                        {module.id === "configuracion" && integrationIssueCount > 0 ? (
                          <span
                            aria-label={`${integrationIssueCount} incidencias de integración`}
                            className={`absolute right-0.5 top-0.5 size-2 rounded-full ring-2 ring-white ${integrationSeverity("/integraciones") === "error" ? "bg-danger" : "bg-warning"}`}
                          />
                        ) : null}
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
                        {module.id === "configuracion" && integrationIssueCount > 0 && isPrimaryNavExpanded ? (
                          <span className={`ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold leading-none tabular-nums ${navBadgeClass("/integraciones")}`}>
                            {integrationIssueCount > 99 ? "99+" : integrationIssueCount}
                          </span>
                        ) : null}
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
                  open={isPrimaryNavControlOpen}
                  onOpenChange={setIsPrimaryNavControlOpen}
                >
                  <PopoverTrigger
                    render={<button
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
                    </button>}
                  />
                  <PopoverContent side="top" align="start" className="w-60 gap-0 overflow-hidden p-0" aria-label="Control de navegación lateral">
                    <div>
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
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </aside>

            {hasSectionNav ? contextPanel : null}

            {/* Pantalla y Consultor IA comparten la última columna como paneles:
              en escritorio el asa entre ambos cambia el ancho del copiloto (se
              recuerda en este navegador). En móvil el grupo es un bloque y el
              copiloto abre su cajón. Montado siempre, para que abrir el
              copiloto no vuelva a montar la pantalla. */}
            <ResizablePanelGroup autoSaveId="copilot" className="min-w-0 max-lg:block">
            <ResizablePanel>
            <section
              id="portal-content"
              tabIndex={-1}
              data-module={activeModule?.id}
              data-channel={["shopify", "meta", "klaviyo"].find((c) =>
                pathname === `/${c}` || pathname.startsWith(`/${c}/`) ||
                (pathname === "/dashboard" && searchParams.get("tab") === c),
              )}
              data-role={navigationRole === "client" ? "client" : "consultant"}
              className={`min-w-0${isPlatformAdmin ? " admin-portal-content" : ""}${
                // Marketing, Integraciones y Cartera comparten los colores de Trabajo e Inicio (grafito +
                // azafrán en cliente, grafito + mandarina en consultor).
                // Comunicación y Conocimiento, solo en el consultor: el cliente las sigue viendo con la paleta base.
                  activeModule?.id === "trabajo" || activeModule?.id === "marketing" || activeModule?.id === "comunicacion" || activeModule?.id === "configuracion" || activeModule?.id === "cartera"  ||
                (navigationRole === "consultant" && (activeModule?.id === "comunicacion" || activeModule?.id === "conocimiento"))
                  ? ` trabajo-theme trabajo-theme--${navigationRole === "client" ? "client" : "consultant"}`
                  : ""
                }${activeModule?.id === "analitica" ? " analytics-theme" : ""}${activeModule?.id === "comunicacion" ? " communication-theme" : ""}`}
            >
              <FocusTarget />
              {activeOrganization ? (
                <AccountStateBanner
                  organizationStatus={activeOrganization.status}
                  subscriptionStatus={activeSubscription?.status ?? null}
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
              <div className={`portal-page-content px-4 pt-4 pb-28 sm:px-6 lg:px-10 lg:pt-6 lg:pb-14${isPlatformAdmin ? " admin-portal-page" : ""}`}>
                <Breadcrumbs items={breadcrumbItems} className="mb-4" />
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
                      connectionId: currentConnectionId,
                      setConnectionId: selectConnection,
                      stores: shopifyConnections.map((connection) => ({
                        connectionId: connection.id,
                        label:
                          connection.provider_account_id ??
                          connection.provider_account_name ??
                          connection.id,
                      })),
                    }}
                  >
                    {consultantOnlyRoute ? (
                      <EmptyState
                        title="Esta sección es del consultor"
                        hint="Clientes y Tiendas reúnen la cartera de un consultor. Tu tienda está en Inicio."
                        action={<Link href="/dashboard">Ir a Inicio</Link>}
                      />
                    ) : needsClientForRoute ? (
                      <EmptyState
                        title="Estás en vista general"
                        hint="Esta sección opera sobre un cliente concreto. Elige uno en el selector «Cliente activo» de arriba, o abre tu cartera en Clientes."
                        action={<Link href="/consultor">Ir a Clientes</Link>}
                      />
                    ) : (
                      <ModuleSummaryProvider publish={setModuleSummary}>
                        <CopilotAskProvider
                          ask={(next) => {
                            setCopilotAsk({
                              ...next,
                              reference: buildCopilotEvidenceReference({
                                route: pathname,
                                title,
                                focusLabel: next.focusLabel,
                                connectionId: currentConnectionId,
                                periodLabel: moduleSummary?.period,
                                searchParams,
                                target: next.reference,
                              }),
                              key: Date.now(),
                            });
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
            </ResizablePanel>
            {isCopilotOpen ? (
              <>
              <ResizableHandle aria-label="Cambiar el ancho del Consultor IA" className="max-lg:hidden" />
              <ResizablePanel defaultSize="26rem" minSize="20rem" maxSize="50%" className="max-lg:contents">
              <CopilotPanel
                organizationId={activeOrganizationId}
                canManageEscalations={isConsultant}
                organizations={bootstrap.memberships.map((membership) => ({
                  id: membership.organization_id,
                  name:
                    membership.organization?.display_name ??
                    membership.organization_id,
                }))}
                view={{
                  route: pathname,
                  title,
                  storeId: currentConnectionId || undefined,
                  storeLabel:
                    shopifyConnections.find(
                      (connection) => connection.id === currentConnectionId,
                    )?.provider_account_id ?? undefined,
                  summary: moduleSummary,
                }}
                ask={copilotAsk}
                onClose={() => {
                  setIsCopilotOpen(false);
                  setCopilotAsk(null);
                }}
              />
              </ResizablePanel>
              </>
            ) : null}
            </ResizablePanelGroup>
            {/* Chat con el consultor desde cualquier pantalla: solo el cliente
              (no el consultor ni «Ver como»), con consultor asignado, fuera
              de Chats y sin el Consultor IA abierto encima. */}
            {clientChatThread && !isCopilotOpen && pathname !== "/mensajes" ? (
              <ConsultantChatFloat
                key={clientChatThread.organization_id}
                organizationId={clientChatThread.organization_id}
                consultantName={clientChatThread.counterpart_name ?? null}
                consultantAvatarUrl={clientChatThread.counterpart_avatar_url ?? null}
                unread={clientChatThread.unread_count ?? 0}
                onActivity={() => setMessagesRefreshKey((key) => key + 1)}
              />
            ) : null}
            <CommandPalette
              modules={navigationModules}
              clients={isConsultant || showClientSelect ? clientSelectOptions : undefined}
              clientsHeading={isConsultant ? "Cambiar de cliente" : "Cambiar de negocio"}
              onSelectClient={(value) => selectOrganization(value === GENERAL_VIEW_KEY ? "" : value)}
              stores={
                showStoreSelect
                  ? [
                      { value: "", label: "Todas las tiendas" },
                      ...shopifyConnections.map((connection) => ({
                        value: connection.id,
                        label: connection.provider_account_id ?? connection.provider_account_name ?? connection.id,
                      })),
                    ]
                  : undefined
              }
              onSelectStore={selectConnection}
              onAsk={
                bootstrap.memberships.length > 0
                  ? (question) => {
                      setCopilotAsk({ question, key: Date.now() });
                      setIsCopilotOpen(true);
                    }
                  : undefined
              }
            />
          </div>

          {/* Barra de navegación inferior (solo móvil): app nativa en web. */}
          <nav
            aria-label="Navegación principal"
            className="fixed inset-x-0 bottom-0 z-50 flex border-t border-separator bg-white pb-[env(safe-area-inset-bottom)] lg:hidden admin-mobile-bottom"
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
                    "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.65rem] no-underline transition-colors hover:no-underline",
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
                "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.65rem] transition-colors",
                isMobileNavOpen ? "text-accent" : "text-muted",
              ].join(" ")}
            >
              {/* Configuración (con Integraciones dentro) está en «Más». */}
              {integrationIssueCount > 0 ? (
                <span
                  aria-label={`${integrationIssueCount} incidencias de integración`}
                  className={`absolute top-1.5 size-1.5 rounded-full ${integrationSeverity("/integraciones") === "error" ? "bg-danger" : "bg-warning"}`}
                />
              ) : null}
              {isMobileNavOpen ? (
                <CloseIcon aria-hidden className="text-[1.15rem]" />
              ) : (
                <MenuIcon aria-hidden className="text-[1.15rem]" />
              )}
              Más
            </button>
          </nav>

        </main>
        </InsightsProvider>
      </PortalSessionContext.Provider>
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
  const session = useContext(PortalSessionContext);
  if (session) return <>{props.children(session.bootstrap, session.token)}</>;

  return (
    <Suspense fallback={<LoadingBlock label="Cargando E-NORA..." />}>
      <PortalShellContent {...props} />
    </Suspense>
  );
}
