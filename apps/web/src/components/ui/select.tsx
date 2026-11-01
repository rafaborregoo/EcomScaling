"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "./cn";
import { useFieldControl } from "./field";

// Select único de la app con la API de shadcn: Select > SelectTrigger >
// SelectValue + SelectContent > SelectGroup > SelectLabel + SelectItem, y
// SelectSeparator. Nativo, sin Base UI ni HeroUI: el trigger es un botón con
// el patrón «select-only combobox» de ARIA (el foco se queda en él y la opción
// resaltada va por aria-activedescendant) y la lista es un `popover="manual"`
// bajo el botón, en la capa superior, así no la recorta ningún overflow ni un
// <dialog>. Teclado: flechas, Inicio/Fin, Intro/Espacio eligen, Escape cierra,
// y teclear letras salta a la opción que empieza así.
//
// `value` null (o "" en el atajo) es «sin elegir» y enseña el `placeholder`.
// SelectValue saca el texto de `items` o, si no se pasan, de los SelectItem
// (se montan siempre, ocultos con el popover cerrado). Con `name` va un input
// oculto para los <form>.
//
// Atajo para casi todo: <Select value onChange options /> con `section` para
// agrupar. Cuándo usarlo: hasta ~10 opciones fijas; si la lista es larga o
// crece con los datos, SearchableSelect (combobox.tsx). La lista comparte las
// clases `.ui-combobox__*` con el combobox; el botón es `.ui-select__trigger`.

type Item = { label: ReactNode; value: string | null };

type SelectContextValue = {
  value: string | null;
  choose: (value: string | null) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  items?: readonly Item[];
  labels: Map<string, string>;
  register: (value: string, label: string) => void;
  highlighted: string | null;
  setHighlighted: (key: string | null) => void;
  listboxId: string;
  optionId: (key: string) => string;
  trigger: HTMLButtonElement | null;
  setTrigger: (node: HTMLButtonElement | null) => void;
  content: HTMLDivElement | null;
  setContent: (node: HTMLDivElement | null) => void;
};

const SelectContext = createContext<SelectContextValue | null>(null);
const GroupContext = createContext<string | undefined>(undefined);

function useSelect() {
  const context = useContext(SelectContext);
  if (!context) throw new Error("Las piezas de Select van dentro de <Select>.");
  return context;
}

// null no puede ser clave de un mapa de opciones del DOM.
const NONE = "\u0000none";
const keyOf = (value: string | null) => value ?? NONE;

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type RootProps = {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  items?: readonly Item[];
  disabled?: boolean;
  name?: string;
  children: ReactNode;
};

export type SelectOption = { value: string; label: string; section?: string };

type ShortcutProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  // El campo que quedó mal: borde rojo y aria-invalid. El texto del error se
  // enlaza con `aria-describedby` (o lo pone Field solo).
  invalid?: boolean;
  // Botón sin caja, en línea sobre el fondo (selector de la barra superior).
  bare?: boolean;
  size?: "sm" | "default";
  "aria-label"?: string;
  "aria-describedby"?: string;
};

export function Select(props: RootProps | ShortcutProps) {
  if ("options" in props) return <SelectShortcut {...props} />;
  return <SelectRoot {...props} />;
}

function SelectRoot({ value: controlledValue, defaultValue = null, onValueChange, items, disabled = false, name, children }: RootProps) {
  const [inner, setInner] = useState<string | null>(defaultValue);
  const value = controlledValue !== undefined ? controlledValue : inner;
  const [open, setOpenState] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [labels, setLabels] = useState(() => new Map<string, string>());
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const listboxId = useId();

  const register = useCallback((key: string, label: string) => {
    setLabels((current) => (current.get(key) === label ? current : new Map(current).set(key, label)));
  }, []);
  const setOpen = (next: boolean) => {
    if (disabled && next) return;
    setOpenState(next);
    if (!next) setHighlighted(null);
  };
  const choose = (next: string | null) => {
    if (controlledValue === undefined) setInner(next);
    onValueChange?.(next);
    setOpen(false);
    trigger?.focus();
  };

  const context: SelectContextValue = {
    value,
    choose,
    open,
    setOpen,
    disabled,
    items,
    labels,
    register,
    highlighted,
    setHighlighted,
    listboxId,
    optionId: (key) => `${listboxId}-${encodeURIComponent(key).replace(/[%.]/g, "_")}`,
    trigger,
    setTrigger,
    content,
    setContent,
  };
  return (
    <SelectContext.Provider value={context}>
      {children}
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    </SelectContext.Provider>
  );
}

