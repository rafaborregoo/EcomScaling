"use client";

import type { InputHTMLAttributes } from "react";
import { Input as HeroInput } from "@heroui/react";
import { cn } from "./cn";
import { useFieldControl } from "./field";

// Input nativo de HeroUI v3 (caja con borde, radio y foco propios). El wrapper
// fija el ancho y, dentro de un Field, toma su id, ayuda y error.
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const field = useFieldControl(props).props;
  return <HeroInput className={cn("w-full", className)} {...props} {...field} />;
}
