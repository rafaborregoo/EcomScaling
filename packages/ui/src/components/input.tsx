"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "./cn.js";
import { fieldClass } from "./field-style.js";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}