function optionNodes(context: SelectContextValue) {
  return [...(context.content?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? [])];
}

function highlight(context: SelectContextValue, node: HTMLElement | undefined) {
  if (!node) return;
  context.setHighlighted(node.dataset.key ?? null);
  node.scrollIntoView({ block: "nearest" });
}

export function SelectTrigger({
  className,
  children,
  size = "default",
  variant = "default",
  onKeyDown,
  ...props
}: ComponentProps<"button"> & { size?: "sm" | "default"; variant?: "default" | "bare" }) {
  const context = useSelect();
  const field = useFieldControl({ id: props.id, "aria-describedby": props["aria-describedby"], "aria-invalid": props["aria-invalid"] });
  const { setTrigger } = context;
  const typed = useRef({ text: "", at: 0 });

  const typeahead = (char: string) => {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : "") + char, at: now };
    const needle = normalize(typed.current.text);
    const node = optionNodes(context).find((option) => normalize(option.textContent ?? "").startsWith(needle));
    if (!node) return;
    if (context.open) highlight(context, node);
    // Cerrado, como un <select>: teclear cambia el valor sin abrir.
    else context.choose(node.dataset.key === NONE ? null : (node.dataset.key ?? null));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const nodes = optionNodes(context);
    const current = nodes.findIndex((node) => node.dataset.key === context.highlighted);
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!context.open) context.setOpen(true);
        else highlight(context, nodes[event.key === "ArrowDown" ? Math.min(current + 1, nodes.length - 1) : Math.max(current - 1, 0)]);
        return;
      case "Home":
      case "End":
        if (!context.open) return;
        event.preventDefault();
        highlight(context, nodes[event.key === "Home" ? 0 : nodes.length - 1]);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!context.open) context.setOpen(true);
        else nodes[current]?.click();
        return;
      case "Escape":
        if (!context.open) return;
        // Que no cierre también el diálogo que contiene el campo.
        event.preventDefault();
        event.stopPropagation();
        context.setOpen(false);
        return;
      case "Tab":
        context.setOpen(false);
        return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typeahead(event.key);
  };

  return (
    <button
      type="button"
      ref={setTrigger}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={context.open}
      aria-controls={context.listboxId}
      aria-activedescendant={context.open && context.highlighted ? context.optionId(context.highlighted) : undefined}
      // En un Field la etiqueta nombra el botón.
      aria-labelledby={props["aria-label"] ? undefined : field.labelId}
      disabled={context.disabled}
      data-slot="select-trigger"
      data-size={size}
      data-variant={variant}
      {...props}
      {...field.props}
      className={cn("ui-select__trigger", className)}
      onClick={(event) => {
        // Safari no enfoca un botón al pulsarlo; sin foco no irían las flechas.
        event.currentTarget.focus();
        context.setOpen(!context.open);
      }}
      onKeyDown={handleKeyDown}
    >
      {children}
      <ChevronDownIcon aria-hidden className="ui-select__chevron" />
    </button>
  );
}

export function SelectValue({ placeholder, className }: { placeholder?: ReactNode; className?: string }) {
  const context = useSelect();
  const fromItems = context.items?.find((item) => item.value === context.value)?.label;
  const label = fromItems ?? (context.value == null ? undefined : (context.labels.get(context.value) ?? context.value));
  const empty = label === undefined || label === "";
  return (
    <span data-slot="select-value" data-placeholder={empty ? "" : undefined} className={cn("ui-select__value", className)}>
      {empty ? placeholder : label}
    </span>
  );
}

