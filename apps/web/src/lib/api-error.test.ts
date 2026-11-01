/**
 * SQO-02: el mensaje de error que ve una persona tiene que llevar la
 * referencia con la que soporte encuentra el log del servidor, y nunca el
 * código de máquina ni el detalle interno.
 *
 * Las pantallas autenticadas leen los errores del API por esta unica
 * funcion (consolidada en la correccion FE-00 de 2026-08-02), asi que
 * arreglarlo aqui las cubre todas.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { formatApiErrorReference, readApiError, readApiFailure } from "./api-error.js";

function jsonResponse(
  body: unknown,
  init: { status?: number; requestId?: string } = {},
) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 500,
    headers: init.requestId
      ? { "content-type": "application/json", "x-request-id": init.requestId }
      : { "content-type": "application/json" },
  });
}

test("el mensaje incluye la referencia corta cuando el API la devuelve", async () => {
  const message = await readApiError(
    jsonResponse(
      { error: "shopify_sync_failed", message: "No se pudo sincronizar." },
      { requestId: "3f2a9c1b-0d4e-4a7b-9c2d-1e5f6a7b8c9d" },
    ),
  );

  assert.equal(message, "No se pudo sincronizar. (ref. 3f2a9c1b)");
});

test("con mensaje humano no se cuela el codigo ni el detalle interno", async () => {
  const message = await readApiError(
    jsonResponse({
      error: "consultant_not_found",
      message: "No hay ninguna cuenta con ese correo.",
      detail: 'relation "profiles" does not exist',
    }),
  );

  assert.equal(message, "No hay ninguna cuenta con ese correo.");
});

test("sin mensaje humano sale un texto por estado y el codigo queda aparte", async () => {
  const failure = await readApiFailure(
    jsonResponse({ error: "task_not_found", detail: "timeout" }, { status: 404, requestId: "req-9" }),
  );

  assert.equal(failure.message, "No lo encontramos: puede que se haya borrado o movido. (ref. req-9)");
  assert.equal(failure.code, "task_not_found");
  assert.equal(failure.status, 404);
});

test("el error por defecto de Fastify, en ingles, no llega a la persona", async () => {
  const message = await readApiError(
    jsonResponse(
      { statusCode: 400, error: "Bad Request", message: "body must have required property 'title'" },
      { status: 400 },
    ),
  );

  assert.equal(message, "Revisa los datos e inténtalo de nuevo.");
});

test("una respuesta que no es JSON sigue dando un mensaje util con referencia", async () => {
  const response = new Response("<html>502</html>", {
    status: 502,
    headers: { "x-request-id": "req-502" },
  });

  assert.equal(
    await readApiError(response),
    "Algo ha fallado por nuestra parte. Inténtalo de nuevo en unos segundos. (ref. req-502)",
  );
});

test("una cabecera vacia o en blanco no produce una referencia falsa", () => {
  assert.equal(formatApiErrorReference(null), "");
  assert.equal(formatApiErrorReference(""), "");
  assert.equal(formatApiErrorReference("   "), "");
  assert.equal(formatApiErrorReference(" req-1 "), " (ref. req-1)");
});
