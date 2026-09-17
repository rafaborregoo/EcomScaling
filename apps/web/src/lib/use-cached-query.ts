"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";

// Caché de datos de página estilo stale-while-revalidate, en el mismo espíritu
// que `bootstrapCache` de PortalShell. Objetivo: al volver a una vista que ya
// visitaste, las cards aparecen al instante con los últimos datos y el refetch
// ocurre por detrás -- se acabó el parpadeo "null -> loader -> datos" en cada
// navegación. Sin dependencias nuevas.

type Entry = { data: unknown; at: number };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

// Dentro de esta ventana desde el último fetch, montar la vista NO dispara
// refetch: se considera fresco. Fuera de ella, se revalida en segundo plano.
const FRESH_MS = 30_000;

async function fetchJson(key: string): Promise<unknown> {
  const response = await apiFetch(key);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(body?.error || body?.message || `HTTP ${response.status}`);
  }
  return response.json();
}

function run(key: string): Promise<unknown> {
  let promise = inflight.get(key);
  if (!promise) {
    promise = fetchJson(key)
      .then((data) => {
        cache.set(key, { data, at: Date.now() });
        return data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
  }
  return promise;
}

/** Lanza (o reutiliza) el fetch de `key` sin esperar. Para prefetch on hover. */
export function prefetchCachedQuery(key: string): void {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.at < FRESH_MS) return;
  void run(key).catch(() => {});
}

/** Borra entradas de caché. Sin prefijo, todo (p.ej. al cambiar de organización
 *  activa: los datos son de otro tenant). Con prefijo, solo las que empiezan por él. */
export function invalidateCachedQueries(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export type CachedQuery<T> = {
  data: T | undefined;
  error: string | null;
  /** true solo en la PRIMERA carga (sin datos cacheados y sin error). */
  isLoading: boolean;
  /** true mientras revalida por detrás, aunque ya se muestren datos. */
  isValidating: boolean;
  reload: () => void;
};

export function useCachedQuery<T>(key: string | null): CachedQuery<T> {
  const [, forceRender] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    const entry = cache.get(key);
    const fresh = entry && Date.now() - entry.at < FRESH_MS;
    if (fresh) return;

    setIsValidating(true);
    run(key)
      .then(() => {
        if (cancelled) return;
        setError(null);
        forceRender((n) => n + 1);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // Si ya había datos cacheados, un fallo de red no debe tapar la vista.
        if (!cache.has(key)) {
          setError(e instanceof Error ? e.message : "No se pudo cargar.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsValidating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const reload = useCallback(() => {
    if (!key) return;
    cache.delete(key);
    setError(null);
    setIsValidating(true);
    run(key)
      .then(() => {
        setError(null);
        forceRender((n) => n + 1);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "No se pudo cargar.");
      })
      .finally(() => setIsValidating(false));
  }, [key]);

  const data = key ? (cache.get(key)?.data as T | undefined) : undefined;

  return {
    data,
    error,
    // `key` null = la pagina todavia no sabe QUE pedir (no hay cliente activo,
    // por ejemplo), asi que no hay fetch en marcha. Sin esta condicion se
    // devolvia `isLoading: true` para siempre: sin datos, sin error y sin nada
    // que los fuera a traer. La pantalla se quedaba girando y parecia lentitud.
    isLoading: key !== null && data === undefined && error === null,
    isValidating,
    reload,
  };
}
