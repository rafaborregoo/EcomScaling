"use client";

import type { ReactNode } from "react";
import { Field, FieldDescription, FieldLabel } from "./field";

/**
 * Fila de ajuste de Configuración: a la izquierda qué es y para qué sirve, a la
 * derecha el control. En móvil se apila. Las filas van una debajo de otra
 * dentro de una Card y se separan con una línea fina. Es un Field: la etiqueta
 * apunta sola al control y la ayuda queda enlazada como su descripción.
 */
export function SettingRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** id del control, si lleva uno propio. */
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <Field className="grid gap-2 border-t border-separator py-4 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center md:gap-8">
      <div className="min-w-0">
        <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
        {hint ? <FieldDescription className="mt-1">{hint}</FieldDescription> : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </Field>
  );
}
