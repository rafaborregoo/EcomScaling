const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8_000;

export type WorkerHttpOptions = {
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<unknown>;
  timeoutMs?: number;
  maxRetries?: number;
};

function retryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_BACKOFF_MS, seconds * 1_000);
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? Math.max(0, Math.min(MAX_BACKOFF_MS, timestamp - Date.now()))
    : null;
}

function isTransient(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function fetchWorkerWithResilience(
  input: string | URL,
  init: RequestInit,
  options: WorkerHttpOptions = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const signal = init.signal
        ? AbortSignal.any([init.signal, controller.signal])
        : controller.signal;
      const response = await fetchImpl(input, { ...init, signal });
      clearTimeout(timeout);

      if (!isTransient(response.status) || attempt === maxRetries) {
        // No abortar: el body queda ligado a `signal` y el caller aún tiene
        // que leerlo con `.json()`. Abortar aquí rompía toda lectura de
        // respuesta (por eso fallaba fathom-webhook-processing cada minuto).
        return response;
      }

      // Transitoria y vamos a reintentar: esta respuesta se descarta.
      controller.abort();
      const delay =
        retryAfterMs(response.headers.get("Retry-After")) ??
        Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
      await sleepImpl(delay);
      continue;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
      if (attempt === maxRetries) throw error;
      await sleepImpl(Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("worker_http_failed");
}
