"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "./cn";

// Lista con buscador y teclado, con la API de shadcn (Command > CommandInput +
// CommandList > CommandEmpty / CommandGroup > CommandItem…). Nativo, sin cmdk:
// patrón WAI-ARIA combobox + listbox con aria-activedescendant. El foco se
// queda en el buscador; ↑↓, Inicio/Fin y Enter mueven y eligen. El filtro no
// distingue mayúsculas ni acentos ("campana" encuentra "Campañas") y exige
// todas las palabras escritas. Un grupo sin resultados desaparece (CSS :has).
// Estilos: `.ui-command` en globals.css. Inventario: docs/INVENTARIO_COMMAND.md.

type CommandContextValue = {
  search: string;
  setSearch: (search: string) => void;
  shouldFilter: boolean;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  listId: string;
  listNode: HTMLDivElement | null;
  setListNode: (node: HTMLDivElement | null) => void;
  visibleCount: number;
};

const CommandContext = createContext<CommandContextValue | null>(null);

function useCommand(name: string) {
  const context = useContext(CommandContext);
  if (!context) throw new Error(`${name} tiene que ir dentro de <Command>`);
  return context;
}

const ITEM_SELECTOR = '[data-slot="command-item"]:not([data-disabled])';

/** Texto sin mayúsculas ni acentos, para comparar. */
export function normalizeSearch(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");
}

