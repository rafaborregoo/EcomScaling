"use client";

import type { ReactNode } from "react";
import { Label } from "@heroui/react";
import { cn } from "./cn";
import { EYEBROW } from "./typography";

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Label className="block">
      <span className={cn("block", EYEBROW)}>{label}</span>
      {children}
    </Label>
  );
}
