"use client";

import type { ReactNode } from "react";
import { EmptyState as HeroEmptyState } from "@heroui/react";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <HeroEmptyState className="border-t border-separator py-10 text-center">
      <p className="font-display text-2xl">{title}</p>
      {hint ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{hint}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </HeroEmptyState>
  );
}
