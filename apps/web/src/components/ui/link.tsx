"use client";

import type { ReactNode } from "react";
import { Link as HeroLink } from "@heroui/react";

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
