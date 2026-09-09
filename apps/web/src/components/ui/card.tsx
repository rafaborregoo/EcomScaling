"use client";

import type { ReactNode } from "react";
import { Card as HeroCard } from "@heroui/react";
import { cn } from "./cn";
import { EYEBROW } from "./typography";

// Card nativo de HeroUI v3 (variant `default`: superficie + shadow-surface, sin
// borde, padding y gap propios). Este wrapper aporta el layout de la cabecera
// (titulo/kicker/descripcion a la izquierda, acciones a la derecha) y el borde
// fino por defecto. El tamaño del titulo se fija en globals.css via
// [data-slot="card-title"].
export function Card({
  title,
  kicker,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  kicker?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  // Ancla de la seccion. Los hallazgos de los agentes enlazan al bloque de
  // datos que los prueba, y ese bloque casi siempre es una Card.
  id?: string;
}) {
  // `cn` es un join simple, no tailwind-merge: si el caller ya pinta su propio
  // color de borde (border-accent, border-warn...) no añadimos el por defecto,
  // porque las dos utilidades competirian por orden de hoja de estilos.
  const hasOwnBorder = /\bborder-[a-z]/.test(className ?? "");

  return (
    <HeroCard
      id={id}
      className={cn("w-full", !hasOwnBorder && "border border-edge", className)}
    >
      {title || kicker || actions ? (
        <HeroCard.Header className="flex flex-row flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <div>
            {kicker ? <p className={EYEBROW}>{kicker}</p> : null}
            {title ? <HeroCard.Title>{title}</HeroCard.Title> : null}
            {description ? (
              <HeroCard.Description>{description}</HeroCard.Description>
            ) : null}
          </div>
          {actions}
        </HeroCard.Header>
      ) : null}
      <HeroCard.Content>{children}</HeroCard.Content>
    </HeroCard>
  );
}

export const Section = Card;
