"use client";

import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

// HeroUI v3 Select es un compound component (Trigger/Popover/ListBox.Item)
// que exige reescribir cada <option> como ListBox.Item -- fuera de alcance
// de este pase (ver plan de migracion HeroUI, "fuera de alcance"). Se
// mantiene el <select> nativo, estilado con los mismos tokens que Input.
const fieldClass =
  "w-full rounded-none border-0 border-b border-edge-strong bg-transparent px-0 py-2 text-sm outline-none transition-colors focus:border-ink disabled:opacity-50";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "cursor-pointer", className)} {...props} />;
}
