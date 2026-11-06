"use client";

import {
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "./cn";
import { useFieldControl } from "./field";

// Combobox único de la app con la API de shadcn: Combobox > ComboboxInput +
// ComboboxContent > ComboboxEmpty + ComboboxList > ComboboxItem, con grupos
// (ComboboxGroup + ComboboxLabel + ComboboxCollection), selección múltiple
// con etiquetas (ComboboxChips + ComboboxValue + ComboboxChip +
// ComboboxChipsInput) y modo desplegable desde un botón (ComboboxTrigger con
// el ComboboxInput dentro del ComboboxContent).
//
// Es nativo: el desplegable es un `popover="manual"` (capa superior del
// navegador, así no lo recorta ningún overflow ni un <dialog>) colocado bajo
// su ancla. El teclado sigue el patrón combobox de ARIA: flechas, Inicio/Fin,
// Intro elige, Escape cierra. Estilos en globals.css (`.ui-combobox`).
//
// Cuándo usarlo (ver /componentes): Select para hasta ~10 opciones fijas;
// Combobox cuando la lista es larga, crece con los datos o hay que elegir
// varias. Los grupos son objetos `{ value, items }` dentro de `items`.

type Group = { value: string; items: readonly unknown[] };

type ComboboxContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  multiple: boolean;
  disabled: boolean;
  autoHighlight: boolean;
  allowsCustomValue: boolean;
  query: string;
  setQuery: (query: string) => void;
  dirty: boolean;
  filtered: readonly unknown[];
  matchCount: number;
  selected: unknown[];
  isSelected: (item: unknown) => boolean;
  choose: (item: unknown) => void;
  remove: (item: unknown) => void;
  clear: () => void;
  addCustom: (text: string) => void;
  label: (item: unknown) => string;
  keyOf: (item: unknown) => string;
  highlighted: string | null;
  setHighlighted: (key: string | null) => void;
  listboxId: string;
  optionId: (key: string) => string;
  // Nodos guardados en estado (refs de callback), no en useRef: se leen al pintar.
  anchor: HTMLElement | null;
  setAnchor: (node: HTMLElement | null) => void;
  content: HTMLDivElement | null;
  setContent: (node: HTMLDivElement | null) => void;
  input: HTMLInputElement | null;
  setInput: (node: HTMLInputElement | null) => void;
  trigger: HTMLElement | null;
  setTrigger: (node: HTMLElement | null) => void;
};

const ComboboxContext = createContext<ComboboxContextValue | null>(null);
const InContentContext = createContext(false);
const GroupContext = createContext<{ items: readonly unknown[]; labelId: string } | null>(null);

function useCombobox() {
  const context = useContext(ComboboxContext);
  if (!context) throw new Error("Las piezas de Combobox van dentro de <Combobox>.");
  return context;
}

function isGroup(item: unknown): item is Group {
  return typeof item === "object" && item !== null && Array.isArray((item as Group).items);
}

function defaultLabel(item: unknown): string {
  if (item == null) return "";
  if (typeof item === "object" && "label" in item) return String((item as { label: unknown }).label);
  return String(item);
}

// Sin tildes ni mayúsculas: «medico» encuentra «Médico».
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type SharedProps<T> = {
  items: readonly unknown[];
  /** Texto con el que se muestra y se filtra cada opción (por defecto, `label` o el propio string). */
  itemToStringValue?: (item: T) => string;
  /** Resalta la primera opción al filtrar, así Intro elige sin bajar con la flecha. */
  autoHighlight?: boolean;
  disabled?: boolean;
  /** Opciones de texto: Intro (y coma, con `multiple`) aceptan lo escrito aunque no esté en la lista. */
  allowsCustomValue?: boolean;
  children: ReactNode;
};
type SingleProps<T> = { multiple?: false; value?: T | null; defaultValue?: T | null; onValueChange?: (value: T | null) => void };
type MultipleProps<T> = { multiple: true; value?: T[]; defaultValue?: T[]; onValueChange?: (value: T[]) => void };