export function SelectContent({ className, children }: { className?: string; children: ReactNode; alignItemWithTrigger?: boolean }) {
  const context = useSelect();
  const { open, setOpen, trigger, content, setContent, value, setHighlighted } = context;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      boxRef.current = node;
      setContent(node);
    },
    [setContent],
  );

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    if (!open) {
      if (box.matches(":popover-open")) box.hidePopover();
      return;
    }
    box.showPopover();
    const place = () => {
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const up = below < 220 && above > below;
      box.style.minWidth = `${rect.width}px`;
      box.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - box.offsetWidth - 8))}px`;
      box.style.top = up ? "auto" : `${rect.bottom + 4}px`;
      box.style.bottom = up ? `${window.innerHeight - rect.top + 4}px` : "auto";
      box.style.maxHeight = `${Math.min(320, Math.max(up ? above : below, 120))}px`;
    };
    place();
    // Al abrir se resalta lo elegido (o la primera).
    const nodes = optionNodes(context);
    const pick = nodes.find((node) => node.dataset.key === keyOf(value)) ?? nodes[0];
    setHighlighted(pick?.dataset.key ?? null);
    pick?.scrollIntoView({ block: "nearest" });
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
    // Solo al abrir y cerrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trigger]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (content?.contains(target) || trigger?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, setOpen, content, trigger]);

  return (
    <div
      ref={attach}
      popover="manual"
      role="listbox"
      id={context.listboxId}
      data-slot="select-content"
      className={cn("ui-combobox__content", className)}
      // El clic en una opción no quita el foco del botón.
      onMouseDown={(event) => event.preventDefault()}
      // Dentro de un <label>, el clic en una opción volvería a pulsar el botón.
      onClick={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, disabled = false, className, children }: { value: string | null; disabled?: boolean; className?: string; children: ReactNode }) {
  const context = useSelect();
  const key = keyOf(value);
  const selected = context.value === value;
  const textRef = useRef<HTMLSpanElement | null>(null);
  const { register } = context;
  useLayoutEffect(() => {
    if (value != null) register(value, textRef.current?.textContent ?? "");
  });
  return (
    <div
      role="option"
      id={context.optionId(key)}
      data-key={key}
      data-slot="select-item"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      data-highlighted={context.highlighted === key ? "" : undefined}
      className={cn("ui-combobox__item", className)}
      onPointerMove={() => {
        if (!disabled && context.highlighted !== key) context.setHighlighted(key);
      }}
      onClick={() => {
        if (!disabled) context.choose(value);
      }}
    >
      <span ref={textRef} className="ui-combobox__item-text">{children}</span>
      <span className="ui-combobox__indicator" aria-hidden>{selected ? <CheckIcon /> : null}</span>
    </div>
  );
}

export function SelectGroup({ className, children }: { className?: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <GroupContext.Provider value={labelId}>
      <div role="group" aria-labelledby={labelId} data-slot="select-group" className={cn("ui-combobox__group", className)}>{children}</div>
    </GroupContext.Provider>
  );
}

export function SelectLabel({ className, children }: { className?: string; children: ReactNode }) {
  const labelId = useContext(GroupContext);
  return <div id={labelId} data-slot="select-label" className={cn("ui-combobox__label", className)}>{children}</div>;
}

export function SelectSeparator({ className }: { className?: string }) {
  return <div role="separator" data-slot="select-separator" className={cn("ui-combobox__separator", className)} />;
}

/** Atajo: `value` string ("" = sin elegir), `options` con `section` opcional para agrupar. */
function SelectShortcut({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  className,
  disabled,
  id,
  invalid,
  bare,
  size,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: ShortcutProps) {
  const sections = [...new Set(options.map((option) => option.section ?? ""))];
  const renderItem = (option: SelectOption) => (
    <SelectItem key={option.value || NONE} value={option.value}>
      {option.label}
    </SelectItem>
  );
  return (
    <Select items={options} value={value} onValueChange={(next) => onChange(next ?? "")} disabled={disabled}>
      <SelectTrigger
        id={id}
        variant={bare ? "bare" : "default"}
        size={size}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        className={className}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {sections.map((section) =>
          section ? (
            <SelectGroup key={section}>
              <SelectLabel>{section}</SelectLabel>
              {options.filter((option) => option.section === section).map(renderItem)}
            </SelectGroup>
          ) : (
            options.filter((option) => !option.section).map(renderItem)
          ),
        )}
      </SelectContent>
    </Select>
  );
}
