"use client";

import type { ComponentProps } from "react";
import { cn } from "./cn";

// Botón único de la app con la API de shadcn (variant × size). Es un <button>
// nativo; los estilos viven en globals.css (`.ui-btn`, dentro de
// @layer components) para que cualquier utilidad de Tailwind pasada en
// `className` gane sin necesitar tailwind-merge. Primario y secundario son el
// morado de E-NORA (--btn-primary*, --btn-secondary*), iguales en toda la app.
// Inventario y plan de la migración: docs/INVENTARIO_BOTONES.md.

export type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
export type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

/** Clases del botón para cualquier elemento: un enlace con aspecto de botón usa esto, no `<Button>`. */
export function buttonVariants({ variant = "default", size = "default", className }: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn("ui-btn", `ui-btn--${variant}`, size !== "default" && `ui-btn--${size}`, className);
}

export function Button({
  variant = "default",
  size = "default",
  className,
  type = "button",
  onClick,
  ...props
}: Omit<ComponentProps<"button">, "onClick"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Sin evento a propósito: el Button anterior (HeroUI, onPress) nunca lo
  // pasaba y hay call sites como onClick={regenerate} cuyo primer parámetro
  // no es un evento.
  onClick?: () => void;
}) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      type={type}
      className={buttonVariants({ variant, size, className })}
      onClick={onClick ? () => onClick() : undefined}
      {...props}
    />
  );
}
