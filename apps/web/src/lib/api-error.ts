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

  // Cuando la API se ha molestado en escribir un `message` para la persona, ese
  // es el mensaje: anteponerle el codigo de maquina convertia cada aviso en
  // "consultant_not_found - Ese correo no tiene cuenta...", que se lee como una
  // averia aunque solo sea un correo mal escrito. `detail` es diagnostico
  // interno (mensajes de Postgres, de proveedores) y va con el codigo, no con
  // el texto humano.
  //
  // Sin `message` no se inventa nada: sigue saliendo el codigo, que es mejor
  // que un "algo ha fallado" con el que soporte no puede hacer nada.
  const message = body?.message
    ? body.message
    : [body?.error ?? `HTTP ${response.status}`, body?.detail]
        .filter(Boolean)
        .join(separator);

  return `${message}${formatApiErrorReference(response.headers.get("x-request-id"))}`;
}
