"use client";

import type { ReactNode } from "react";
import { Link as HeroLink } from "@heroui/react";
import { cn } from "./cn";

// Link real de HeroUI (React Aria). Navega client-side gracias al
// AriaRouterProvider montado en el layout raiz (le pasa el router.push de
// Next.js) -- sin eso, el Link de React Aria haria recarga completa de
// pagina en cada click. React Aria no acepta onClick (solo onPress, igual
// que Button, ver button.tsx) -- los call sites actuales solo usan onClick
// para efectos secundarios sin leer el evento, asi que traducir sin
// reenviarlo es seguro.
export function Link({
  href,
  children,
  className,
  target,
  rel,
  onClick,
  "aria-current": ariaCurrent,
  "aria-label": ariaLabel,
}: {
  href: string;
  children?: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  "aria-current"?: "page" | boolean;
  // Cuando el texto se repite en una lista ("Ver y configurar" en cada
  // tarjeta), la lista de enlaces del lector de pantalla es ilegible sin un
  // nombre que diga de que tarjeta es cada uno.
  "aria-label"?: string;
}) {
  return (
    <HeroLink
      href={href}
      target={target}
      rel={rel}
      onPress={onClick}
      className={className}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
    >
      {children}
    </HeroLink>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
  target,
  rel,
  download,
}: {
  href: string;
  children?: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
}) {
  return (
    <HeroLink
      href={href}
      target={target}
      rel={rel}
      download={download}
      className={cn(
        "inline-flex min-h-9 w-fit items-center rounded-md border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2",
        variant === "primary"
          ? "border-accent bg-accent text-accent-foreground hover:bg-accent-hover"
          : "border-separator bg-surface text-foreground hover:border-accent hover:text-accent",
        className,
      )}
    >
      {children}
    </HeroLink>
  );
}
