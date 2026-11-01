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
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "./cn";

// Menú de acciones con la API de shadcn: DropdownMenu > DropdownMenuTrigger +
// DropdownMenuContent > DropdownMenuItem / Label / Separator / Shortcut /
// Group. Nativo: el menú es un `popover="auto"` (capa superior, no lo recorta
// ningún overflow; pulsar fuera o Escape lo cierran) colocado bajo su botón.
// Teclado del patrón menu de ARIA: ↑↓, Inicio/Fin, Intro elige, Tab o Escape
// cierran y el foco vuelve al botón. Para elegir entre muchas opciones con
// buscador, Command. Estilos: `.ui-dropdown-menu` en globals.css.

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  trigger: HTMLElement | null;
  setTrigger: (node: HTMLElement | null) => void;
  contentId: string;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu(name: string) {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <DropdownMenu>`);
  return context;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

export function DropdownMenu({
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
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, trigger, setTrigger, contentId }}>
      {children}
    </DropdownMenuContext.Provider>
  );
}

/** Con `render` (p. ej. un Button) le pasa el estado y el clic; sin él, un <button>. */
export function DropdownMenuTrigger({
  render,
  className,
  children,
}: {
  render?: ReactElement;
  className?: string;
  children?: ReactNode;
}) {
  const menu = useDropdownMenu("DropdownMenuTrigger");
  const props = {
    ref: menu.setTrigger,
    type: "button" as const,
    "aria-haspopup": "menu" as const,
    "aria-expanded": menu.open,
    "aria-controls": menu.open ? menu.contentId : undefined,
    "data-slot": "dropdown-menu-trigger",
    "data-state": menu.open ? "open" : "closed",
    // El clic lo resuelve el navegador (popovertarget): abre, cierra y no
    // reabre al pulsar el botón con el menú abierto. El estado sigue a onToggle.
    popoverTarget: menu.contentId,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        menu.setOpen(true);
      }
    },
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

export function DropdownMenuContent({
  align = "end",
  sideOffset = 4,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "popover" | "role"> & { align?: "start" | "end"; sideOffset?: number }) {
  const menu = useDropdownMenu("DropdownMenuContent");
  const ref = useRef<HTMLDivElement>(null);
  const { open, trigger, setOpen } = menu;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!open) {
      if (node.matches(":popover-open")) node.hidePopover();
      return;
    }
    if (!node.matches(":popover-open")) node.showPopover();
    // Debajo del botón, alineado a su borde; arriba si no cabe.
    const anchor = trigger?.getBoundingClientRect();
    if (anchor) {
      const { width, height } = node.getBoundingClientRect();
      const left = align === "end" ? anchor.right - width : anchor.left;
      const below = anchor.bottom + sideOffset;
      const top = below + height > window.innerHeight - 8 && anchor.top - sideOffset - height > 8 ? anchor.top - sideOffset - height : below;
      node.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
      node.style.top = `${top}px`;
    }
    node.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus();
    // Desplazar la página dejaría el menú flotando lejos de su botón.
    const close = (event: Event) => {
      if (!node.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
    // setOpen cambia en cada render del padre; abrir/cerrar depende de `open`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trigger, align, sideOffset]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: HTMLElement | undefined;
    if (event.key === "ArrowDown") next = items[(index + 1) % items.length];
    else if (event.key === "ArrowUp") next = items[(index - 1 + items.length) % items.length];
    else if (event.key === "Home") next = items[0];
    else if (event.key === "End") next = items.at(-1);
    else if (event.key === "Tab") {
      setOpen(false);
      return;
    } else return;
    event.preventDefault();
    next?.focus();
  };

  return (
    <div
      ref={ref}
      id={menu.contentId}
      popover="auto"
      role="menu"
      aria-orientation="vertical"
      data-slot="dropdown-menu-content"
      data-state={open ? "open" : "closed"}
      className={cn("ui-dropdown-menu", className)}
      onKeyDown={onKeyDown}
      onToggle={(event) => {
        // El navegador abre (botón) o cierra (pulsar fuera, Escape, botón)
        // y el estado le sigue.
        const next = (event.nativeEvent as ToggleEvent).newState === "open";
        if (next !== open) setOpen(next);
        if (!next) trigger?.focus();
      }}
      {...props}
    >
      {open ? children : null}
    </div>
  );
}

export function DropdownMenuItem({
  variant = "default",
  disabled = false,
  onSelect,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "onSelect" | "onClick"> & {
  variant?: "default" | "destructive";
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const menu = useDropdownMenu("DropdownMenuItem");
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn("ui-dropdown-menu__item", className)}
      onClick={() => {
        if (disabled) return;
        menu.setOpen(false);
        menu.trigger?.focus();
        onSelect?.();
      }}
      onPointerMove={(event) => {
        if (!disabled) event.currentTarget.focus();
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuGroup({ className, ...props }: ComponentProps<"div">) {
  return <div role="group" data-slot="dropdown-menu-group" className={className} {...props} />;
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="dropdown-menu-label" className={cn("ui-dropdown-menu__label", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<"div">) {
  return <div role="separator" data-slot="dropdown-menu-separator" className={cn("ui-dropdown-menu__separator", className)} {...props} />;
}

export function DropdownMenuShortcut({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="dropdown-menu-shortcut" className={cn("ui-dropdown-menu__shortcut", className)} {...props} />;
}
