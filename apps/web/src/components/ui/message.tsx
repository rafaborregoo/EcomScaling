"use client";

import { createContext, useContext, type ComponentProps } from "react";
import type { BubbleAlign } from "./bubble";
import { cn } from "./cn";

// Fila de mensaje con la API de shadcn: Message > MessageAvatar +
// MessageContent (MessageHeader, Bubble, MessageFooter). Message pone la
// alineación (start = el otro, end = yo), el avatar y la cabecera/pie; la
// superficie es Bubble, que hereda `align` del Message. MessageGroup apila
// mensajes seguidos del mismo autor. Para notas de estado o «Hoy», Marker.
// Estilos: `.ui-message` en globals.css.

const MessageAlignContext = createContext<BubbleAlign | null>(null);

/** Alineación del Message que envuelve (null fuera de uno). */
export function useMessageAlign() {
  return useContext(MessageAlignContext);
}

export function Message({ align = "start", className, ...props }: ComponentProps<"div"> & { align?: BubbleAlign }) {
  return (
    <MessageAlignContext.Provider value={align}>
      <div data-slot="message" data-align={align} className={cn("ui-message", className)} {...props} />
    </MessageAlignContext.Provider>
  );
}

export function MessageGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="message-group" className={cn("ui-message-group", className)} {...props} />;
}

/** Hueco del avatar, abajo. Vacío en los mensajes anteriores de un grupo para que queden alineados. */
export function MessageAvatar({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="message-avatar" className={cn("ui-message__avatar", className)} {...props} />;
}

export function MessageContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="message-content" className={cn("ui-message__content", className)} {...props} />;
}

/** Encima del mensaje (autor); siempre al inicio. */
export function MessageHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="message-header" className={cn("ui-message__header", className)} {...props} />;
}

/** Debajo del mensaje (hora, «Visto», acciones); va del lado del mensaje. */
export function MessageFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="message-footer" className={cn("ui-message__footer", className)} {...props} />;
}
