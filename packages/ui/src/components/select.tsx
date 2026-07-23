"use client";

import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn.js";
import { fieldClass } from "./field-style.js";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "cursor-pointer", className)} {...props} />;
}
