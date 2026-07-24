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
  className,
  title,
  children,
}: {
  tone?: Tone;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <Chip variant="soft" color={colorMap[tone]} size="sm" className={className} title={title}>
      {children}
    </Chip>
  );
}
