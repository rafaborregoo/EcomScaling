"use client";

import type { ReactNode } from "react";
import { Card as HeroCard } from "@heroui/react";

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
    <HeroCard className={className}>
      {title || kicker || actions ? (
        <HeroCard.Header className="flex flex-row flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            {kicker ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{kicker}</p>
            ) : null}
            {title ? <HeroCard.Title>{title}</HeroCard.Title> : null}
            {description ? <HeroCard.Description>{description}</HeroCard.Description> : null}
          </div>
          {actions}
        </HeroCard.Header>
      ) : null}
      <HeroCard.Content>{children}</HeroCard.Content>
    </HeroCard>
  );
}

export const Section = Card;
