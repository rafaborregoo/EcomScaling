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

/**
 * Por que fallo el proveedor, en terminos que cambian lo que hay que hacer.
 *
 * Existe porque en produccion 61 de 65 fallos de agente fueron "saldo de
 * Anthropic agotado" y llegaban a `agent_runs.error_message` como un blob JSON
 * del SDK, indistinguibles de un fallo de red. Un problema de facturacion y una
 * caida del proveedor se arreglan en sitios distintos y por personas distintas.
 */
export const PROVIDER_FAILURE_KINDS = [
  /** No hay credito/cuota. No se arregla reintentando: se arregla pagando. */
  "out_of_credit",
  /** Clave invalida, revocada o sin permisos. */
  "auth",
  /** Limite de tasa del proveedor. Se reintenta. */
  "rate_limited",
  "timeout",
  /** Caida o degradacion del proveedor (5xx, red). Se reintenta. */
  "unavailable",
  /** La peticion estaba mal formada. Culpa nuestra, no del proveedor. */
  "bad_request",
  "unknown",
] as const;

export type ProviderFailureKind = (typeof PROVIDER_FAILURE_KINDS)[number];

function errorSurface(error: unknown): { status: number; text: string } {
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
  };
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const message =
    typeof candidate?.message === "string" ? candidate.message : "";
  return {
    status: Number(candidate?.status ?? candidate?.statusCode),
    text: `${code} ${message}`,
  };
}

export function classifyProviderError(error: unknown): ProviderFailureKind {
  if (error instanceof AgentRequestTimeoutError) return "timeout";

  const { status, text } = errorSurface(error);

  // Antes que el status: Anthropic manda el saldo agotado como 400 y OpenAI la
  // cuota agotada como 429. Clasificar por codigo mandaria uno a "peticion mal
  // formada" y el otro a "reintentalo", y las dos lecturas son falsas.
  if (
    /credit balance is too low|insufficient_quota|exceeded your current quota|billing|payment required/i.test(
      text,
    ) ||
    status === 402
  ) {
    return "out_of_credit";
  }

  if (status === 401 || status === 403 || /invalid.?api.?key/i.test(text)) {
    return "auth";
  }
  if (status === 429 || /rate.?limit/i.test(text)) return "rate_limited";
  if (/timeout|etimedout|timed out/i.test(text)) return "timeout";
  if (
    (Number.isInteger(status) && status >= 500 && status <= 599) ||
    /econnreset|econnrefused|enotfound|fetch failed|network|overloaded|temporar/i.test(
      text,
    )
  ) {
    return "unavailable";
  }
  if (Number.isInteger(status) && status >= 400 && status <= 499) {
    return "bad_request";
  }

  return "unknown";
}

export function isTransientAgentError(error: unknown): boolean {
  if (error instanceof AgentRequestTimeoutError) return true;

  // Sin saldo o sin credenciales validas, reintentar es quemar el reloj para
  // recibir el mismo error tres veces. Va antes que la comprobacion de status
  // porque la cuota agotada de OpenAI es un 429, que si es reintentable en
  // cualquier otro caso.
  const kind = classifyProviderError(error);
  if (kind === "out_of_credit" || kind === "auth") return false;

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
  const message =
    typeof candidate?.message === "string" ? candidate.message : "";
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

  throw lastError instanceof Error
    ? lastError
    : new Error("agent_provider_failed");
}
