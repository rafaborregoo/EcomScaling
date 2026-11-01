"use client";

import type { ReactNode } from "react";
import { Link as HeroLink } from "@heroui/react";
import NextLink from "next/link";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "./button";

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
  variant = "default",
  size = "default",
  className,
  target,
  rel,
  download,
  onClick,
  "aria-label": ariaLabel,
}: {
  href: string;
  children?: ReactNode;
  // Mismo vocabulario que Button (variant × size). Es un enlace de verdad
  // (next/link) con las clases del botón, como pide shadcn: nada de
  // role="button" sobre un <a>.
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
  // Los call sites lo usan para efectos secundarios (invalidar cache al
  // cambiar de cliente) sin leer el evento.
  onClick?: () => void;
  "aria-label"?: string;
}) {
  return (
    <NextLink
      href={href}
      target={target}
      rel={rel}
      download={download === true ? "" : download || undefined}
      onClick={onClick ? () => onClick() : undefined}
      aria-label={ariaLabel}
      className={buttonVariants({ variant, size, className })}
    >
      {children}
    </NextLink>
  );
}
