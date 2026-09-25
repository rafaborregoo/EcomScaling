"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useUrlSection<const T extends string>(
  parameter: string,
  allowedValues: readonly T[],
  defaultValue: T,
) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get(parameter);
  const requestedValue = allowedValues.includes(requested as T)
    ? (requested as T)
    : defaultValue;
  const setValue = useCallback(
    (next: T) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(parameter, next);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [parameter, pathname, router, searchParams],
  );

  return [requestedValue, setValue] as const;
}
