// Un intento de autorizacion no es una tienda.
//
// El OAuth de Shopify (y el de Meta y Klaviyo) tiene que sembrar la fila de
// `integration_connections` ANTES de mandarte al proveedor: ahi se guarda el
// `state` anti-CSRF que el callback tiene que validar cuando vuelvas. Asi que
// desde el instante en que pulsas "Conectar" existe una fila en `pending`, sin
// que hayas autorizado nada todavia.
//
// El problema no era sembrarla, era que no caducaba. Quien cerraba la pestana,
// se equivocaba de dominio o se arrepentia dejaba una fila `pending` para
// siempre, y esa fila:
//   - se lee en la interfaz como una tienda medio rota, indistinguible de un
//     token caducado, que es un problema muy distinto;
//   - cuenta para el limite de tiendas del plan (`assertStoreLimit` mira las
//     conexiones existentes), asi que dos intentos abandonados podian dejar sin
//     cupo para la tienda de verdad.
//
// Este modulo es la unica definicion de "en curso" frente a "abandonado", y lo
// comparten el backend (que purga) y la interfaz (que lo cuenta). Separados
// divergirian: la pantalla diria "sigue en curso" de algo que el cron ya borro.

/** Margen para ir al proveedor, mirar los permisos y aceptar. Dentro de el, un
 * `pending` es una autorizacion en marcha y no se anuncia como un problema. */
export const AUTHORIZATION_IN_PROGRESS_MS = 15 * 60 * 1000;

/** A partir de aqui el intento se borra solo. Es bastante mas que el margen
 * anterior a proposito: entre uno y otro la persona ve "no terminaste de
 * conectar" con la opcion de retomarlo, en vez de que la fila desaparezca sin
 * explicacion mientras la mira. */
export const AUTHORIZATION_ABANDONED_PURGE_MS = 60 * 60 * 1000;

export type AuthorizationAttemptState =
  /** Pulsaste "Conectar" hace poco; la pantalla del proveedor sigue abierta. */
  | "in_progress"
  /** Se empezo y nunca se termino. Ni es una tienda ni llegara a serlo sola. */
  | "abandoned";

/** Lo minimo que hace falta para decidir. Se pide suelto y no la fila entera
 * para que sirva igual con la forma del backend y con la del frontend. */
export type AuthorizationAttemptInput = {
  status: string;
  /** Nulo mientras el callback no haya completado el intercambio de tokens. */
  connected_at?: string | null;
  /** Cuando se sembro la fila. */
  created_at?: string | null;
  /** Si el flujo se relanzo, el upsert la pisa y esta avanza: cuenta la ultima
   * vez que alguien lo intento, no la primera. */
  updated_at?: string | null;
};

/**
 * `null` cuando la conexion no es un intento de autorizacion: una tienda
 * conectada, una en error, una marcada para borrado. Solo `pending` sin
 * `connected_at` es un intento.
 */
export function classifyAuthorizationAttempt(
  connection: AuthorizationAttemptInput,
  now: Date = new Date(),
): AuthorizationAttemptState | null {
  if (connection.status !== "pending") return null;
  // Una conexion que alguna vez completo el OAuth no vuelve a ser un intento,
  // por mucho que hoy este en pending: ahi hay datos y credenciales detras.
  if (connection.connected_at) return null;

  const startedAt = connection.updated_at ?? connection.created_at ?? null;
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  // Sin fecha legible no se puede saber si acaba de empezar. Se trata como
  // recien empezado: el lado que no borra es el que no destruye el intento de
  // alguien que esta mirando la pantalla de Shopify en ese momento.
  if (Number.isNaN(started)) return "in_progress";

  return now.getTime() - started < AUTHORIZATION_IN_PROGRESS_MS
    ? "in_progress"
    : "abandoned";
}

/** El intento lleva abandonado lo bastante como para borrarlo sin avisar. */
export function isPurgeableAuthorizationAttempt(
  connection: AuthorizationAttemptInput,
  now: Date = new Date(),
): boolean {
  if (classifyAuthorizationAttempt(connection, now) !== "abandoned") {
    return false;
  }

  const startedAt = connection.updated_at ?? connection.created_at ?? null;
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  if (Number.isNaN(started)) return false;

  return now.getTime() - started >= AUTHORIZATION_ABANDONED_PURGE_MS;
}

/**
 * Un intento que acabo en `error` antes de autorizarse (Klaviyo deja asi el
 * `state` caducado). No es una tienda rota: nunca se conecto ni trajo un dato, y
 * sin esta regla se quedaba para siempre, porque la purga de arriba solo mira
 * `pending`.
 */
export function isPurgeableFailedAttempt(
  connection: AuthorizationAttemptInput & { last_sync_at?: string | null },
  now: Date = new Date(),
): boolean {
  if (connection.status !== "error") return false;
  if (connection.connected_at || connection.last_sync_at) return false;

  const startedAt = connection.updated_at ?? connection.created_at ?? null;
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  if (Number.isNaN(started)) return false;

  return now.getTime() - started >= AUTHORIZATION_ABANDONED_PURGE_MS;
}

/** La frontera que usa la consulta de purga, para no traerse a Node filas que
 * ni siquiera son candidatas. */
export function authorizationPurgeCutoff(now: Date = new Date()): string {
  return new Date(
    now.getTime() - AUTHORIZATION_ABANDONED_PURGE_MS,
  ).toISOString();
}
