"use client";

export function LoadingBlock({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="border-t border-edge pt-5">
      <p className="animate-pulse text-sm text-muted">{label}</p>
    </div>
  );
}
