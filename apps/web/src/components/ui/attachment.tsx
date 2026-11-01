"use client";

import { cloneElement, isValidElement, type ComponentProps, type ReactElement } from "react";
import { Button } from "./button";
import { cn } from "./cn";

// Adjunto único de la app con la API de shadcn: un archivo o una imagen con su
// miniatura, nombre, datos y acciones. Lo usan los adjuntos de Mensajes, el
// banco de imágenes y los selectores de imagen del estudio. Estilos en
// globals.css (`.ui-attachment`, @layer components).
//
// Attachment
// ├── AttachmentMedia        icono o <img>
// ├── AttachmentContent
// │   ├── AttachmentTitle    brilla mientras sube o se procesa
// │   └── AttachmentDescription
// ├── AttachmentActions
// │   └── AttachmentAction   botón (icon-xs por defecto); queda por encima del trigger
// └── AttachmentTrigger      toda la tarjeta abre un enlace o un diálogo

export type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done";
export type AttachmentSize = "default" | "sm" | "xs";

export function Attachment({
  state = "done",
  size = "default",
  orientation = "horizontal",
  className,
  ...props
}: ComponentProps<"div"> & {
  state?: AttachmentState;
  size?: AttachmentSize;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      data-slot="attachment"
      data-state={state}
      data-size={size}
      data-orientation={orientation}
      aria-busy={state === "uploading" || state === "processing" || undefined}
      className={cn("ui-attachment", className)}
      {...props}
    />
  );
}

export function AttachmentMedia({
  variant = "icon",
  className,
  ...props
}: ComponentProps<"div"> & { variant?: "icon" | "image" }) {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn("ui-attachment__media", className)}
      {...props}
    />
  );
}

export function AttachmentContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="attachment-content" className={cn("ui-attachment__content", className)} {...props} />;
}

export function AttachmentTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="attachment-title" className={cn("ui-attachment__title", className)} {...props} />;
}

export function AttachmentDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="attachment-description" className={cn("ui-attachment__description", className)} {...props} />;
}

export function AttachmentActions({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="attachment-actions" className={cn("ui-attachment__actions", className)} {...props} />;
}

export function AttachmentAction({
  size = "icon-xs",
  variant = "ghost",
  ...props
}: ComponentProps<typeof Button>) {
  return <Button data-slot="attachment-action" size={size} variant={variant} {...props} />;
}

type TriggerProps = ComponentProps<"button">;

/**
 * Capa que cubre la tarjeta. Con `render` se pinta otro elemento (un enlace,
 * el disparador de un diálogo) con sus props fusionadas.
 */
export function AttachmentTrigger({
  render,
  className,
  ...props
}: TriggerProps & {
  render?: ReactElement<Record<string, unknown>> | ((props: TriggerProps) => ReactElement);
}) {
  const merged = { "data-slot": "attachment-trigger", ...props, className: cn("ui-attachment__trigger", className) };
  if (typeof render === "function") return render(merged);
  if (isValidElement(render)) {
    const own = render.props as { className?: string };
    return cloneElement(render, { ...merged, ...render.props, className: cn(merged.className, own.className) });
  }
  return <button type="button" {...merged} />;
}

/** Fila con scroll horizontal, que encaja cada adjunto y difumina los bordes. */
export function AttachmentGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="attachment-group" className={cn("ui-attachment-group", className)} {...props} />;
}
