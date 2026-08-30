"use client";

import type { InputHTMLAttributes } from "react";
import { Input as HeroInput } from "@heroui/react";
import { cn } from "./cn";

// Input en caja, alineado con el Select y las Card (borde fino, radio
// --radius, fondo blanco). Antes era solo una linea inferior: quedaba
// desalineado junto a los Select y se leia como "sin terminar".
const fieldClass =
  "w-full rounded-md border border-edge bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/60 hover:border-edge-strong focus:border-brand focus:ring-0 focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-brand focus-visible:ring-0 disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <HeroInput className={cn(fieldClass, className)} {...props} />;
}
