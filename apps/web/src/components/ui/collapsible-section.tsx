"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";
import { IconChevronDown } from "./icons";

// Bloque plegable con disparador nativo <details>/<summary>: sin estado, sin
// JS, accesible por teclado. El boton es discreto a proposito -- color de
// fondo y borde minimo, no una tarjeta destacada.
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
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-md border border-separator bg-background",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-foreground pointer-coarse:py-3 [&::-webkit-details-marker]:hidden">
        {title}
        <IconChevronDown
          aria-hidden
          className="size-3.5 text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-separator px-4 pb-4 pt-4">{children}</div>
    </details>
  );
}
