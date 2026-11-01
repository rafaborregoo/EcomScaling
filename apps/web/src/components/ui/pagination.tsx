import type { ComponentProps } from "react";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { buttonVariants } from "./button";
import { cn } from "./cn";

// Paginación con la API de shadcn: Pagination > PaginationContent >
// PaginationItem > PaginationLink / Previous / Next / Ellipsis. Nativa: un
// <nav> con una lista; cada enlace es un <a> si lleva `href` (páginas con URL)
// y un <button> si no (estado de la pantalla, lo habitual aquí).
//
// `<Pagination page pageCount onChange />` es el atajo que usa casi toda la
// app: pinta el rango con elipsis (1 … 4 5 6 … 20) y no se ve con una página.
// Estilos: `.ui-pagination` en globals.css.

function paginationRange(page: number, pageCount: number): Array<number | "ellipsis"> {
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  const range: Array<number | "ellipsis"> = [1];
  if (start > 2) range.push("ellipsis");
  for (let index = start; index <= end; index += 1) range.push(index);
  if (end < pageCount - 1) range.push("ellipsis");
  if (pageCount > 1) range.push(pageCount);
  return range;
}

type PaginationShortcut = { page: number; pageCount: number; onChange: (page: number) => void };

export function Pagination({
  page,
  pageCount,
  onChange,
  className,
  children,
  ...props
}: Omit<ComponentProps<"nav">, "onChange"> & Partial<PaginationShortcut>) {
  if (page !== undefined && pageCount !== undefined && onChange) {
    if (pageCount <= 1) return null;
    children = (
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious disabled={page <= 1} onClick={() => onChange(page - 1)} />
        </PaginationItem>
        {paginationRange(page, pageCount).map((item, index) => (
          <PaginationItem key={item === "ellipsis" ? `ellipsis-${index}` : item}>
            {item === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink isActive={item === page} onClick={() => onChange(item)}>
                {item}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext disabled={page >= pageCount} onClick={() => onChange(page + 1)} />
        </PaginationItem>
      </PaginationContent>
    );
  }
  return (
    <nav aria-label="Paginación" data-slot="pagination" className={cn("ui-pagination", className)} {...props}>
      {children}
    </nav>
  );
}

export function PaginationContent({ className, ...props }: ComponentProps<"ul">) {
  return <ul data-slot="pagination-content" className={cn("ui-pagination__content", className)} {...props} />;
}

export function PaginationItem(props: ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
  size?: "icon" | "default";
  disabled?: boolean;
} & (ComponentProps<"a"> | ComponentProps<"button">);

export function PaginationLink({ isActive, size = "icon", disabled, className, ...props }: PaginationLinkProps) {
  const shared = {
    "aria-current": isActive ? ("page" as const) : undefined,
    "data-slot": "pagination-link",
    "data-active": isActive || undefined,
    className: buttonVariants({ variant: isActive ? "outline" : "ghost", size: size === "icon" ? "icon-sm" : "sm", className: cn("ui-pagination__link", className) }),
  };
  if ("href" in props && props.href !== undefined) {
    // Un enlace no se puede desactivar: sin href y aria-disabled.
    const { href, ...rest } = props as ComponentProps<"a">;
    return <a {...rest} {...shared} href={disabled ? undefined : href} aria-disabled={disabled || undefined} />;
  }
  return <button type="button" {...(props as ComponentProps<"button">)} {...shared} disabled={disabled} />;
}

export function PaginationPrevious({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink aria-label="Página anterior" size="default" className={cn("ui-pagination__step", className)} {...props}>
      <ChevronLeftIcon aria-hidden />
      <span className="ui-pagination__step-label">Anterior</span>
    </PaginationLink>
  );
}

export function PaginationNext({ className, ...props }: PaginationLinkProps) {
  return (
    <PaginationLink aria-label="Página siguiente" size="default" className={cn("ui-pagination__step", className)} {...props}>
      <span className="ui-pagination__step-label">Siguiente</span>
      <ChevronRightIcon aria-hidden />
    </PaginationLink>
  );
}

export function PaginationEllipsis({ className, ...props }: ComponentProps<"span">) {
  return (
    <span aria-hidden data-slot="pagination-ellipsis" className={cn("ui-pagination__ellipsis", className)} {...props}>
      <MoreHorizontalIcon />
      <span className="sr-only">Más páginas</span>
    </span>
  );
}
