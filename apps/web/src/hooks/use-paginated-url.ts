"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function buildUrlWithParam(
  pathname: string,
  current: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  const params = new URLSearchParams(current.toString());
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Igual que usePaginated, pero la pagina actual vive en la URL (`?page=` por
 * defecto, o `?<paramName>=` si una misma pantalla tiene varias listas
 * independientes) en vez de en memoria -- mismo patron que cliente/tienda
 * activos (ADR-0010). Al navegar fuera de la pantalla y volver, el usuario
 * sigue en la misma pagina porque la URL la recuerda; `usePaginated` en
 * memoria la pierde en cuanto el componente se desmonta (ver ADR-0013).
 *
 * `page=1` nunca aparece en la URL (es el default implicito), para no
 * ensuciar enlaces compartidos con parametros redundantes.
 */
export function usePaginatedUrl<T>(items: T[], pageSize: number, paramName = "page") {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const rawPage = Number(searchParams.get(paramName) ?? "1");
  const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1;
  const page = Math.min(requestedPage, pageCount);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  function setPage(nextPage: number) {
    const clamped = Math.min(Math.max(1, Math.trunc(nextPage)), pageCount);
    router.replace(
      buildUrlWithParam(pathname, searchParams, paramName, clamped === 1 ? undefined : String(clamped)),
      { scroll: false },
    );
  }

  return { page, pageCount, pageItems, setPage };
}
