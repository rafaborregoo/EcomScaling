"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowSelectionState,
  type Updater,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Settings2Icon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button, buttonVariants } from "./button";
import { Card, CardContent } from "./card";
import { Checkbox } from "./checkbox";
import { cn } from "./cn";
import { EmptyState } from "./empty";
import { Field } from "./field";
import { Input } from "./input";
import { Select } from "./select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { EYEBROW } from "./typography";

// Tabla de datos única de la app: la guía Data Table de shadcn sobre TanStack
// Table v9, extraída a un componente reutilizable. Se describe con columnas
// sencillas ({ key, label, render }) y cada pantalla enciende lo que necesita:
//
// - Ordenar: automático en toda columna cuyo valor sea texto o número
//   (`row[key]`, o `value(row)` si la celda pinta otra cosa). `sortable: false`
//   lo apaga.
// - Buscar: `searchPlaceholder` pinta la caja de búsqueda sobre todas las
//   columnas con valor.
// - Paginar: siempre, `pageSize` filas por página (20); los controles solo
//   aparecen si hay más de una página.
// - Ocultar columnas: `columnToggle` (solo en escritorio, como shadcn).
// - Seleccionar filas: `selected` + `onSelectedChange` (ids). Solo donde la
//   lista tiene una acción en bloque.
//
// Debajo de `lg` (sin sidebar) cada fila se apila como una Card: primera
// columna = título, el resto = pares etiqueta/valor, columnas sin `label` =
// acciones a pie de tarjeta. `row.id` es obligatorio: es el id de fila.

export type DataTableColumn<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** Valor para ordenar y buscar cuando la celda no es `row[key]` tal cual. */
  value?: (row: T) => string | number | null | undefined;
  sortable?: boolean;
  align?: "start" | "end";
};

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime, text: sortFn_text },
});

type Features = typeof features;
type Primitive = string | number | undefined;

const PAGE_SIZES = [10, 20, 50, 100];

