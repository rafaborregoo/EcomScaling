"use client";

import type { ReactNode } from "react";
import { cn } from "./cn.js";
import type { Tone } from "./tone.js";

// Badge de punto: sin caja rellena, solo un punto de color + texto mono.
const badgeDot: Record<Tone, string> = {
  neutral: "bg-edge-strong",
  brand: "bg-brand",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-brand",
};

const badgeText: Record<Tone, string> = {
  neutral: "text-muted",
  brand: "text-brand",
  success: "text-success",
  warn: "text-warn-deep",
  danger: "text-brand-deep",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide",
        badgeText[tone],
        className,
      )}
    >
      <span aria-hidden className={cn("inline-block size-1.5 rounded-full", badgeDot[tone])} />
      {children}
    </span>
  );
}
