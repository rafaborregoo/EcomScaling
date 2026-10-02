import type { ReactNode } from "react";
import s from "./trabajo-ui.module.css";

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
    <section className={s.strip}>
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
}: {
  label: string;
  title: ReactNode;
  children?: ReactNode;
  /** Botones/enlaces; el que lleve className={heroPrimary} va en acento. */
  actions?: ReactNode;
}) {
  return (
    <section className={s.hero}>
      <span className={s.heroLabel}>{label}</span>
      <h2>{title}</h2>
      {children ? <div className={s.heroBody}>{children}</div> : null}
      {actions ? <div className={s.heroActs}>{actions}</div> : null}
    </section>
  );
}

/** Clase para el botón principal dentro de HeroBlock. */
export const heroPrimary = s.primary;
