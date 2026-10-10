"use client";

import type { ReactNode } from "react";

/**
 * Fila de ajuste de Configuración: a la izquierda qué es y para qué sirve, a la
 * derecha el control. En móvil se apila. Las filas van una debajo de otra
 * dentro de una Card y se separan con una línea fina.
 */
export function SettingRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** id del control, para que pulsar la etiqueta lo enfoque. */
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 border-t border-separator py-4 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center md:gap-8">
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium text-foreground">{label}</p>
        )}
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
