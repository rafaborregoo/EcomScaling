import assert from "node:assert/strict";
import test from "node:test";
import { fetchApiWithTimeout } from "./request-timeout.js";
import { defaultTimeoutFor } from "./bootstrap.js";

test("aborta una petición del frontend que supera el timeout", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) =>
    await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  try {
    await assert.rejects(
      () => fetchApiWithTimeout("http://api.test/hang", {}, 5),
      (error: unknown) =>
        error instanceof DOMException && error.name === "AbortError",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Regresion del bug real "The user aborted a request." en /dashboard: el
// body de la respuesta se leia DESPUES de que fetchApiWithTimeout retornara
// (patron `await apiFetch(...)` seguido de `await response.json()` en toda
// la app). Un `finally` que abortaba el controller sin condicion cancelaba
// esa lectura incluso en una respuesta 200 exitosa.
test("no aborta la lectura del body tras una respuesta exitosa", async () => {
  const originalFetch = globalThis.fetch;
  let capturedSignal: AbortSignal | undefined;
  globalThis.fetch = async (_input, init) => {
    capturedSignal = init?.signal ?? undefined;
    // Simula que el body tarda en llegar despues de que fetch() ya resolvio
    // (headers ya disponibles, body todavia no) -- el caso real que rompia.
    const stream = new ReadableStream<Uint8Array>({
      async start(streamController) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        streamController.enqueue(new TextEncoder().encode('{"ok":true}'));
        streamController.close();
      },
    });
    return new Response(stream, { status: 200 });
  };

  try {
    const response = await fetchApiWithTimeout(
      "http://api.test/slow-body",
      {},
      10_000,
    );
    assert.equal(capturedSignal?.aborted, false);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("conserva la cancelación explícita del caller", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) =>
    await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });

  const caller = new AbortController();
  try {
    const request = fetchApiWithTimeout(
      "http://api.test/cancel",
      { signal: caller.signal },
      10_000,
    );
    caller.abort();
    await assert.rejects(request, /Abort/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Las rutas de IA ejecutan el agente en linea en fallo de cache: con el
// timeout general de 15s la primera carga de cualquier agente moria abortada.
test("las rutas de IA reciben un timeout largo y el resto el general", () => {
  assert.equal(
    defaultTimeoutFor("/v1/organizations/x/ai/operativa-shopify"),
    300_000,
  );
  assert.equal(defaultTimeoutFor("/v1/organizations/x/ai/plan/week"), 300_000);
  assert.equal(defaultTimeoutFor("/v1/organizations/x/metric-analysis/conversion/explanation?days=30"), 300_000);
  assert.equal(defaultTimeoutFor("/v1/organizations/x/metric-analysis?days=30"), undefined);
  assert.equal(defaultTimeoutFor("/v1/consultant/organizations"), undefined);
});
