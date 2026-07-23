"use client";

import { cn } from "./cn.js";

// Pagination: control moderno de paginado. Numeros mono, pagina activa en
// negro solido, resto como enlaces subrayados; colapsa con puntos suspensivos
// cuando hay muchas paginas en vez de listarlas todas. Sin sombras, esquinas
// rectas -- para conservar la posicion del usuario al volver, usar el hook
// usePaginatedUrl (apps/web) en vez de estado en memoria (ver ADR-0013).
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
                "size-6 text-center transition",
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
