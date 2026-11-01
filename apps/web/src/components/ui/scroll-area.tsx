import type { ComponentProps } from "react";
import { cn } from "./cn";

// Zona con desplazamiento propio con la API de shadcn: <ScrollArea
// className="h-72">. Nativa, sin Base UI: un div con overflow y la barra fina
// del gris del logo (scrollbar-width/scrollbar-color, y ::-webkit-scrollbar
// para Safari). Sirve en los dos ejes, así que no hace falta <ScrollBar
// orientation="horizontal">: si el contenido es más ancho, desliza. El color
// lo hereda también cualquier overflow de la app (--scrollbar-thumb en :root).
// Estilos: `.ui-scroll-area` en globals.css.

export function ScrollArea({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="scroll-area" className={cn("ui-scroll-area", className)} {...props} />;
}