export function Combobox<T>(props: SharedProps<T> & (SingleProps<T> | MultipleProps<T>)) {
  const { items, itemToStringValue, autoHighlight = false, disabled = false, allowsCustomValue = false, children } = props;
  const multiple = props.multiple === true;
  const [open, setOpenState] = useState(false);
  const [query, setQueryState] = useState("");
  const [dirty, setDirty] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [inner, setInner] = useState<unknown>(props.defaultValue ?? (multiple ? [] : null));
  const controlled = props.value !== undefined;
  const value = controlled ? props.value : inner;
  const selected = useMemo(() => (multiple ? ((value as unknown[]) ?? []) : value == null ? [] : [value]), [multiple, value]);

  const listboxId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);

  const label = (item: unknown) => (itemToStringValue ? itemToStringValue(item as T) : defaultLabel(item));
  const keyOf = (item: unknown) => {
    if (typeof item === "object" && item !== null && "value" in item) {
      const raw = (item as { value: unknown }).value;
      if (typeof raw === "string" || typeof raw === "number") return String(raw);
    }
    return label(item);
  };
  const selectedKeys = new Set(selected.map(keyOf));

  const needle = dirty ? normalize(query.trim()) : "";
  // Se busca en el texto de la opción y, si la tiene, en su segunda línea (`hint`).
  const matches = (item: unknown) => {
    if (!needle) return true;
    const hint = typeof item === "object" && item !== null && "hint" in item ? String((item as { hint: unknown }).hint ?? "") : "";
    return normalize(`${label(item)} ${hint}`).includes(needle);
  };
  const filtered = items
    .map((item) => (isGroup(item) ? { ...item, items: item.items.filter(matches) } : item))
    .filter((item) => (isGroup(item) ? item.items.length > 0 : matches(item)));
  const matchCount = filtered.reduce<number>((sum, item) => sum + (isGroup(item) ? item.items.length : 1), 0);

  const emit = (next: unknown) => {
    if (!controlled) setInner(next);
    (props.onValueChange as ((value: unknown) => void) | undefined)?.(next);
  };
  const setQuery = (next: string) => {
    setQueryState(next);
    setDirty(true);
  };
  const setOpen = (next: boolean) => {
    if (disabled && next) return;
    setOpenState(next);
    if (!next) {
      setQueryState("");
      setDirty(false);
      setHighlighted(null);
    }
  };
  const choose = (item: unknown) => {
    if (multiple) {
      const key = keyOf(item);
      emit(selectedKeys.has(key) ? selected.filter((entry) => keyOf(entry) !== key) : [...selected, item]);
      setQueryState("");
      setDirty(false);
      input?.focus();
      return;
    }
    emit(item);
    setOpen(false);
    (trigger ?? input)?.focus();
  };
  const remove = (item: unknown) => {
    const key = keyOf(item);
    emit(multiple ? selected.filter((entry) => keyOf(entry) !== key) : null);
  };
  // Lo pegado con comas o punto y coma («a@x.com, b@y.com») entra como varias.
  // En selección simple, lo escrito pasa a ser el valor y se cierra.
  const addCustom = (text: string) => {
    if (!multiple) {
      if (text.trim()) emit(text.trim());
      setOpen(false);
      return;
    }
    const fresh = [...new Set(text.split(/[,;]/).map((part) => part.trim()).filter(Boolean))].filter((part) => !selectedKeys.has(part));
    if (fresh.length) emit([...selected, ...fresh]);
    setQueryState("");
    setDirty(false);
  };

  const context: ComboboxContextValue = {
    open,
    setOpen,
    multiple,
    disabled,
    autoHighlight,
    allowsCustomValue,
    query,
    setQuery,
    dirty,
    filtered,
    matchCount,
    selected,
    isSelected: (item) => selectedKeys.has(keyOf(item)),
    choose,
    remove,
    clear: () => emit(multiple ? [] : null),
    addCustom,
    label,
    keyOf,
    highlighted,
    setHighlighted,
    listboxId,
    optionId: (key) => `${listboxId}-${encodeURIComponent(key).replace(/[%.]/g, "_")}`,
    anchor,
    setAnchor,
    content,
    setContent,
    input,
    setInput,
    trigger,
    setTrigger,
  };

  return <ComboboxContext.Provider value={context}>{children}</ComboboxContext.Provider>;
}

/** Opciones visibles y elegibles, en el orden en que se pintan. */
function optionNodes(context: ComboboxContextValue) {
  return [...(context.content?.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])') ?? [])];
}

