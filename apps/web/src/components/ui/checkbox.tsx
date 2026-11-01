"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { useFieldControl } from "./field";

// Casilla única de la app con la API de shadcn: `checked` + `onCheckedChange`
// (o `defaultChecked` sin controlar), `disabled`, `aria-invalid` e
// `indeterminate` para el «seleccionar todo» a medias. Es un
// <input type="checkbox"> nativo (teclado, formularios y lector de pantalla
// gratis) pintado en globals.css (`.ui-checkbox`, @layer components).
//
// Con `children` se envuelve en un <label> con el texto al lado (el atajo de
// Field orientation="horizontal" + FieldLabel de shadcn); `className` va
// entonces a la etiqueta. Sin texto visible, pásale `aria-label`.
export function Checkbox({
  onCheckedChange,
  onChange,
  indeterminate = false,
  children,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type" | "children"> & {
  onCheckedChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  children?: ReactNode;
}) {
  // En un Field horizontal (con FieldLabel al lado) toma su id; con texto propio no.
  const field = useFieldControl(props).props;
  const input = (
    <input
      type="checkbox"
      data-slot="checkbox"
      ref={(node) => {
        if (node) node.indeterminate = indeterminate;
      }}
      className={cn("ui-checkbox", !children && className)}
      onChange={(event) => {
        onChange?.(event);
        onCheckedChange?.(event.target.checked);
      }}
      {...props}
      {...(children ? {} : field)}
    />
  );
  if (!children) return input;
  return (
    <label data-slot="checkbox-field" className={cn("ui-checkbox-field", className)}>
      {input}
      <span className="ui-checkbox-field__label">{children}</span>
    </label>
  );
}
