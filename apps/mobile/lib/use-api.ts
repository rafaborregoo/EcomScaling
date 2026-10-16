import { useCallback, useEffect, useState } from "react";
import { apiGet } from "./api";

// Caché stale-while-revalidate a nivel de módulo (misma idea que use-cached-query.ts de la web): al volver a una
// pantalla ya vista, los datos salen al instante y se revalidan por detrás. Dentro de FRESH_MS ni se pide de nuevo.
const FRESH_MS = 60_000;
const cache = new Map<string, { data: unknown; at: number }>();
const inflight = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  let p = inflight.get(path) as Promise<T> | undefined;
  if (!p) {
    p = apiGet<T>(path)
      .then((data) => {
        cache.set(path, { data, at: Date.now() });
        return data;
      })
      .finally(() => inflight.delete(path));
    inflight.set(path, p);
  }
  return p;
}

/** Vacía la caché (cerrar sesión: los datos son de otro usuario). */
export const clearApiCache = () => cache.clear();

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(() => (path ? ((cache.get(path)?.data as T | undefined) ?? null) : null));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let stale = false;
    const hit = cache.get(path);
    setData((hit?.data as T | undefined) ?? null);
    setError(null);
    if (hit && tick === 0 && Date.now() - hit.at < FRESH_MS) return;
    load<T>(path).then(
      (d) => !stale && setData(d),
      (e: Error) => !stale && !hit && setError(e.message),
    );
    return () => {
      stale = true;
    };
  }, [path, tick]);

  // Recarga sin vaciar la pantalla: devuelve la promesa para que RefreshControl sepa cuándo parar.
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setData(await load<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    }
  }, [path]);

  return { data, error, reload, retry: () => setTick((t) => t + 1) };
}
