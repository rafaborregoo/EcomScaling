import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui";
import { LegalFooterLinks } from "@/components/legal-page";
import { PublicCompactNav } from "./public-compact-nav";
import styles from "./public-entry.module.css";

export function PublicEntryShell({ active, children }: { active: "login" | "platform" | "consultants" | "request"; children: ReactNode }) {
  // Las páginas con vídeo (clientes y consultores) comparten la cabecera de «platform»
  const entry = active === "login" ? "login" : "platform";
  return (
    <div className={styles.shell} data-entry={entry}>
      <a className={styles.skip} href="#public-content">Saltar al contenido</a>
      <header className={styles.header}>
        <Link href="/como-funciona" aria-label="E-NORA, conoce la plataforma" className={styles.logo}>
          <BrandLogo />
        </Link>
        <nav aria-label="Navegación pública" className={styles.nav}>
          <Link href="/como-funciona" aria-current={active === "platform" ? "page" : undefined}>Conoce E-NORA</Link>
          <Link href="/consultores" aria-current={active === "consultants" ? "page" : undefined}>Consultores</Link>
          <Link href="/solicitar" aria-current={active === "request" ? "page" : undefined}>Pedir acceso</Link>
          <Link href="/login" aria-current={active === "login" ? "page" : undefined}>Ingresar</Link>
        </nav>
      </header>
      {entry === "platform" && <PublicCompactNav />}
      {children}
      <footer className={styles.footer}>
        <span>E-NORA · Tu negocio, con perspectiva.</span>
        <LegalFooterLinks />
      </footer>
    </div>
  );
}
