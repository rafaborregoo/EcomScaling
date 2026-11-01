"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { Separator } from "./separator";

// Grupo de botones con la API de shadcn: los hijos van pegados (sin hueco,
// esquinas interiores rectas, un solo borde entre ellos). Es para acciones
// hermanas del mismo peso, normalmente `outline` (Anterior · Hoy · Siguiente,
// Archivar · Más). Una fila de acciones de distinto peso (Guardar + Cancelar)
// no es un grupo: va en un `flex gap-2`. Estilos: `.ui-button-group` en
// globals.css.

export type ButtonGroupOrientation = "horizontal" | "vertical";

const ButtonGroupContext = createContext<ButtonGroupOrientation>("horizontal");

export function ButtonGroup({
  orientation = "horizontal",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { orientation?: ButtonGroupOrientation }) {
  return (
    <ButtonGroupContext.Provider value={orientation}>
      <div
        role="group"
        data-slot="button-group"
        data-orientation={orientation}
        className={cn("ui-button-group", className)}
        {...props}
      />
    </ButtonGroupContext.Provider>
  );
}

export function ButtonGroupSeparator({
  orientation,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { orientation?: ButtonGroupOrientation }) {
  const groupOrientation = useContext(ButtonGroupContext);
  const resolvedOrientation = orientation ?? (groupOrientation === "horizontal" ? "vertical" : "horizontal");

  return (
    <Separator
      orientation={resolvedOrientation}
      data-slot="button-group-separator"
      className={cn("ui-button-group__separator", className)}
      {...props}
    />
  );
}

export function ButtonGroupText({
  render,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { render?: ReactElement; children?: ReactNode }) {
  const elementProps = {
    ...props,
    "data-slot": "button-group-text",
    className: cn("ui-button-group__text", className),
  };

  return render && isValidElement(render)
    ? cloneElement(render as ReactElement<Record<string, unknown>>, {
        ...elementProps,
        className: cn(elementProps.className, (render.props as { className?: string }).className),
        children,
      })
    : <span {...elementProps}>{children}</span>;
}
