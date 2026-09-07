const API_REQUEST_TIMEOUT_MS = 15_000;

/** Evita que una pantalla quede esperando indefinidamente al API. */
export async function fetchApiWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = API_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  // Con `abort()` a secas el error llega como "signal is aborted without
  // reason" y no hay forma de saber si fue el timeout, una navegacion o el
  // caller. Darle motivo hace que el mensaje diga cuanto se espero.
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          `La peticion al API supero el limite de ${Math.round(timeoutMs / 1000)}s.`,
          "TimeoutError",
        ),
      ),
    timeoutMs,
  );
  const signal = init.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;

  try {
    return await fetch(input, { ...init, signal });
  } finally {
    // Bug real (reportado como "The user aborted a request." en /dashboard):
    // `fetch()` resuelve en cuanto llegan las cabeceras, no cuando termina de
    // leerse el body. Todo caller hace `await response.json()` DESPUES de que
    // esta funcion retorne -- abortar aqui incondicionalmente cancelaba esa
    // lectura si el body tardaba en llegar, incluso en una respuesta 200
    // exitosa. `clearTimeout` ya es suficiente para que el abort programado
    // nunca dispare; no hace falta abortar nada mas en el camino de exito.
    clearTimeout(timeout);
  }
}
