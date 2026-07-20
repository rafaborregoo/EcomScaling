"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  apiFetch,
  fetchAccountActions,
  fetchBootstrap,
  getAccessToken,
  type AccountAction,
  type BootstrapResponse,
} from "@/lib/bootstrap";
import { supabase } from "@/lib/supabase";
import { Combobox, ErrorBlock, LoadingBlock } from "@ecomscaling/ui";
import {
  ACTIVE_ORGANIZATION_STORAGE_KEY,
  ActiveOrganizationContext,
} from "@/components/active-organization";
import {
  ACTIVE_CONNECTION_STORAGE_KEY,
  ActiveConnectionContext,
} from "@/components/active-connection";
import { CopilotPanel } from "@/components/copilot-panel";

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
    items: [{ href: "/consultor", label: "Clientes" }],
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
  window.localStorage.setItem(ACTIVE_CONNECTION_STORAGE_KEY, JSON.stringify(map));
}

// Cada pagina monta su propio PortalShell (no vive en un layout compartido),
// asi que cada navegacion lo desmonta y remonta desde cero. Sin esta cache en
// memoria del modulo, eso significaba pedir el bootstrap otra vez y tapar
// TODO el shell (sidebar, cabecera, contenido) con "Cargando cuenta..." en
// cada clic de navegacion -- el sidebar "desaparecia" constantemente. Con la
// cache, solo se ve ese loader la primera vez que se abre el portal en la
// sesion; las siguientes navegaciones muestran el shell al instante con los
// ultimos datos conocidos mientras se refrescan en segundo plano.
let bootstrapCache: { bootstrap: BootstrapResponse; actions: AccountAction[]; token: string } | null = null;

