"use client";

import { cn } from "./cn.js";
import type { ReactNode } from "react";

// Cifras protagonistas.
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "success" | "danger";
  className?: string;
}) {
  return (
    <div className={cn("py-1", className)}>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-3xl tracking-tight",
          tone === "success" && "text-success",
          tone === "danger" && "text-brand",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 font-mono text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
