// Cuándo una conexión necesita que una persona la vuelva a autorizar.
//
// `integration_connections.status = 'error'` mezcla dos cosas muy distintas:
//   - el permiso ya no vale (token caducado o revocado, falta un permiso): solo
//     lo arregla el cliente reconectando;
//   - una sincronización falló (Meta devolvió datos a medias, un 5xx, un límite
//     de ritmo): E-NORA lo reintenta sola y reconectar no sirve de nada.
// Pintar las dos igual llenaba la app de «Reconectar» y mandaba al cliente a
// reautorizar por fallos que no eran suyos. Esta es la única regla que las
// separa; la usan la API (avisos y punto rojo), la interfaz y el trigger de
// avisos de la base de datos (20261221100000), que copia el patrón: un test
// comprueba que los dos siguen iguales.

/** Fragmentos de `last_error_message` que significan «el permiso ya no vale». */
export const RECONNECT_ERROR_PATTERN =
  "reauth|reconnect|reconect|invalid[_ :.-]*grant|token.{0,24}(expired|invalid|revoked)|invalid.{0,16}(api.?key|credential)|unauthorized|permission(s)?[_ :.-]*(missing|denied)|scope(s)?[_ :.-]*(missing|insufficient)|oauth[_ :.-]*(denied|error)";

const RECONNECT_ERROR = new RegExp(RECONNECT_ERROR_PATTERN, "i");

export function connectionNeedsReconnect(connection: {
  status: string;
  last_error_message?: string | null;
}): boolean {
  if (connection.status === "revoked") return true;
  return connection.status === "error" && RECONNECT_ERROR.test(connection.last_error_message ?? "");
}