/** ¿Contiene `text` todas las palabras de `search`? */
export function matchesSearch(text: string, search: string) {
  const haystack = normalizeSearch(text);
  return normalizeSearch(search).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

export function Command({
  shouldFilter = true,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { shouldFilter?: boolean }) {
  const [search, setSearchState] = useState("");
  const searchChanged = useRef(false);
  const setSearch = useCallback((next: string) => {
    searchChanged.current = true;
    setSearchState(next);
  }, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [listNode, setListNode] = useState<HTMLDivElement | null>(null);
  const listId = useId();

  // Cada vez que cambian las opciones (filtro, datos que llegan): cuántas
  // quedan y, si la activa desapareció, la primera pasa a ser la activa.
  useLayoutEffect(() => {
    if (!listNode) return;
    const sync = () => {
      const items = [...listNode.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
      setVisibleCount(items.length);
      // Al escribir, la primera opción vuelve a ser la activa.
      const restart = searchChanged.current;
      searchChanged.current = false;
      if (restart) listNode.scrollTo({ top: 0 });
      setActiveId((current) => (!restart && items.some((item) => item.id === current) ? current : (items[0]?.id ?? null)));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(listNode, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-disabled"] });
    return () => observer.disconnect();
  }, [listNode]);

  return (
    <CommandContext.Provider value={{ search, setSearch, shouldFilter, activeId, setActiveId, listId, listNode, setListNode, visibleCount }}>
      <div data-slot="command" data-searching={search ? "" : undefined} className={cn("ui-command", className)} {...props}>
        {children}
      </div>
    </CommandContext.Provider>
  );
}

/** Con `render` (p. ej. el <textarea> de un chat) ese campo maneja la lista:
 *  recibe el teclado y los atributos ARIA, pero su valor sigue siendo suyo
 *  (usar con `<Command shouldFilter={false}>`). Las flechas solo se roban
 *  mientras hay opciones a la vista. */
export function CommandInput({
  className,
  value,
  onValueChange,
  onKeyDown,
  render,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange"> & {
  value?: string;
  onValueChange?: (value: string) => void;
  render?: ReactElement<{ onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void }>;
}) {
  const command = useCommand("CommandInput");
  const { setSearch } = command;
  useEffect(() => {
    if (value !== undefined) setSearch(value);
  }, [value, setSearch]);

  const move = (event: KeyboardEvent<HTMLElement>) => {
    const items = [...(command.listNode?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])];
    if (!items.length) return;
    const index = items.findIndex((item) => item.id === command.activeId);
    let next: HTMLElement | undefined;
    if (event.key === "ArrowDown") next = items[Math.min(index + 1, items.length - 1)];
    else if (event.key === "ArrowUp") next = items[Math.max(index - 1, 0)];
    else if (event.key === "Home" && event.ctrlKey) next = items[0];
    else if (event.key === "End" && event.ctrlKey) next = items.at(-1);
    else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      if (index >= 0) {
        event.preventDefault();
        items[index]!.click();
      }
      return;
    } else return;
    event.preventDefault();
    if (next) {
      command.setActiveId(next.id);
      next.scrollIntoView({ block: "nearest" });
    }
  };

  if (render) {
    const own = render.props.onKeyDown;
    return cloneElement(render, {
      "aria-controls": command.listId,
      "aria-activedescendant": command.activeId ?? undefined,
      "aria-autocomplete": "list",
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        move(event);
        if (!event.defaultPrevented) own?.(event);
      },
    } as Record<string, unknown>);
  }

  return (
    <div data-slot="command-input-wrapper" className="ui-command__input">
      <SearchIcon aria-hidden />
      <input
        type="text"
        role="combobox"
        aria-expanded
        aria-autocomplete="list"
        aria-controls={command.listId}
        aria-activedescendant={command.activeId ?? undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        data-slot="command-input"
        className={className}
        value={value ?? command.search}
        onChange={(event) => {
          command.setSearch(event.target.value);
          onValueChange?.(event.target.value);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) move(event);
        }}
        {...props}
      />
    </div>
  );
}

export function CommandList({ className, ...props }: ComponentProps<"div">) {
  const { setListNode, listId } = useCommand("CommandList");
  return (
    <div
      ref={setListNode}
      id={listId}
      role="listbox"
      data-slot="command-list"
      className={cn("ui-command__list", className)}
      {...props}
    />
  );
}

export function CommandEmpty({ className, ...props }: ComponentProps<"div">) {
  const command = useCommand("CommandEmpty");
  if (command.visibleCount > 0) return null;
  return <div role="presentation" data-slot="command-empty" className={cn("ui-command__empty", className)} {...props} />;
}

export function CommandGroup({
  heading,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "title"> & { heading?: ReactNode }) {
  const headingId = useId();
  return (
    <div
      role="group"
      aria-labelledby={heading ? headingId : undefined}
      data-slot="command-group"
      className={cn("ui-command__group", className)}
      {...props}
    >
      {heading ? <div id={headingId} className="ui-command__heading" aria-hidden>{heading}</div> : null}
      {children}
    </div>
  );
}

export function CommandItem({
  value,
  keywords = [],
  disabled = false,
  onSelect,
  className,
  children,
  ...props
}: Omit<ComponentProps<"div">, "onSelect"> & {
  /** Texto por el que se busca; si falta, el texto de `children`. Lo recibe `onSelect`. */
  value?: string;
  /** Más texto por el que encontrarlo (sinónimos, la sección a la que pertenece…). */
  keywords?: string[];
  disabled?: boolean;
  onSelect?: (value: string) => void;
}) {
  const command = useCommand("CommandItem");
  const id = useId();
  const text = value ?? nodeText(Children.toArray(children));
  if (command.shouldFilter && command.search && !matchesSearch([text, ...keywords].join(" "), command.search)) return null;
  const selected = command.activeId === id;

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      data-slot="command-item"
      data-selected={selected ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      className={cn("ui-command__item", className)}
      onPointerMove={() => {
        if (!disabled && !selected) command.setActiveId(id);
      }}
      onClick={() => {
        if (!disabled) onSelect?.(text);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CommandSeparator({ className, ...props }: ComponentProps<"div">) {
  return <div role="separator" data-slot="command-separator" className={cn("ui-command__separator", className)} {...props} />;
}

export function CommandShortcut({ className, ...props }: ComponentProps<"span">) {
  return <span data-slot="command-shortcut" className={cn("ui-command__shortcut", className)} {...props} />;
}

/** La paleta: un <dialog> modal con un Command dentro. Escape o pulsar fuera cierran. */
export function CommandDialog({
  open,
  onOpenChange,
  title = "Paleta de comandos",
  description = "Busca una sección o una acción",
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-slot="command-dialog"
      className={cn("ui-command-dialog", className)}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClick={(event) => {
        // Pulsar en el fondo (el propio <dialog>, fuera de su contenido) cierra.
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <h2 id={titleId} className="sr-only">{title}</h2>
      <p className="sr-only">{description}</p>
      {open ? children : null}
    </dialog>
  );
}
