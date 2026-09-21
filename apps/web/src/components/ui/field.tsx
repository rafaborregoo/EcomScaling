"use client";

import type { ReactNode } from "react";
import { Label } from "@heroui/react";

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </span>
      {children}
    </Label>
  );
}
