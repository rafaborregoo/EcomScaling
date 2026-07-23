"use client";

import { Spinner } from "@heroui/react";

export function LoadingBlock({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-edge pt-5">
      <Spinner size="sm" color="current" className="text-muted" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
