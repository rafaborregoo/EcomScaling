"use client";

import {
  Activity,
  ArrowUpRight,
  Bot,
  BookOpen,
  CircleDollarSign,
  FileText,
  FlaskConical,
  ScrollText,
  Users,
  Wrench,
} from "lucide-react";
import { Link } from "@/components/ui";
import { BrandLogo } from "@/components/ui/brand-logo";
import { PlatformAdminShell } from "@/components/platform-admin-shell";

const shortcuts = [
  { href: "/admin/clientes", label: "Gestionar clientes", icon: Users, tone: "green" },
  { href: "/admin/consultores", label: "Administrar consultores", icon: Users, tone: "sand" },
  { href: "/admin/observabilidad", label: "Revisar la operación", icon: Activity, tone: "blue" },
  { href: "/admin/facturacion", label: "Abrir facturación", icon: FileText, tone: "gold" },
];

const modules = [
  {
    title: "Plataforma",
    description: "Gestiona cuentas, equipo y el programa de referidos.",
    icon: Users,
    links: [
      ["Clientes", "/admin/clientes"],
      ["Consultores", "/admin/consultores"],
      ["Programa de referidos", "/admin/programa-consultores"],
    ],
  },
  {
    title: "Operaciones e IA",
    description: "Controla la actividad, los agentes y las herramientas.",
    icon: Bot,
    links: [
      ["Observabilidad", "/admin/observabilidad"],
      ["Agentes de IA", "/admin/agentes"],
      ["Costes de IA", "/admin/costes-ia"],
      ["Herramientas", "/admin/tools"],
      ["Laboratorio de mailing", "/admin/laboratorio-mailing"],
    ],
  },
  {
    title: "Finanzas",
    description: "Consulta movimientos y administra la facturación.",
    icon: CircleDollarSign,
    links: [
      ["Finanzas", "/admin/finanzas"],
      ["Facturación", "/admin/facturacion"],
    ],
  },
  {
    title: "Conocimiento y sistema",
    description: "Mantén la metodología y revisa cambios e incidencias.",
    icon: BookOpen,
    links: [
      ["Metodología", "/admin/conocimiento"],
      ["Auditoría", "/admin/logs/auditoria"],
      ["Errores de sincronización", "/admin/logs/errores-sync"],
      ["Errores de agentes", "/admin/logs/errores-agentes"],
    ],
  },
];

export default function AdminHomePage() {
  return (
    <PlatformAdminShell title="Resumen">
      {(bootstrap) => (
        <div className="admin-overview">
          <div className="admin-page-heading">
            <div>
              <span className="admin-eyebrow">CENTRO DE CONTROL</span>
              <h1>Resumen de plataforma</h1>
              <p>Accede a cada área de administración desde un único lugar.</p>
            </div>
            <span className="admin-date-note">Consola · E-NORA</span>
          </div>

          <section className="admin-welcome" aria-label="Estado de la plataforma">
            <div className="admin-welcome-copy">
              <span className="admin-welcome-label"><i aria-hidden /> SESIÓN ADMINISTRADORA ACTIVA</span>
              <h2>Hola, {bootstrap.profile.full_name?.split(" ")[0] ?? "equipo"}.</h2>
              <p>Tu acceso de administrador está activo. Elige una tarea para continuar.</p>
            </div>
            <div className="admin-welcome-mark" aria-hidden>
              <BrandLogo variant="completo" className="h-16 w-auto" alt="" />
            </div>
          </section>

          <section className="admin-section-block" aria-labelledby="admin-shortcuts-title">
            <div className="admin-section-heading">
              <div>
                <h2 id="admin-shortcuts-title">Accesos rápidos</h2>
                <p>Las áreas más utilizadas de la consola.</p>
              </div>
            </div>
            <div className="admin-shortcuts-grid">
              {shortcuts.map(({ href, label, icon: Icon, tone }) => (
                <Link key={href} href={href} className={`admin-shortcut admin-shortcut-${tone}`}>
                  <span className="admin-shortcut-icon"><Icon size={18} strokeWidth={1.8} aria-hidden /></span>
                  <span>{label}</span>
                  <ArrowUpRight size={16} aria-hidden />
                </Link>
              ))}
            </div>
          </section>

          <section className="admin-section-block" aria-labelledby="admin-modules-title">
            <div className="admin-section-heading">
              <div>
                <h2 id="admin-modules-title">Todos los módulos</h2>
                <p>Administración completa, organizada por área.</p>
              </div>
              <span className="admin-module-count">{modules.reduce((total, group) => total + group.links.length, 0)} secciones</span>
            </div>
            <div className="admin-modules-grid">
              {modules.map(({ title, description, icon: Icon, links }) => (
                <article className="admin-module-card" key={title}>
                  <div className="admin-module-card-heading">
                    <span className="admin-module-icon"><Icon size={18} strokeWidth={1.8} aria-hidden /></span>
                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </div>
                  <div className="admin-module-links">
                    {links.map(([label, href]) => (
                      <Link href={href} key={href}>
                        <span>{label}</span><ArrowUpRight size={14} aria-hidden />
                      </Link>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="admin-tool-strip" aria-label="Enlaces de soporte operativo">
            <div><FlaskConical size={17} aria-hidden /><span>Laboratorio de mailing</span></div>
            <Link href="/admin/tools"><Wrench size={15} aria-hidden /> Herramientas de IA</Link>
            <Link href="/admin/logs/auditoria"><ScrollText size={15} aria-hidden /> Registro de auditoría</Link>
          </section>
        </div>
      )}
    </PlatformAdminShell>
  );
}
