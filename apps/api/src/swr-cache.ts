// Caché "sirve lo que haya y refresca detrás" para respuestas caras.
//
// Una pantalla de métricas hace ~100 llamadas REST y, con el REST de Supabase
// atascado, tarda más que el límite de 30 s del navegador: recargar solo
// encola más trabajo (docs/LATENCIA_SUPABASE_TEST_2026-10-21.md). Con esto:
//   - fresca (< freshSeconds): se devuelve tal cual, sin tocar la base;
//   - caducada pero dentro de staleSeconds: se devuelve YA y se refresca en
//     segundo plano, así nadie espera el recálculo;
//   - sin copia: se calcula, y las peticiones idénticas simultáneas comparten
//     el mismo cálculo (single-flight) en vez de lanzar uno cada una.
// Solo se guardan los resultados correctos: un fallo nunca pisa una copia buena.
import { createSingleFlight } from "./single-flight.js";

export type SwrStore = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, ttlSeconds: number) => Promise<void>;
};

type Entry<T> = { at: number; value: T; revision?: string | undefined };

export function createSwrCache(now: () => number = Date.now) {
  const flights = createSingleFlight<unknown>();

  return async function swr<R extends { ok: boolean }>(opts: {
    store: SwrStore;
    key: string;
    freshSeconds: number;
    staleSeconds: number;
    revision?: string;
    load: () => Promise<R>;
    onRefreshError?: (error: unknown) => void;
  }): Promise<R> {
    const { store, key, freshSeconds, staleSeconds, load } = opts;
    const refresh = () =>
      flights(key, async () => {
        const result = await load();
        if (result.ok) {
          await store.set(key, { at: now(), value: result, revision: opts.revision } satisfies Entry<R>, freshSeconds + staleSeconds);
        }
        return result;
      }) as Promise<R>;

    const entry = await store.get<Entry<R>>(key);
    if (entry) {
      const ageSeconds = (now() - entry.at) / 1000;
      if (ageSeconds < freshSeconds && entry.revision === opts.revision) return entry.value;
      if (ageSeconds < freshSeconds + staleSeconds) {
        refresh().catch((error) => opts.onRefreshError?.(error));
        return entry.value;
      }
    }
    return refresh();
  };
}