function valueOf<T>(column: DataTableColumn<T>, row: T): Primitive {
  const value = column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function cellOf<T>(column: DataTableColumn<T>, row: T) {
  return column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "");
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  ariaLabel,
  emptyLabel,
  className,
  mobileLayout = "cards",
  searchPlaceholder,
  pageSize = 20,
  columnToggle = false,
  selected,
  onSelectedChange,
  toolbar,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  ariaLabel: string;
  emptyLabel?: string;
  className?: string;
  mobileLayout?: "cards" | "list";
  searchPlaceholder?: string;
  pageSize?: number;
  columnToggle?: boolean;
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Acciones a la derecha de la barra (p. ej. la acción en bloque de la selección). */
  toolbar?: ReactNode;
}) {
  const selectable = Boolean(onSelectedChange);
  const byKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);
  const tableColumns = useMemo<ColumnDef<Features, T>[]>(
    () =>
      columns.map((column) => ({
        id: column.key,
        accessorFn: (row: T) => valueOf(column, row),
        // Con una sola fila no hay nada que ordenar: la cabecera queda en texto.
        enableSorting: rows.length > 1 && (column.sortable ?? rows.some((row) => valueOf(column, row) !== undefined)),
        enableHiding: Boolean(column.label.trim()) && column !== columns[0],
        sortUndefined: "last" as const,
      })),
    [columns, rows],
  );
  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries((selected ?? []).map((id) => [id, true])),
    [selected],
  );

  const table = useTable({
    features,
    data: rows,
    columns: tableColumns,
    getRowId: (row: T) => row.id,
    autoResetPageIndex: false,
    initialState: { pagination: { pageIndex: 0, pageSize } },
    ...(selectable
      ? {
          state: { rowSelection },
          onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
            const next = typeof updater === "function" ? updater(rowSelection) : updater;
            onSelectedChange?.(Object.keys(next).filter((id) => next[id]));
          },
        }
      : { enableRowSelection: false }),
  });

  // Si los datos encogen (refresco, filtro de la pantalla) y la página actual
  // se queda vacía, vuelve a la última que existe.
  const pageCount = table.getPageCount();
  const { pageIndex } = table.state.pagination;
  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= pageCount) table.setPageIndex(Math.max(0, pageCount - 1));
  }, [pageIndex, pageCount, table]);

  const [query, setQuery] = useState("");

  if (rows.length === 0 && emptyLabel) {
    return <EmptyState size="sm" title={emptyLabel} />;
  }

  const visible = table
    .getVisibleLeafColumns()
    .map((column) => ({ column, def: byKey.get(column.id)! }))
    .filter((entry) => entry.def);
  const pageRows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const selectedCount = selectable ? Object.keys(rowSelection).length : 0;
  const [titleColumn, ...restColumns] = visible.map((entry) => entry.def);
  const labelledColumns = restColumns.filter((column) => column.label.trim());
  const actionColumns = restColumns.filter((column) => !column.label.trim());
  const hideable = table.getAllLeafColumns().filter((column) => column.getCanHide());
  const showToolbar = Boolean(searchPlaceholder || toolbar || (columnToggle && hideable.length));

  return (
    <div data-slot="data-table" className={cn("ui-data-table", className)}>
      {showToolbar ? (
        <div className="ui-data-table__toolbar">
          {searchPlaceholder ? (
            <Input
              type="search"
              autoComplete="off"
              value={query}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="max-w-sm"
              onChange={(event) => {
                setQuery(event.target.value);
                table.setGlobalFilter(event.target.value);
                table.setPageIndex(0);
              }}
            />
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {toolbar}
            {columnToggle && hideable.length ? (
              <Popover>
                <PopoverTrigger
                  render={<button type="button" className={buttonVariants({ variant: "outline", size: "sm", className: "hidden lg:inline-flex" })}>
                    <Settings2Icon aria-hidden />
                    Columnas
                  </button>}
                />
                <PopoverContent side="bottom" align="end" className="w-56 p-3" aria-label="Columnas visibles">
                  <div className="grid gap-2">
                    {hideable.map((column) => (
                      <Checkbox
                        key={column.id}
                        checked={column.getIsVisible()}
                        onCheckedChange={(checked) => column.toggleVisibility(checked)}
                      >
                        {byKey.get(column.id)?.label}
                      </Checkbox>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Móvil y tablet (`<lg`, sin sidebar): filas apiladas como Card. */}
      <ul
        className={cn(mobileLayout === "list" ? "divide-y divide-separator" : "grid gap-3", "lg:hidden")}
        aria-label={ariaLabel}
      >
        {pageRows.map((row) => {
          const content = (
            <div className="text-sm">
              <div className="flex items-start gap-3">
                {selectable ? (
                  <Checkbox
                    aria-label="Seleccionar fila"
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked)}
                  />
                ) : null}
                {titleColumn ? <div className="min-w-0 font-medium text-foreground">{cellOf(titleColumn, row.original)}</div> : null}
              </div>
              {labelledColumns.length ? (
                <dl className="mt-2 grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-1.5">
                  {labelledColumns.map((column) => (
                    <div key={column.key} className="contents">
                      <dt className={cn(EYEBROW, "self-center")}>{column.label}</dt>
                      <dd className="min-w-0 text-right">{cellOf(column, row.original)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {actionColumns.length ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-separator pt-3">
                  {actionColumns.map((column) => (
                    <div key={column.key}>{cellOf(column, row.original)}</div>
                  ))}
                </div>
              ) : null}
            </div>
          );
          return (
            <li key={row.id} className={mobileLayout === "list" ? "py-3 first:pt-0 last:pb-0" : undefined}>
              {mobileLayout === "list" ? content : <Card><CardContent>{content}</CardContent></Card>}
            </li>
          );
        })}
        {pageRows.length === 0 ? <li className="text-sm text-muted">Sin resultados.</li> : null}
      </ul>

      {/* lg+ (con sidebar): la tabla. */}
      <div className="ui-data-table__frame hidden lg:block">
        <Table aria-label={ariaLabel}>
          <TableHeader>
            <TableRow>
              {selectable ? (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Seleccionar todas las filas de la página"
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
                  />
                </TableHead>
              ) : null}
              {visible.map(({ column, def }) => {
                const sorted = column.getIsSorted();
                return (
                  <TableHead
                    key={column.id}
                    data-align={def.align}
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                  >
                    {column.getCanSort() && def.label.trim() ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ui-data-table__sort"
                        onClick={() => column.toggleSorting(sorted === "asc")}
                      >
                        {def.label}
                        {sorted === "asc" ? <ArrowUpIcon aria-hidden /> : sorted === "desc" ? <ArrowDownIcon aria-hidden /> : <ArrowUpDownIcon aria-hidden />}
                      </Button>
                    ) : (
                      def.label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length ? (
              pageRows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {selectable ? (
                    <TableCell>
                      <Checkbox
                        aria-label="Seleccionar fila"
                        checked={row.getIsSelected()}
                        onCheckedChange={(checked) => row.toggleSelected(checked)}
                      />
                    </TableCell>
                  ) : null}
                  {visible.map(({ column, def }) => (
                    <TableCell key={column.id} data-align={def.align}>
                      {cellOf(def, row.original)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={visible.length + (selectable ? 1 : 0)} className="h-24 text-center text-muted">
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 || selectable ? (
        <div className="ui-data-table__footer">
          <p className="flex-1 text-sm text-muted tabular-nums">
            {selectable
              ? `${selectedCount} de ${filteredCount} fila(s) seleccionada(s).`
              : `${filteredCount} fila(s)`}
          </p>
          {pageCount > 1 ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Field orientation="horizontal" label="Filas por página" className="hidden w-auto gap-2 sm:flex">
                <Select
                  className="w-20"
                  value={String(table.state.pagination.pageSize)}
                  onChange={(value) => table.setPageSize(Number(value))}
                  options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
                />
              </Field>
              <span className="text-sm font-medium tabular-nums">
                Página {pageIndex + 1} de {pageCount}
              </span>
              <div role="group" aria-label="Paginación" className="flex items-center gap-2">
                <Button variant="outline" size="icon-sm" className="hidden lg:inline-flex" aria-label="Primera página" disabled={!table.getCanPreviousPage()} onClick={() => table.setPageIndex(0)}>
                  <ChevronsLeftIcon aria-hidden />
                </Button>
                <Button variant="outline" size="icon-sm" aria-label="Página anterior" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
                  <ChevronLeftIcon aria-hidden />
                </Button>
                <Button variant="outline" size="icon-sm" aria-label="Página siguiente" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
                  <ChevronRightIcon aria-hidden />
                </Button>
                <Button variant="outline" size="icon-sm" className="hidden lg:inline-flex" aria-label="Última página" disabled={!table.getCanNextPage()} onClick={() => table.setPageIndex(pageCount - 1)}>
                  <ChevronsRightIcon aria-hidden />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
