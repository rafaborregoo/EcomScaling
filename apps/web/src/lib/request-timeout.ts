const API_REQUEST_TIMEOUT_MS = 15_000;

/** Evita que una pantalla quede esperando indefinidamente al API. */
export async function fetchApiWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs = API_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
