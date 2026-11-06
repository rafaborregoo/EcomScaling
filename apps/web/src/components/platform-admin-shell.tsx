"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  BookOpen,
  Clapperboard,
  ClipboardCheck,
  ChevronRight,
  CircleDollarSign,
  Command,
  FileText,
  FlaskConical,
  Gift,
  Inbox,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings2,
  Users,
  Wrench,
} from "lucide-react";
import { Drawer, DrawerContent, Link, OverlayRole } from "@/components/ui";
import { BrandLogo } from "@/components/ui/brand-logo";
import { PortalShell } from "@/components/portal-shell";
import { CommandPaletteButton } from "@/components/command-palette";
import { type BootstrapResponse } from "@/lib/bootstrap";
import { ErrorBlock } from "@/components/ui";

const navigation = [
  {
    label: "General",
    items: [{ href: "/admin", label: "Resumen", icon: LayoutDashboard }],
  },
  {
    label: "Plataforma",
    items: [
      { href: "/admin/solicitudes", label: "Solicitudes", icon: Inbox },
      { href: "/admin/clientes", label: "Clientes", icon: Users },
      { href: "/admin/consultores", label: "Consultores", icon: Users },
      { href: "/admin/programa-consultores", label: "Referidos", icon: Gift },
      { href: "/admin/onboarding", label: "Onboarding de prueba", icon: ClipboardCheck },
      { href: "/admin/conocimiento", label: "Metodología", icon: BookOpen },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { href: "/admin/observabilidad", label: "Observabilidad", icon: Activity },
      { href: "/admin/infraestructura", label: "Salud y seguridad", icon: Activity },
      { href: "/admin/agentes", label: "Agentes de IA", icon: Bot },
      { href: "/admin/costes-ia", label: "Costes de IA", icon: CircleDollarSign },
      { href: "/admin/auditoria-ia", label: "Auditoría de IA", icon: ClipboardCheck },
      { href: "/admin/laboratorio-ia", label: "Laboratorio de IA", icon: FlaskConical },
      { href: "/admin/tools", label: "Herramientas", icon: Wrench },
      { href: "/admin/informes", label: "Plantillas PDF", icon: ScrollText },
      { href: "/admin/laboratorio-mailing", label: "Laboratorio de mailing", icon: FlaskConical },
    ],
  },
  {
    label: "Contenido",
    items: [{ href: "/admin/contenido-video", label: "Calendario de vídeos", icon: Clapperboard }],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/admin/finanzas", label: "Finanzas", icon: CircleDollarSign },
      { href: "/admin/facturacion", label: "Facturación", icon: FileText },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/logs/auditoria", label: "Auditoría", icon: ScrollText },
      { href: "/admin/logs/errores-sync", label: "Errores de sincronización", icon: Activity },
      { href: "/admin/logs/errores-agentes", label: "Errores de agentes", icon: Bot },
    ],
  },
];

const pageContext: Record<string, { area: string; description: string }> = {
  "Laboratorio de IA": { area: "Operaciones", description: "Una página por agente para comparar seis modelos y seguir los fallos y sus correcciones." },
  "Auditoría de IA": { area: "Operaciones", description: "Estado de modelos y costes, problemas detectados y propuesta de evaluación por agente." },
  "Onboarding de prueba": { area: "Plataforma", description: "Recorre el alta de un cliente o consultor en un entorno aislado." },
  Solicitudes: { area: "Plataforma", description: "Quién pide acceso, plazas libres e invitaciones." },
  Clientes: { area: "Plataforma", description: "Organizaciones, accesos y asignación de consultores." },
  Consultores: { area: "Plataforma", description: "Equipo, cartera de clientes y actividad de IA." },
  "Programa de consultores": { area: "Plataforma", description: "Códigos de referido y rendimiento del programa." },
  Metodología: { area: "Conocimiento", description: "Documentos compartidos que utiliza el copiloto en todos los clientes." },
  Observabilidad: { area: "Operaciones", description: "Ejecuciones, calidad, costes e incidencias de los agentes." },
  "Salud y seguridad": { area: "Operaciones", description: "VPS, rendimiento, organizaciones afectadas, informes y cobertura de seguridad." },
  "Configuración de IA": { area: "Operaciones", description: "Modelos, agentes activos y límites de ejecución." },
  "Tools del copiloto": { area: "Operaciones", description: "Herramientas disponibles, permisos y agentes que las utilizan." },
  "Plantillas PDF": { area: "Operaciones", description: "Plantillas nativas que reutiliza el copiloto para generar informes PDF." },
    "Laboratorio de mailing": { area: "Operaciones", description: "Biblioteca interna de plantillas y patrones editoriales de E-NORA." },
  "Calendario de vídeos": { area: "Contenido", description: "Los vídeos de Instagram del mes: calendario, banco de ideas por módulo y diseños." },
  Finanzas: { area: "Finanzas", description: "Ingresos, gastos, resultado y movimientos de la plataforma." },
  Facturación: { area: "Finanzas", description: "Planes, concesiones y configuración de facturación." },
  Auditoría: { area: "Sistema", description: "Historial de acciones administrativas y cambios en la plataforma." },
  "Errores de sincronización": { area: "Sistema", description: "Sincronizaciones fallidas y acciones para recuperarlas." },
  "Errores de agentes IA": { area: "Sistema", description: "Ejecuciones fallidas y diagnósticos de agentes." },
};

