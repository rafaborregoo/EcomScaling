"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "./cn.js";

// Combobox: selector personalizado (boton + panel) para reemplazar el
// <select> nativo donde el contexto importa (cliente activo, tienda activa).
// Mismo lenguaje tipografico que Field (kicker mono uppercase + valor
// subrayado), panel plano con separadores de linea, sin sombras: la
// separacion del panel respecto al fondo la da el borde + blanco solido, no
// una sombra (ver ADR-0013 -- se quito una sombra dura que sobrevivio a la
// auditoria de FE-00).
export type ComboboxOption = { value: string; label: string; hint?: string };

export function Combobox({
  label,
  value,
  options,
  onChange,
  placeholder = "Sin opciones",
  className,
}: {
  label: ReactNode;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.find((option) => option.value === value) ?? null;

  function closeAndReturnFocus() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  // Navegacion por teclado tipo listbox (flechas mueven el foco entre
  // opciones, Home/End saltan a los extremos, Escape cierra y devuelve el
  // foco al trigger).
  function focusOption(index: number) {
    const clamped = Math.max(0, Math.min(index, options.length - 1));
    optionRefs.current[clamped]?.focus();
  }

  function handleListKeyDown(event: ReactKeyboardEvent) {
    const currentIndex = optionRefs.current.findIndex((el) => el === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(currentIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(options.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndReturnFocus();
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const selectedIndex = options.findIndex((option) => option.value === value);
      focusOption(selectedIndex >= 0 ? selectedIndex : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir, no en cada cambio de value/options.
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        className="block w-full cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
        disabled={options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <span className="block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 border-b border-edge-strong pb-1 text-sm font-medium transition-colors group-hover:border-ink">
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <svg
            aria-hidden
            viewBox="0 0 10 6"
            className={cn("size-2.5 shrink-0 transition-transform", isOpen && "rotate-180")}
          >
            <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-label={typeof label === "string" ? label : "Opciones"}
          onKeyDown={handleListKeyDown}
          className="absolute left-0 top-full z-40 mt-1.5 max-h-72 w-max min-w-full overflow-y-auto border border-ink bg-white"
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={cn(
                "block w-full whitespace-nowrap px-3 py-2 text-left text-sm transition-colors",
                option.value === value
                  ? "bg-black text-white"
                  : "text-black hover:bg-surface focus-visible:bg-surface",
              )}
              onClick={() => {
                onChange(option.value);
                closeAndReturnFocus();
              }}
            >
              {option.label}
              {option.hint ? (
                <span className={cn("ml-2 font-mono text-xs", option.value === value ? "text-white/60" : "text-muted")}>
                  {option.hint}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
