"use client";

import type { ComponentProps } from "react";
import { cn } from "./cn";

// Aviso único de la app con la API de shadcn: Alert > icono + AlertTitle +
// AlertDescription + AlertAction. Es un <div> nativo; los estilos viven en
// globals.css (`.ui-alert`, dentro de @layer components) para que cualquier
// utilidad de Tailwind en `className` gane. Banner y ErrorBlock son atajos
// sobre este componente, así que todos los avisos se ven igual.
//
// Cada variante tiene un uso:
// - default: información o contexto que conviene saber (sin urgencia).
// - success: confirma que algo ha salido bien.
// - warning: algo limita lo que ves o puedes hacer; suele decir cómo resolverlo.
// - destructive: algo ha fallado o se va a perder; interrumpe al lector de pantalla.

export type AlertVariant = "default" | "success" | "warning" | "destructive";

export function Alert({
  variant = "default",
  className,
  role,
  ...props
}: ComponentProps<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      // Casi siempre aparece por algo que acaba de pasar: sin región viva, el
      // lector de pantalla no lo anunciaba. `alert` interrumpe; `status` espera.
      role={role ?? (variant === "destructive" ? "alert" : "status")}
      className={cn("ui-alert", `ui-alert--${variant}`, className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("ui-alert__title", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("ui-alert__description", className)} {...props} />;
}

/** Botón o enlace del aviso: va a la derecha del texto y baja debajo en pantallas estrechas. */
export function AlertAction({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-action" className={cn("ui-alert__action", className)} {...props} />;
}
