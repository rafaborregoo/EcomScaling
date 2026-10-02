"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new Error(body?.message || body?.error || `HTTP ${response.status}`);
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
    setError(null);
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

/**
 * Variante para paneles que componen una vista a partir de varios GETs
 * independientes (por ejemplo el mapa de playbooks y las dimensiones F4).
 * Mantiene una entrada por URL, deduplica peticiones en vuelo y conserva el
 * mismo stale-while-revalidate que `useCachedQuery`, sin llamar hooks dentro
 * de un `map`.
 */
export function useCachedQueries<T>(keys: string[]): CachedQuery<T[]> {
  const keySignature = keys.join("\u0000");
  const stableKeys = useMemo(
    () => [...new Set(keys.filter(Boolean))],
    [keySignature],
  );
  const [, forceRender] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    if (stableKeys.length === 0) return;
    let cancelled = false;
    const staleKeys = stableKeys.filter((key) => {
      const entry = cache.get(key);
      return !entry || Date.now() - entry.at >= FRESH_MS;
    });
    if (staleKeys.length === 0) return;

    setIsValidating(true);
    Promise.all(staleKeys.map((key) => run(key)))
      .then(() => {
        if (cancelled) return;
        setError(null);
        forceRender((n) => n + 1);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : "No se pudo cargar.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsValidating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [forceRender, keySignature, stableKeys]);

  const hasAllData = stableKeys.every((key) => cache.has(key));
  const data = hasAllData
    ? (stableKeys.map((key) => cache.get(key)?.data) as T[])
    : undefined;

  const reload = useCallback(() => {
    if (stableKeys.length === 0) return;
    setError(null);
    setIsValidating(true);
    Promise.all(stableKeys.map((key) => run(key)))
      .then(() => {
        setError(null);
        forceRender((n) => n + 1);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "No se pudo cargar.",
        );
      })
      .finally(() => setIsValidating(false));
  }, [forceRender, stableKeys]);

  return {
    data,
    error,
    isLoading: stableKeys.length > 0 && data === undefined && error === null,
    isValidating,
    reload,
  };
}

/**
 * Igual que `useCachedQueries`, pero conserva los resultados que sí llegan
 * cuando uno de los endpoints falla. Es útil para mapas de diagnóstico: un
 * dominio no disponible no debe ocultar los otros 24 ni convertir toda la
 * tarjeta en un error global.
 */
export function useCachedQueriesSettled<T>(
  keys: string[],
): CachedQuery<Array<T | undefined>> & { errors: Array<string | null> } {
  const keySignature = keys.join("\u0000");
  const stableKeys = useMemo(
    () => [...new Set(keys.filter(Boolean))],
    [keySignature],
  );
  const [, forceRender] = useState(0);
  const [errors, setErrors] = useState<Array<string | null>>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [hasSettled, setHasSettled] = useState(false);

  const load = useCallback(
    (force = false) => {
      if (stableKeys.length === 0) return;
      if (force) stableKeys.forEach((key) => cache.delete(key));
      const pending = stableKeys.filter((key) => {
        const entry = cache.get(key);
        return !entry || Date.now() - entry.at >= FRESH_MS;
      });
      if (pending.length === 0) {
        setHasSettled(true);
        return;
      }

      setIsValidating(true);
      Promise.all(
        pending.map(async (key) => {
          try {
            await run(key);
            return null;
          } catch (reason: unknown) {
            return reason instanceof Error
              ? reason.message
              : "No se pudo cargar.";
          }
        }),
      )
        .then((pendingErrors) => {
          setErrors((previous) => {
            const next = [...previous];
            pending.forEach((key, index) => {
              const position = stableKeys.indexOf(key);
              next[position] = pendingErrors[index];
            });
            return next;
          });
          setHasSettled(true);
          forceRender((n) => n + 1);
        })
        .finally(() => setIsValidating(false));
    },
    [forceRender, stableKeys],
  );

  useEffect(() => {
    load();
  }, [load]);

  const data = hasSettled
    ? stableKeys.map((key) => cache.get(key)?.data as T | undefined)
    : undefined;
  const reload = useCallback(() => load(true), [load]);
  const firstError = errors.find(Boolean) ?? null;

  return {
    data,
    error: firstError,
    errors,
    isLoading: stableKeys.length > 0 && data === undefined && !firstError,
    isValidating,
    reload,
  };
}
