"use client";

import type { ReactNode } from "react";
import { cn } from "./cn.js";

// Tabs: navegacion horizontal dentro de una pagina densa, para partirla en
// vistas mas claras en vez de scroll infinito. Mismo lenguaje que el
// selector de periodo ya usado en dashboard/shopify (subrayado + negro).
export type TabItem = { value: string; label: string; icon?: ReactNode };

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("mt-4 flex flex-wrap gap-6 border-b border-line", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex items-center gap-2 border-b-2 pb-3 text-sm transition-colors",
              active ? "border-brand font-medium text-black" : "border-transparent text-muted hover:text-black",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
