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
import {
  Alert,
  Avatar,
  Breadcrumbs,
  Button,
  CloseIcon,
  Combobox,
  ConfirmDialog,
  ErrorBlock,
  IconChevronRight,
  Link,
  LoadingBlock,
  MenuIcon,
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
import { NotificationsBell } from "@/components/notifications-bell";

type PortalShellProps = {
  title: string;
  eyebrow?: string;
  children: (bootstrap: BootstrapResponse, token: string) => ReactNode;
};

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

// Navegacion por rol. Para consultores/admins el portal ES el panel de
// consultor: "Clientes" va primero y el resto de secciones operan sobre el
// cliente activo. Para clientes, la navegacion es su propia operacion.
const consultantNavGroups: NavGroup[] = [
  {
    label: "Consultoría",
    items: [
      { href: "/consultor", label: "Clientes" },
      { href: "/agentes", label: "Ejecuciones IA" },
      { href: "/marketing", label: "Marketing IA" },
    ],
  },
  {
    label: "Cliente activo",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/tareas", label: "Tareas" },
      { href: "/camino", label: "Mi Camino" },
      { href: "/llamadas", label: "Llamadas" },
    ],
  },
  {
    label: "Datos del cliente",
    items: [
      { href: "/integraciones", label: "Integraciones" },
      { href: "/shopify", label: "Shopify" },
      { href: "/conocimiento", label: "Conocimiento" },
      { href: "/configuracion", label: "Configuración" },
    ],
  },
];

