"use client";

import type { ReactNode } from "react";
import { cn } from "./cn";

// Contador sobre un icono o botón, al estilo del badge contador de shadcn:
// píldora con cifras tabulares, anillo del color del fondo para despegarla de
// lo que tapa y tope `max` (99+). Sin `count`, un punto. Morado de marca por
// defecto; `secondary` es el gris del logo. Estilos: `.ui-notification-badge`
// en globals.css.

type NotificationBadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive";
type NotificationPlacement = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export function NotificationBadge({
  children,
  count,
  max = 99,
  variant = "default",
  placement = "top-right",
  size = "default",
  className,
}: {
  children: ReactNode;
  /** Número (se corta en `max`) o texto corto. Sin valor: punto. 0 no se pinta. */
  count?: number | string;
  max?: number;
  variant?: NotificationBadgeVariant;
  placement?: NotificationPlacement;
  size?: "sm" | "default";
  className?: string;
}) {
  const dot = count == null;
  const label = typeof count === "number" && count > max ? `${max}+` : count;

  return (
    <span data-slot="notification-badge" className={cn("ui-notification-badge", className)}>
      {children}
      {count === 0 ? null : (
        <span
          // La key reinicia la animación al cambiar la cifra.
          key={String(label)}
          data-slot="notification-badge-count"
          data-variant={variant}
          data-placement={placement}
          data-size={size}
          data-dot={dot ? "" : undefined}
          aria-hidden={dot ? true : undefined}
          className="ui-notification-badge__count"
        >
          {label}
        </span>
      )}
    </span>
  );
}
