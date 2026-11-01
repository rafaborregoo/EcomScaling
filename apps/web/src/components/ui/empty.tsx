"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

// Vacío único de la app con la API de shadcn: Empty > EmptyHeader (EmptyMedia +
// EmptyTitle + EmptyDescription) + EmptyContent. Son <div> nativos; los estilos
// viven en globals.css (`.ui-empty`, dentro de @layer components) para que
// cualquier utilidad de Tailwind en `className` gane (p. ej. `border
// border-dashed` para la variante con contorno). EmptyState es el atajo que usa
// casi toda la app.
//
// Dos tamaños, como Card:
// - default: la sección o la página entera no tiene nada (título grande).
// - sm: la lista de dentro de una tarjeta está vacía (una línea gris centrada).

export function Empty({
  size = "default",
  className,
  ...props
}: ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return <div data-slot="empty" data-size={size} className={cn("ui-empty", className)} {...props} />;
}

export function EmptyHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="empty-header" className={cn("ui-empty__header", className)} {...props} />;
}

/** Icono (variant="icon": en un cuadro gris) o cualquier otra pieza, como un Avatar. */
export function EmptyMedia({
  variant = "default",
  className,
  ...props
}: ComponentProps<"div"> & { variant?: "default" | "icon" }) {
  return <div data-slot="empty-icon" data-variant={variant} className={cn("ui-empty__media", className)} {...props} />;
}

export function EmptyTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="empty-title" className={cn("ui-empty__title", className)} {...props} />;
}

export function EmptyDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="empty-description" className={cn("ui-empty__description", className)} {...props} />;
}

/** Botones, enlaces o un buscador para salir del vacío. */
export function EmptyContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="empty-content" className={cn("ui-empty__content", className)} {...props} />;
}

export function EmptyState({
  title,
  hint,
  action,
  icon,
  size,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <Empty size={size} className={className}>
      <EmptyHeader>
        {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        {hint ? <EmptyDescription>{hint}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent className="flex-row flex-wrap justify-center gap-2">{action}</EmptyContent> : null}
    </Empty>
  );
}
