import { cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";

// Marca en una conversación con la API de shadcn: Marker > MarkerIcon +
// MarkerContent. `default` es una nota en línea («Recuperando conversación…»,
// un paso de herramienta), `border` la misma nota con línea debajo y
// `separator` un rótulo centrado entre dos líneas («Hoy»). Sin rol por
// defecto: lo que está en curso lleva `role="status"`; un separador con texto
// no lleva `role="separator"` (se perdería el texto). Con `render` es un
// <a> o <button>. Estilos: `.ui-marker` en globals.css.

export type MarkerVariant = "default" | "border" | "separator";

export function Marker({
  variant = "default",
  render,
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  variant?: MarkerVariant;
  /** El elemento de la marca: <a href>, <button>… Sus hijos valen si Marker no trae. */
  render?: ReactElement;
}) {
  const base = { "data-slot": "marker", "data-variant": variant, ...props };
  if (render && isValidElement(render)) {
    const own = render.props as { className?: string; children?: ReactNode };
    return cloneElement(render as ReactElement<Record<string, unknown>>, {
      ...base,
      className: cn("ui-marker", own.className, className),
      children: children ?? own.children,
    });
  }
  return (
    <div {...base} className={cn("ui-marker", className)}>
      {children}
    </div>
  );
}

/** Icono decorativo: el sentido lo lleva MarkerContent. */
export function MarkerIcon({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="marker-icon" aria-hidden className={cn("ui-marker__icon", className)} {...props} />;
}

export function MarkerContent({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="marker-content" className={cn("ui-marker__content", className)} {...props} />;
}
