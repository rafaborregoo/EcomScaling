"use client";

import type { ReactNode } from "react";
import { cn } from "./cn.js";

// Banner de regla lateral (sin caja rellena, sin sombra).
const bannerTones: Record<"success" | "warn" | "danger", string> = {
  success: "border-success text-success",
  warn: "border-warn text-warn-deep",
  danger: "border-brand text-brand-deep",
};

export function Banner({
  tone = "danger",
  className,
  children,
}: {
  tone?: "success" | "warn" | "danger";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("border-l-2 py-0.5 pl-3 text-sm leading-6", bannerTones[tone], className)} role="status">
      {children}
    </div>
  );
}
