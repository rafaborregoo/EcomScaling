"use client";

import type { ReactNode } from "react";
import { Typography } from "@heroui/react";
import { cn } from "./cn";

// Titulo de seccion sobre el Typography.Heading real de HeroUI, con el
// tamano/peso "font-display" ya validado (Libro Mayor v2) en vez del tamano
// por defecto de HeroUI, para no cambiar la jerarquia visual ya establecida.
const SIZE_CLASS: Record<"lg" | "md", string> = {
  lg: "font-display text-2xl",
  md: "font-display text-xl",
};

export function Heading({
  level = 2,
  size = "lg",
  className,
  id,
  children,
}: {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  size?: "lg" | "md";
  className?: string;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <Typography.Heading level={level} id={id} className={cn(SIZE_CLASS[size], className)}>
      {children}
    </Typography.Heading>
  );
}
