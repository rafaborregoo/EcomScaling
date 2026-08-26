import { traceable } from "langsmith/traceable";

export interface LangSmithRuntimeConfig {
  tracing: boolean;
  project: string;
  environment: string;
  capturePayloads: boolean;
}

export interface LangSmithEnvironmentSource {
  LANGSMITH_TRACING?: string;
  LANGSMITH_API_KEY?: string;
  LANGSMITH_PROJECT?: string;
  APP_ENV?: string;
}

export function resolveLangSmithRuntimeConfig(
  env: LangSmithEnvironmentSource,
): LangSmithRuntimeConfig {
  return {
    tracing: env.LANGSMITH_TRACING === "true" && Boolean(env.LANGSMITH_API_KEY),
    project: env.LANGSMITH_PROJECT?.trim() || "ecomscaling-agents",
    environment: env.APP_ENV?.trim() || "development",
    capturePayloads: false,
  };
}

function redactForTrace(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactForTrace);
  if (!value || typeof value !== "object") {
    return typeof value === "string" && value.length > 2_000
      ? `${value.slice(0, 2_000)}…[redacted-length]`
      : value;
  }

  const blocked = /token|secret|password|api.?key|authorization|cookie/i;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.test(key))
      .map(([key, item]) => [key, redactForTrace(item)]),
  );
}

/**
 * Envuelve una operación sin hacer obligatorio LangSmith para el producto.
 * Cuando el tracing está desactivado, el wrapper sigue siendo local y no se
 * envían datos. Cuando está activo, solo se publican entradas/salidas
 * redactadas y metadatos no sensibles.
 */
export function createOptionalLangSmithTraceable<
  Args extends unknown[],
  Result,
>(
  name: string,
  operation: (...args: Args) => Promise<Result> | Result,
  config: LangSmithRuntimeConfig,
) {
  if (!config.tracing) return operation;

  return traceable(operation, {
    name,
    project_name: config.project,
    tags: ["ecomscaling", config.environment],
    metadata: { environment: config.environment },
    processInputs: (inputs) =>
      config.capturePayloads
        ? (redactForTrace(inputs) as Record<string, unknown>)
        : { captured: false },
    processOutputs: (outputs) =>
      config.capturePayloads
        ? (redactForTrace(outputs) as Record<string, unknown>)
        : { captured: false },
  });
}