function AdminWorkspace({
  title,
  email,
  children,
}: {
  title: string;
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const context = pageContext[title];

  // La misma navegación en la columna fija (escritorio) y en el Drawer
  // izquierdo (móvil, < 1024 px).
  const sidebar = (
      <>
        <Link href="/admin" className="admin-brand" onClick={() => setMenuOpen(false)}>
          <span className="admin-brand-mark">
            <BrandLogo variant="simple" className="h-8 w-8" alt="" />
          </span>
          <span className="admin-brand-copy">
            <strong>E-NORA</strong>
            <small>ADMINISTRACIÓN</small>
          </span>
        </Link>

        <div className="admin-sidebar-scroll">
          <Link
            href="/admin"
            onClick={() => setMenuOpen(false)}
            className={`admin-overview-link${pathname === "/admin" ? " is-active" : ""}`}
            aria-current={pathname === "/admin" ? "page" : undefined}
          >
            <LayoutDashboard size={17} aria-hidden />
            <span>Vista general</span>
            <ChevronRight size={15} aria-hidden />
          </Link>

          {navigation.slice(1).map((group) => (
            <nav key={group.label} className="admin-nav-group" aria-label={group.label}>
              <p>{group.label}</p>
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`admin-nav-link${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={16} strokeWidth={1.8} aria-hidden />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          ))}
        </div>

        <div className="admin-sidebar-footer">
          <span className="admin-access-dot" aria-hidden />
          <span>Acceso de plataforma</span>
          <Settings2 size={15} aria-hidden />
        </div>
      </>
  );

  return (
    <div className="admin-workspace">
      <OverlayRole role="admin" />
      <aside className="admin-sidebar">{sidebar}</aside>
      <Drawer open={menuOpen} onOpenChange={setMenuOpen} swipeDirection="left">
        <DrawerContent id="admin-mobile-nav" aria-label="Navegación de administración" className="admin-sidebar admin-sidebar--drawer">
          {sidebar}
        </DrawerContent>
      </Drawer>

      <div className="admin-main-column">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-button"
            aria-label={menuOpen ? "Cerrar navegación" : "Abrir navegación"}
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu size={20} aria-hidden />
          </button>
          <Link href="/admin" className="admin-topbar-brand" aria-label="E-NORA, inicio de administración">
            <BrandLogo variant="letras" className="h-5 w-auto" alt="" />
          </Link>
          <div className="admin-breadcrumb">
            <span>Espacio de trabajo</span>
            <ChevronRight size={14} aria-hidden />
            <strong>{title}</strong>
          </div>
          <div className="admin-topbar-meta">
            <CommandPaletteButton />
            <span className="admin-live"><i aria-hidden /> Sesión activa</span>
            <Link href="/perfil" className="admin-user" aria-label={`Abrir perfil de ${email}`}>
              <span className="admin-user-avatar" aria-hidden>{email.slice(0, 1).toUpperCase() || "A"}</span>
              <span className="admin-user-email">{email}</span>
            </Link>
          </div>
        </header>
        <main className="admin-page-content" id="admin-main-content">
          {context ? (
            <section className="admin-module-intro" aria-labelledby="admin-module-title">
              <div>
                <p>{context.area}</p>
                <h1 id="admin-module-title">{title}</h1>
                <span>{context.description}</span>
              </div>
              <span className="admin-module-intro-mark" aria-hidden>EN</span>
            </section>
          ) : null}
          {children}
        </main>
        <footer className="admin-footer">
          <span>E-NORA · Consola de administración</span>
          <span><Command size={13} aria-hidden /> Plataforma</span>
        </footer>
      </div>
    </div>
  );
}

export function PlatformAdminShell({
  title,
  children,
}: {
  title: string;
  children: (bootstrap: BootstrapResponse, token: string) => ReactNode;
}) {
  return (
    <PortalShell title={title}>
      {(bootstrap, token) => bootstrap.profile.platform_role === "platform_admin" ? (
        <AdminWorkspace title={title} email={bootstrap.user.email ?? "Administrador"}>
          {children(bootstrap, token)}
        </AdminWorkspace>
      ) : (
        <ErrorBlock>Esta sección es solo para administradores de la plataforma.</ErrorBlock>
      )}
    </PortalShell>
  );
}
