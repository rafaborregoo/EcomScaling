"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { IconChevronDown } from "./icons";

// Caja plegable con título y flecha, sobre Collapsible. El disparador es
// discreto a propósito: borde mínimo, no una tarjeta destacada.
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("ui-collapsible-section", className)}>
      <CollapsibleTrigger>
        {title}
        <IconChevronDown aria-hidden className="ui-collapsible__chevron size-3.5" />
      </CollapsibleTrigger>
      <CollapsibleContent className="ui-collapsible-section__body">{children}</CollapsibleContent>
    </Collapsible>
  );
}
