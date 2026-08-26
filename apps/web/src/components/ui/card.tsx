"use client";

import type { ReactNode } from "react";
import { Card as HeroCard } from "@heroui/react";
import { cn } from "./cn";

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
    <HeroCard
      className={cn(
        "rounded-md border border-edge bg-white shadow-none",
        className,
      )}
    >
      {title || kicker || actions ? (
        <HeroCard.Header className="flex flex-row flex-wrap items-baseline justify-between gap-x-6 gap-y-3 p-4 sm:p-5">
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
      <HeroCard.Content className="px-4 pb-4 sm:px-5 sm:pb-5">
        {children}
      </HeroCard.Content>
    </HeroCard>
  );
}

export const Section = Card;
