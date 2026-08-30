"use client";

import type { ReactNode } from "react";
import {
  TableBody as HeroTableBody,
  TableCell as HeroTableCell,
  TableColumn as HeroTableColumn,
  TableContent as HeroTableContent,
  TableHeader as HeroTableHeader,
  TableRoot as HeroTableRoot,
  TableRow as HeroTableRow,
  TableScrollContainer as HeroTableScrollContainer,
} from "@heroui/react";
import { cn } from "./cn";
import { EYEBROW } from "./typography";

export type TableColumnDef<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

function cellValue<T extends { id: string }>(column: TableColumnDef<T>, row: T) {
  return column.render
    ? column.render(row)
    : String((row as Record<string, unknown>)[column.key] ?? "");
}

/**
 * Tabla generica sobre HeroUI (columnas estaticas, filas dinamicas via `items`).
 * `row.id` es obligatorio -- react-aria-components lo usa como key de la coleccion.
 *
 * En movil (`<md`) la tabla no scrollea en horizontal: cada fila se apila como
 * una tarjeta (primera columna = titulo, resto = pares etiqueta/valor,
 * columnas sin `label` = accion a pie de tarjeta). En `md+` es la tabla normal.
 */
export function Table<T extends { id: string }>({
  columns,
  rows,
  ariaLabel,
  emptyLabel,
  className,
}: {
  columns: TableColumnDef<T>[];
  rows: T[];
  ariaLabel: string;
  emptyLabel?: string;
  className?: string;
}) {
  if (rows.length === 0 && emptyLabel) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  const [titleColumn, ...restColumns] = columns;
  const labelledColumns = restColumns.filter((column) => column.label.trim());
  const actionColumns = restColumns.filter((column) => !column.label.trim());

  return (
    <>
      {/* Movil: filas apiladas como tarjetas. */}
      <ul className={cn("grid gap-3 md:hidden", className)} aria-label={ariaLabel}>
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-md border border-edge bg-white p-3.5 text-sm"
          >
            {titleColumn ? (
              <div className="font-medium">{cellValue(titleColumn, row)}</div>
            ) : null}
            {labelledColumns.length ? (
              <dl className="mt-2 grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
                {labelledColumns.map((column) => (
                  <div key={column.key} className="contents">
                    <dt className={cn(EYEBROW, "self-center")}>{column.label}</dt>
                    <dd className="min-w-0 text-right">{cellValue(column, row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {actionColumns.length ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-edge pt-3">
                {actionColumns.map((column) => (
                  <div key={column.key}>{cellValue(column, row)}</div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {/* md+: tabla normal con scroll horizontal de reserva. */}
      <HeroTableRoot className={cn("hidden md:block", className)}>
        <HeroTableScrollContainer>
          <HeroTableContent aria-label={ariaLabel}>
            <HeroTableHeader>
              {columns.map((column) => (
                <HeroTableColumn key={column.key} id={column.key} isRowHeader={column === columns[0]}>
                  {column.label}
                </HeroTableColumn>
              ))}
            </HeroTableHeader>
            <HeroTableBody items={rows}>
              {(row: T) => (
                <HeroTableRow id={row.id}>
                  {columns.map((column) => (
                    <HeroTableCell key={column.key}>{cellValue(column, row)}</HeroTableCell>
                  ))}
                </HeroTableRow>
              )}
            </HeroTableBody>
          </HeroTableContent>
        </HeroTableScrollContainer>
      </HeroTableRoot>
    </>
  );
}
