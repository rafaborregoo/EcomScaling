"use client";

import type { TextareaHTMLAttributes } from "react";
import { TextArea as HeroTextArea } from "@heroui/react";
import { cn } from "./cn";

// TextArea nativa de HeroUI v3; el wrapper solo fija el ancho.
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <HeroTextArea className={cn("w-full", className)} {...props} />;
}
