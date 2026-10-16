import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/ui";
import { LegalFooterLinks } from "@/components/legal-page";
import styles from "./public-entry.module.css";

export function PublicEntryShell({ active, children }: { active: "login" | "platform"; children: ReactNode }) {
  return (
    <div className={styles.shell} data-entry={active}>
      <a className={styles.skip} href="#public-content">Saltar al contenido</a>
      <header className={styles.header}>
        <Link href="/conoce-e-nora" aria-label="E-NORA, conoce la plataforma" className={styles.logo}>
          <BrandLogo />
        </Link>
        <nav aria-label="Navegación pública" className={styles.nav}>
          <Link href="/conoce-e-nora" aria-current={active === "platform" ? "page" : undefined}>Conoce E-NORA</Link>
          <Link href="/login" aria-current={active === "login" ? "page" : undefined}>Iniciar sesión</Link>
        </nav>
      </header>
      {children}
      <footer className={styles.footer}>
        <span>E-NORA · Tu negocio, con perspectiva.</span>
        <LegalFooterLinks />
      </footer>
    </div>
  );
}
