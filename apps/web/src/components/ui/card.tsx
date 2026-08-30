"use client";

import type { ReactNode } from "react";
import { Card as HeroCard } from "@heroui/react";
import { cn } from "./cn";
import { EYEBROW } from "./typography";

// Card nativo de HeroUI v3 (variant `default`: superficie + shadow-surface, sin
// borde, padding y gap propios). Este wrapper solo aporta el layout de la
// cabecera (titulo/kicker/descripcion a la izquierda, acciones a la derecha).
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
    <HeroCard className={cn("w-full", className)}>
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
