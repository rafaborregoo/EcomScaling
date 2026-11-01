"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { apiFetch, invalidateApiGetCache } from "@/lib/bootstrap";
import { readApiFailure } from "@/lib/api-error";

// Caché de datos de página estilo stale-while-revalidate, en el mismo espíritu
// que `bootstrapCache` de PortalShell. Objetivo: al volver a una vista que ya
// visitaste, las cards aparecen al instante con los últimos datos y el refetch
// ocurre por detrás -- se acabó el parpadeo "null -> loader -> datos" en cada
// navegación. Sin dependencias nuevas.

type Entry = { data: unknown; at: number };

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const keyVersions = new Map<string, number>();
let invalidationVersion = 0;
const invalidationListeners = new Set<() => void>();
const subscribeInvalidation = (listener: () => void) => {
  invalidationListeners.add(listener);
  return () => { invalidationListeners.delete(listener); };
};
const readServerInvalidation = () => 0;
function useInvalidationVersion(signature: string) {
  const readInvalidation = useCallback(() => Math.max(0, ...signature.split("\u0000").map((key) => keyVersions.get(key) ?? 0)), [signature]);
  return useSyncExternalStore(subscribeInvalidation, readInvalidation, readServerInvalidation);
}

// Dentro de esta ventana desde el último fetch, montar la vista NO dispara
// refetch: se considera fresco. Fuera de ella, se revalida en segundo plano.
const FRESH_MS = 30_000;

async function fetchJson(key: string): Promise<unknown> {
  const response = await apiFetch(key);
  if (!response.ok) throw await readApiFailure(response);
  return response.json();
}

function run(key: string): Promise<unknown> {
  let promise = inflight.get(key);
  if (!promise) {
    const version = keyVersions.get(key) ?? 0;
    promise = fetchJson(key)
      .then((data) => {
        // Publish a completed snapshot even under a continuous event stream.
        // Then fetch once more if this particular resource changed meanwhile.
        if (version !== (keyVersions.get(key) ?? 0)) {
          setTimeout(() => invalidateCachedQueries(key), 0);
        }
        cache.set(key, { data, at: Date.now() });
        return data;
      })
      .finally(() => { if (inflight.get(key) === promise) inflight.delete(key); });
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
export function invalidateCachedQueries(prefix?: string | string[]): void {
  invalidateApiGetCache();
  const prefixes = typeof prefix === "string" ? [prefix] : prefix;
  for (const key of new Set([...cache.keys(), ...inflight.keys()])) {
    if (prefixes && !prefixes.some((value) => key.startsWith(value))) continue;
    keyVersions.set(key, invalidationVersion + 1);
    if (!prefixes) cache.delete(key);
    else if (cache.has(key)) cache.set(key, { ...cache.get(key)!, at: 0 });
  }
  invalidationVersion += 1;
  invalidationListeners.forEach((listener) => listener());
}

type Failure = { message: string; code: string | null };

function toFailure(reason: unknown): Failure {
  if (reason instanceof Error) {
    return { message: reason.message, code: "code" in reason && typeof reason.code === "string" ? reason.code : null };
  }
  return { message: "No se ha podido cargar. Inténtalo de nuevo en unos segundos.", code: null };
}

export type CachedQuery<T> = {
  data: T | undefined;
  /** Texto para enseñar. */
  error: string | null;
  /** Código de la API (`shopify_store_selection_required`...) para decidir, nunca para enseñar. */
  errorCode: string | null;
  /** true solo en la PRIMERA carga (sin datos cacheados y sin error). */
  isLoading: boolean;
  /** true mientras revalida por detrás, aunque ya se muestren datos. */
  isValidating: boolean;
  reload: () => void;
};

export function useCachedQuery<T>(key: string | null): CachedQuery<T> {
  const invalidation = useInvalidationVersion(key ?? "");
  const [, forceRender] = useState(0);
  const [failure, setError] = useState<Failure | null>(null);
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
        if (!cache.has(key)) setError(toFailure(e));
      })
      .finally(() => {
        if (!cancelled) setIsValidating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, invalidation]);

  const reload = useCallback(() => {
    if (!key) return;
    setError(null);
    setIsValidating(true);
    run(key)
      .then(() => {
        setError(null);
        forceRender((n) => n + 1);
      })
      .catch((e: unknown) => setError(toFailure(e)))
      .finally(() => setIsValidating(false));
  }, [key]);

  const data = key ? (cache.get(key)?.data as T | undefined) : undefined;
  const error = failure?.message ?? null;

  return {
    data,
    error,
    errorCode: failure?.code ?? null,
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
  const invalidation = useInvalidationVersion(keys.join("\u0000"));
  const keySignature = keys.join("\u0000");
  const stableKeys = useMemo(
    () => [...new Set(keys.filter(Boolean))],
    [keySignature],
  );
  const [, forceRender] = useState(0);
  const [failure, setError] = useState<Failure | null>(null);
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
        if (!cancelled) setError(toFailure(reason));
      })
      .finally(() => {
        if (!cancelled) setIsValidating(false);
      });

    return () => {
      cancelled = true;
    };
  }, [forceRender, keySignature, stableKeys, invalidation]);

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
      .catch((reason: unknown) => setError(toFailure(reason)))
      .finally(() => setIsValidating(false));
  }, [forceRender, stableKeys]);

  const error = failure?.message ?? null;

  return {
    data,
    error,
    errorCode: failure?.code ?? null,
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
  const invalidation = useInvalidationVersion(keys.join("\u0000"));
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
              : "No se ha podido cargar. Inténtalo de nuevo en unos segundos.";
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load, invalidation]);

  const data = hasSettled
    ? stableKeys.map((key) => cache.get(key)?.data as T | undefined)
    : undefined;
  const reload = useCallback(() => load(true), [load]);
  const firstError = errors.find(Boolean) ?? null;

  return {
    data,
    error: firstError,
    errorCode: null,
    errors,
    isLoading: stableKeys.length > 0 && data === undefined && !firstError,
    isValidating,
    reload,
  };
}

/**
 * Deja los últimos datos en pantalla mientras llega otra clave del MISMO
 * ámbito (otro periodo de la misma ficha): sin esto, cambiar de 30 a 90 días
 * vaciaba la página y la devolvía arriba. Al cambiar `scope` (otro cliente,
 * otra tienda, otra ficha) se descartan: nunca se ven datos de otro sitio.
 */
export function useKeepPrevious<T>(data: T | undefined, scope: string | null): T | undefined {
  const [kept, setKept] = useState<{ scope: string | null; data: T } | null>(null);
  if (data !== undefined && (kept?.data !== data || kept.scope !== scope)) {
    setKept({ scope, data });
  }
  return data ?? (kept?.scope === scope ? kept.data : undefined);
}
