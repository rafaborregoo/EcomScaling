"use client";

import type { TextareaHTMLAttributes } from "react";
import { cn } from "./cn.js";
import { fieldClass } from "./field-style.js";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldClass, "border border-edge-strong px-3 py-2 focus:border-ink", className)}
      {...props}
    />
  );
}
