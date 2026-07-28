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

export type TableColumnDef<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

/**
 * Tabla generica sobre HeroUI (columnas estaticas, filas dinamicas via `items`).
 * `row.id` es obligatorio -- react-aria-components lo usa como key de la coleccion.
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

  return (
    <HeroTableRoot className={className}>
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
                  <HeroTableCell key={column.key}>
                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "")}
                  </HeroTableCell>
                ))}
              </HeroTableRow>
            )}
          </HeroTableBody>
        </HeroTableContent>
      </HeroTableScrollContainer>
    </HeroTableRoot>
  );
}
