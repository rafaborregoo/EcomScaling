import type { ComponentProps } from "react";
import { cn } from "./cn";

// Tabla única de la app con la API de shadcn: Table > TableHeader/TableBody/
// TableFooter > TableRow > TableHead/TableCell, más TableCaption. Es un
// <table> nativo dentro de un contenedor con scroll horizontal; los estilos
// viven en globals.css (`.ui-table`, @layer components) para que `className`
// gane. Para listas de registros con orden, búsqueda, paginación o selección,
// usa DataTable (data-table.tsx), que se pinta con estas mismas piezas.

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="ui-table-container">
      <table data-slot="table" className={cn("ui-table", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("ui-table__header", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("ui-table__body", className)} {...props} />;
}

export function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
  return <tfoot data-slot="table-footer" className={cn("ui-table__footer", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("ui-table__row", className)} {...props} />;
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return <th data-slot="table-head" className={cn("ui-table__head", className)} {...props} />;
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("ui-table__cell", className)} {...props} />;
}

export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("ui-table__caption", className)} {...props} />;
}
