"use client";

import type { ReactNode } from "react";
import { Typography } from "@heroui/react";
import { cn } from "./cn";

// Titulo de seccion sobre el Typography.Heading real de HeroUI, con el
// tamano/peso "font-display" ya validado (Libro Mayor v2) en vez del tamano
// por defecto de HeroUI, para no cambiar la jerarquia visual ya establecida.
const SIZE_CLASS: Record<"lg" | "md", string> = {
  lg: "font-display",
  md: "font-display text-xl",
};

const LEVEL_CLASS: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "text-4xl leading-tight tracking-[-0.03em]",
  2: "text-3xl leading-tight tracking-[-0.025em]",
  3: "text-2xl leading-tight tracking-[-0.02em]",
  4: "text-xl leading-snug",
  5: "text-lg leading-snug",
  6: "text-base leading-normal",
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
    <Typography.Heading
      level={level}
      id={id}
      className={cn(SIZE_CLASS[size], size === "lg" && LEVEL_CLASS[level], className)}
    >
      {children}
    </Typography.Heading>
  );
}