function moveHighlight(context: ComboboxContextValue, to: "next" | "prev" | "first" | "last") {
  const nodes = optionNodes(context);
  if (!nodes.length) return;
  const current = nodes.findIndex((node) => node.dataset.key === context.highlighted);
  const index =
    to === "first" ? 0
    : to === "last" ? nodes.length - 1
    : to === "next" ? (current + 1) % nodes.length
    : current <= 0 ? nodes.length - 1 : current - 1;
  context.setHighlighted(nodes[index].dataset.key ?? null);
  nodes[index].scrollIntoView({ block: "nearest" });
}

function useInputHandlers(context: ComboboxContextValue) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!context.open) context.setOpen(true);
        else moveHighlight(context, event.key === "ArrowDown" ? "next" : "prev");
        break;
      case "Home":
      case "End":
        if (context.open && !context.query) {
          event.preventDefault();
          moveHighlight(context, event.key === "Home" ? "first" : "last");
        }
        break;
      case "Enter": {
        if (!context.open) return;
        const node = optionNodes(context).find((item) => item.dataset.key === context.highlighted);
        if (node) {
          event.preventDefault();
          node.click();
        } else if (context.allowsCustomValue && context.query.trim()) {
          event.preventDefault();
          context.addCustom(context.query);
        }
        break;
      }
      case ",":
        if (context.multiple && context.allowsCustomValue && context.query.trim()) {
          event.preventDefault();
          context.addCustom(context.query);
        }
        break;
      case "Escape":
        if (context.open) {
          // Que no cierre también el diálogo que contiene el campo.
          event.preventDefault();
          event.stopPropagation();
          context.setOpen(false);
          context.trigger?.focus();
        }
        break;
      case "Backspace":
        if (context.multiple && !context.query && context.selected.length) context.remove(context.selected[context.selected.length - 1]);
        break;
      case "Tab":
        context.setOpen(false);
        break;
    }
  };
}

function inputAria(context: ComboboxContextValue) {
  return {
    role: "combobox" as const,
    "aria-expanded": context.open,
    "aria-controls": context.listboxId,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": context.open && context.highlighted ? context.optionId(context.highlighted) : undefined,
    autoComplete: "off",
  };
}

/**
 * Campo de texto del combobox. Fuera del desplegable es la caja con la flecha
 * (y la X con `showClear`); los `children` van delante, como icono. Dentro
 * del ComboboxContent es el buscador del modo desplegable.
 */
export function ComboboxInput({
  className,
  showClear = false,
  showTrigger = true,
  disabled,
  children,
  "aria-invalid": ariaInvalid,
  ...props
}: Omit<ComponentProps<"input">, "value" | "defaultValue" | "children"> & { showClear?: boolean; showTrigger?: boolean; children?: ReactNode }) {
  const context = useCombobox();
  const inContent = useContext(InContentContext);
  const onKeyDown = useInputHandlers(context);
  const isDisabled = disabled ?? context.disabled;
  const { setInput, setAnchor } = context;
  const field = useFieldControl({ id: props.id, "aria-describedby": props["aria-describedby"], "aria-invalid": ariaInvalid }).props;

  if (inContent) {
    return (
      <div data-slot="combobox-search" className="ui-combobox__search">
        <SearchIcon aria-hidden />
        <input
          ref={setInput}
          {...inputAria(context)}
          {...props}
          aria-invalid={ariaInvalid}
          className={cn("ui-combobox__input", className)}
          value={context.query}
          onChange={(event) => context.setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    );
  }

  // En selección simple la caja enseña la opción elegida hasta que se escribe.
  const shown = context.dirty || context.multiple ? context.query : context.selected.length ? context.label(context.selected[0]) : "";
  return (
    <div
      ref={setAnchor}
      data-slot="combobox-control"
      data-invalid={field["aria-invalid"] && field["aria-invalid"] !== "false" ? "" : undefined}
      data-disabled={isDisabled ? "" : undefined}
      className={cn("ui-combobox__control", className)}
    >
      {children}
      <input
        ref={setInput}
        {...inputAria(context)}
        {...props}
        {...field}
        disabled={isDisabled}
        className="ui-combobox__input"
        value={shown}
        onChange={(event) => {
          context.setQuery(event.target.value);
          context.setOpen(true);
        }}
        onClick={() => context.setOpen(true)}
        // Con una opción ya elegida, escribir la sustituye en vez de añadirse detrás.
        onFocus={(event) => event.target.select()}
        onKeyDown={onKeyDown}
      />
      {showClear && context.selected.length && !isDisabled ? (
        <button type="button" tabIndex={-1} aria-label="Borrar la selección" className="ui-combobox__icon-btn" onClick={() => { context.clear(); context.input?.focus(); }}>
          <XIcon aria-hidden />
        </button>
      ) : null}
      {showTrigger ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={context.open ? "Ocultar opciones" : "Mostrar opciones"}
          disabled={isDisabled}
          className="ui-combobox__icon-btn"
          onClick={() => {
            context.setOpen(!context.open);
            context.input?.focus();
          }}
        >
          <ChevronDownIcon aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Botón que abre el desplegable (modo popup). `render` recibe el elemento que hace de botón. */
export function ComboboxTrigger({ render, children, className }: { render?: ReactElement; children?: ReactNode; className?: string }) {
  const context = useCombobox();
  const element = render ?? <button type="button" />;
  const props = element.props as { className?: string; children?: ReactNode };
  const { setTrigger, setAnchor } = context;
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      setTrigger(node);
      setAnchor(node);
    },
    [setTrigger, setAnchor],
  );
  return cloneElement(element as ReactElement<Record<string, unknown>>, {
    ref: setRef,
    "aria-haspopup": "listbox",
    "aria-expanded": context.open,
    "aria-controls": context.listboxId,
    disabled: context.disabled || undefined,
    "data-slot": "combobox-trigger",
    className: cn("ui-combobox__trigger", props.className, className),
    onClick: () => context.setOpen(!context.open),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" && !context.open) {
        event.preventDefault();
        context.setOpen(true);
      }
    },
    children: children ?? props.children,
  });
}

