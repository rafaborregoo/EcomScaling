"use client";

import type { ReactNode } from "react";
import { Chip } from "@heroui/react";

export type Tone = "neutral" | "brand" | "success" | "warn" | "danger";

const colorMap: Record<Tone, "default" | "accent" | "success" | "warning" | "danger"> = {
  neutral: "default",
  brand: "accent",
  success: "success",
  warn: "warning",
  danger: "danger",
};

export function Badge({
  tone = "neutral",
  variant = "soft",
  className,
  title,
  children,
}: {
  tone?: Tone;
  /**
   * `solid` para el estado principal de algo, donde el color tiene que leerse
   * de un vistazo desde el otro lado de la mesa (conectada / caída). `soft`
   * sigue siendo el defecto para etiquetas secundarias, que en bloque cansan.
   */
  variant?: "soft" | "solid";
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Chip
      // HeroUI llama "primary" a la version de color pleno.
      variant={variant === "solid" ? "primary" : "soft"}
      color={colorMap[tone]}
      size="sm"
      className={className}
      title={title}
    >
      {children}
    </Chip>
  );
}