const clientNavGroups: NavGroup[] = [
  {
    label: "Operación",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/tareas", label: "Tareas" },
      { href: "/camino", label: "Mi Camino" },
      { href: "/llamadas", label: "Llamadas" },
    ],
  },
  {
    label: "Datos y ajustes",
    items: [
      { href: "/integraciones", label: "Integraciones" },
      { href: "/shopify", label: "Shopify" },
      { href: "/conocimiento", label: "Conocimiento" },
      { href: "/configuracion", label: "Configuración" },
    ],
  },
];

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
// TODO el shell (sidebar, cabecera, contenido) con "Cargando cuenta..." en
// cada clic de navegacion -- el sidebar "desaparecia" constantemente. Con la
// cache, solo se ve ese loader la primera vez que se abre el portal en la
// sesion; las siguientes navegaciones muestran el shell al instante con los
// ultimos datos conocidos mientras se refrescan en segundo plano.
let bootstrapCache: {
  bootstrap: BootstrapResponse;
  actions: AccountAction[];
  token: string;
} | null = null;

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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!bootstrapCache);
  const [activeOrganizationId, setActiveOrganizationId] = useState(() => {
    if (!bootstrapCache) {
      return organizationIdFromUrl ?? "";
    }
    const validIds = bootstrapCache.bootstrap.memberships.map(
      (membership) => membership.organization_id,
    );
    if (organizationIdFromUrl && validIds.includes(organizationIdFromUrl)) {
      return organizationIdFromUrl;
    }
    const stored = window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
    return stored && validIds.includes(stored) ? stored : (validIds[0] ?? "");
  });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [shopifyConnections, setShopifyConnections] = useState<
    ShopifyConnectionSummary[]
  >([]);
  const [activeConnectionId, setActiveConnectionId] = useState("");

  // El menú móvil se cierra al navegar a otra ruta.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  // WCAG 2.4.2 (Page Titled): antes todas las paginas compartian el mismo
  // <title>"EcomScaling IA" del layout raiz (los componentes de pagina son
  // client components, no pueden exportar `metadata` de Next.js) -- se
  // reutiliza el `title` que cada pagina ya le pasa a PortalShell para el
  // encabezado movil/sidebar, sin introducir una API nueva.
  useEffect(() => {
    document.title = `${title} · EcomScaling IA`;
  }, [title]);

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
        return stored && validIds.includes(stored)
          ? stored
          : (payload.selected_connection_id ?? validIds[0] ?? "");
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
    updateUrlParams({ connectionId });
  }

  useEffect(() => {
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
        const accountActions = await fetchAccountActions(accessToken);
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
        // localStorage, si no la primera membership.
        const stored = window.localStorage.getItem(
          ACTIVE_ORGANIZATION_STORAGE_KEY,
        );
        const validIds = payload.memberships.map(
          (membership) => membership.organization_id,
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
          return stored && validIds.includes(stored)
            ? stored
            : (validIds[0] ?? "");
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Error cargando la cuenta",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [router]);

  function selectOrganization(organizationId: string) {
    setActiveOrganizationId(organizationId);
    window.localStorage.setItem(
      ACTIVE_ORGANIZATION_STORAGE_KEY,
      organizationId,
    );
    // La tienda activa es especifica de cada organizacion; se recalcula en
    // cuanto llega la lista de tiendas de la nueva organizacion.
    setActiveConnectionId("");
    updateUrlParams({ organizationId, connectionId: undefined });
  }

  async function signOut() {
    await getSupabaseClient().auth.signOut();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <LoadingBlock label="Cargando cuenta..." />
      </main>
    );
  }

  if (error || !bootstrap || !token) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <ErrorBlock>{error ?? "No se pudo resolver la sesión"}</ErrorBlock>
      </main>
    );
  }

  const visibleActions = actions.slice(0, 3);
  const isConsultant = ["platform_admin", "consultant"].includes(
    bootstrap.profile.platform_role,
  );
  const visibleGroups = isConsultant ? consultantNavGroups : clientNavGroups;

  const navigation = (
    <nav className="grid gap-5" aria-label="Navegacion principal">
      {visibleGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
            {group.label}
          </p>
          <div className="mt-2 grid gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "border-l-2 px-3 py-2 text-sm transition",
                    active
                      ? "border-brand bg-brand-tint font-medium text-black"
                      : "border-transparent text-muted hover:bg-surface hover:text-black",
                  ].join(" ")}
                  href={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const accountBlock = (
    <div className="border-t border-line pt-5 text-sm text-muted">
      <div className="flex items-center gap-3">
        <Avatar
          name={bootstrap.profile.full_name ?? bootstrap.user.email ?? "?"}
          size="sm"
          color="accent"
        />
        <div className="min-w-0">
          <p className="truncate text-black">
            {bootstrap.profile.full_name ?? bootstrap.user.email}
          </p>
          <p className="mt-0.5 font-mono text-xs text-brand">
            {formatRole(bootstrap.profile.platform_role)}
          </p>
        </div>
      </div>
      <ConfirmDialog
        trigger={
          <Button
            variant="secondary"
            className="mt-4 block w-full border border-edge px-3 py-2 text-left text-sm text-black transition hover:border-brand hover:text-brand"
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

  return (
    <>
      <main className="min-h-screen bg-white pt-2 text-black">
        <a className="skip-link" href="#portal-content">
          Saltar al contenido principal
        </a>
        {/* Barra superior solo móvil: marca + hamburguesa */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 text-black lg:hidden">
          <div>
            <p className="font-mono text-[0.65rem] uppercase text-brand">
              {eyebrow}
            </p>
            <p className="text-sm font-semibold">{title}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell token={token} />
            <Button
              variant="secondary"
              aria-expanded={isMobileNavOpen}
              aria-controls="mobile-nav"
              onClick={() => setIsMobileNavOpen((open) => !open)}
            >
              {isMobileNavOpen ? (
                <CloseIcon aria-hidden />
              ) : (
                <MenuIcon aria-hidden />
              )}
              Menú
            </Button>
          </div>
        </div>

        {/* Panel de navegacion móvil desplegable */}
        {isMobileNavOpen ? (
          <div
            id="mobile-nav"
            className="border-b border-line bg-white px-4 py-5 text-black lg:hidden"
          >
            {navigation}
            <div className="mt-6">{accountBlock}</div>
          </div>
        ) : null}

        <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
          <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-line bg-white p-5 text-black lg:flex">
            <div>
              <p className="font-mono text-xs uppercase text-brand">
                {eyebrow}
              </p>
              <h1 className="mt-2 text-lg font-semibold">Centro operativo</h1>
              <div className="mt-7">{navigation}</div>
            </div>
            {accountBlock}
          </aside>

          <section id="portal-content" tabIndex={-1} className="min-w-0">
            <div className="hidden items-center justify-between border-b border-line px-6 py-3 lg:flex lg:px-10">
              <Breadcrumbs
                items={[
                  { label: eyebrow, href: "/dashboard" },
                  { label: title },
                ]}
              />
              <NotificationsBell token={token} />
            </div>
            {/* Mini barra de contexto: solo se muestra si hay algo que seleccionar
              (cliente activo o tienda). El indicador de rol/estado se quito por no
              aportar nada al usuario. */}
            {(isConsultant && bootstrap.memberships.length > 1) ||
            shopifyConnections.length > 1 ? (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line bg-surface px-6 py-3 lg:px-10">
                {isConsultant && bootstrap.memberships.length > 1 ? (
                  <Combobox
                    className="w-44"
                    label="Cliente activo"
                    value={activeOrganizationId}
                    onChange={selectOrganization}
                    options={bootstrap.memberships.map((membership) => ({
                      value: membership.organization_id,
                      label:
                        membership.organization?.display_name ??
                        membership.organization_id,
                    }))}
                  />
                ) : null}
                {shopifyConnections.length > 1 ? (
                  <Combobox
                    className="w-40"
                    label="Tienda"
                    value={activeConnectionId}
                    onChange={selectConnection}
                    options={shopifyConnections.map((connection) => ({
                      value: connection.id,
                      label:
                        connection.provider_account_id ??
                        connection.provider_account_name ??
                        connection.id,
                    }))}
                  />
                ) : null}
              </div>
            ) : null}

            {visibleActions.map((action) => (
              <div
                key={action.id}
                className="border-b border-edge px-6 py-3 lg:px-10"
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
              <div className="border-b border-edge px-6 py-2 font-mono text-xs text-muted lg:px-10">
                {actions.length - visibleActions.length} avisos más en
                Integraciones.
              </div>
            ) : null}
            <div className="px-6 pt-6 pb-14 lg:px-10">
              <ActiveOrganizationContext.Provider
                value={{
                  organizationId:
                    activeOrganizationId ||
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
                  {children(bootstrap, token)}
                </ActiveConnectionContext.Provider>
              </ActiveOrganizationContext.Provider>
            </div>
          </section>
        </div>

        {activeOrganizationId || bootstrap.memberships[0]?.organization_id ? (
          <>
            <Button
              className="fixed bottom-6 right-6 z-30"
              aria-expanded={isCopilotOpen}
              aria-controls="copilot-panel"
              onClick={() => setIsCopilotOpen((open) => !open)}
            >
              {isCopilotOpen ? "Cerrar copiloto" : "Copiloto"}
            </Button>
            {isCopilotOpen ? (
              <CopilotPanel
                organizationId={
                  activeOrganizationId ||
                  (bootstrap.memberships[0]?.organization_id ?? "")
                }
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
