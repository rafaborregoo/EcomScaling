import type { ReactNode } from "react";
import s from "./trabajo-ui.module.css";
import { buttonVariants } from "@/components/ui/button";

export type StripItem = {
  value: ReactNode;
  label: string;
  tone?: "bad" | "warn" | "good";
  /** Línea pequeña bajo la etiqueta (contexto de la cifra). */
  hint?: string;
  /** Valor de texto (nombre de hito, fecha) en vez de cifra. */
  text?: boolean;
};

/** Franja de estado de arriba de cada página de Trabajo: 3-5 cifras. */
export function StatusStrip({ items }: { items: StripItem[] }) {
  return (
    <section className={s.strip} aria-label="Estado del trabajo">
      {items.map((item) => (
        <div key={item.label} className={item.tone ? s[item.tone] : undefined}>
          <b className={item.text ? s.text : undefined}>{item.value}</b>
          <span>{item.label}</span>
          {item.hint ? <span className={s.hint}>{item.hint}</span> : null}
        </div>
      ))}
    </section>
  );
}

/** Bloque destacado: lo único que hay que hacer ahora en esa página. */
export function HeroBlock({
  label,
  title,
  children,
  actions,
  tone,
}: {
  label: string;
  title: ReactNode;
  children?: ReactNode;
  /** Botones/enlaces con className={heroPrimary} o {heroSecondary} (el botón único). */
  actions?: ReactNode;
  /** Con color: "next" en ámbar para lo siguiente, "late" en rojo si va tarde. */
  tone?: "next" | "late";
}) {
  return (
    <section className={[s.hero, tone === "next" && s.heroNext, tone === "late" && s.heroLate].filter(Boolean).join(" ")}>
      <h2>{title}</h2>
      <p className={s.heroLabel}>{label}</p>
      {children ? <div className={s.heroBody}>{children}</div> : null}
      {actions ? <div className={s.heroActs}>{actions}</div> : null}
    </section>
  );
}

/** Clase para el botón principal dentro de HeroBlock. */
export const heroPrimary = buttonVariants();
export const heroSecondary = buttonVariants({ variant: "secondary" });

export function WorkPageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return <header className={`${s.pageHeader} client-sr-title`}><h1>{title}</h1>{children ? <p>{children}</p> : null}</header>;
}
