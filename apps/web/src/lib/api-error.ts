type ApiErrorBody = {
  error?: string;
  message?: string;
  detail?: string;
};

/**
 * SQO-02: la API devuelve `x-request-id` en toda respuesta y lo usa para
 * correlacionar sus logs estructurados. Sin arrastrarlo hasta el mensaje que
 * ve la persona, soporte no tiene por donde empezar cuando un cliente dice
 * "me da error": el log existe, pero no hay forma de saber cual de todos es.
 */
export function formatApiErrorReference(requestId: string | null): string {
  const trimmed = requestId?.trim();
  return trimmed ? ` (ref: ${trimmed})` : "";
}

/** Reads the public error contract returned by the API without assuming JSON. */
export async function readApiError(
  response: Response,
  separator = " - ",
): Promise<string> {
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  const message = [
    body?.error ?? `HTTP ${response.status}`,
    body?.message,
    body?.detail,
  ]
    .filter(Boolean)
    .join(separator);

  return `${message}${formatApiErrorReference(response.headers.get("x-request-id"))}`;
}
