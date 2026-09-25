"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useUrlSection<const T extends string>(
  parameter: string,
  allowedValues: readonly T[],
  defaultValue: T,
) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolveValue = useCallback((): T => {
    // En el primer render el servidor no conoce la query del navegador. Usar
    // la URL real tras hidratar evita que una sección válida (por ejemplo,
    // /dashboard?tab=klaviyo) se renderice como la sección por defecto.
    const requested =
      typeof window === "undefined"
        ? searchParams.get(parameter)
        : new URLSearchParams(window.location.search).get(parameter);

    return allowedValues.includes(requested as T)
      ? (requested as T)
      : defaultValue;
  }, [allowedValues, defaultValue, parameter, searchParams]);
  const [value, setValueState] = useState<T>(defaultValue);

  useEffect(() => {
    const syncUrlSection = window.setTimeout(() => {
      setValueState(resolveValue());
    }, 0);
    return () => window.clearTimeout(syncUrlSection);
  }, [pathname, resolveValue, searchParams]);

  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(parameter, next);
      setValueState(next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [parameter, pathname, router, searchParams],
  );

  return [value, setValue] as const;
}
