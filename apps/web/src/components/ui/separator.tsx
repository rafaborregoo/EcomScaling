import type { ComponentProps } from "react";
import { cn } from "./cn";

// Línea que separa con la API de shadcn: <Separator /> o <Separator
// orientation="vertical" />. Nativo, sin Base UI: un div con role="separator"
// de 1 px en el gris de las líneas de la app (--separator). Horizontal ocupa
// todo el ancho; vertical se estira al alto de la fila (dale `h-5` y
// `self-center` si la fila es más alta que lo que separa). Es el primitivo de
// ItemSeparator y ButtonGroupSeparator. Estilos: `.ui-separator` en globals.css.

export function Separator({
  orientation = "horizontal",
  className,
  ...props
}: ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation === "vertical" ? "vertical" : undefined}
      data-slot="separator"
      data-orientation={orientation}
      className={cn("ui-separator", className)}
      {...props}
    />
  );
}
