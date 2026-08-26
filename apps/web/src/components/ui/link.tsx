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
}: {
  href: string;
  children?: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  "aria-current"?: "page" | boolean;
}) {
  return (
    <HeroLink
      href={href}
      target={target}
      rel={rel}
      onPress={onClick}
      className={className}
      aria-current={ariaCurrent}
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
}: {
  href: string;
  children?: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <HeroLink
      href={href}
      className={cn(
        "inline-flex min-h-9 w-fit items-center border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2",
        variant === "primary"
          ? "border-brand bg-brand text-white hover:bg-brand-deep"
          : "border-edge bg-white text-ink hover:border-brand hover:text-brand",
        className,
      )}
    >
      {children}
    </HeroLink>
  );
}
