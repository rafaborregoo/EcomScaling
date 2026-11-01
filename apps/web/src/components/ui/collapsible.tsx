"use client";

import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { useRevealHash, useRevealListener } from "./accordion";
import { Button } from "./button";
import { cn } from "./cn";
import { IconChevronDown } from "./icons";

// Plegable con la API de shadcn: Collapsible > CollapsibleTrigger +
// CollapsibleContent, `open`/`defaultOpen`/`onOpenChange`. Para UN bloque que
// se abre y se cierra; uno de varios en una lista es Accordion. Misma mecánica
// que Accordion: el disparador es un <button> con aria-expanded/aria-controls,
// lo cerrado sigue montado (0 de alto e `inert`) y un ?focus= o un #ancla que
// apunte dentro lo abre (revealHidden). `data-state="open|closed"` en los tres
// para estilar (girar la flecha: `group-data-[state=open]:rotate-180`).
// Estilos: `.ui-collapsible` en globals.css.

type CollapsibleContextValue = {
  open: boolean;
  disabled: boolean;
  contentId: string;
  setOpen: (open: boolean) => void;
};

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsible(name: string) {
  const context = useContext(CollapsibleContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <Collapsible>`);
  return context;
}

const stateOf = (open: boolean) => (open ? "open" : "closed");

export function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  ...props
}: Omit<ComponentProps<"div">, "onChange"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const contentId = useId();
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <CollapsibleContext.Provider value={{ open, disabled, contentId, setOpen }}>
      <div
        data-slot="collapsible"
        data-state={stateOf(open)}
        data-disabled={disabled ? "" : undefined}
        className={cn("group/collapsible", className)}
        {...props}
      />
    </CollapsibleContext.Provider>
  );
}

/** Sin `render` es un <button> sin estilo; con `render` (p. ej. un Button) le
 *  pasa el estado y el clic, como el `render` de shadcn. */
export function CollapsibleTrigger({
  render,
  className,
  children,
  onClick,
  ...props
}: Omit<ComponentProps<"button">, "onClick"> & { render?: ReactElement; onClick?: () => void }) {
  const collapsible = useCollapsible("CollapsibleTrigger");
  const toggle = () => {
    onClick?.();
    collapsible.setOpen(!collapsible.open);
  };
  const triggerProps = {
    ...props,
    type: "button" as const,
    "aria-expanded": collapsible.open,
    "aria-controls": collapsible.contentId,
    "data-slot": "collapsible-trigger",
    "data-state": stateOf(collapsible.open),
    disabled: collapsible.disabled || props.disabled,
  };

  if (render && isValidElement(render)) {
    const renderProps = render.props as { className?: string; onClick?: () => void; children?: ReactNode };
    return cloneElement(render as ReactElement<Record<string, unknown>>, {
      ...triggerProps,
      className: cn(renderProps.className, className),
      onClick: () => {
        renderProps.onClick?.();
        toggle();
      },
      children: children ?? renderProps.children,
    });
  }

  return (
    <button {...triggerProps} className={cn("ui-collapsible__trigger", className)} onClick={toggle}>
      {children}
    </button>
  );
}

export function CollapsibleContent({ className, children, ...props }: ComponentProps<"div">) {
  const collapsible = useCollapsible("CollapsibleContent");
  const ref = useRef<HTMLDivElement>(null);
  useRevealListener(ref, () => {
    if (!collapsible.open) collapsible.setOpen(true);
  });
  useRevealHash(ref);

  return (
    <div
      ref={ref}
      id={collapsible.contentId}
      data-slot="collapsible-content"
      data-state={stateOf(collapsible.open)}
      inert={!collapsible.open}
      className="ui-collapsible__panel"
    >
      <div className="ui-collapsible__clip">
        <div className={className} {...props}>{children}</div>
      </div>
    </div>
  );
}

/** Disparador de "Ver N más / Ver menos" para listas recortadas: los
 *  primeros elementos van fuera del CollapsibleContent y el resto dentro. */
export function CollapsibleMore({
  count,
  more = `Ver ${count} más`,
  less = "Ver menos",
  className,
}: {
  count: number;
  more?: ReactNode;
  less?: ReactNode;
  className?: string;
}) {
  const { open } = useCollapsible("CollapsibleMore");
  return (
    <CollapsibleTrigger render={<Button variant="ghost" size="sm" className={className} />}>
      {open ? less : more}
      <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
    </CollapsibleTrigger>
  );
}
