"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";

// Tarjeta que se asoma al pasar el ratón (o llegar con el teclado) por un
// enlace o un chip, con la API de shadcn: HoverCard > HoverCardTrigger (delay,
// closeDelay, render) + HoverCardContent (side, align, sideOffset,
// alignOffset). Nativo: un `popover="manual"` en la capa superior, así no lo
// recorta ningún overflow ni cierra otros menús abiertos. En táctil no se
// abre: lo que enseña es un adelanto y tiene que estar también detrás del
// enlace o del botón. Para un texto corto, `title`; para algo que se pulsa y
// se queda, Popover. Estilos: `.ui-hover-card` en globals.css.

export type Side = "top" | "bottom" | "left" | "right";

type HoverCardContextValue = {
  open: boolean;
  trigger: HTMLElement | null;
  setTrigger: (node: HTMLElement | null) => void;
  contentId: string;
  /** Abre o cierra tras la espera del trigger; `now` sin espera. */
  schedule: (next: boolean, now?: boolean) => void;
  cancel: () => void;
  delaysRef: { current: { open: number; close: number } };
};

const HoverCardContext = createContext<HoverCardContextValue | null>(null);

function useHoverCard(name: string) {
  const context = useContext(HoverCardContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <HoverCard>`);
  return context;
}

export function HoverCard({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const delaysRef = useRef({ open: 400, close: 200 });
  const open = controlledOpen ?? uncontrolledOpen;
  const contentId = useId();

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const cancel = () => window.clearTimeout(timer.current);
  const schedule = (next: boolean, now = false) => {
    cancel();
    if (now) setOpen(next);
    else timer.current = window.setTimeout(() => setOpen(next), next ? delaysRef.current.open : delaysRef.current.close);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <HoverCardContext.Provider value={{ open, trigger, setTrigger, contentId, schedule, cancel, delaysRef }}>
      {children}
    </HoverCardContext.Provider>
  );
}

type TriggerHandlers = {
  onPointerEnter?: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: PointerEvent<HTMLElement>) => void;
  onFocus?: (event: FocusEvent<HTMLElement>) => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
};

/**
 * Con `render` (un Link, un Button, un chip) le pasa el hover y el foco sin
 * tocar su clic; sin él, un <span>. `delay` y `closeDelay` en milisegundos.
 */
export function HoverCardTrigger({
  delay = 400,
  closeDelay = 200,
  render,
  className,
  children,
}: {
  delay?: number;
  closeDelay?: number;
  render?: ReactElement;
  className?: string;
  children?: ReactNode;
}) {
  const card = useHoverCard("HoverCardTrigger");
  const { delaysRef } = card;
  useEffect(() => {
    delaysRef.current = { open: delay, close: closeDelay };
  }, [delaysRef, delay, closeDelay]);

  const own = (isValidElement(render) ? render.props : {}) as TriggerHandlers & { className?: string; children?: ReactNode };
  const props = {
    ref: card.setTrigger,
    "data-slot": "hover-card-trigger",
    "data-state": card.open ? "open" : "closed",
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      own.onPointerEnter?.(event);
      if (event.pointerType !== "touch") card.schedule(true);
    },
    onPointerLeave: (event: PointerEvent<HTMLElement>) => {
      own.onPointerLeave?.(event);
      if (event.pointerType !== "touch") card.schedule(false);
    },
    // Solo el foco de teclado: el de un clic con ratón ya lo cubre el hover.
    onFocus: (event: FocusEvent<HTMLElement>) => {
      own.onFocus?.(event);
      if (event.currentTarget.matches(":focus-visible")) card.schedule(true);
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      own.onBlur?.(event);
      card.schedule(false);
    },
  };
  if (render && isValidElement(render)) {
    return cloneElement(render as ReactElement<Record<string, unknown>>, {
      ...props,
      className: cn(own.className, className),
      children: children ?? own.children,
    });
  }
  return <span {...props} className={className}>{children}</span>;
}

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };
const MARGIN = 8;

/** Coloca la tarjeta junto a su trigger; si no cabe en ese lado y sí en el contrario, se da la vuelta. */
export function place(node: HTMLElement, anchor: DOMRect, side: Side, align: "start" | "center" | "end", sideOffset: number, alignOffset: number) {
  const { width, height } = node.getBoundingClientRect();
  const fits: Record<Side, boolean> = {
    top: anchor.top - sideOffset - height >= MARGIN,
    bottom: anchor.bottom + sideOffset + height <= window.innerHeight - MARGIN,
    left: anchor.left - sideOffset - width >= MARGIN,
    right: anchor.right + sideOffset + width <= window.innerWidth - MARGIN,
  };
  const actual = fits[side] || !fits[OPPOSITE[side]] ? side : OPPOSITE[side];
  const along = (start: number, size: number, length: number) =>
    align === "start" ? start + alignOffset : align === "end" ? start + size - length - alignOffset : start + (size - length) / 2;
  const vertical = actual === "top" || actual === "bottom";
  const left = vertical ? along(anchor.left, anchor.width, width) : actual === "left" ? anchor.left - sideOffset - width : anchor.right + sideOffset;
  const top = vertical ? (actual === "top" ? anchor.top - sideOffset - height : anchor.bottom + sideOffset) : along(anchor.top, anchor.height, height);
  node.style.left = `${Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))}px`;
  node.style.top = `${Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN))}px`;
  node.dataset.side = actual;
}

export function HoverCardContent({
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "popover"> & {
  side?: Side;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
}) {
  const card = useHoverCard("HoverCardContent");
  const ref = useRef<HTMLDivElement>(null);
  const { open, trigger, schedule } = card;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!open) {
      if (node.matches(":popover-open")) node.hidePopover();
      return;
    }
    if (!node.matches(":popover-open")) node.showPopover();
    const anchor = trigger?.getBoundingClientRect();
    if (anchor) place(node, anchor, side, align, sideOffset, alignOffset);
    // Al desplazar la página se quedaría flotando lejos de su trigger.
    const close = () => schedule(false, true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
    // schedule cambia en cada render del padre; abrir/cerrar depende de `open`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trigger, side, align, sideOffset, alignOffset]);

  return (
    <div
      ref={ref}
      id={card.contentId}
      popover="manual"
      data-slot="hover-card-content"
      data-state={open ? "open" : "closed"}
      className={cn("ui-hover-card", className)}
      // Pasar del trigger a la tarjeta (o tabular dentro) la mantiene abierta.
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") card.cancel();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") schedule(false);
      }}
      onFocus={card.cancel}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) schedule(false);
      }}
      {...props}
    >
      {open ? children : null}
    </div>
  );
}
