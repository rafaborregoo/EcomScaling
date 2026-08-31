"use client";

import { Spinner } from "@heroui/react";

export function LoadingBlock({ label = "Cargando..." }: { label?: string }) {
  return (
    <div
      className="flex items-center gap-2 border-t border-separator pt-5"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Spinner
        size="sm"
        color="current"
        className="text-muted"
        aria-hidden="true"
      />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
