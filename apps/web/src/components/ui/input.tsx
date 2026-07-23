"use client";

import type { InputHTMLAttributes } from "react";
import { Input as HeroInput } from "@heroui/react";
import { cn } from "./cn";

const fieldClass =
  "w-full rounded-none border-0 border-b border-edge-strong bg-transparent px-0 py-2 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-ink disabled:opacity-50";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <HeroInput className={cn(fieldClass, className)} {...props} />;
}
