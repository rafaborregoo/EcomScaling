"use client";

import type { TextareaHTMLAttributes } from "react";
import { TextArea as HeroTextArea } from "@heroui/react";
import { cn } from "./cn";

const fieldClass =
  "w-full rounded-none border border-edge-strong bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-ink focus:ring-0 focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-brand focus-visible:ring-0 disabled:opacity-50";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <HeroTextArea className={cn(fieldClass, className)} {...props} />;
}
