"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  fetchAccountActions,
  fetchBootstrap,
  getAccessToken,
  type AccountAction,
  type BootstrapResponse,
} from "@/lib/bootstrap";
import { supabase } from "@/lib/supabase";

type PortalShellProps = {
  title: string;
  eyebrow?: string;
  children: (bootstrap: BootstrapResponse, token: string) => ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/integraciones", label: "Integraciones" },
  { href: "/shopify", label: "Shopify" },
  { href: "/configuracion", label: "Configuracion" },
  { href: "/consultor", label: "Consultor" },
];

function formatRole(role: string) {
  return role.replaceAll("_", " ");
}

export function PortalShell({ title, eyebrow = "EcomScaling IA", children }: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [actions, setActions] = useState<AccountAction[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Error cargando la cuenta");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <div className="rounded-md border border-[#d8d8d8] bg-white p-6">Cargando cuenta...</div>
      </main>
    );
  }

  if (error || !bootstrap || !token) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        <div className="rounded-md border border-[#dc1f26] bg-white p-6 text-[#b5121b]">
          {error ?? "No se pudo resolver la sesion"}
        </div>
      </main>
    );
  }

  const primaryOrganization = bootstrap.memberships[0]?.organization;
  const primaryAction = actions[0] ?? null;

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-[#d8d8d8] bg-black p-5 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4 lg:block">
            <div>
              <p className="font-mono text-xs uppercase text-[#ff4a51]">{eyebrow}</p>
              <h1 className="mt-2 text-lg font-semibold">Centro operativo</h1>
            </div>
            <button
              className="rounded-md border border-white/25 px-3 py-2 text-sm hover:border-[#ff4a51] hover:text-[#ff4a51] lg:hidden"
              type="button"
              onClick={signOut}
            >
              Salir
            </button>
          </div>

          <nav className="mt-6 grid gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  className={[
                    "rounded-md px-3 py-2 text-sm transition",
                    active ? "bg-white text-black" : "text-white/75 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                  href={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 hidden border-t border-white/15 pt-5 text-sm text-white/75 lg:block">
            <p className="text-white">{bootstrap.profile.full_name ?? bootstrap.user.email}</p>
            <p className="mt-1 font-mono text-xs text-[#ff4a51]">
              {formatRole(bootstrap.profile.platform_role)}
            </p>
            <button
              className="mt-5 rounded-md border border-white/25 px-3 py-2 text-sm text-white hover:border-[#ff4a51] hover:text-[#ff4a51]"
              type="button"
              onClick={signOut}
            >
              Salir
            </button>
          </div>
        </aside>

        <section className="min-w-0">
          {primaryAction ? (
            <div className="border-b border-[#dc1f26] bg-[#fff7f7] px-5 py-3 text-sm text-[#8f1018]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{primaryAction.title}</p>
                  <p className="mt-1">
                    {primaryAction.organization_name ? `${primaryAction.organization_name}: ` : ""}
                    {primaryAction.message}
                  </p>
                  {primaryAction.missing_scopes?.length ? (
                    <p className="mt-1 font-mono text-xs">
                      {primaryAction.missing_scopes.length} permisos pendientes
                    </p>
                  ) : null}
                </div>
                <Link
                  className="inline-flex w-fit rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-[#dc1f26]"
                  href={primaryAction.cta_href}
                >
                  {primaryAction.cta_label}
                </Link>
              </div>
            </div>
          ) : null}
          <header className="border-b border-[#d8d8d8] px-5 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-mono text-xs uppercase text-[#dc1f26]">
                  {primaryOrganization?.display_name ?? "Sin organizacion activa"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-sm border border-[#d8d8d8] px-2 py-1 font-mono">
                  {bootstrap.profile.platform_role}
                </span>
                <span className="rounded-sm border border-[#d8d8d8] px-2 py-1 font-mono">
                  {primaryOrganization?.status ?? "sin_org"}
                </span>
              </div>
            </div>
          </header>

          <div className="px-5 py-6">{children(bootstrap, token)}</div>
        </section>
      </div>
    </main>
  );
}
