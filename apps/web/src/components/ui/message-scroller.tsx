"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "./cn";

// Scroll de un chat con la API de shadcn: MessageScroller > Viewport > Content
// (las filas) + MessageScrollerButton. Lo que importa: no mover al lector
// contra su voluntad.
// - Abre al final, o en la fila con `data-scroll-anchor` (el «Nuevo»).
// - Sigue lo que llega solo si el lector ya estaba al final; si ha subido a
//   leer, se queda donde está y el botón avisa de que hay mensajes nuevos.
// - `useMessageScroller().scrollToEnd()` para cuando el propio lector envía.
// Versión corta del de shadcn: sin anclar turnos ni streaming, que un chat
// entre personas no necesita. Estilos: `.ui-message-scroller` en globals.css.

const END_SLACK = 48;

type ScrollerState = {
  viewportRef: RefObject<HTMLDivElement | null>;
  atEnd: boolean;
  hasNew: boolean;
  scrollToEnd: (behavior?: ScrollBehavior) => void;
  setAtEnd: (atEnd: boolean) => void;
  setHasNew: (hasNew: boolean) => void;
};

const ScrollerContext = createContext<ScrollerState | null>(null);

export function useMessageScroller() {
  const context = useContext(ScrollerContext);
  if (!context) throw new Error("useMessageScroller va dentro de <MessageScroller>");
  return context;
}

export function MessageScroller({ className, children, ...props }: ComponentProps<"div">) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [hasNew, setHasNew] = useState(false);
  const scrollToEnd = useCallback((behavior: ScrollBehavior = "auto") => {
    const element = viewportRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);
  return (
    <ScrollerContext.Provider value={{ viewportRef, atEnd, hasNew, scrollToEnd, setAtEnd, setHasNew }}>
      <div data-slot="message-scroller" className={cn("ui-message-scroller", className)} {...props}>
        {children}
      </div>
    </ScrollerContext.Provider>
  );
}

export function MessageScrollerViewport({
  className,
  onScroll,
  children,
  ...props
}: ComponentProps<"div">) {
  const { viewportRef, setAtEnd, setHasNew } = useMessageScroller();
  // Lo que valía antes de que creciera el contenido: crecer no dispara scroll.
  const atEndRef = useRef(true);
  const anchored = useRef(false);

  useEffect(() => {
    const element = viewportRef.current;
    const content = element?.firstElementChild;
    if (!element || !content) return;
    const observer = new ResizeObserver(() => {
      const anchor = anchored.current ? null : content.querySelector<HTMLElement>("[data-scroll-anchor]");
      if (anchor) {
        anchored.current = true;
        // El viewport es `position: relative`: offsetTop ya se mide desde él.
        element.scrollTop = anchor.offsetTop - 16;
      } else if (atEndRef.current) {
        element.scrollTop = element.scrollHeight;
      } else {
        setHasNew(true);
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [viewportRef, setHasNew]);

  return (
    <div
      data-slot="message-scroller-viewport"
      ref={viewportRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        const atEnd = element.scrollHeight - element.scrollTop - element.clientHeight < END_SLACK;
        atEndRef.current = atEnd;
        setAtEnd(atEnd);
        if (atEnd) setHasNew(false);
        onScroll?.(event);
      }}
      className={cn("ui-message-scroller__viewport", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/** Las filas del chat. `role="log"`: el lector de pantalla anuncia lo que se añade. */
export function MessageScrollerContent({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="message-scroller-content" role="log" aria-relevant="additions" className={cn("ui-message-scroller__content", className)} {...props} />;
}

/** «Ir a lo último»: solo aparece si el lector no está al final. */
export function MessageScrollerButton({ className, ...props }: ComponentProps<"button">) {
  const { atEnd, hasNew, scrollToEnd } = useMessageScroller();
  return (
    <button
      type="button"
      data-slot="message-scroller-button"
      data-hidden={atEnd || undefined}
      tabIndex={atEnd ? -1 : undefined}
      aria-hidden={atEnd || undefined}
      onClick={() => scrollToEnd("smooth")}
      className={cn("ui-message-scroller__button", className)}
      {...props}
    >
      <ArrowDown aria-hidden />
      {hasNew ? "Mensajes nuevos" : "Ir a lo último"}
    </button>
  );
}
