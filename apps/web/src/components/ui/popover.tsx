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
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { place, type Side } from "./hover-card";

// Panel que se abre al pulsar un botón y se queda, con la API de shadcn:
// Popover > PopoverTrigger (render) + PopoverContent (side, align,
// sideOffset, alignOffset) con PopoverHeader / PopoverTitle /
// PopoverDescription. Nativo: un `popover="auto"` en la capa superior (no lo
// recorta ningún overflow; pulsar fuera o Escape lo cierran y el foco vuelve
// al botón). Sigue a su botón al desplazar y se da la vuelta si no cabe.
// Para un adelanto al pasar, HoverCard; para una lista de acciones,
// DropdownMenu; para un formulario con enviar, Dialog. Estilos: `.ui-popover`.

type PopoverContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  trigger: HTMLElement | null;
  setTrigger: (node: HTMLElement | null) => void;
  contentId: string;
};

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopover(name: string) {
  const context = useContext(PopoverContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <Popover>`);
  return context;
}

export function Popover({
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
  const open = controlledOpen ?? uncontrolledOpen;
  const contentId = useId();
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  return <PopoverContext.Provider value={{ open, setOpen, trigger, setTrigger, contentId }}>{children}</PopoverContext.Provider>;
}

/** Con `render` (un Button, un chip, un icono) le pasa el estado y el clic; sin él, un <button>. */
export function PopoverTrigger({ render, className, children }: { render?: ReactElement; className?: string; children?: ReactNode }) {
  const popover = usePopover("PopoverTrigger");
  const props = {
    ref: popover.setTrigger,
    type: "button" as const,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": popover.open,
    "aria-controls": popover.open ? popover.contentId : undefined,
    "data-slot": "popover-trigger",
    "data-state": popover.open ? "open" : "closed",
    // El clic lo resuelve el navegador (popovertarget); el estado sigue a onToggle.
    popoverTarget: popover.contentId,
  };
  if (render && isValidElement(render)) {
    const own = render.props as { className?: string; children?: ReactNode };
    return cloneElement(render as ReactElement<Record<string, unknown>>, {
      ...props,
      className: cn(own.className, className),
      children: children ?? own.children,
    });
  }
  return <button {...props} className={className}>{children}</button>;
}

export function PopoverContent({
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "popover" | "role"> & {
  side?: Side;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
}) {
  const popover = usePopover("PopoverContent");
  const ref = useRef<HTMLDivElement>(null);
  const { open, trigger, setOpen } = popover;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!open) {
      if (node.matches(":popover-open")) node.hidePopover();
      return;
    }
    if (!node.matches(":popover-open")) node.showPopover();
    const reposition = () => {
      const anchor = trigger?.getBoundingClientRect();
      if (anchor) place(node, anchor, side, align, sideOffset, alignOffset);
    };
    reposition();
    // El foco entra al panel (lo que lleve autoFocus, o el panel mismo).
    (node.querySelector<HTMLElement>("[autofocus]") ?? node).focus({ preventScroll: true });
    // Sigue a su botón al desplazar y al cambiar de tamaño (cargar datos, abrir un hilo).
    const observer = new ResizeObserver(reposition);
    observer.observe(node);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, trigger, side, align, sideOffset, alignOffset]);

  return (
    <div
      ref={ref}
      id={popover.contentId}
      popover="auto"
      role="dialog"
      tabIndex={-1}
      data-slot="popover-content"
      data-state={open ? "open" : "closed"}
      className={cn("ui-popover", className)}
      onToggle={(event) => {
        // El navegador abre (botón) o cierra (pulsar fuera, Escape, botón) y el estado le sigue.
        const next = (event.nativeEvent as ToggleEvent).newState === "open";
        if (next !== open) setOpen(next);
        // Al cerrar, el foco vuelve al botón si estaba dentro (no si se pulsó otra cosa).
        const active = document.activeElement;
        if (!next && (!active || active === document.body || event.currentTarget.contains(active))) trigger?.focus();
      }}
      {...props}
    >
      {open ? children : null}
    </div>
  );
}

export function PopoverHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="popover-header" className={cn("ui-popover__header", className)} {...props} />;
}

export function PopoverTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 data-slot="popover-title" className={cn("ui-popover__title", className)} {...props} />;
}

export function PopoverDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="popover-description" className={cn("ui-popover__description", className)} {...props} />;
}
