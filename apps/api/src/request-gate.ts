// Tope de peticiones simultáneas de la API hacia el REST de Supabase, con tiempo
// máximo y un reintento en las lecturas.
//
// PostgREST tiene un pool pequeño (10 conexiones en Micro). Una sola petición de
// métricas lanza ~16 RPC y el dashboard hace varias a la vez: el resto se queda
// esperando, incluidas las ligeras, y las que pasan del `statement_timeout` dan
// 500 (PGRST003/504 en los logs del 21-oct, docs/LATENCIA_SUPABASE_TEST_2026-10-21.md).
// Aquí se hace cola en la propia API en vez de en el pool, y una lectura atascada
// no retiene su hueco más de `timeoutMs`.
//
// Ninguna petición espera a otra, así que no puede haber interbloqueo.

export type GateOptions = {
  /** Tiempo máximo de una lectura ya en vuelo (no cuenta la espera en cola). */
  timeoutMs?: number;
  /** Espera antes del único reintento: reintentar al instante con el pool saturado empeora la cola. */
  retryDelayMs?: number;
};

// Solo se reintenta lo que no escribe: GET/HEAD y estas RPC (todas STABLE).
const READ_RPC = /\/rest\/v1\/rpc\/(shopify_(sales|top_products|stock|margin|financial|funnel|customer_value|cohorts)|meta_(spend|creative_performance|performance_daily|creative_ranking_distribution|learning_phase_status|pixel_health|audience_overview|change_impact)|klaviyo_(email_report|daily_revenue))/;

export function isReadRequest(input: Parameters<typeof fetch>[0], init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method === "GET" || method === "HEAD") return true;
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return method === "POST" && READ_RPC.test(url);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 25P02: una conexión del pool de PostgREST se quedó en una transacción abortada
 * tras una cancelación (docs/audits/2026-10-26-consultor-mejoras-implementadas.md).
 * El comando no llegó a ejecutarse, así que repetirlo es seguro incluso al
 * escribir, y otra conexión del pool lo atiende.
 */
export function retryAbortedTransaction(base: typeof fetch = fetch, attempts = 4, delayMs = 200): typeof fetch {
  return async (input, init) => {
    for (let left = attempts; ; left -= 1) {
      const response = await base(input, init);
      if (left === 1 || response.status !== 500) return response;
      if (!(await response.clone().text()).includes('"25P02"')) return response;
      await sleep(delayMs);
    }
  };
}

/** Envuelve `fetch`: como mucho `limit` en vuelo; las lecturas, con timeout y un reintento. */
export function createGatedFetch(
  limit: number,
  base: typeof fetch = fetch,
  { timeoutMs = 12_000, retryDelayMs = 500 }: GateOptions = {},
): typeof fetch {
  let active = 0;
  const waiting: Array<() => void> = [];

  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  };

  async function once(input: Parameters<typeof fetch>[0], init: RequestInit | undefined, read: boolean) {
    if (active >= limit) {
      // El hueco se cede directamente al siguiente (`active` no baja ni sube).
      await new Promise<void>((resolve) => waiting.push(resolve));
    } else {
      active += 1;
    }
    try {
      // Si la petición se canceló mientras esperaba, no gastar un hueco en ella.
      init?.signal?.throwIfAborted();
      if (!read) return await base(input, init);
      const signal = init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
      return await base(input, { ...init, signal });
    } finally {
      release();
    }
  }

  return async (input, init) => {
    const read = isReadRequest(input, init);
    if (!read) return once(input, init, false);
    try {
      const response = await once(input, init, true);
      if (![502, 503, 504].includes(response.status)) return response;
    } catch (error) {
      // La cancelación del que llama no se reintenta; el timeout y los fallos de red, sí.
      if (init?.signal?.aborted) throw error;
    }
    await sleep(retryDelayMs);
    return once(input, init, true);
  };
}

const parsed = Number(process.env.SUPABASE_REST_CONCURRENCY);
/** 5 de 10 conexiones del pool de Micro: con 8 consultas pesadas a la vez, 2 vCPU compartidas las alargan hasta el statement_timeout (21-oct). El resto queda para service role, worker y consultas sueltas. */
export const SUPABASE_REST_CONCURRENCY = Number.isInteger(parsed) && parsed > 0 ? parsed : 5;
const parsedTimeout = Number(process.env.SUPABASE_REST_TIMEOUT_MS);

/** Compartido por todos los clientes con el token del usuario de este proceso. */
export const gatedFetch = createGatedFetch(SUPABASE_REST_CONCURRENCY, retryAbortedTransaction(), {
  timeoutMs: Number.isInteger(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 12_000,
});
