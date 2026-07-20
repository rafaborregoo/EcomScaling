"use client";

// Design system v2 "Libro Mayor" (FE-08).
// Lenguaje editorial: contenido plano sobre el lienzo, separadores de linea
// fina en lugar de cajas con borde, jerarquia por tipografia (font-display
// serif para titulares, mono para cifras), esquinas rectas, rojo de marca
// como acento puntual. Formularios subrayados, sin cajitas.
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Botones: primario negro nitido; secundario y ghost como enlaces subrayados
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md";

const buttonBase: Record<ButtonVariant, string> = {
  primary:
    "bg-black font-medium text-white transition hover:bg-brand disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "bg-brand font-medium text-white transition hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "font-medium underline decoration-edge-strong decoration-1 underline-offset-4 transition hover:text-brand hover:decoration-brand disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "text-muted underline decoration-transparent underline-offset-4 transition hover:text-brand hover:decoration-brand disabled:cursor-not-allowed disabled:opacity-50",
};

const solidSizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
};

const linkSizes: Record<ButtonSize, string> = {
  sm: "text-xs",
  md: "text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  const isSolid = variant === "primary" || variant === "danger";

  return (
    <button
      className={cn(isSolid ? solidSizes[size] : linkSizes[size], buttonBase[variant], className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Secciones planas: regla superior + kicker en small caps + titular serif
// ---------------------------------------------------------------------------

export function Card({
  title,
  kicker,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  kicker?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-ink/20 pt-5", className)}>
      {title || kicker || actions ? (
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            {kicker ? (
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{kicker}</p>
            ) : null}
            {title ? (
              <h3 className="font-display text-xl leading-snug">{title}</h3>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={title || kicker || actions ? "mt-5" : undefined}>{children}</div>
    </section>
  );
}

// Alias semantico para nuevas paginas.
export const Section = Card;

// ---------------------------------------------------------------------------
// Cifras protagonistas
// ---------------------------------------------------------------------------

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "success" | "danger";
  className?: string;
}) {
  return (
    <div className={cn("py-1", className)}>
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-3xl tracking-tight",
          tone === "success" && "text-success",
          tone === "danger" && "text-brand",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 font-mono text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges de punto y banners de regla lateral (sin cajas rellenas)
// ---------------------------------------------------------------------------

type Tone = "neutral" | "brand" | "success" | "warn" | "danger";

const badgeDot: Record<Tone, string> = {
  neutral: "bg-edge-strong",
  brand: "bg-brand",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-brand",
};

const badgeText: Record<Tone, string> = {
  neutral: "text-muted",
  brand: "text-brand",
  success: "text-success",
  warn: "text-warn-deep",
  danger: "text-brand-deep",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide",
        badgeText[tone],
        className,
      )}
    >
      <span aria-hidden className={cn("inline-block size-1.5 rounded-full", badgeDot[tone])} />
      {children}
    </span>
  );
}

const bannerTones: Record<"success" | "warn" | "danger", string> = {
  success: "border-success text-success",
  warn: "border-warn text-warn-deep",
  danger: "border-brand text-brand-deep",
};

export function Banner({
  tone = "danger",
  className,
  children,
}: {
  tone?: "success" | "warn" | "danger";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("border-l-2 py-0.5 pl-3 text-sm leading-6", bannerTones[tone], className)} role="status">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formularios subrayados
// ---------------------------------------------------------------------------

const fieldClass =
  "w-full rounded-none border-0 border-b border-edge-strong bg-transparent px-0 py-2 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-ink disabled:opacity-50";

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldClass, "cursor-pointer", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldClass, "border border-edge-strong px-3 py-2 focus:border-ink", className)}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Estados planos (loading, error, vacio) y estado de sync
// ---------------------------------------------------------------------------

export function LoadingBlock({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="border-t border-edge pt-5">
      <p className="animate-pulse text-sm text-muted">{label}</p>
    </div>
  );
}

export function ErrorBlock({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-2 border-brand py-0.5 pl-3 text-sm leading-6 text-brand-deep" role="alert">
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-t border-edge py-10 text-center">
      <p className="font-display text-2xl">{title}</p>
      {hint ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{hint}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

// Estado de sincronizacion unico para todas las superficies.
export type SyncState = "in_progress" | "ok" | "partial" | "failed" | "stale" | "never";

const syncStateConfig: Record<SyncState, { label: string; tone: Tone }> = {
  in_progress: { label: "Sincronizando...", tone: "brand" },
  ok: { label: "Al dia", tone: "success" },
  partial: { label: "Parcial", tone: "warn" },
  failed: { label: "Fallido", tone: "danger" },
  stale: { label: "Desactualizado", tone: "warn" },
  never: { label: "Sin sincronizar", tone: "neutral" },
};

export function SyncStateBadge({ state, detail }: { state: SyncState; detail?: string }) {
  const config = syncStateConfig[state];
  return (
    <Badge tone={config.tone}>
      {config.label}
      {detail ? ` - ${detail}` : ""}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Tabs: navegacion horizontal dentro de una pagina densa, para partirla en
// vistas mas claras en vez de scroll infinito. Mismo lenguaje que el
// selector de periodo ya usado en dashboard/shopify (subrayado + negro).
// ---------------------------------------------------------------------------

export type TabItem = { value: string; label: string };

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-6 border-b border-line", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "border-b-2 pb-3 text-sm transition-colors",
              active ? "border-brand font-medium text-black" : "border-transparent text-muted hover:text-black",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination: control moderno de paginado. Numeros mono, pagina activa en
// negro solido, resto como enlaces subrayados; colapsa con puntos suspensivos
// cuando hay muchas paginas en vez de listarlas todas.
// ---------------------------------------------------------------------------

function paginationRange(page: number, pageCount: number): Array<number | "ellipsis"> {
  const delta = 1;
  const range: Array<number | "ellipsis"> = [];
  const start = Math.max(2, page - delta);
  const end = Math.min(pageCount - 1, page + delta);

  range.push(1);
  if (start > 2) {
    range.push("ellipsis");
  }
  for (let index = start; index <= end; index += 1) {
    range.push(index);
  }
  if (end < pageCount - 1) {
    range.push("ellipsis");
  }
  if (pageCount > 1) {
    range.push(pageCount);
  }

  return range;
}

export function Pagination({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Paginacion"
      className={cn("flex items-center justify-between gap-4 border-t border-line pt-3 font-mono text-xs", className)}
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="uppercase tracking-wide text-muted underline decoration-transparent underline-offset-4 transition hover:text-brand hover:decoration-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted"
      >
        ← Anterior
      </button>
      <div className="flex items-center gap-1">
        {paginationRange(page, pageCount).map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-1.5 text-muted">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? "page" : undefined}
              onClick={() => onChange(item)}
              className={cn(
                "size-6 rounded-sm text-center transition",
                item === page ? "bg-black text-white" : "text-muted hover:text-black",
              )}
            >
              {item}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className="uppercase tracking-wide text-muted underline decoration-transparent underline-offset-4 transition hover:text-brand hover:decoration-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted"
      >
        Siguiente →
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Combobox: selector personalizado (boton + panel) para reemplazar el
// <select> nativo donde el contexto importa (cliente activo, tienda activa).
// Mismo lenguaje tipografico que Field (kicker mono uppercase + valor
// subrayado), panel plano con separadores de linea, sin sombras pesadas.
// ---------------------------------------------------------------------------

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
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        className="block w-full cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
        disabled={options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
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
          className="absolute left-0 top-full z-40 mt-1.5 max-h-72 w-max min-w-full overflow-y-auto border border-ink bg-white shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={cn(
                "block w-full whitespace-nowrap px-3 py-2 text-left text-sm transition-colors hover:bg-surface",
                option.value === value ? "bg-black text-white hover:bg-black" : "text-black",
              )}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
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