export function PortalShell({ title, eyebrow = "EcomScaling IA", children }: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(bootstrapCache?.bootstrap ?? null);
  const [actions, setActions] = useState<AccountAction[]>(bootstrapCache?.actions ?? []);
  const [token, setToken] = useState<string | null>(bootstrapCache?.token ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!bootstrapCache);
  const [activeOrganizationId, setActiveOrganizationId] = useState(() => {
    if (!bootstrapCache) {
      return "";
    }
    const stored = window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
    const validIds = bootstrapCache.bootstrap.memberships.map((membership) => membership.organization_id);
    return stored && validIds.includes(stored) ? stored : (validIds[0] ?? "");
  });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [shopifyConnections, setShopifyConnections] = useState<ShopifyConnectionSummary[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState("");

  // El menú móvil se cierra al navegar a otra ruta.
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

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

      const response = await apiFetch(`/v1/organizations/${activeOrganizationId}/shopify/connections`);

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

      const validIds = (payload.connections ?? []).map((connection) => connection.id);

      // Si una pagina ya fijo una tienda valida mientras esta carga estaba en
      // vuelo (p. ej. un deep-link ?connectionId=...), no la pisamos.
      setActiveConnectionId((current) => {
        if (current && validIds.includes(current)) {
          return current;
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
  }, [activeOrganizationId, token]);

  function selectConnection(connectionId: string) {
    setActiveConnectionId(connectionId);
    if (activeOrganizationId) {
      writeConnectionMap(activeOrganizationId, connectionId);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const accessToken = await getAccessToken();

        if (!accessToken) {
          router.replace("/login");
          return;
        }

        const payload = await fetchBootstrap(accessToken);
        const accountActions = await fetchAccountActions(accessToken);
        setToken(accessToken);
        setBootstrap(payload);
        setActions(accountActions);
        bootstrapCache = { bootstrap: payload, actions: accountActions, token: accessToken };

        // Organización activa global: la que ya estaba activa (remontaje via
        // cache) si sigue siendo valida, si no la ultima elegida en
        // localStorage, si no la primera membership.
        const stored = window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
        const validIds = payload.memberships.map((membership) => membership.organization_id);
        setActiveOrganizationId((current) => {
          if (current && validIds.includes(current)) {
            return current;
          }
          return stored && validIds.includes(stored) ? stored : (validIds[0] ?? "");
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando la cuenta");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [router]);

  function selectOrganization(organizationId: string) {
    setActiveOrganizationId(organizationId);
    window.localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, organizationId);
    // La tienda activa es especifica de cada organizacion; se recalcula en
    // cuanto llega la lista de tiendas de la nueva organizacion.
    setActiveConnectionId("");
  }

  async function signOut() {
    await supabase.auth.signOut();
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

  const activeMembership =
    bootstrap.memberships.find(
      (membership) => membership.organization_id === activeOrganizationId,
    ) ?? bootstrap.memberships[0];
  const primaryOrganization = activeMembership?.organization;
  const visibleActions = actions.slice(0, 3);
  const isConsultant = ["platform_admin", "consultant"].includes(bootstrap.profile.platform_role);
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
                    "rounded-md border-l-2 px-3 py-2 text-sm transition",
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
      <p className="truncate text-black">{bootstrap.profile.full_name ?? bootstrap.user.email}</p>
      <p className="mt-1 font-mono text-xs text-brand">
        {formatRole(bootstrap.profile.platform_role)}
      </p>
      <button
        className="mt-4 w-full rounded-md border border-edge px-3 py-2 text-left text-sm text-black transition hover:border-brand hover:text-brand"
        type="button"
        onClick={signOut}
      >
        Cerrar sesión
      </button>
    </div>
  );

  return (
    <main className="min-h-screen bg-white text-black">
      {/* Barra superior solo móvil: marca + hamburguesa */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white px-4 py-3 text-black lg:hidden">
        <div>
          <p className="font-mono text-[0.65rem] uppercase text-brand">{eyebrow}</p>
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-md border border-edge px-3 py-2 text-sm transition hover:border-brand hover:text-brand"
          type="button"
          aria-expanded={isMobileNavOpen}
          aria-controls="mobile-nav"
          onClick={() => setIsMobileNavOpen((open) => !open)}
        >
          <span aria-hidden>{isMobileNavOpen ? "✕" : "☰"}</span>
          Menú
        </button>
      </div>

      {/* Panel de navegacion móvil desplegable */}
      {isMobileNavOpen ? (
        <div id="mobile-nav" className="border-b border-line bg-white px-4 py-5 text-black lg:hidden">
          {navigation}
          <div className="mt-6">{accountBlock}</div>
        </div>
      ) : null}

      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="sticky top-0 hidden h-screen flex-col justify-between border-r border-line bg-white p-5 text-black lg:flex">
          <div>
            <p className="font-mono text-xs uppercase text-brand">{eyebrow}</p>
            <h1 className="mt-2 text-lg font-semibold">Centro operativo</h1>
            <div className="mt-7">{navigation}</div>
          </div>
          {accountBlock}
        </aside>

        <section className="min-w-0">
          {/* Mini barra de contexto: a quien se esta viendo y desde que rol,
              separado del contenido de la pagina en si. */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line bg-surface px-6 py-3 lg:px-10">
            {isConsultant && bootstrap.memberships.length > 1 ? (
              <Combobox
                className="w-44"
                label="Cliente activo"
                value={activeOrganizationId}
                onChange={selectOrganization}
                options={bootstrap.memberships.map((membership) => ({
                  value: membership.organization_id,
                  label: membership.organization?.display_name ?? membership.organization_id,
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
                  label: connection.provider_account_id ?? connection.provider_account_name ?? connection.id,
                }))}
              />
            ) : null}
            <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted">
              <span
                aria-hidden
                className={[
                  "inline-block size-1.5 rounded-full",
                  primaryOrganization?.status === "active" ? "bg-success" : "bg-edge-strong",
                ].join(" ")}
              />
              {formatRole(bootstrap.profile.platform_role)}
              {primaryOrganization ? ` · ${primaryOrganization.status}` : ""}
            </div>
          </div>

          {visibleActions.map((action) => (
            <div key={action.id} className="border-b border-edge px-6 py-3 text-sm lg:px-10">
              <div className="flex flex-col gap-2 border-l-2 border-brand pl-3 md:flex-row md:items-center md:justify-between md:gap-6">
                <div>
                  <p className="font-medium text-brand-deep">{action.title}</p>
                  <p className="mt-0.5 text-muted">
                    {action.organization_name ? `${action.organization_name}: ` : ""}
                    {action.message}
                    {action.missing_scopes?.length
                      ? ` (${action.missing_scopes.length} permisos pendientes)`
                      : ""}
                  </p>
                </div>
                <Link
                  className="whitespace-nowrap text-sm font-medium underline decoration-brand decoration-1 underline-offset-4 transition hover:text-brand"
                  href={action.cta_href}
                >
                  {action.cta_label} →
                </Link>
              </div>
            </div>
          ))}
          {actions.length > visibleActions.length ? (
            <div className="border-b border-edge px-6 py-2 font-mono text-xs text-muted lg:px-10">
              {actions.length - visibleActions.length} avisos más en Integraciones.
            </div>
          ) : null}
          <header className="px-6 pt-8 pb-6 lg:px-10">
            {!isConsultant ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-brand">
                {primaryOrganization?.display_name ?? "Sin organización activa"}
              </p>
            ) : null}
            <h2 className="mt-1 truncate font-display text-4xl leading-tight lg:text-5xl">{title}</h2>
          </header>

          <div className="px-6 pb-14 lg:px-10">
            <ActiveOrganizationContext.Provider
              value={{
                organizationId: activeOrganizationId || (bootstrap.memberships[0]?.organization_id ?? ""),
                setOrganizationId: selectOrganization,
              }}
            >
              <ActiveConnectionContext.Provider
                value={{ connectionId: activeConnectionId, setConnectionId: selectConnection }}
              >
                {children(bootstrap, token)}
              </ActiveConnectionContext.Provider>
            </ActiveOrganizationContext.Provider>
          </div>
        </section>
      </div>

      {(activeOrganizationId || bootstrap.memberships[0]?.organization_id) ? (
        <>
          <button
            className="fixed bottom-6 right-6 z-30 bg-black px-5 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-brand"
            type="button"
            onClick={() => setIsCopilotOpen((open) => !open)}
          >
            {isCopilotOpen ? "Cerrar copiloto" : "Copiloto"}
          </button>
          {isCopilotOpen ? (
            <CopilotPanel
              organizationId={activeOrganizationId || (bootstrap.memberships[0]?.organization_id ?? "")}
              onClose={() => setIsCopilotOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