/** Lo elegido: texto de la opción (simple) o una función que recibe la lista (múltiple). */
export function ComboboxValue<T>({ children, placeholder }: { children?: ReactNode | ((value: T[]) => ReactNode); placeholder?: ReactNode }) {
  const context = useCombobox();
  if (typeof children === "function") return <>{children(context.selected as T[])}</>;
  if (children !== undefined) return <>{children}</>;
  const text = context.selected.map(context.label).join(", ");
  return <span data-slot="combobox-value" className="ui-combobox__value">{text || placeholder}</span>;
}

export function ComboboxContent({ className, children }: { className?: string; children: ReactNode }) {
  const context = useCombobox();
  const { open, setOpen, anchor, content, setContent, trigger, input } = context;
  // El estilo de posición se escribe sobre un ref propio (no sobre el estado).
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
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
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
    // Cada fotograma mientras está abierta: además del scroll y el zoom, sigue al
    // campo cuando lo mueve la propia página (datos que llegan, un menú que se pliega).
    let last = "";
    let frame = requestAnimationFrame(function follow() {
      const rect = anchor?.getBoundingClientRect();
      const now = rect ? `${rect.left},${rect.top},${rect.width},${window.innerWidth},${window.innerHeight}` : "";
      if (now !== last) {
        last = now;
        place();
      }
      frame = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, anchor]);

  // Cerrar al pulsar fuera del campo y del desplegable.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (content?.contains(target) || anchor?.contains(target) || trigger?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, setOpen, anchor, content, trigger]);

  // En modo popup el foco entra en el buscador al abrir.
  useEffect(() => {
    if (open && trigger) input?.focus();
  }, [open, trigger, input]);

  return (
    <div
      ref={attach}
      popover="manual"
      data-slot="combobox-content"
      className={cn("ui-combobox__content", className)}
      // El clic en una opción no debe quitar el foco del campo.
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
    >
      <InContentContext.Provider value>{open ? children : null}</InContentContext.Provider>
    </div>
  );
}

