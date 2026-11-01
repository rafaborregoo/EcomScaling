/**
 * Lecturas de Supabase con tope de espera y un reintento.
 *
 * La capa REST de Supabase TEST (instancia Micro) da parones aleatorios de
 * 10–40 s en el primer byte, aunque Postgres responda en milisegundos
 * (docs/LATENCIA_SUPABASE_TEST_2026-10-21.md). Sin tope, una sola lectura
 * colgada tumba la pantalla entera: el cliente corta a los 30 s con «No hemos
 * podido conectar con E-NORA». Un parón es puntual, así que cortar a los pocos
 * segundos y repetir casi siempre acierta.
 *
 * Solo se repite lo que lee: GET/HEAD contra /rest/v1 y los rpc de la lista
 * `READ_ONLY_RPCS` (funciones `stable`). Las escrituras y el resto de rpc pasan
 * tal cual, sin reintento.
 */
import { READ_ONLY_RPCS } from "./supabase-read-rpcs.js";

const DEFAULT_TIMEOUT_MS = 8_000;

export function wrapSupabaseReads(
  supabaseUrl: string,
  baseFetch: typeof fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  readRpcs: ReadonlySet<string> = READ_ONLY_RPCS,
): typeof fetch {
  const base = supabaseUrl.replace(/\/+$/, "");
  const restPrefix = `${base}/rest/v1/`;
  // Validar un token (GET /auth/v1/user) también es una lectura que se cuelga igual.
  const authUser = `${base}/auth/v1/user`;
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    const rpcName = method === "POST" && url.startsWith(`${restPrefix}rpc/`) ? url.slice(restPrefix.length + 4).split("?")[0] ?? null : null;
    const isRead = method === "GET" || method === "HEAD" || (rpcName !== null && readRpcs.has(rpcName));
    const isAuthUser = method === "GET" && url.startsWith(authUser);
    if (timeoutMs <= 0 || (!url.startsWith(restPrefix) && !isAuthUser) || (!isRead && !isAuthUser)) {
      return baseFetch(input, init);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
      try {
        return await baseFetch(input, { ...init, signal });
      } catch (error) {
        // Si quien llamó canceló, no se reintenta: se respeta su decisión.
        if (init?.signal?.aborted) throw error;
        lastError = error;
      }
    }
    throw lastError;
  };
}

/** Envuelve el fetch global: los clientes de supabase-js lo leen al hacer cada petición. */
export function installSupabaseReadRetry(supabaseUrl: string, timeoutMs?: number) {
  globalThis.fetch = wrapSupabaseReads(supabaseUrl, globalThis.fetch, timeoutMs);
}
