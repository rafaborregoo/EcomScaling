type ApiErrorBody = {
  error?: string;
  message?: string;
  detail?: string;
  statusCode?: number;
};

/**
 * Error de la API con su código de máquina aparte: `message` es lo que se
 * enseña; `code` es para decidir en la UI (p. ej. «hay que elegir tienda»).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * SQO-02: la API devuelve `x-request-id` en toda respuesta y lo usa para
 * correlacionar sus logs estructurados. Sin arrastrarlo hasta el mensaje que
 * ve la persona, soporte no tiene por donde empezar cuando un cliente dice
 * "me da error". Basta el principio del id para encontrarlo en los logs; el
 * uuid entero en pantalla solo asusta.
 */
export function formatApiErrorReference(requestId: string | null): string {
  const trimmed = requestId?.trim();
  return trimmed ? ` (ref. ${trimmed.slice(0, 8)})` : "";
}

/** Qué decir cuando la API no ha escrito un mensaje para la persona. */
export function genericApiErrorMessage(status: number): string {
  if (status === 400 || status === 422) return "Revisa los datos e inténtalo de nuevo.";
  if (status === 401) return "Tu sesión ha caducado. Vuelve a entrar.";
  if (status === 402) return "No queda saldo para hacer esto.";
  if (status === 403) return "No tienes permiso para hacer esto.";
  if (status === 404) return "No lo encontramos: puede que se haya borrado o movido.";
  if (status === 409) return "Ha cambiado mientras lo tenías abierto. Recarga y vuelve a intentarlo.";
  if (status === 413) return "El archivo es demasiado grande.";
  if (status === 429) return "Demasiadas peticiones seguidas. Espera un minuto y vuelve a intentarlo.";
  return "Algo ha fallado por nuestra parte. Inténtalo de nuevo en unos segundos.";
}

/**
 * Lee el contrato de error de la API sin suponer que es JSON.
 *
 * Solo se enseña `message` cuando lo ha escrito la API para la persona. Los
 * códigos de máquina («task_not_found») y `detail` (mensajes de Postgres o de
 * proveedores) son diagnóstico: se quedan en `code` y en los logs. Los errores
 * por defecto de Fastify (validación, ruta inexistente, límite de peticiones)
 * traen `message` en inglés y `error` con la frase HTTP («Bad Request»): esos
 * tampoco son para la persona.
 */
export async function readApiFailure(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  const code = typeof body?.error === "string" && /^[a-z0-9_]+$/.test(body.error) ? body.error : null;
  const fastifyDefault = typeof body?.statusCode === "number" && !code;
  const human = body?.message && !fastifyDefault && !/^[a-z0-9_]+$/.test(body.message)
    ? body.message
    : genericApiErrorMessage(response.status);
  return new ApiError(
    `${human}${formatApiErrorReference(response.headers.get("x-request-id"))}`,
    code,
    response.status,
  );
}

export async function readApiError(response: Response): Promise<string> {
  return (await readApiFailure(response)).message;
}
