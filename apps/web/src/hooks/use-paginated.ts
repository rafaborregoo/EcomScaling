"use client";

import { useMemo, useState } from "react";

/** Pagina un array en memoria; resetea a la pagina 1 si el array cambia de tamaño de forma que la pagina actual ya no existe. */
export function usePaginated<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  return { page: safePage, pageCount, pageItems, setPage };
}
