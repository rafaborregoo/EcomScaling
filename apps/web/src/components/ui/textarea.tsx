"use client";

import type { TextareaHTMLAttributes } from "react";
import { TextArea as HeroTextArea } from "@heroui/react";
import { cn } from "./cn";
import { useFieldControl } from "./field";

// TextArea nativa de HeroUI v3; el wrapper fija el ancho y, dentro de un
// Field, toma su id, ayuda y error.
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useFieldControl(props).props;
  return <HeroTextArea className={cn("w-full", className)} {...props} {...field} />;
}
