"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { Separator } from "./separator";

// Fila de contenido con la API de shadcn: Item > ItemMedia + ItemContent
// (ItemTitle, ItemDescription) + ItemActions, y ItemHeader / ItemFooter a lo
// ancho. Es la fila de una lista (cliente, factura, conexión, aviso…), no un
// formulario: para un control con etiqueta, Field. Dentro de `List` va a ras
// con la línea fina entre filas; en `ItemGroup`, cada una por separado (con
// variant="outline" son cajas). Con `render` la fila entera es un Link, <a>,
// <button> o <li>. Estilos: `.ui-item` en globals.css.

export type ItemVariant = "default" | "outline" | "muted";
export type ItemSize = "default" | "sm" | "xs";

const ItemGroupContext = createContext(false);

export function ItemGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <ItemGroupContext.Provider value={true}>
      <div role="list" data-slot="item-group" className={cn("ui-item-group", className)} {...props} />
    </ItemGroupContext.Provider>
  );
}

export function ItemSeparator({ className, ...props }: ComponentProps<"div">) {
  return <Separator data-slot="item-separator" className={cn("ui-item-separator", className)} {...props} />;
}

export function Item({
  variant = "default",
  size = "default",
  render,
  className,
  children,
  ...props
}: ComponentProps<"div"> & {
  variant?: ItemVariant;
  size?: ItemSize;
  /** El elemento de la fila: <Link href>, <a>, <button>, <li>… Sus hijos valen si Item no trae. */
  render?: ReactElement;
}) {
  const inGroup = useContext(ItemGroupContext);
  const base = {
    "data-slot": "item",
    "data-variant": variant,
    "data-size": size,
    ...props,
  };
  if (render && isValidElement(render)) {
    const own = render.props as { className?: string; children?: ReactNode };
    return cloneElement(render as ReactElement<Record<string, unknown>>, {
      ...base,
      role: inGroup && render.type !== "li" ? "listitem" : undefined,
      className: cn("ui-item", own.className, className),
      children: children ?? own.children,
    });
  }
  return (
    <div role={inGroup ? "listitem" : undefined} {...base} className={cn("ui-item", className)}>
      {children}
    </div>
  );
}

export function ItemMedia({
  variant = "default",
  className,
  ...props
}: ComponentProps<"div"> & { variant?: "default" | "icon" | "image" }) {
  return <div data-slot="item-media" data-variant={variant} className={cn("ui-item__media", className)} {...props} />;
}

export function ItemContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="item-content" className={cn("ui-item__content", className)} {...props} />;
}

export function ItemTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="item-title" className={cn("ui-item__title", className)} {...props} />;
}

export function ItemDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="item-description" className={cn("ui-item__description", className)} {...props} />;
}

export function ItemActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="item-actions" className={cn("ui-item__actions", className)} {...props} />;
}

export function ItemHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="item-header" className={cn("ui-item__header", className)} {...props} />;
}

export function ItemFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="item-footer" className={cn("ui-item__footer", className)} {...props} />;
}
