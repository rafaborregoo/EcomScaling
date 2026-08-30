"use client";

import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "./cn";

// Lista de presentacion: filas separadas por una linea fina. HeroUI v3 no
// trae un componente de lista no interactiva (`ListBox` es para seleccion),
// asi que este wrapper centraliza el `divide-y divide-edge` que estaba
// repetido a mano en ~10 paginas. Para datos tabulares usar `Table`; para
// seleccion, `Select`/`Combobox`.
//
// Polimorfico: por defecto `<div role="list">` (la forma mas comun en el
// codigo y la que admite filas `<button>`/`<Link>` directas). Pasar
// `as="ul"` + `List.Item as="li"` cuando la semantica de lista importe.

type PolymorphicProps<T extends ElementType> = {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function List<T extends ElementType = "div">({
  as,
  bordered = false,
  className,
  ...props
}: PolymorphicProps<T> & { bordered?: boolean }) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      role={as === "ul" || as === "ol" ? undefined : "list"}
      className={cn(
        "divide-y divide-edge",
        bordered && "border-y border-edge",
        className,
      )}
      {...props}
    />
  );
}

// Marcador de fila: no impone padding ni layout (cada lista los suyos, y `cn`
// aqui no resuelve utilidades en conflicto). Solo normaliza el elemento.
function ListItem<T extends ElementType = "div">({
  as,
  className,
  ...props
}: PolymorphicProps<T>) {
  const Component = (as ?? "div") as ElementType;
  return <Component className={className} {...props} />;
}

List.Item = ListItem;
