"use client";

import { createContext, useContext, useEffect, useEffectEvent, useId, useRef, useState, type ComponentProps, type RefObject } from "react";
import { cn } from "./cn";
import { IconChevronDown } from "./icons";

// Acordeón con la API de shadcn: Accordion > AccordionItem > AccordionTrigger
// + AccordionContent; `value`/`defaultValue` son arrays y `multiple` deja
// abrir varios a la vez. Nativo, como Button: sin Base UI ni HeroUI. Patrón
// WAI-ARIA: el disparador es un <button> dentro de un encabezado, con
// aria-expanded/aria-controls, y el panel es una región etiquetada por él.
// Lo cerrado sigue montado (a 0 de alto e `inert`): lo que carga datos al
// montarse carga igual, y un ?focus= o un #ancla que apunte dentro lo abre
// (revealHidden). Estilos: `.ui-accordion` en globals.css.

const REVEAL_EVENT = "ui:reveal";

/** Abre todos los acordeones y plegables que esconden `node` (anidados incluidos). */
export function revealHidden(node: Element) {
  node.dispatchEvent(new Event(REVEAL_EVENT, { bubbles: true }));
}

/** Llama a `reveal` cuando algo de dentro de `ref` pide mostrarse (revealHidden). */
export function useRevealListener(ref: RefObject<HTMLElement | null>, reveal: () => void) {
  const onReveal = useEffectEvent(reveal);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const listener = () => onReveal();
    node.addEventListener(REVEAL_EVENT, listener);
    return () => node.removeEventListener(REVEAL_EVENT, listener);
  }, [ref]);
}

/** Un #ancla que cae dentro de `ref`: se abre lo que la esconde y se vuelve a
 *  desplazar, porque el navegador ya había saltado al hueco plegado. */
export function useRevealHash(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const revealHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target || !ref.current?.contains(target)) return;
      revealHidden(target);
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    };
    revealHash();
    window.addEventListener("hashchange", revealHash);
    return () => window.removeEventListener("hashchange", revealHash);
  }, [ref]);
}

type AccordionContextValue = {
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
  reveal: (value: string) => void;
};
type ItemContextValue = {
  value: string;
  open: boolean;
  disabled: boolean;
  triggerId: string;
  panelId: string;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);
const ItemContext = createContext<ItemContextValue | null>(null);

function useRequired<T>(value: T | null, name: string): T {
  if (!value) throw new Error(`${name} tiene que ir dentro de <Accordion>/<AccordionItem>`);
  return value;
}

export function Accordion({
  value,
  defaultValue = [],
  onValueChange,
  multiple = false,
  className,
  ...props
}: Omit<ComponentProps<"div">, "defaultValue" | "onChange"> & {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  multiple?: boolean;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const openValues = value ?? uncontrolled;
  const rootRef = useRef<HTMLDivElement>(null);

  const commit = (next: string[]) => {
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };
  const context: AccordionContextValue = {
    isOpen: (item) => openValues.includes(item),
    toggle: (item) =>
      commit(
        openValues.includes(item)
          ? openValues.filter((open) => open !== item)
          : multiple ? [...openValues, item] : [item],
      ),
    reveal: (item) => {
      if (!openValues.includes(item)) commit(multiple ? [...openValues, item] : [item]);
    },
  };

  useRevealHash(rootRef);

  return (
    <AccordionContext.Provider value={context}>
      <div ref={rootRef} data-slot="accordion" className={cn("ui-accordion", className)} {...props} />
    </AccordionContext.Provider>
  );
}

export function AccordionItem({
  value,
  disabled = false,
  className,
  ...props
}: Omit<ComponentProps<"div">, "ref"> & { value: string; disabled?: boolean }) {
  const accordion = useRequired(useContext(AccordionContext), "AccordionItem");
  const id = useId();
  const open = accordion.isOpen(value);
  const ref = useRef<HTMLDivElement>(null);
  useRevealListener(ref, () => accordion.reveal(value));

  return (
    <ItemContext.Provider value={{ value, open, disabled, triggerId: `${id}-trigger`, panelId: `${id}-panel` }}>
      <div
        ref={ref}
        data-slot="accordion-item"
        data-open={open ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        className={cn("ui-accordion__item", className)}
        {...props}
      />
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "onClick" | "type">) {
  const accordion = useRequired(useContext(AccordionContext), "AccordionTrigger");
  const item = useRequired(useContext(ItemContext), "AccordionTrigger");
  return (
    <h3 data-slot="accordion-header" className="ui-accordion__header">
      <button
        type="button"
        id={item.triggerId}
        aria-controls={item.panelId}
        aria-expanded={item.open}
        disabled={item.disabled}
        data-slot="accordion-trigger"
        className={cn("ui-accordion__trigger", className)}
        onClick={() => accordion.toggle(item.value)}
        {...props}
      >
        {children}
        <IconChevronDown aria-hidden className="ui-accordion__chevron" />
      </button>
    </h3>
  );
}

export function AccordionContent({ className, children, ...props }: ComponentProps<"div">) {
  const item = useRequired(useContext(ItemContext), "AccordionContent");
  return (
    <div
      role="region"
      id={item.panelId}
      aria-labelledby={item.triggerId}
      data-slot="accordion-content"
      data-open={item.open ? "" : undefined}
      inert={!item.open}
      className="ui-accordion__panel"
      {...props}
    >
      <div className="ui-accordion__clip">
        <div className={cn("ui-accordion__content", className)}>{children}</div>
      </div>
    </div>
  );
}
