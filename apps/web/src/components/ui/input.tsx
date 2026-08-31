"use client";

import type { InputHTMLAttributes } from "react";
import { Input as HeroInput } from "@heroui/react";
import { cn } from "./cn";

// Input nativo de HeroUI v3 (caja con borde, radio y foco propios). El wrapper
// solo fija el ancho; el resto lo pinta HeroUI con sus tokens de field.
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <HeroInput className={cn("w-full", className)} {...props} />;
}
