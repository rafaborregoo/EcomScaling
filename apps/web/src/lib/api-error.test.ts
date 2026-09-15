/**
 * SQO-02: el mensaje de error que ve una persona tiene que llevar la
 * referencia con la que soporte encuentra el log del servidor.
 *
 * Las 12 pantallas autenticadas leen los errores del API por esta unica
 * funcion (consolidada en la correccion FE-00 de 2026-08-02), asi que
 * arreglarlo aqui las cubre todas.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { formatApiErrorReference, readApiError } from "./api-error.js";

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

test("el mensaje incluye la referencia cuando el API la devuelve", async () => {
  const message = await readApiError(
    jsonResponse(
      { error: "shopify_sync_failed", message: "No se pudo sincronizar." },
      { requestId: "req-abc-123" },
    ),
  );

  assert.equal(message, "No se pudo sincronizar. (ref: req-abc-123)");
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

test("sin mensaje humano sigue saliendo el codigo con su detalle", async () => {
  const message = await readApiError(
    jsonResponse(
      { error: "shopify_sync_failed", detail: "timeout" },
      { requestId: "req-9" },
    ),
  );

  assert.equal(message, "shopify_sync_failed - timeout (ref: req-9)");
});

test("sin cabecera de referencia el mensaje no gana ruido", async () => {
  const message = await readApiError(
    jsonResponse({ error: "organization_access_denied" }),
  );

  assert.equal(message, "organization_access_denied");
});

test("una respuesta que no es JSON sigue dando un mensaje util con referencia", async () => {
  const response = new Response("<html>502</html>", {
    status: 502,
    headers: { "x-request-id": "req-502" },
  });

  assert.equal(await readApiError(response), "HTTP 502 (ref: req-502)");
});

test("una cabecera vacia o en blanco no produce una referencia falsa", () => {
  assert.equal(formatApiErrorReference(null), "");
  assert.equal(formatApiErrorReference(""), "");
  assert.equal(formatApiErrorReference("   "), "");
  assert.equal(formatApiErrorReference(" req-1 "), " (ref: req-1)");
});
