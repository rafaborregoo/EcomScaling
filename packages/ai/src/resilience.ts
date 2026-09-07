// AI-14: política común de resiliencia para llamadas a proveedores IA.
// Los temporizadores son asíncronos: nunca bloquean el event loop. El trabajo
// CPU pesado debe permanecer acotado o desplazarse a workers; las operaciones
// I/O se cancelan mediante AbortSignal cuando el proveedor lo permite.

export type AgentResiliencePolicy = {
  timeoutMs: number;
  maxRetries: number;
  baseBackoffMs: number;
  maxBackoffMs: number;
  jitterRatio: number;
};

export const DEFAULT_AGENT_RESILIENCE_POLICY: AgentResiliencePolicy = {
  timeoutMs: 45_000,
  maxRetries: 2,
  baseBackoffMs: 500,
  maxBackoffMs: 8_000,
  jitterRatio: 0.2,
};

export class AgentRequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`agent_provider_timeout_${timeoutMs}ms`);
    this.name = "AgentRequestTimeoutError";
  }
}

export function isTransientAgentError(error: unknown): boolean {
  if (error instanceof AgentRequestTimeoutError) return true;

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
  };
  const status = Number(candidate?.status ?? candidate?.statusCode);
  if (status === 408 || status === 409 || status === 425 || status === 429) {
    return true;
  }
  if (Number.isInteger(status) && status >= 500 && status <= 599) return true;

  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  return /(?:econnreset|econnrefused|etimedout|enotfound|fetch failed|network|overloaded|rate.?limit|timeout|temporar)/i.test(
    `${code} ${message}`,
  );
}

export function computeExponentialBackoffMs(
  retryNumber: number,
  policy: AgentResiliencePolicy = DEFAULT_AGENT_RESILIENCE_POLICY,
  random = Math.random,
): number {
  const exponential = Math.min(
    policy.maxBackoffMs,
    policy.baseBackoffMs * 2 ** Math.max(0, retryNumber - 1),
  );
  const jitter = exponential * policy.jitterRatio * random();
  return Math.min(policy.maxBackoffMs, Math.round(exponential + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withAgentResilience<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  policy: AgentResiliencePolicy = DEFAULT_AGENT_RESILIENCE_POLICY,
  options: { random?: () => number } = {},
): Promise<T> {
  const attempts = policy.maxRetries + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const operationPromise = operation(controller.signal);
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new AgentRequestTimeoutError(policy.timeoutMs));
        }, policy.timeoutMs);
      });
      return await Promise.race([operationPromise, timeoutPromise]);
    } catch (error) {
      lastError = error;
      // Aborta el fetch en curso antes de reintentar o salir por error. NO se
      // hace en `finally`: en el camino de exito el caller todavia no ha leido
      // el body (`await response.json()` corre despues de que esta funcion
      // retorne) y un abort incondicional cancelaba esa lectura de un 200 OK,
      // que subia como `AbortError: The operation was aborted.` -> 500.
      controller.abort();
      if (!isTransientAgentError(error) || attempt === attempts) throw error;
      await sleep(computeExponentialBackoffMs(attempt, policy, options.random));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("agent_provider_failed");
}

