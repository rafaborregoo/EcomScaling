"use client";

import type { ReactNode } from "react";
import { cn } from "./cn.js";

// Secciones planas: regla superior + kicker en small caps + titular. El
// kicker/title son opcionales a proposito -- una pantalla dentro de una
// navegacion clara no necesita repetir el nombre de la seccion (ver
// ADR-0013: titulos discretos, no titulos de seccion redundantes).
export function Card({
  title,
  kicker,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  kicker?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-ink/20 pt-5", className)}>
      {title || kicker || actions ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            {kicker ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{kicker}</p>
            ) : null}
            {title ? (
              <h2 className="font-display text-xl leading-snug">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={title || kicker || actions ? "mt-5" : undefined}>{children}</div>
    </section>
  );
}

// Alias semantico para nuevas paginas.
export const Section = Card;