export function ComboboxList<T>({ className, children }: { className?: string; children: ReactNode | ((item: T, index: number) => ReactNode) }) {
  const context = useCombobox();
  const { open, autoHighlight, dirty, query, filtered, selected, keyOf, setHighlighted } = context;

  // Al abrir se resalta lo elegido; al filtrar con autoHighlight, la primera.
  useEffect(() => {
    if (!open) return;
    const nodes = optionNodes(context);
    const pick = autoHighlight && dirty && query ? nodes[0] : nodes.find((node) => node.dataset.key === (selected[0] != null ? keyOf(selected[0]) : undefined));
    setHighlighted(pick?.dataset.key ?? null);
    pick?.scrollIntoView({ block: "nearest" });
    // Solo al abrir y al cambiar el texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  return (
    <div role="listbox" id={context.listboxId} aria-multiselectable={context.multiple || undefined} data-slot="combobox-list" className={cn("ui-combobox__list", className)}>
      {typeof children === "function" ? filtered.map((item, index) => children(item as T, index)) : children}
    </div>
  );
}

export function ComboboxItem({ value, disabled = false, className, children }: { value: unknown; disabled?: boolean; className?: string; children: ReactNode }) {
  const context = useCombobox();
  const key = context.keyOf(value);
  const selected = context.isSelected(value);
  return (
    <div
      role="option"
      id={context.optionId(key)}
      data-key={key}
      data-slot="combobox-item"
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
      <span className="ui-combobox__item-text">{children}</span>
      <span className="ui-combobox__indicator" aria-hidden>{selected ? <CheckIcon /> : null}</span>
    </div>
  );
}

export function ComboboxEmpty({ className, children }: { className?: string; children: ReactNode }) {
  const context = useCombobox();
  if (context.matchCount > 0) return null;
  // Con allowsCustomValue, lo escrito se puede añadir: se dice cómo.
  if (context.allowsCustomValue && context.query.trim()) {
    return <div role="status" data-slot="combobox-empty" className={cn("ui-combobox__empty", className)}>Pulsa Intro para añadir «{context.query.trim()}»</div>;
  }
  return <div role="status" data-slot="combobox-empty" className={cn("ui-combobox__empty", className)}>{children}</div>;
}

export function ComboboxGroup({ items, className, children }: { items: readonly unknown[]; className?: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <GroupContext.Provider value={{ items, labelId }}>
      <div role="group" aria-labelledby={labelId} data-slot="combobox-group" className={cn("ui-combobox__group", className)}>{children}</div>
    </GroupContext.Provider>
  );
}

export function ComboboxLabel({ className, children }: { className?: string; children: ReactNode }) {
  const group = useContext(GroupContext);
  return <div id={group?.labelId} data-slot="combobox-label" className={cn("ui-combobox__label", className)}>{children}</div>;
}

export function ComboboxCollection<T>({ children }: { children: (item: T, index: number) => ReactNode }) {
  const group = useContext(GroupContext);
  return <>{(group?.items ?? []).map((item, index) => children(item as T, index))}</>;
}

export function ComboboxSeparator({ className }: { className?: string }) {
  return <div role="separator" data-slot="combobox-separator" className={cn("ui-combobox__separator", className)} />;
}

/** Caja de la selección múltiple: etiquetas + ComboboxChipsInput. */
export function ComboboxChips({ className, children }: { className?: string; children: ReactNode }) {
  const context = useCombobox();
  const { setAnchor } = context;
  return (
    <div
      ref={setAnchor}
      data-slot="combobox-chips"
      data-disabled={context.disabled ? "" : undefined}
      className={cn("ui-combobox__chips", className)}
      onClick={(event) => {
        if (event.target === event.currentTarget) context.input?.focus();
      }}
    >
      {children}
    </div>
  );
}

/** Etiqueta de una opción elegida. Con `value`, lleva la X para quitarla. */
export function ComboboxChip({ value, className, children }: { value?: unknown; className?: string; children: ReactNode }) {
  const context = useCombobox();
  return (
    <span data-slot="combobox-chip" className={cn("ui-combobox__chip", className)}>
      {children}
      {value !== undefined && !context.disabled ? (
        <button type="button" tabIndex={-1} aria-label={`Quitar ${context.label(value)}`} className="ui-combobox__chip-remove" onClick={() => context.remove(value)}>
          <XIcon aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

export function ComboboxChipsInput({ className, ...props }: Omit<ComponentProps<"input">, "value" | "defaultValue">) {
  const context = useCombobox();
  const onKeyDown = useInputHandlers(context);
  const { setInput } = context;
  const field = useFieldControl(props).props;
  return (
    <input
      ref={setInput}
      {...inputAria(context)}
      {...props}
      {...field}
      disabled={context.disabled}
      data-slot="combobox-chips-input"
      className={cn("ui-combobox__chips-input", className)}
      value={context.query}
      onChange={(event) => {
        context.setQuery(event.target.value);
        context.setOpen(true);
      }}
      onClick={() => context.setOpen(true)}
      onFocus={() => context.setOpen(true)}
      onBlur={() => {
        // Lo escrito y no confirmado se añade al salir, como en un campo de emails.
        if (context.allowsCustomValue && context.query.trim()) context.addCustom(context.query);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

export type SearchableSelectOption = { value: string; label: string; section?: string; hint?: string };

/**
 * Atajo con la API de Select (`value` string, `options`, `onChange`) para las
 * listas largas: buscador, grupos por `section` y, con `hint`, una segunda
 * línea en cada opción. "" es «sin elegir».
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Busca…",
  emptyText = "No hay resultados.",
  showClear = false,
  disabled,
  invalid,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyText?: string;
  showClear?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={className}>
      <Combobox<SearchableSelectOption>
        items={groupOptions(options)}
        value={options.find((option) => option.value === value) ?? null}
        onValueChange={(option) => onChange(option?.value ?? "")}
        disabled={disabled}
        autoHighlight
      >
        <ComboboxInput placeholder={placeholder} aria-label={ariaLabel} aria-invalid={invalid || undefined} showClear={showClear} />
        <OptionsContent emptyText={emptyText} />
      </Combobox>
    </div>
  );
}

/** Opciones planas o agrupadas por `section`, en el orden en que aparecen. */
function groupOptions(options: SearchableSelectOption[]) {
  const sections = [...new Set(options.map((option) => option.section ?? ""))];
  if (!sections.some(Boolean)) return options;
  return sections.map((section) => ({ value: section, items: options.filter((option) => (option.section ?? "") === section) }));
}

function renderOption(option: SearchableSelectOption) {
  return (
    <ComboboxItem key={option.value || "__none"} value={option}>
      {option.label}
      {option.hint ? <span className="ui-combobox__hint">{option.hint}</span> : null}
    </ComboboxItem>
  );
}

function OptionsContent({ emptyText }: { emptyText: ReactNode }) {
  return (
    <ComboboxContent>
      <ComboboxEmpty>{emptyText}</ComboboxEmpty>
      <ComboboxList<SearchableSelectOption | { value: string; items: SearchableSelectOption[] }>>
        {(entry) =>
          "items" in entry ? (
            <ComboboxGroup key={entry.value || "__loose"} items={entry.items}>
              {entry.value ? <ComboboxLabel>{entry.value}</ComboboxLabel> : null}
              <ComboboxCollection<SearchableSelectOption>>{renderOption}</ComboboxCollection>
              <ComboboxSeparator />
            </ComboboxGroup>
          ) : (
            renderOption(entry)
          )
        }
      </ComboboxList>
    </ComboboxContent>
  );
}

/**
 * Selección múltiple con etiquetas y la API de Select (`values` string[]).
 * Con `allowsCustomValue` acepta lo que se escriba (emails, tipografías...):
 * se añade con Intro, coma o al salir del campo.
 */
export function MultiSearchableSelect({
  values,
  onChange,
  options,
  placeholder = "Busca…",
  emptyText = "No hay resultados.",
  allowsCustomValue = false,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyText?: ReactNode;
  allowsCustomValue?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const byValue = new Map(options.map((option) => [option.value, option]));
  const selected = values.map((value) => byValue.get(value) ?? { value, label: value });
  return (
    <div className={className}>
      <Combobox<SearchableSelectOption>
        multiple
        items={groupOptions(options)}
        value={selected}
        onValueChange={(next) => onChange(next.map((entry) => (typeof entry === "string" ? entry : entry.value)))}
        allowsCustomValue={allowsCustomValue}
        disabled={disabled}
        autoHighlight
      >
        <ComboboxChips>
          <ComboboxValue<SearchableSelectOption>>
            {(chosen) =>
              chosen.map((option) => (
                <ComboboxChip key={option.value} value={option}>
                  {option.label}
                </ComboboxChip>
              ))
            }
          </ComboboxValue>
          <ComboboxChipsInput placeholder={values.length ? "" : placeholder} aria-label={ariaLabel} />
        </ComboboxChips>
        <OptionsContent emptyText={emptyText} />
      </Combobox>
    </div>
  );
}
